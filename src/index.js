import {json,cors} from "./security.js";
import {adminApi} from "./admin.js";
import {handleVless} from "./proxy.js";
import {subscription} from "./subscriptions.js";
export default {
 async fetch(request,env) {
  const url=new URL(request.url);
  if(request.method==="OPTIONS")return cors(request,new Response(null,{status:204}));
  let response;
  if(url.pathname.startsWith("/api/admin/"))response=await adminApi(request,env,url);
  else if(url.pathname.startsWith("/sub/")){
   const uuid=url.pathname.split("/")[2], user=await subscription(env,uuid);
   if(!user)response=new Response("Subscription not found",{status:404});
   else response=new Response(JSON.stringify({outbounds:[{type:"vless",tag:"proxy",server:url.hostname,server_port:443,uuid:user.uuid,transport:{type:"ws",path:"/ws"}}],route:{final:"proxy"}}),{headers:{"content-type":"application/json","cache-control":"no-store"}});
  } else if(url.pathname==="/ws")response=await handleVless(request,env);
  else if(url.pathname==="/health")response=json({ok:true,service:"VolveEdge"});
  else response=new Response("VolveEdge",{headers:{"content-type":"text/plain"}});
  return cors(request,response);
 }
};
