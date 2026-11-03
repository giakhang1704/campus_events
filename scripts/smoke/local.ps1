param([string]$BaseUrl = 'http://localhost:4200')
$ErrorActionPreference = 'Stop'
$result = Invoke-RestMethod "$BaseUrl/api/health"
if ($result.status -ne 'UP' -or $result.tables -ne 15) { throw 'Backend/schema health check failed' }
$page = Invoke-WebRequest $BaseUrl
if ($page.StatusCode -ne 200) { throw 'Frontend unavailable' }
Write-Host 'PASS: frontend HTTP 200; API UP; PostgreSQL schema campus has 15 tables.'
