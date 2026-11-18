$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$migration = Join-Path $projectRoot 'database/migrations/001_i3_qr_write_guard.sql'
Push-Location $projectRoot
try {
  & docker compose up -d --wait db
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL did not become ready.' }
  $schemaReady = $false
  for ($attempt=0; $attempt -lt 30; $attempt++) {
    $probe = "SELECT to_regprocedure('campus.guard_attendance()') IS NOT NULL;" | & docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -tA -U "$POSTGRES_USER" -d "$POSTGRES_DB"' 2>$null
    if ($LASTEXITCODE -eq 0 -and (($probe -join '').Trim() -eq 't')) { $schemaReady=$true; break }
    Start-Sleep -Seconds 1
  }
  if (!$schemaReady) { throw 'The campus schema is not ready. Initialize the baseline only on an empty database; do not reset existing data.' }
  Get-Content -LiteralPath $migration -Raw | & docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
  if ($LASTEXITCODE -ne 0) { throw 'Local I3 migration failed; inspect the database error above. No volume reset is needed.' }
  Write-Host 'I3 QR write guard updated. Existing event/account/attendance data was preserved.'
} finally { Pop-Location }
