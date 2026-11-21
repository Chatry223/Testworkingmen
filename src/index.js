import {json,cors} from "./security.js";
import {adminApi} from "./admin.js";
import {handleVless} from "./proxy.js";
import {subscription} from "./subscriptions.js";
import {verifyRelay} from "./relay-auth.js";

function singBoxConfig(host, user, relayUrl) {
 const outbounds = [{
  type:"vless",tag:"cloudflare",server:host,server_port:443,uuid:user.uuid,
  tls:{enabled:true,server_name:host},
  transport:{type:"ws",path:"/ws",headers:{Host:host}}
 }];
 let final = "cloudflare";
 if (relayUrl) {
  let relay;
  try { relay = new URL(relayUrl); } catch { throw new Error("RELAY_URL must be a valid wss:// URL"); }
  if (relay.protocol !== "wss:" || !relay.hostname) throw new Error("RELAY_URL must use wss://");
  const port = relay.port ? Number(relay.port) : 443;
  const path = relay.pathname || "/ws";
  outbounds.push({
   type:"vless",tag:"vps-relay",server:relay.hostname,server_port:port,uuid:user.uuid,
   tls:{enabled:true,server_name:relay.hostname},
   transport:{type:"ws",path,headers:{Host:relay.hostname}}
  });
  outbounds.push({
   type:"urltest",tag:"auto",outbounds:["cloudflare","vps-relay"],
   url:"https://www.gstatic.com/generate_204",interval:"2m",tolerance:150,
   interrupt_exist_connections:true
  });
  final = "auto";
 }
 return {
  log:{level:"warn"},
  outbounds,
  route:{final}
 };
}

export default {
 async fetch(request,env) {
  const url=new URL(request.url);
  if(request.method==="OPTIONS")return cors(request,new Response(null,{status:204}));
  let response;
  if(url.pathname==="/api/relay/verify") response=await verifyRelay(request,env);
  else if(url.pathname.startsWith("/api/admin/")) response=await adminApi(request,env,url);
  else if(url.pathname.startsWith("/sub/")) {
   const id=decodeURIComponent(url.pathname.slice(5));
   const user=await subscription(env,id);
   if(!user) response=new Response("Subscription not found",{status:404});
   else {
    try {
     response=new Response(JSON.stringify(singBoxConfig(url.hostname,user,env.RELAY_URL),null,2),{
      headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","content-disposition":'attachment; filename="volveedge-sing-box.json"'}
     });
    } catch(error) { response=json({error:error.message},503); }
   }
  } else if(url.pathname==="/ws") response=await handleVless(request,env);
  else if(url.pathname==="/health") response=json({ok:true,service:"VolveEdge",transport:"vless-ws-tls",relayConfigured:!!env.RELAY_URL});
  else if(env.ASSETS) response=await env.ASSETS.fetch(request);
  else response=new Response("VolveEdge assets are not configured",{status:503});
  return cors(request,response);
 }
};
