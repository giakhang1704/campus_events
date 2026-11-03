$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$configPath = Join-Path $projectRoot '.env'
if (Test-Path -LiteralPath $configPath) {
  Write-Host '.env already exists; configuration was preserved.'
  exit 0
}
$template = Get-Content -LiteralPath (Join-Path $projectRoot '.env.example') -Raw
$localPassword = [guid]::NewGuid().ToString('N')
$content = $template.Replace('replace-with-your-local-password', $localPassword)
[System.IO.File]::WriteAllText($configPath, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host 'Created .env with a local database password. No existing configuration overwritten.'
