#!/usr/bin/env bash
set -euo pipefail

if grep -q "REPLACE_WITH_D1_DATABASE_ID" wrangler.toml; then
  echo "Set the real D1 database_id in wrangler.toml before deploying." >&2
  exit 1
fi

npm install --no-audit --no-fund
npx wrangler d1 migrations apply volveedge --remote
npx wrangler deploy
