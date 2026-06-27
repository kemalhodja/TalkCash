# Telefon + yerel API baglantisi
# Usage: .\scripts\connect-mobile.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent
Set-Location $Root

Write-Host ""
Write-Host "=== TalkCash Telefon Baglantisi ==="
Write-Host ""

# 1) Docker API
try {
    Invoke-WebRequest "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5 | Out-Null
    Write-Host "[OK] Yerel API calisiyor (localhost:8000)"
} catch {
    Write-Host "[!!] API kapali. Calistirin: .\scripts\run-local-api.ps1"
    exit 1
}

# 2) Cloudflare tunnel
& (Join-Path $PSScriptRoot "start-cloudflare-tunnel.ps1")
if ($LASTEXITCODE -ne 0) { exit 1 }

$tunnelBase = (Get-Content (Join-Path $Root ".tunnel-url") -Raw).Trim()
$apiTunnel = "$tunnelBase/api/v1"

# 3) WiFi IP (aynı ag)
$wifiIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -like "*Wi-Fi*" -and $_.IPAddress -notlike "169.*"
} | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "--- ONEMLI ---"
Write-Host "Play Store / production APK icinde API adresi SABIT:"
Write-Host "  https://talkcash-api-prod.fly.dev/api/v1  (calismiyor)"
Write-Host ""
Write-Host ".env degistirmek yuklu production uygulamayi ETKILEMEZ."
Write-Host "Yeni preview APK gerekir (asagidaki komut)."
Write-Host ""

Write-Host "--- Telefonda tarayici testi ---"
Write-Host "Once su linki Chrome'da acin (JSON gormelisiniz):"
Write-Host "  $tunnelBase/health"
Write-Host ""

if ($wifiIp) {
    Write-Host "--- Ayni WiFi (daha stabil, sadece preview APK) ---"
    Write-Host "  http://${wifiIp}:8000/health"
    Write-Host "  API: http://${wifiIp}:8000/api/v1"
    Write-Host ""
}

Write-Host "--- Preview APK build (telefona yukle) ---"
Write-Host "Tunnel URL eas.json preview-tunnel profiline yazildi, build:"
Write-Host "  cd mobile"
Write-Host "  npx eas-cli build --profile preview-tunnel --platform android --non-interactive"
Write-Host ""
Write-Host "WiFi ile (telefon + PC ayni ag):"
Write-Host "  npx eas-cli build --profile preview-local --platform android --non-interactive"
Write-Host ""

$build = Read-Host "Simdi preview-tunnel APK build baslatilsin mi? (e/h)"
if ($build -eq "e" -or $build -eq "E") {
    $easPath = Join-Path $Root "mobile\eas.json"
    $eas = Get-Content $easPath -Raw | ConvertFrom-Json
    $eas.build."preview-tunnel".env.EXPO_PUBLIC_API_URL = $apiTunnel
    $eas | ConvertTo-Json -Depth 10 | Set-Content $easPath
    Set-Location (Join-Path $Root "mobile")
    Write-Host "EAS build baslatiliyor (API: $apiTunnel)..."
    npx.cmd eas-cli build --profile preview-tunnel --platform android --non-interactive
}
