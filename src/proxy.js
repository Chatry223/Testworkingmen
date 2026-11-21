import {parseVlessHeader} from "./protocol/vless.js";
export async function handleVless(request,env) {
 if(request.headers.get("Upgrade")!=="websocket")return new Response("WebSocket required",{status:426});
 const pair=new WebSocketPair(), client=pair[0], server=pair[1]; server.accept();
 let upstream=null, authenticated=false;
 server.addEventListener("message",async event=>{
  try {
   const bytes=event.data instanceof ArrayBuffer?new Uint8Array(event.data):new Uint8Array(await event.data.arrayBuffer());
   if(!authenticated){
    const h=parseVlessHeader(bytes);
    const user=await env.DB.prepare("SELECT uuid,enabled FROM users WHERE uuid=?").bind(h.id).first();
    if(!user||!user.enabled)throw new Error("Unauthorized UUID");
    authenticated=true;
    const socket=connect({hostname:h.host,port:h.port});
    upstream=socket; const writer=socket.writable.getWriter(),reader=socket.readable.getReader();
    await writer.write(bytes.slice(h.offset));
    server.send(new Uint8Array([h.version,0]).buffer);
    (async()=>{try{while(true){const {value,done}=await reader.read();if(done)break;if(value?.length)server.send(value);}}catch{}finally{try{server.close();}catch{}}})();
    server.addEventListener("message",e=>{if(authenticated&&upstream){const w=upstream.writable.getWriter();w.write(e.data).finally(()=>w.releaseLock());}});
   } else if(upstream){const w=upstream.writable.getWriter();await w.write(bytes);w.releaseLock();}
  } catch(e){try{server.send(JSON.stringify({error:e.message}));server.close(1008,"Proxy error");}catch{}}
 });
 server.addEventListener("close",()=>{try{upstream?.close();}catch{}});
 return new Response(null,{status:101,webSocket:client});
}
