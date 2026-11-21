export async function listUsers(env) {
 const {results=[]}=await env.DB.prepare("SELECT id,name,uuid,enabled,created_at FROM users ORDER BY created_at DESC").all();
 return results;
}
export async function createUser(env,name) {
 const id=crypto.randomUUID(), uuid=crypto.randomUUID();
 await env.DB.prepare("INSERT INTO users(id,name,uuid) VALUES(?,?,?)").bind(id,name,uuid).run();
 return {id,name,uuid,enabled:1};
}
export async function setUserEnabled(env,id,enabled) {
 const r=await env.DB.prepare("UPDATE users SET enabled=? WHERE id=?").bind(enabled?1:0,id).run();
 return r.meta?.changes>0;
}
export async function deleteUser(env,id) {
 const r=await env.DB.prepare("DELETE FROM users WHERE id=?").bind(id).run();
 return r.meta?.changes>0;
}
export async function subscription(env,uuid) {
 const user=await env.DB.prepare("SELECT name,uuid,enabled FROM users WHERE uuid=?").bind(uuid).first();
 if(!user||!user.enabled)return null;
 return user;
}
