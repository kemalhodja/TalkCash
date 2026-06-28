# TalkCash — Web önizleme (localhost, Metro API proxy)
$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent
$Mobile = Join-Path $Root "mobile"
$Port = if ($args[0]) { [int]$args[0] } else { 8081 }

foreach ($p in 8081, 8083) {
  if ($p -eq $Port) { continue }
  Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { if ($_ -gt 0) { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }
}

@(
  "EXPO_PUBLIC_API_URL=https://talkcash-api-prod.onrender.com/api/v1"
  "EXPO_PUBLIC_APP_ENV=development"
) | ForEach-Object {
  $k, $v = $_ -split "=", 2
  Set-Item -Path "env:$k" -Value $v
}

Write-Host "==> Expo web http://localhost:$Port (Ctrl+C ile dur)" -ForegroundColor Cyan
Start-Process "cursor" -ArgumentList "--open-url", "vscode://vscode.simple-browser/show?url=http%3A%2F%2Flocalhost%3A$Port" -ErrorAction SilentlyContinue
Set-Location $Mobile
npx expo start --web --port $Port
