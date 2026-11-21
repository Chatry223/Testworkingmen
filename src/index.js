import {json,cors} from "./security.js";
import {adminApi} from "./admin.js";
import {handleVless} from "./proxy.js";
import {subscription} from "./subscriptions.js";
import {verifyRelay} from "./relay-auth.js";

function singBoxConfig(host,user,relayUrl) {
 const outbound=(tag,server,port,path)=>({
  type:"vless",tag,server,server_port:port,uuid:user.uuid,network:"tcp",
  tls:{enabled:true,server_name:server},
  transport:{type:"ws",path,headers:{Host:server}}
 });
 const outbounds=[outbound("cloudflare",host,443,"/ws")];
 let final="cloudflare";
 if(relayUrl){
  let relay;try{relay=new URL(relayUrl);}catch{throw new Error("RELAY_URL must be a valid wss:// URL");}
  if(relay.protocol!=="wss:"||!relay.hostname)throw new Error("RELAY_URL must use wss://");
  outbounds.push(outbound("vps-relay",relay.hostname,relay.port?Number(relay.port):443,relay.pathname||"/ws"));
  outbounds.push({type:"urltest",tag:"auto",outbounds:["cloudflare","vps-relay"],url:"https://www.gstatic.com/generate_204",interval:"2m",tolerance:150,interrupt_exist_connections:true});
  final="auto";
 }
 return {log:{level:"warn"},outbounds,route:{final}};
}

export default {
 async fetch(request,env) {
  const url=new URL(request.url);
  if(request.method==="OPTIONS")return cors(request,new Response(null,{status:204}));
  let response;
  if(url.pathname==="/api/relay/verify")response=await verifyRelay(request,env);
  else if(url.pathname.startsWith("/api/admin/"))response=await adminApi(request,env,url);
  else if(url.pathname.startsWith("/sub/")){
   const id=decodeURIComponent(url.pathname.slice(5));
   const user=await subscription(env,id);
   if(!user)response=new Response("Subscription not found",{status:404});
   else try{if(env.RELAY_URL&&!env.RELAY_SHARED_SECRET)throw new Error("RELAY_SHARED_SECRET is required when RELAY_URL is configured");response=new Response(JSON.stringify(singBoxConfig(url.hostname,user,env.RELAY_URL),null,2),{headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","content-disposition":'attachment; filename="volveedge-sing-box.json"'}});}
   catch(error){response=json({error:error.message},503);}
  }else if(url.pathname==="/ws")response=await handleVless(request,env);
  else if(url.pathname==="/health")response=json({ok:true,service:"VolveEdge",transport:"vless-ws-tls",relayConfigured:!!env.RELAY_URL&&!!env.RELAY_SHARED_SECRET});
  else if(env.ASSETS)response=await env.ASSETS.fetch(request);
  else response=new Response("VolveEdge assets are not configured",{status:503});
  return cors(request,response);
 }
};
