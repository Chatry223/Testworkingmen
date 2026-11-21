import { json, secureEqual } from "./security.js";

export async function verifyRelay(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!env.RELAY_SHARED_SECRET || !secureEqual(request.headers.get("x-relay-secret") || "", env.RELAY_SHARED_SECRET)) {
    return json({ error: "Unauthorized" }, 401);
  }
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const uuid = String(body?.uuid || "").toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid)) {
    return json({ allowed: false }, 400);
  }
  const user = await env.DB.prepare("SELECT enabled FROM users WHERE uuid = ?").bind(uuid).first();
  return json({ allowed: user?.enabled === 1 });
}
