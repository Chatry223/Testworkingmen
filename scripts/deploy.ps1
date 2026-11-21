$ErrorActionPreference = "Stop"

npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

npm run deploy
if ($LASTEXITCODE -ne 0) { throw "Cloudflare deployment or D1 migration failed" }
