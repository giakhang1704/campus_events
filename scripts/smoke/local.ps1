param(
  [string]$BaseUrl = 'http://localhost:4200',
  [ValidateRange(1, 300)][int]$TimeoutSeconds = 60
)
$ErrorActionPreference = 'Stop'
$timer = [System.Diagnostics.Stopwatch]::StartNew()
do {
  try {
    $result = Invoke-RestMethod "$BaseUrl/api/health" -TimeoutSec 4
    if ($result.status -ne 'UP' -or $result.tables -ne 15) { throw 'Backend/schema health check failed' }
    $page = Invoke-WebRequest $BaseUrl -UseBasicParsing -TimeoutSec 4
    if ($page.StatusCode -ne 200) { throw 'Frontend unavailable' }
    Write-Host 'PASS: frontend HTTP 200; API UP; PostgreSQL schema campus has 15 tables.'
    return
  } catch {
    $lastFailure = $_.Exception.Message
  }
  if ($timer.Elapsed.TotalSeconds -ge $TimeoutSeconds) { break }
  Start-Sleep -Seconds 1
} while ($true)
throw "Local stack did not become ready within $TimeoutSeconds seconds. Last failure: $lastFailure"
