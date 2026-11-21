# VolveEdge VPS Relay

Optional independent VLESS-over-WebSocket/TLS relay. It is a separate endpoint from Cloudflare Workers and is used by sing-box URLTest when `RELAY_URL` is configured.

## Requirements

- A Linux VPS with a public IPv4/IPv6 address
- A DNS A/AAAA record pointing `RELAY_DOMAIN` to that VPS
- Docker Engine and Docker Compose plugin
- A Cloudflare Worker already deployed

## Setup

1. Copy `.env.example` to `.env`.
2. Set `RELAY_DOMAIN` to the VPS hostname.
3. Set `AUTH_URL` to your deployed Worker URL plus `/api/relay/verify`.
4. Generate one random secret of at least 32 characters. Set the exact same value as `RELAY_SHARED_SECRET` in this VPS `.env` and as the Worker secret in Cloudflare.
5. In Cloudflare Worker settings, set `RELAY_URL` to `wss://RELAY_DOMAIN/ws`.
6. Run `docker compose up -d --build`.
7. Check `https://RELAY_DOMAIN/health`; it should return JSON with `ok: true`.
8. Re-download the user's sing-box config. It now contains Cloudflare and VPS outbounds under an automatic URLTest group.

## Security notes

- The relay asks the Worker to validate every VLESS UUID against the live D1 user list. Disabling or deleting a user therefore blocks new relay sessions.
- The relay blocks loopback, private, link-local, multicast, and reserved destination IP ranges, and rejects hostnames if any DNS answer is private/reserved.
- Use a dedicated VPS and keep the shared secret private. Do not expose the relay's internal port 8080 publicly; only Caddy's 80/443 ports should be open.
- This relay supports TCP only. It does not provide UDP, WireGuard, QUIC, or a guarantee against every ISP/network block.
