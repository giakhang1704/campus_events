$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$configPath = Join-Path $projectRoot '.env'
if (Test-Path -LiteralPath $configPath) {
  $content = Get-Content -LiteralPath $configPath -Raw
  Write-Host '.env already exists; existing settings were preserved.'
} else {
  $template = Get-Content -LiteralPath (Join-Path $projectRoot '.env.example') -Raw
  $localPassword = [guid]::NewGuid().ToString('N')
  $content = $template.Replace('replace-with-your-local-password', $localPassword)
}
if ($content -notmatch '(?m)^ATTENDANCE_TOKEN_KEY=[^\r\n]*[^ \t\r\n][^\r\n]*\r?$') {
  $keyBytes = New-Object byte[] 32
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($keyBytes) } finally { $generator.Dispose() }
  $keySetting = 'ATTENDANCE_TOKEN_KEY=' + [Convert]::ToBase64String($keyBytes)
  if ($content -match '(?m)^ATTENDANCE_TOKEN_KEY=[ \t]*\r?$') {
    $content = [regex]::Replace($content, '(?m)^ATTENDANCE_TOKEN_KEY=[ \t]*\r?$', $keySetting)
  } else {
    $content = $content.TrimEnd() + "`n" + $keySetting + "`n"
  }
  Write-Host 'Generated a private local attendance key; no existing secret was replaced.'
}
[System.IO.File]::WriteAllText($configPath, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host 'Local configuration is ready. Secret values were not printed.'
