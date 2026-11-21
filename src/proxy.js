import { connect } from "cloudflare:sockets";
import { parseVlessHeader } from "./protocol/vless.js";

function isBlockedDestination(host, port) {
  const value = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (["localhost", "localhost.localdomain"].includes(value) ||
      value.endsWith(".localhost") || value.endsWith(".local") ||
      value.endsWith(".internal") || value.endsWith(".test")) return true;

  const parts = value.split(".");
  if (parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) {
    const [a,b] = parts.map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && (b === 0 || b === 168)) ||
        (a === 198 && (b === 18 || b === 19))) return true;
  }
  if (value.includes(":")) {
    if (value === "::" || value === "::1" || value.startsWith("fc") ||
        value.startsWith("fd") || /^fe[89ab]/.test(value) ||
        value.startsWith("ff") || value.startsWith("::ffff:127.") ||
        value.startsWith("::ffff:10.") || value.startsWith("::ffff:192.168.")) return true;
  }
  // SMTP is blocked by Cloudflare Workers; deny it explicitly with other unsafe service ports.
  if ([25, 135, 137, 138, 139, 445].includes(port)) return true;
  return false;
}

export async function handleVless(request, env) {
  if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response("WebSocket upgrade required", { status: 426 });
  }
  if (!env.DB) return new Response("Database binding is unavailable", { status: 503 });

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.binaryType = "arraybuffer";
  server.accept({ allowHalfOpen: true });

  let upstream;
  let upstreamWriter;
  let authenticated = false;
  let pending = new Uint8Array(0);
  let closed = false;
  let writeQueue = Promise.resolve();

  const close = (code = 1000, reason = "") => {
    if (closed) return;
    closed = true;
    try { server.close(code, reason.slice(0, 120)); } catch {}
    try { upstreamWriter?.releaseLock(); } catch {}
    try { upstream?.close(); } catch {}
  };

  const send = (bytes) => {
    if (!closed && server.readyState === WebSocket.OPEN) server.send(bytes);
  };

  server.addEventListener("message", (event) => {
    writeQueue = writeQueue.then(async () => {
      if (closed) return;
      const chunk = event.data instanceof ArrayBuffer
        ? new Uint8Array(event.data)
        : event.data instanceof Blob
          ? new Uint8Array(await event.data.arrayBuffer())
          : null;
      if (!chunk) throw new Error("Only binary WebSocket frames are supported");

      if (!authenticated) {
        if (pending.length + chunk.length > 8192) throw new Error("VLESS handshake is too large");
        const merged = new Uint8Array(pending.length + chunk.length);
        merged.set(pending);
        merged.set(chunk, pending.length);
        pending = merged;

        const header = parseVlessHeader(pending);
        if (!header) return;
        if (header.version !== 0) throw new Error("Unsupported VLESS version");
        if (isBlockedDestination(header.host, header.port)) throw new Error("Destination is blocked by proxy policy");

        const user = await env.DB.prepare(
          "SELECT uuid, enabled FROM users WHERE uuid = ?"
        ).bind(header.id).first();
        if (!user || user.enabled !== 1) throw new Error("Unauthorized UUID");

        // Cloudflare Workers can only open outbound TCP sockets; it cannot proxy inbound raw TCP here.
        upstream = connect({ hostname: header.host, port: header.port }, { allowHalfOpen: true });
        await upstream.opened;
        upstreamWriter = upstream.writable.getWriter();
        const initialPayload = pending.subarray(header.offset);
        pending = new Uint8Array(0);
        if (initialPayload.length) await upstreamWriter.write(initialPayload);
        authenticated = true;
        send(new Uint8Array([header.version, 0]).buffer);

        const reader = upstream.readable.getReader();
        (async () => {
          try {
            while (!closed) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value?.byteLength) send(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
            }
          } catch {
            close(1011, "Upstream read failed");
          } finally {
            try { reader.releaseLock(); } catch {}
            if (!closed) close(1000, "Upstream closed");
          }
        })();
        return;
      }

      if (upstreamWriter) await upstreamWriter.write(chunk);
    }).catch((error) => close(1008, error?.message || "Proxy error"));
  });

  server.addEventListener("close", () => close());
  server.addEventListener("error", () => close(1011, "WebSocket error"));
  return new Response(null, { status: 101, webSocket: client });
}
