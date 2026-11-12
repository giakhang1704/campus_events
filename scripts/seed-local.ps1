$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$configPath = Join-Path $projectRoot '.env'
if (!(Test-Path -LiteralPath $configPath)) { throw 'Run scripts/setup-local.ps1 first.' }
$content = Get-Content -LiteralPath $configPath -Raw
if ($content -notmatch '(?m)^DEV_SEED_PASSWORD=') {
 $content = $content.TrimEnd() + "`nDEV_SEED_PASSWORD=" + [guid]::NewGuid().ToString('N') + "`n"
 [System.IO.File]::WriteAllText($configPath,$content,[System.Text.UTF8Encoding]::new($false))
}
Push-Location $projectRoot
try {
 & docker compose -f compose.yaml -f compose.seed.yaml up --build -d backend
 if ($LASTEXITCODE -ne 0) { throw 'Seed-enabled backend could not start.' }
 Write-Host 'Seed enabled for local backend. Check startup logs. Password is only in .env (DEV_SEED_PASSWORD). Existing accounts are not overwritten.'
} finally { Pop-Location }
