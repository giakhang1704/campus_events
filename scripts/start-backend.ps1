$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$configPath = Join-Path $projectRoot '.env'
if (!(Test-Path -LiteralPath $configPath)) { throw 'Create .env from .env.example first.' }
$settings = @{}
foreach ($line in Get-Content -LiteralPath $configPath) {
  if ($line -match '^\s*(POSTGRES_DB|POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_PORT|BACKEND_PORT|MAIL_ENABLED|BREVO_API_KEY|BREVO_SENDER_EMAIL|BREVO_SENDER_NAME)=(.*)$') {
    $settings[$Matches[1]] = $Matches[2]
  }
}
if (!$settings['POSTGRES_PASSWORD']) { throw 'POSTGRES_PASSWORD is required in .env.' }
$dbPort = if ($settings['POSTGRES_PORT']) { $settings['POSTGRES_PORT'] } else { '5432' }
$env:DB_URL = "jdbc:postgresql://localhost:${dbPort}/$($settings['POSTGRES_DB'])?currentSchema=campus"
$env:DB_USER = $settings['POSTGRES_USER']
$env:DB_PASSWORD = $settings['POSTGRES_PASSWORD']
$env:PORT = if ($settings['BACKEND_PORT']) { $settings['BACKEND_PORT'] } else { '8080' }
foreach ($mailKey in @('MAIL_ENABLED','BREVO_API_KEY','BREVO_SENDER_EMAIL','BREVO_SENDER_NAME')) {
  if ($settings.ContainsKey($mailKey)) { [Environment]::SetEnvironmentVariable($mailKey, $settings[$mailKey], 'Process') }
}
Push-Location (Join-Path $projectRoot 'backend')
try {
  # On this Windows host the default AF_UNIX temporary path fails; project-local path was verified.
  $socketDirectory = Join-Path $projectRoot 'backend/target/socket-tmp'
  New-Item -ItemType Directory -Path $socketDirectory -Force | Out-Null
  $jvmArgument = '-Djdk.net.unixdomain.tmpdir="' + $socketDirectory + '"'
  & mvn.cmd "-Dspring-boot.run.jvmArguments=$jvmArgument" spring-boot:run
  if ($LASTEXITCODE -ne 0) { throw 'Backend process failed.' }
}
finally { Pop-Location }
