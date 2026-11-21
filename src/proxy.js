import { connect } from "cloudflare:sockets";
import { parseVlessHeader } from "./protocol/vless.js";
import { isBlockedIp, isBlockedDestination } from "./ip-policy.js";

async function resolvePublic(host) {
  if(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)||host.includes(":")){
    if(isBlockedIp(host))throw new Error("Private or reserved destination is blocked");
    return host;
  }
  const answers=[];
  for(const type of ["A","AAAA"]){
    const endpoint=new URL("https://cloudflare-dns.com/dns-query");
    endpoint.searchParams.set("name",host);
    endpoint.searchParams.set("type",type);
    const response=await fetch(endpoint,{headers:{accept:"application/dns-json"},signal:AbortSignal.timeout(4000)});
    if(!response.ok)throw new Error("Destination DNS lookup failed");
    const data=await response.json();
    for(const record of data.Answer||[]){
      if(record.type===(type==="A"?1:28)&&record.data)answers.push(record.data);
    }
  }
  if(!answers.length)throw new Error("Destination hostname did not resolve");
  if(answers.some(isBlockedIp))throw new Error("Private or reserved DNS destination is blocked");
  return answers[0];
}

export async function handleVless(request,env) {
  if(request.method!=="GET"||request.headers.get("Upgrade")?.toLowerCase()!=="websocket")
    return new Response("WebSocket upgrade required",{status:426});
  if(!env.DB)return new Response("Database binding is unavailable",{status:503});
  const pair=new WebSocketPair(),client=pair[0],server=pair[1];
  server.binaryType="arraybuffer";server.accept({allowHalfOpen:true});
  let upstream,upstreamWriter,authenticated=false,pending=new Uint8Array(0),closed=false,writeQueue=Promise.resolve();
  const close=(code=1000,reason="")=>{
    if(closed)return;closed=true;
    try{server.close(code,reason.slice(0,120));}catch{}
    try{upstreamWriter?.releaseLock();}catch{}
    try{upstream?.close();}catch{}
  };
  const send=bytes=>{if(!closed&&server.readyState===WebSocket.OPEN)server.send(bytes);};
  server.addEventListener("message",event=>{
    writeQueue=writeQueue.then(async()=>{
      if(closed)return;
      const chunk=event.data instanceof ArrayBuffer?new Uint8Array(event.data):
        event.data instanceof Blob?new Uint8Array(await event.data.arrayBuffer()):null;
      if(!chunk)throw new Error("Only binary WebSocket frames are supported");
      if(!authenticated){
        if(pending.length+chunk.length>8192)throw new Error("VLESS handshake is too large");
        const merged=new Uint8Array(pending.length+chunk.length);merged.set(pending);merged.set(chunk,pending.length);pending=merged;
        const header=parseVlessHeader(pending);if(!header)return;
        if(header.version!==0)throw new Error("Unsupported VLESS version");
        if(isBlockedDestination(header.host,header.port))throw new Error("Destination is blocked by proxy policy");
        const user=await env.DB.prepare("SELECT uuid,enabled FROM users WHERE uuid=?").bind(header.id).first();
        if(!user||user.enabled!==1)throw new Error("Unauthorized UUID");
        const target=await resolvePublic(header.host);
        upstream=connect({hostname:target,port:header.port},{allowHalfOpen:true});
        await upstream.opened;upstreamWriter=upstream.writable.getWriter();
        const initialPayload=pending.subarray(header.offset);pending=new Uint8Array(0);
        if(initialPayload.length)await upstreamWriter.write(initialPayload);
        authenticated=true;send(new Uint8Array([header.version,0]).buffer);
        const reader=upstream.readable.getReader();
        (async()=>{
          try{while(!closed){const {value,done}=await reader.read();if(done)break;if(value?.byteLength)send(value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength));}}
          catch{close(1011,"Upstream read failed");}
          finally{try{reader.releaseLock();}catch{}if(!closed)close(1000,"Upstream closed");}
        })();
        return;
      }
      if(upstreamWriter)await upstreamWriter.write(chunk);
    }).catch(error=>close(1008,error?.message||"Proxy error"));
  });
  server.addEventListener("close",()=>close());
  server.addEventListener("error",()=>close(1011,"WebSocket error"));
  return new Response(null,{status:101,webSocket:client});
}
