import {json,requireAdmin,uuid} from "./security.js";
import {listUsers,createUser,setUserEnabled,deleteUser} from "./subscriptions.js";
export async function adminApi(request,env,url) {
 if(!requireAdmin(request,env))return json({error:"Unauthorized"},401);
 if(request.method==="GET"&&url.pathname==="/api/admin/users")return json({users:await listUsers(env)});
 if(request.method==="POST"&&url.pathname==="/api/admin/users"){
  const body=await request.json(); const name=String(body.name||"").trim().slice(0,80);
  if(!name)return json({error:"Name is required"},400);
  return json({user:await createUser(env,name)},201);
 }
 const m=url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
 if(m&&request.method==="POST"){const b=await request.json();return json({updated:await setUserEnabled(env,m[1],!!b.enabled)});}
 if(m&&request.method==="DELETE")return json({deleted:await deleteUser(env,m[1])});
 return json({error:"Not found"},404);
}
