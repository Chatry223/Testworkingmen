# VolveEdge — Cloudflare Worker

VolveEdge is a VLESS over WebSocket + TLS TCP proxy implemented on Cloudflare Workers, with D1 for user accounts and a browser-based admin page.

**Current deployment target: Cloudflare only.** The optional VPS relay is not required. Leave `RELAY_URL` and `RELAY_SHARED_SECRET` unset.

## Deploy

1. Click **Deploy to Cloudflare** at the top of this page and authorize Cloudflare and GitHub.
2. Select your Cloudflare account and confirm the Worker project.
3. Set `ADMIN_TOKEN` to a long random secret (32+ characters). Save it securely; the admin page cannot recover it.
4. Confirm the Worker has a D1 database binding named `DB`. The database should be named `volveedge`.
5. Complete deployment and open `https://YOUR-WORKER.workers.dev/health`. Expect JSON with `ok: true` and `databaseConfigured: true`.

If the deploy flow does not create the D1 database automatically, create one in Cloudflare Dashboard → Storage & databases → D1. Bind it to this Worker with variable name `DB` and database name `volveedge`.

## Initialize the database

From a local clone, run:

```bash
npm install
npx wrangler login
npx wrangler d1 migrations apply DB --remote
```

This applies the SQL migration that creates the required tables. If the migration has already been applied successfully, do not run manual SQL to recreate them.

## Configure the admin secret

In Cloudflare Dashboard → Workers & Pages → your Worker → Settings → Variables and Secrets, add `ADMIN_TOKEN` as a **Secret**. Use the same value entered during deployment. Do not put it in source code or commit it.

## Create users and connect

1. Open `https://YOUR-WORKER.workers.dev/admin.html`.
2. Enter your `ADMIN_TOKEN`.
3. Create a user and copy the generated UUID or subscription URL.
4. Import the subscription JSON into a compatible sing-box client.

The subscription is a complete sing-box configuration, not just an outbound fragment. It includes a local mixed SOCKS/HTTP inbound at `127.0.0.1:2080`, a VLESS/TLS/WebSocket outbound to this Worker, and direct/block outbounds. Start sing-box and configure applications to use the local proxy.

## Endpoints

- `/health` — Worker response and D1 binding status.
- `/admin.html` — browser-based user management.
- `/sub/USER-UUID` — complete sing-box JSON for an enabled user.
- `/ws` — VLESS WebSocket endpoint.

A healthy `/health` response proves only that the Worker responds and has a D1 binding. It does **not** prove a tunnel works. You must test with a real sing-box client from a separate network and confirm TCP traffic passes.

## Local development and deploy

```bash
npm install
npx wrangler d1 migrations apply DB --local
npm test
npm run dev
```

For a production deployment from a trusted local clone, ensure `wrangler.toml` contains the real D1 database ID and `ADMIN_TOKEN` is configured as a Cloudflare secret, then run:

```bash
npm run deploy
```

Never commit `.dev.vars`, `.env`, admin tokens, user UUIDs, or relay secrets.

## Transport scope and limitations

- VLESS over WebSocket + TLS.
- TCP destinations only. UDP, QUIC, WireGuard, and raw TCP ingress are not implemented.
- The Worker accepts WebSocket traffic and opens outbound TCP connections through the Cloudflare Workers sockets API.
- Compatibility and reachability depend on the client, Cloudflare configuration, and network. It is not guaranteed to bypass every ISP or restrictive network.
- The optional VPS relay is separate and is not part of the Cloudflare-only deployment path.
