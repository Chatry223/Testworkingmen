#!/usr/bin/env bash
set -euo pipefail
npm ci
npx wrangler d1 migrations apply volveedge --remote
npx wrangler deploy
