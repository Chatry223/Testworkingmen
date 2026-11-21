# VolveEdge

Cloudflare Worker project for managing VLESS-over-WebSocket users and subscription profiles.

## Local setup

```bash
npm install
cp .dev.vars.example .dev.vars
```

Set a long random `ADMIN_TOKEN` in `.dev.vars`. Create the D1 database and copy its ID into `wrangler.toml`:

```bash
npx wrangler d1 create volveedge
npx wrangler d1 migrations apply volveedge --local
npm run dev
```

Deploy after configuring the remote D1 database:

```bash
npx wrangler d1 migrations apply volveedge --remote
npx wrangler secret put ADMIN_TOKEN
npm run deploy
```

- Health endpoint: `/health`
- Admin API: `/api/admin/users` (Bearer token)
- User subscription: `/sub/{uuid}`
- WebSocket endpoint: `/ws`

For GitHub Actions deployment, add repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## Current scope

This is an early implementation. It supports TCP-oriented VLESS/WebSocket only. UDP, WireGuard, QUIC, production hardening, and end-to-end validation with real client software are not included yet. Cloudflare Workers Socket API availability and compatibility must be confirmed for the target account/runtime before deployment.
