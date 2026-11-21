import {json,cors} from "./security.js";
import {adminApi} from "./admin.js";
import {handleVless} from "./proxy.js";
import {subscription} from "./subscriptions.js";

export default {
 async fetch(request,env) {
  const url=new URL(request.url);
  if(request.method==="OPTIONS")return cors(request,new Response(null,{status:204}));
  let response;
  if(url.pathname.startsWith("/api/admin/")) response=await adminApi(request,env,url);
  else if(url.pathname.startsWith("/sub/")) {
   const id=decodeURIComponent(url.pathname.slice(5));
   const user=await subscription(env,id);
   if(!user) response=new Response("Subscription not found",{status:404});
   else response=new Response(JSON.stringify({
    log:{level:"warn"},
    outbounds:[{type:"vless",tag:"proxy",server:url.hostname,server_port:443,uuid:user.uuid, tls:{enabled:true,server_name:url.hostname},transport:{type:"ws",path:"/ws",headers:{Host:url.hostname}}}],
    route:{final:"proxy"}
   },null,2),{headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","content-disposition":'attachment; filename="volveedge-sing-box.json"'}});
  } else if(url.pathname==="/ws") response=await handleVless(request,env);
  else if(url.pathname==="/health") response=json({ok:true,service:"VolveEdge",transport:"vless-ws-tls"});
  else if(env.ASSETS) response=await env.ASSETS.fetch(request);
  else response=new Response("VolveEdge assets are not configured",{status:503});
  return cors(request,response);
 }
};
