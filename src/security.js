const enc = new TextEncoder();
export function json(data,status=200,headers={}) {
 return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});
}
export function cors(request, response) {
 // Cloudflare WebSocket upgrade responses (101) carry a webSocket endpoint.
 // Re-wrapping them with the standard Response constructor breaks the upgrade.
 if (response.status === 101) return response;
 const origin=request.headers.get("Origin")||"*";
 const h=new Headers(response.headers);
 h.set("access-control-allow-origin",origin);
 h.set("vary","Origin");
 h.set("access-control-allow-methods","GET,POST,DELETE,OPTIONS");
 h.set("access-control-allow-headers","content-type,authorization");
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
}
export async function sha256(value) {
 const digest=await crypto.subtle.digest("SHA-256",enc.encode(value));
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
export function secureEqual(a,b) {
 if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;
 let out=0; for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i); return out===0;
}
export function uuid(){return crypto.randomUUID();}
export function requireAdmin(request,env) {
 const token=(request.headers.get("authorization")||"").replace(/^Bearer\\s+/i,"");
 return !!env.ADMIN_TOKEN && secureEqual(token,env.ADMIN_TOKEN);
}
