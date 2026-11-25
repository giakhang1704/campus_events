# Angular browser checks with intercepted API contract responses. Does not start Docker or use a database.
param([string]$PlaywrightModule)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$artifacts = Join-Path $projectRoot 'frontend/.angular/student-attendance'
$uiProcess = $null
$previousBase = [Environment]::GetEnvironmentVariable('I3_DETAIL_UI_BASE_URL', 'Process')
Push-Location $projectRoot
try {
 if (!(Test-Path 'frontend/node_modules/@angular/cli/bin/ng.js')) { throw 'Run npm ci --prefix frontend first.' }
 if (!$PlaywrightModule -and !(Test-Path 'scripts/smoke/node_modules/playwright')) { throw 'Run npm ci --prefix scripts/smoke first.' }
 if (Get-NetTCPConnection -LocalPort 14206 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 14206 is already in use.' }
 New-Item -ItemType Directory -Force -Path $artifacts | Out-Null
 $env:I3_DETAIL_UI_BASE_URL = 'http://127.0.0.1:14206'
 $uiProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('node_modules/@angular/cli/bin/ng.js','serve','--host','127.0.0.1','--port','14206') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $artifacts 'angular.log') -RedirectStandardError (Join-Path $artifacts 'angular-error.log')
 $ready = $false
 for ($attempt = 0; $attempt -lt 90; $attempt++) {
  $uiProcess.Refresh()
  if ($uiProcess.HasExited) { throw 'Angular exited. See frontend/.angular/student-attendance/angular-error.log.' }
  try { $null = Invoke-WebRequest $env:I3_DETAIL_UI_BASE_URL -UseBasicParsing -TimeoutSec 2; $ready = $true; break } catch { Start-Sleep -Seconds 1 }
 }
 if (!$ready) { throw 'Angular did not become ready. Inspect frontend/.angular/student-attendance/angular.log.' }
 & node scripts/smoke/i3_student_attendance_ui.cjs $PlaywrightModule
 if ($LASTEXITCODE -ne 0) { throw 'Student attendance UI checks failed.' }
 & node scripts/smoke/system_regressions_ui.cjs $PlaywrightModule
 if ($LASTEXITCODE -ne 0) { throw 'System regression UI checks failed.' }
 & node scripts/smoke/startup_ui.cjs $PlaywrightModule
 if ($LASTEXITCODE -ne 0) { throw 'Startup UI checks failed.' }
} finally {
 if ($uiProcess) { $uiProcess.Refresh(); if (!$uiProcess.HasExited) { Stop-Process -Id $uiProcess.Id } }
 [Environment]::SetEnvironmentVariable('I3_DETAIL_UI_BASE_URL', $previousBase, 'Process')
 Pop-Location
}
