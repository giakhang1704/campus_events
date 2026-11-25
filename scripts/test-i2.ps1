param([string]$PlaywrightModule)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$env:TEST_DB_PASSWORD = [guid]::NewGuid().ToString('N')
$env:TEST_ACCOUNT_PASSWORD = [guid]::NewGuid().ToString('N')
Push-Location $projectRoot
$uiProcess = $null
try {
 & docker compose -p campus-events-i2-test -f compose.i2-test.yaml down
 if ($LASTEXITCODE -ne 0) { throw 'Could not stop isolated I2 test stack.' }
 & docker compose -p campus-events-i2-test -f compose.i2-test.yaml up --build -d
 if ($LASTEXITCODE -ne 0) { throw 'I2 test stack failed to start.' }
 & python scripts/smoke/i2_http.py
 if ($LASTEXITCODE -ne 0) { throw 'I2 tests failed.' }
 if ($PlaywrightModule) {
  # Serve the actual Angular app against the same isolated I2 backend (port 18081).
  New-Item -ItemType Directory -Force frontend/.angular | Out-Null
  '{"/api":{"target":"http://127.0.0.1:18081","secure":false}}' | Set-Content -Encoding ascii frontend/.angular/i2-test-proxy.json
  $uiProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('node_modules/@angular/cli/bin/ng.js','serve','--host','127.0.0.1','--port','14201','--proxy-config','.angular/i2-test-proxy.json') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot 'frontend/.angular/i2-server.log') -RedirectStandardError (Join-Path $projectRoot 'frontend/.angular/i2-server-error.log')
  $env:I2_UI_BASE_URL = 'http://127.0.0.1:14201'
  if (!$env:I2_UI_CHANNEL) { $env:I2_UI_CHANNEL = 'msedge' }
  $uiReady = $false
  for ($attempt=0; $attempt -lt 90; $attempt++) {
   $uiProcess.Refresh()
   if ($uiProcess.HasExited) { throw 'Angular test server exited. See frontend/.angular/i2-server-error.log.' }
   try { $null = Invoke-WebRequest $env:I2_UI_BASE_URL -UseBasicParsing -TimeoutSec 2; $uiReady = $true; break } catch { Start-Sleep -Seconds 1 }
  }
  if (!$uiReady) { throw 'Angular test server did not become ready. See frontend/.angular/i2-server-error.log.' }
  & node scripts/smoke/i2_ui.cjs $PlaywrightModule
  if ($LASTEXITCODE -ne 0) { throw 'I2 browser tests failed.' }
 }
} finally {
 if ($uiProcess -and !$uiProcess.HasExited) { Stop-Process -Id $uiProcess.Id }
 # Keep a failed stack for inspection; its data is ephemeral and isolated.
 Pop-Location
}
