# Browser checks for I3 /attendance (organizer) and /scan (student) against an isolated stack (API 18085, UI 14205).
param([string]$PlaywrightModule)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$project = 'campus-events-i3-ui-test'
$artifacts = Join-Path $projectRoot 'frontend/.angular/i3-ui'
$uiProcess = $null
$stackStarted = $false
$names = @('TEST_DB_PASSWORD','TEST_ACCOUNT_PASSWORD','TEST_QR_KEY','I3_API_PORT','I3_UI_BASE_URL','I3_UI_CHANNEL','I3_UI_TEST_PROJECT')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
Push-Location $projectRoot
try {
 if (!(Test-Path 'frontend/node_modules/@angular/cli/bin/ng.js')) { throw 'Run npm ci --prefix frontend first.' }
 if (!$PlaywrightModule -and !(Test-Path 'scripts/smoke/node_modules/playwright')) { throw 'Run npm ci --prefix scripts/smoke first (browser test dependencies).' }
 foreach ($port in @(18085,14205)) {
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Test port $port is already in use. Stop that test server and retry." }
 }
 New-Item -ItemType Directory -Force -Path $artifacts | Out-Null
 $env:TEST_DB_PASSWORD = [guid]::NewGuid().ToString('N')
 $env:TEST_ACCOUNT_PASSWORD = [guid]::NewGuid().ToString('N')
 $keyBytes = New-Object byte[] 32
 $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
 try { $generator.GetBytes($keyBytes) } finally { $generator.Dispose() }
 $env:TEST_QR_KEY = [Convert]::ToBase64String($keyBytes)
 $env:I3_API_PORT = '18085'
 $env:I3_UI_BASE_URL = 'http://127.0.0.1:14205'
 $env:I3_UI_TEST_PROJECT = $project
 if (!$env:I3_UI_CHANNEL) { $env:I3_UI_CHANNEL = 'msedge' }

 # Only this dedicated project's tmpfs is reset. No .env, seed or volume from localhost is used.
 & docker compose -p $project -f compose.i3-test.yaml down *> (Join-Path $artifacts 'compose-down.log')
 if ($LASTEXITCODE -ne 0) { throw 'Docker is unavailable. Start Docker Desktop and retry.' }
 $stackStarted = $true
 Write-Output 'Starting isolated I3 UI test API (18085) and PostgreSQL; email is disabled...'
 & docker compose -p $project -f compose.i3-test.yaml up --build -d *> (Join-Path $artifacts 'compose.log')
 if ($LASTEXITCODE -ne 0) { throw 'Test backend failed to start. See frontend/.angular/i3-ui/compose.log.' }
 $ready = $false
 for ($attempt = 0; $attempt -lt 150; $attempt++) {
  try { $null = Invoke-WebRequest 'http://127.0.0.1:18085/api/health' -UseBasicParsing -TimeoutSec 2; $ready = $true; break } catch { Start-Sleep -Seconds 1 }
 }
 if (!$ready) { throw 'Test backend did not become ready. Inspect the dedicated compose project.' }

 '{"/api":{"target":"http://127.0.0.1:18085","secure":false}}' | Set-Content -Encoding ascii (Join-Path $artifacts 'proxy.json')
 $uiProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('node_modules/@angular/cli/bin/ng.js','serve','--host','127.0.0.1','--port','14205','--proxy-config','.angular/i3-ui/proxy.json') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $artifacts 'angular.log') -RedirectStandardError (Join-Path $artifacts 'angular-error.log')
 $ready = $false
 for ($attempt = 0; $attempt -lt 90; $attempt++) {
  $uiProcess.Refresh()
  if ($uiProcess.HasExited) { throw 'Angular test server exited. See frontend/.angular/i3-ui/angular-error.log.' }
  try { $null = Invoke-WebRequest $env:I3_UI_BASE_URL -UseBasicParsing -TimeoutSec 2; $ready = $true; break } catch { Start-Sleep -Seconds 1 }
 }
 if (!$ready) { throw 'Angular test server did not become ready. See frontend/.angular/i3-ui/angular.log.' }
 Write-Output 'Checking organizer attendance and student scan in a real browser...'
 & node scripts/smoke/i3_attendance_ui.cjs $PlaywrightModule
 if ($LASTEXITCODE -ne 0) { throw 'Attendance browser tests failed. See frontend/.angular/i3-ui.' }
 & node scripts/smoke/i3_scan_ui.cjs $PlaywrightModule
 if ($LASTEXITCODE -ne 0) { throw 'Scan browser tests failed. See frontend/.angular/i3-ui.' }
} finally {
 if ($uiProcess) { $uiProcess.Refresh(); if (!$uiProcess.HasExited) { Stop-Process -Id $uiProcess.Id } }
 if ($stackStarted) { & docker compose -p $project -f compose.i3-test.yaml down *> (Join-Path $artifacts 'cleanup.log') }
 foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
 Pop-Location
}
