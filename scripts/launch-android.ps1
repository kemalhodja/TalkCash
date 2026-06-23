# TalkCash — Android Studio / emulator'a otomatik build + yukle
# Usage: .\scripts\launch-android.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent
$Mobile = Join-Path $Root "mobile"
$Android = Join-Path $Mobile "android"
$Sdk = "$env:LOCALAPPDATA\Android\Sdk"
$adb = Join-Path $Sdk "platform-tools\adb.exe"
$emu = Join-Path $Sdk "emulator\emulator.exe"
$studio = "C:\Program Files\Android\Android Studio\bin\studio64.exe"

$env:ANDROID_HOME = $Sdk
$env:ANDROID_SDK_ROOT = $Sdk
$env:GRADLE_USER_HOME = Join-Path $env:LOCALAPPDATA "TalkCashGradle"
$env:Path = "$Sdk\platform-tools;$Sdk\emulator;$env:Path"
New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME | Out-Null

# .env — Render prod (emulator + telefon icin)
@(
    "EXPO_PUBLIC_API_URL=https://talkcash-api-prod.onrender.com/api/v1"
    "EXPO_PUBLIC_APP_ENV=development"
    "EXPO_PUBLIC_PRIVACY_URL=https://talkcash-api-prod.onrender.com/privacy"
    "EXPO_PUBLIC_TERMS_URL=https://talkcash-api-prod.onrender.com/terms"
    "EAS_PROJECT_ID=d7cfbb2e-a657-49a6-bfc9-bcfc4e120230"
) | Set-Content (Join-Path $Mobile ".env") -Encoding UTF8

Write-Host "==> TalkCash Android launch" -ForegroundColor Cyan

# Android Studio ac
if (Test-Path $studio) {
    Start-Process -FilePath $studio -ArgumentList $Android
    Write-Host "Android Studio acildi: $Android"
}

# Cihaz / emulator bekle veya baslat
$devices = @()
if (Test-Path $adb) {
    $devices = (& $adb devices | Select-String "device$" | ForEach-Object { $_.Line })
}

if (-not $devices -and (Test-Path $emu)) {
    $avds = & $emu -list-avds 2>$null
    if ($avds) {
        $name = $avds | Select-Object -First 1
        Write-Host "Emulator baslatiliyor: $name"
        Start-Process -FilePath $emu -ArgumentList "-avd", $name -WindowStyle Normal
        for ($i = 0; $i -lt 60; $i++) {
            Start-Sleep -Seconds 3
            $devices = (& $adb devices | Select-String "device$")
            if ($devices) { break }
        }
    } else {
        Write-Host ""
        Write-Host "Emulator yok. Android Studio -> Device Manager -> Create Device" -ForegroundColor Yellow
        Write-Host "Veya USB ile telefon bagla (USB debugging acik)." -ForegroundColor Yellow
    }
}

Set-Location $Mobile

# Metro zaten calisiyorsa --no-bundler
$bundlerFlag = @()
try {
    Invoke-WebRequest "http://localhost:8081/status" -UseBasicParsing -TimeoutSec 2 | Out-Null
    $bundlerFlag = @("--no-bundler")
    Write-Host "Metro zaten calisiyor (8081)"
} catch {
    Write-Host "Metro yok - expo run:android kendi baslatir"
}

Write-Host "==> Gradle build + cihaza yukleme..."
npx expo run:android @bundlerFlag
