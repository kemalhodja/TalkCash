# TalkCash — P0 doğrulama (PowerShell)
$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent
$Api = if ($env:API_URL) { $env:API_URL } else { "https://talkcash-api-prod.onrender.com" }

Write-Host "==> Health: $Api/health" -ForegroundColor Cyan
$health = Invoke-RestMethod -Uri "$Api/health" -TimeoutSec 45
Write-Host "  status: $($health.status)"
Write-Host "  version: $($health.observability.version)"
Write-Host "  launch_readiness:" -ForegroundColor Yellow
$health.launch_readiness | Format-List

Write-Host "==> Smoke test" -ForegroundColor Cyan
$env:API_URL = $Api
python (Join-Path $Root "scripts\smoke_test.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nP0 verify OK" -ForegroundColor Green
