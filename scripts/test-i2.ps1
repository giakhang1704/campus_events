param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$env:TEST_DB_PASSWORD = [guid]::NewGuid().ToString('N')
$env:TEST_ACCOUNT_PASSWORD = [guid]::NewGuid().ToString('N')
Push-Location $projectRoot
try {
 & docker compose -p campus-events-i2-test -f compose.i2-test.yaml down
 if ($LASTEXITCODE -ne 0) { throw 'Could not stop isolated I2 test stack.' }
 & docker compose -p campus-events-i2-test -f compose.i2-test.yaml up --build -d
 if ($LASTEXITCODE -ne 0) { throw 'I2 test stack failed to start.' }
 & python scripts/smoke/i2_http.py
 if ($LASTEXITCODE -ne 0) { throw 'I2 tests failed.' }
} finally { Pop-Location }
