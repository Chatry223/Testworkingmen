$ErrorActionPreference = "Stop"
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
npx wrangler d1 migrations apply volveedge --remote
if ($LASTEXITCODE -ne 0) { throw "D1 migration failed" }
npx wrangler deploy
if ($LASTEXITCODE -ne 0) { throw "Worker deploy failed" }
