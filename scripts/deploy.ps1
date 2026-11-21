$ErrorActionPreference = "Stop"

$config = Get-Content "wrangler.toml" -Raw
if ($config.Contains("REPLACE_WITH_D1_DATABASE_ID")) {
  throw "Set the real D1 database_id in wrangler.toml before deploying."
}

npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

npx wrangler d1 migrations apply volveedge --remote
if ($LASTEXITCODE -ne 0) { throw "D1 migration failed" }

npx wrangler deploy
if ($LASTEXITCODE -ne 0) { throw "Worker deploy failed" }
