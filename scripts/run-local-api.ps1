# TalkCash API - yerel calistir (Render/Fly gerekmez)
# Docker Desktop acik olmali: https://www.docker.com/products/docker-desktop/
#
# Usage:
#   .\scripts\run-local-api.ps1
#   .\scripts\run-local-api.ps1 -Tunnel   # telefondan erisim icin Cloudflare Tunnel

param(
    [switch]$Tunnel
)

$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent
Set-Location $Root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker bulunamadi. Docker Desktop kurun: https://www.docker.com/products/docker-desktop/"
    exit 1
}

if (-not (Test-Path "backend\.env")) {
    Copy-Item "backend\.env.production.example" "backend\.env"
    $sk = -join ((1..32) | ForEach-Object { "{0:x2}" -f (Get-Random -Maximum 256) })
    (Get-Content "backend\.env") -replace "generate-a-long-random-string", $sk | Set-Content "backend\.env"
    Write-Host "backend\.env olusturuldu (SECRET_KEY otomatik uretildi)"
}

Write-Host "==> Docker Compose baslatiliyor (db + redis + minio + api)..."
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build

Write-Host ""
Write-Host "Yerel API: http://localhost:8000"
Write-Host "Health:    http://localhost:8000/health"
Write-Host "Swagger:   http://localhost:8000/docs"
Write-Host ""

if ($Tunnel) {
    & (Join-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) "start-cloudflare-tunnel.ps1")
    exit $LASTEXITCODE
} else {
    Write-Host "Telefondan test icin (PC acik kalmali):"
    Write-Host "  .\scripts\start-cloudflare-tunnel.ps1"
    Write-Host "  # veya: .\scripts\run-local-api.ps1 -Tunnel"
    Write-Host ""
    Write-Host "Kalici ucretsiz bulut icin Koyeb rehberi:"
    Write-Host "  .\scripts\setup-koyeb-prod.ps1"
}
