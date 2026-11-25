param(
  [ValidateSet('Start','Preview','Confirm','Report','Export','Close','Refresh','ManualPresent','ManualClear','History','Stop')]
  [string]$Action = 'Start',
  [ValidateSet('registered','waiting')]
  [string]$Student = 'registered',
  [string]$Reason = '',
  [ValidateRange(1,30)]
  [int]$DurationMinutes = 10
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$demoDirectory = Join-Path $projectRoot 'backend/target/i3-demo'
$configPath = Join-Path $demoDirectory 'config.json'
$variableNames = @('TEST_DB_PASSWORD','TEST_ACCOUNT_PASSWORD','TEST_QR_KEY','I3_API_PORT')
$previousValues = @{}
foreach ($name in $variableNames) { $previousValues[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
Push-Location $projectRoot
try {
  if (!(Test-Path -LiteralPath $configPath)) {
    if ($Action -notin @('Start','Stop')) { throw 'Run ./scripts/demo-i3.ps1 -Action Start first.' }
    if ($Action -eq 'Start') {
      New-Item -ItemType Directory -Path $demoDirectory -Force | Out-Null
      $bytes = New-Object byte[] 32
      $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
      try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
      $config = @{ dbPassword=[guid]::NewGuid().ToString('N'); accountPassword=[guid]::NewGuid().ToString('N'); qrKey=[Convert]::ToBase64String($bytes) }
      [System.IO.File]::WriteAllText($configPath,($config | ConvertTo-Json),[System.Text.UTF8Encoding]::new($false))
    }
  }
  if (Test-Path -LiteralPath $configPath) {
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    $env:TEST_DB_PASSWORD = $config.dbPassword
    $env:TEST_ACCOUNT_PASSWORD = $config.accountPassword
    $env:TEST_QR_KEY = $config.qrKey
  } else {
    # Compose validates interpolation even for down; these values are never used to start services.
    $env:TEST_DB_PASSWORD='unused-for-stop'; $env:TEST_ACCOUNT_PASSWORD='unused-for-stop'; $env:TEST_QR_KEY='unused-for-stop'
  }
  $env:I3_API_PORT = '18083'
  if ($Action -eq 'Stop') {
    & docker compose -p campus-events-i3-demo -f compose.i3-test.yaml down
    if ($LASTEXITCODE -ne 0) { throw 'Could not stop the private I3 demo stack.' }
    Write-Host 'Stopped I3 demo. The normal localhost stack and volume were preserved.'
    return
  }
  if ($Action -eq 'Start') {
    Write-Host 'Starting private I3 demo on port 18083; normal local data is preserved.'
    $startLog = Join-Path $demoDirectory 'start.log'
    Write-Host "First build may take a few minutes. Log: $startLog"
    & docker compose -p campus-events-i3-demo -f compose.i3-test.yaml up --build -d *> $startLog
    if ($LASTEXITCODE -ne 0) { throw "Demo startup failed. See $startLog" }
  }
  if ($Action -in @('ManualPresent','ManualClear') -and [string]::IsNullOrWhiteSpace($Reason)) { throw 'Manual attendance changes require -Reason.' }
  & python scripts/smoke/i3_manual.py --action $Action --student $Student --reason=$Reason --duration-minutes $DurationMinutes
  if ($LASTEXITCODE -ne 0) { throw 'Demo action did not succeed; see the API message above.' }
} finally {
  foreach ($name in $variableNames) { [Environment]::SetEnvironmentVariable($name,$previousValues[$name],'Process') }
  Pop-Location
}
