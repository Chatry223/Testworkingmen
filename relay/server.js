import http from "node:http";
import net from "node:net";
import dns from "node:dns/promises";
import { WebSocketServer, WebSocket } from "ws";

const PORT = Number(process.env.PORT || 8080);
const AUTH_URL = process.env.AUTH_URL;
const RELAY_SHARED_SECRET = process.env.RELAY_SHARED_SECRET;
const WS_PATH = process.env.WS_PATH || "/ws";
if (!AUTH_URL || !RELAY_SHARED_SECRET || RELAY_SHARED_SECRET.length < 32) {
  throw new Error("Set AUTH_URL and a 32+ character RELAY_SHARED_SECRET");
}

function uuidFrom(bytes) {
 const h=Buffer.from(bytes).toString("hex");
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
function parseHeader(b) {
 if(b.length<18)return null;
 const version=b[0], uuid=uuidFrom(b.subarray(1,17)), opt=b[17], ci=18+opt;
 if(b.length<=ci)return null;
 if(b[ci]!==1)throw new Error("Only TCP VLESS is supported");
 const pi=ci+1;if(b.length<pi+3)return null;
 const port=b.readUInt16BE(pi);if(!port)throw new Error("Invalid port");
 const at=b[pi+2];let off=pi+3,host;
 if(at===1){if(b.length<off+4)return null;host=[...b.subarray(off,off+4)].join(".");off+=4;}
 else if(at===2){if(b.length<off+1)return null;const n=b[off++];if(!n||b.length<off+n)return null;host=b.subarray(off,off+n).toString("utf8");off+=n;if(!/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(host))throw new Error("Invalid hostname");}
 else if(at===3){if(b.length<off+16)return null;const w=[];for(let i=0;i<16;i+=2)w.push(b.readUInt16BE(off+i).toString(16));host=w.join(":");off+=16;}
 else throw new Error("Unsupported address type");
 return {version,uuid,host,port,offset:off};
}
function isPrivate(ip) {
 if(net.isIP(ip)===4){const [a,b,c]=ip.split(".").map(Number);return a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===0||b===2||b===168||b===88&&c===99))||(a===198&&(b===18||b===19||b===51&&c===100))||(a===203&&b===0&&c===113);}
 if(net.isIP(ip)===6){const s=ip.toLowerCase();return s==="::"||s==="::1"||s.startsWith("fc")||s.startsWith("fd")||/^fe[89ab]/.test(s)||s.startsWith("ff")||s.startsWith("::ffff:")||s.startsWith("2001:db8:")||s.startsWith("2001:10:")||s.startsWith("2002:");}
 return true;
}
async function resolvePublic(host) {
 if(net.isIP(host)) { if(isPrivate(host))throw new Error("Private destination blocked"); return host; }
 const records=await dns.lookup(host,{all:true,verbatim:true});
 if(!records.length||records.some(r=>isPrivate(r.address)))throw new Error("Destination resolves to a private or reserved address");
 return records[0].address;
}
async function authenticate(uuid) {
 const response=await fetch(AUTH_URL,{method:"POST",headers:{"content-type":"application/json","x-relay-secret":RELAY_SHARED_SECRET},body:JSON.stringify({uuid}),signal:AbortSignal.timeout(5000)});
 if(!response.ok)return false;
 const data=await response.json();return data.allowed===true;
}
const server=http.createServer((req,res)=>{
 if(req.url==="/health"){res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});res.end(JSON.stringify({ok:true,service:"VolveEdge VPS Relay"}));return;}
 res.writeHead(404);res.end("Not found");
});
const wss=new WebSocketServer({noServer:true,maxPayload:1024*1024,perMessageDeflate:false});
server.on("upgrade",(req,socket,head)=>{
 if(req.url!==WS_PATH){socket.destroy();return;}
 wss.handleUpgrade(req,socket,head,ws=>wss.emit("connection",ws,req));
});
wss.on("connection",ws=>{
 let pending=Buffer.alloc(0), upstream=null, ready=false, ended=false;
 const cleanup=()=>{if(ended)return;ended=true;try{upstream?.destroy();}catch{};if(ws.readyState===WebSocket.OPEN)ws.close();};
 let messageQueue=Promise.resolve();
 ws.on("message",(raw,isBinary)=>{
  messageQueue=messageQueue.then(async()=>{
  try{
   if(!isBinary)throw new Error("Binary frames required");
   const chunk=Buffer.from(raw);
   if(!ready){
    if(pending.length+chunk.length>8192)throw new Error("Handshake too large");
    pending=Buffer.concat([pending,chunk]);
    const h=parseHeader(pending);if(!h)return;
    if(h.version!==0)throw new Error("Unsupported VLESS version");
    if(!await authenticate(h.uuid))throw new Error("Unauthorized UUID");
    const ip=await resolvePublic(h.host);
    upstream=net.createConnection({host:ip,port:h.port});
    await new Promise((resolve,reject)=>{upstream.once("connect",resolve);upstream.once("error",reject);});
    upstream.on("data",data=>{if(ws.readyState===WebSocket.OPEN)ws.send(data,{binary:true});});
    upstream.on("end",()=>{if(ws.readyState===WebSocket.OPEN)ws.close(1000,"Upstream ended");});
    upstream.on("error",cleanup);
    ws.send(Buffer.from([h.version,0]),{binary:true});
    const payload=pending.subarray(h.offset);pending=Buffer.alloc(0);ready=true;
    if(payload.length)upstream.write(payload);
    return;
   }
   if(upstream&&!upstream.destroyed)upstream.write(chunk);
  }catch{cleanup();}
  });
 });
 ws.on("close",()=>{if(!ended){ended=true;upstream?.destroy();}});
 ws.on("error",cleanup);
});
server.listen(PORT,"0.0.0.0",()=>console.log(`VolveEdge relay listening on ${PORT}`));
