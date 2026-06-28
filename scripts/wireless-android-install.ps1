# TalkCash - Wireless ADB pair, connect, build debug APK, install on phone.
# Usage (from repo root):
#   .\scripts\wireless-android-install.ps1 -PairHost 192.168.1.50 -PairPort 37123 -PairCode 123456 -ConnectHost 192.168.1.50 -ConnectPort 38447
# Or interactive:
#   .\scripts\wireless-android-install.ps1
param(
    [string]$PairHost,
    [int]$PairPort = 0,
    [string]$PairCode,
    [string]$ConnectHost,
    [int]$ConnectPort = 0,
    [switch]$SkipBuild,
    [switch]$ProdApi,
    [string]$ApkPath = (Join-Path (Split-Path $PSScriptRoot -Parent) "dist\talkcash-preview.apk")
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Mobile = Join-Path $Root "mobile"
$Adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"

if (-not (Test-Path $Adb)) {
    Write-Error "adb not found. Install Android SDK platform-tools."
}

function Get-LanIp {
    $wifi = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.InterfaceAlias -match "Wi-Fi|WLAN" -and $_.IPAddress -notlike "169.254*" } |
        Select-Object -First 1
    if ($wifi) { return $wifi.IPAddress }
    return "192.168.1.9"
}

function Invoke-Adb([string[]]$CmdArgs) {
    & $Adb @CmdArgs
    if ($LASTEXITCODE -ne 0) { throw "adb failed: adb $($CmdArgs -join ' ')" }
}

Write-Host "==> TalkCash wireless install" -ForegroundColor Cyan
Write-Host "    PC Wi-Fi IP: $(Get-LanIp) (phone must be on same network)"
Write-Host ""

if (-not $PairHost) {
    Write-Host "Telefonda: Ayarlar > Gelistirici secenekleri > Kablosuz hata ayiklama" -ForegroundColor Yellow
    Write-Host "1) 'Eslestirme koduyla cihaz eslestir' -> IP, port ve 6 haneli kod" -ForegroundColor Yellow
    Write-Host "2) Ana ekranda 'IP adresi ve baglanti noktasi' -> connect icin port" -ForegroundColor Yellow
    Write-Host ""
    $PairHost = Read-Host "Eslestirme IP (ornek 192.168.1.50)"
    $PairPort = [int](Read-Host "Eslestirme portu (ornek 37123)")
    $PairCode = Read-Host "Eslestirme kodu (6 hane)"
    $ConnectHost = Read-Host "Baglanti IP (genelde ayni IP)"
    if (-not $ConnectHost) { $ConnectHost = $PairHost }
    $ConnectPort = [int](Read-Host "Baglanti portu (wireless debugging ana ekrandan)")
}

Write-Host "==> Pairing $PairHost`:$PairPort ..."
Invoke-Adb @("pair", "${PairHost}:${PairPort}", $PairCode)

Write-Host "==> Connecting ${ConnectHost}:${ConnectPort} ..."
Invoke-Adb @("connect", "${ConnectHost}:${ConnectPort}")
Start-Sleep -Seconds 2
& $Adb devices -l
$devices = & $Adb devices | Select-String "device$"
if (-not $devices) {
    Write-Error "No device after wireless connect. Check phone is on same Wi-Fi and wireless debugging is on."
}

if ($ProdApi) {
    $apiUrl = "https://talkcash-api-prod.onrender.com/api/v1"
} else {
    $lan = Get-LanIp
    $apiUrl = "http://${lan}:8000/api/v1"
    Write-Host "    LAN API: $apiUrl (backend must run on PC, or use -ProdApi)" -ForegroundColor Yellow
}

$env:EXPO_PUBLIC_API_URL = $apiUrl
$env:EXPO_PUBLIC_APP_ENV = "development"
$env:EXPO_PUBLIC_PRIVACY_URL = "https://talkcash-api-prod.onrender.com/privacy"
$env:EXPO_PUBLIC_TERMS_URL = "https://talkcash-api-prod.onrender.com/terms"

$debugApk = Join-Path $Mobile "android\app\build\outputs\apk\debug\app-debug.apk"

if (-not $SkipBuild) {
    if (-not (Test-Path (Join-Path $Mobile "node_modules"))) {
        Write-Host "==> npm install ..."
        Push-Location $Mobile
        npm install --no-audit --no-fund
        Pop-Location
    }
    Write-Host "==> Building debug APK (first run may take 10-15 min) ..."
    Push-Location (Join-Path $Mobile "android")
    & .\gradlew.bat assembleDebug
    Pop-Location
    $installApk = $debugApk
} else {
    $installApk = $ApkPath
}

if (-not (Test-Path $installApk)) {
    Write-Error "APK not found: $installApk"
}

Write-Host "==> Installing $installApk ..."
Invoke-Adb @("install", "-r", $installApk)

Write-Host ""
Write-Host "Done. Open TalkCash on your phone." -ForegroundColor Green
Write-Host "API: $apiUrl"
