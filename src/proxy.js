import {connect} from "cloudflare:sockets";
import {parseVlessHeader} from "./protocol/vless.js";

export async function handleVless(request,env) {
 if(request.method!=="GET"||request.headers.get("Upgrade")?.toLowerCase()!=="websocket")
  return new Response("WebSocket upgrade required",{status:426});
 const pair=new WebSocketPair(), client=pair[0], server=pair[1];
 server.accept();
 let upstream=null, authenticated=false, pending=new Uint8Array(0), writer=null;
 const close=(code=1000,reason="")=>{try{server.close(code,reason);}catch{}try{upstream?.close();}catch{}};
 server.addEventListener("message",async event=>{
  try {
   const chunk=event.data instanceof ArrayBuffer?new Uint8Array(event.data):new Uint8Array(await event.data.arrayBuffer());
   if(!authenticated){
    const merged=new Uint8Array(pending.length+chunk.length);merged.set(pending);merged.set(chunk,pending.length);pending=merged;
    let header;
    try{header=parseVlessHeader(pending);}catch(e){if(e.message==="Incomplete VLESS header")return;throw e;}
    if(header.version!==0)throw new Error("Unsupported VLESS version");
    const user=await env.DB.prepare("SELECT uuid,enabled FROM users WHERE uuid=?").bind(header.id).first();
    if(!user||!user.enabled)throw new Error("Unauthorized UUID");
    if(!header.host||!Number.isInteger(header.port)||header.port<1||header.port>65535)throw new Error("Invalid destination");
    authenticated=true;
    upstream=connect({hostname:header.host,port:header.port},{secureTransport:"off",allowHalfOpen:false});
    writer=upstream.writable.getWriter();
    const initial=pending.slice(header.offset);pending=new Uint8Array(0);
    if(initial.length)await writer.write(initial);
    server.send(new Uint8Array([header.version,0]).buffer);
    (async()=>{const reader=upstream.readable.getReader();try{while(true){const {value,done}=await reader.read();if(done)break;if(value?.length)server.send(value);}}catch{}finally{try{reader.releaseLock();}catch{}close();}})();
   } else if(writer) await writer.write(chunk);
  } catch(e){close(1008,e.message||"Proxy error");}
 });
 server.addEventListener("close",()=>close());
 server.addEventListener("error",()=>close(1011,"WebSocket error"));
 return new Response(null,{status:101,webSocket:client});
}
