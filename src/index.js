import {json,cors} from "./security.js";
import {adminApi} from "./admin.js";
import {handleVless} from "./proxy.js";
import {subscription} from "./subscriptions.js";
import {verifyRelay} from "./relay-auth.js";
import {singBoxConfig} from "./singbox.js";

export default {
 async fetch(request,env) {
  const url=new URL(request.url);
  if(request.method==="OPTIONS")return cors(request,new Response(null,{status:204}));
  let response;
  if(url.pathname==="/api/relay/verify")response=await verifyRelay(request,env);
  else if(url.pathname.startsWith("/api/admin/"))response=await adminApi(request,env,url);
  else if(url.pathname.startsWith("/sub/")){
   let id;
   try{id=decodeURIComponent(url.pathname.slice(5));}catch{response=new Response("Invalid subscription identifier",{status:400});}
   if(id){
    const user=await subscription(env,id);
    if(!user)response=new Response("Subscription not found",{status:404});
    else try{if(env.RELAY_URL&&!env.RELAY_SHARED_SECRET)throw new Error("RELAY_SHARED_SECRET is required when RELAY_URL is configured");response=new Response(JSON.stringify(singBoxConfig(url.hostname,user,env.RELAY_URL),null,2),{headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","content-disposition":'attachment; filename="volveedge-sing-box.json"'}});}
    catch(error){response=json({error:error.message},503);}
   }
  }else if(url.pathname==="/ws")response=await handleVless(request,env);
  else if(url.pathname==="/health")response=json({ok:true,service:"VolveEdge",transport:"vless-ws-tls",databaseConfigured:!!env.DB,relayConfigured:!!env.RELAY_URL&&!!env.RELAY_SHARED_SECRET});
  else if(env.ASSETS)response=await env.ASSETS.fetch(request);
  else response=new Response("VolveEdge assets are not configured",{status:503});
  return cors(request,response);
 }
};
