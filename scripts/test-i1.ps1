param([string]$PlaywrightModule)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$env:TEST_DB_PASSWORD = [guid]::NewGuid().ToString('N')
$env:TEST_ACCOUNT_PASSWORD = [guid]::NewGuid().ToString('N')
Push-Location $projectRoot
$uiProcess = $null
try {
 # Dedicated project, private database in tmpfs; never uses the development volume.
 & docker compose -p campus-events-i1-test -f compose.i1-test.yaml down
 if ($LASTEXITCODE -ne 0) { throw 'Could not stop the dedicated test project.' }
 & docker compose -p campus-events-i1-test -f compose.i1-test.yaml up --build -d
 if ($LASTEXITCODE -ne 0) { throw 'Test stack failed to start.' }
 & python scripts/smoke/i1_http.py
 if ($LASTEXITCODE -ne 0) { throw 'I1 integration tests failed.' }
 if ($PlaywrightModule) {
  # Serve the actual Angular app against the same isolated test backend.
  New-Item -ItemType Directory -Force frontend/.angular | Out-Null
  '{"/api":{"target":"http://127.0.0.1:18080","secure":false}}' | Set-Content -Encoding ascii frontend/.angular/i1-test-proxy.json
  $uiProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('node_modules/@angular/cli/bin/ng.js','serve','--host','127.0.0.1','--port','14200','--proxy-config','.angular/i1-test-proxy.json') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot 'frontend/.angular/i1-server.log') -RedirectStandardError (Join-Path $projectRoot 'frontend/.angular/i1-server-error.log')
  $env:I1_UI_BASE_URL = 'http://127.0.0.1:14200'
  $uiReady = $false
  for ($attempt=0; $attempt -lt 90; $attempt++) {
   $uiProcess.Refresh()
   if ($uiProcess.HasExited) { throw 'Angular test server exited. See frontend/.angular/i1-server-error.log.' }
   try { $null = Invoke-WebRequest $env:I1_UI_BASE_URL -UseBasicParsing -TimeoutSec 2; $uiReady = $true; break } catch { Start-Sleep -Seconds 1 }
  }
  if (!$uiReady) { throw 'Angular test server did not become ready. See frontend/.angular/i1-server-error.log.' }
  # The concurrency test may lock either Admin; use the one still ACTIVE.
  $env:I1_UI_ADMIN_EMAIL = (& docker compose -p campus-events-i1-test -f compose.i1-test.yaml exec -T db psql -U campus_test -d campus_i1_test -tAc "SELECT email FROM campus.users WHERE role='ADMIN' AND status='ACTIVE' ORDER BY id LIMIT 1").Trim()
  & node scripts/smoke/i1_ui.cjs $PlaywrightModule
  if ($LASTEXITCODE -ne 0) { throw 'I1 browser tests failed.' }
 }
} finally {
 if ($uiProcess -and !$uiProcess.HasExited) { Stop-Process -Id $uiProcess.Id }
 # Keep failed stack available for inspection. Its data is ephemeral and isolated.
 Pop-Location
}
