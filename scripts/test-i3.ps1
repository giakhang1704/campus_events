param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$env:TEST_DB_PASSWORD = [guid]::NewGuid().ToString('N')
$env:TEST_ACCOUNT_PASSWORD = [guid]::NewGuid().ToString('N')
$keyBytes = New-Object byte[] 32
$generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $generator.GetBytes($keyBytes) } finally { $generator.Dispose() }
$env:TEST_QR_KEY = [Convert]::ToBase64String($keyBytes)
$previousI3Port = [Environment]::GetEnvironmentVariable('I3_API_PORT','Process')
$env:I3_API_PORT = '18082'
Push-Location $projectRoot
try {
 & docker compose -p campus-events-i3-test -f compose.i3-test.yaml down
 if ($LASTEXITCODE -ne 0) { throw 'Could not stop isolated I3 test stack.' }
 & docker compose -p campus-events-i3-test -f compose.i3-test.yaml up --build -d
 if ($LASTEXITCODE -ne 0) { throw 'I3 test stack failed to start.' }
 & python scripts/smoke/i3_http.py
 if ($LASTEXITCODE -ne 0) { throw 'I3 tests failed.' }
} finally {
 [Environment]::SetEnvironmentVariable('I3_API_PORT',$previousI3Port,'Process')
 Pop-Location
}
