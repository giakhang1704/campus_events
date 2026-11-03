$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$env:TEST_DB_PASSWORD = [guid]::NewGuid().ToString('N')
$env:TEST_ACCOUNT_PASSWORD = [guid]::NewGuid().ToString('N')
Push-Location $projectRoot
try {
 # Dedicated project, private database in tmpfs; never uses the development volume.
 & docker compose -p campus-events-i1-test -f compose.i1-test.yaml down
 if ($LASTEXITCODE -ne 0) { throw 'Could not stop the dedicated test project.' }
 & docker compose -p campus-events-i1-test -f compose.i1-test.yaml up --build -d
 if ($LASTEXITCODE -ne 0) { throw 'Test stack failed to start.' }
 & python scripts/smoke/i1_http.py
 if ($LASTEXITCODE -ne 0) { throw 'I1 integration tests failed.' }
} finally {
 # Keep failed stack available for inspection. Its data is ephemeral and isolated.
 Pop-Location
}
