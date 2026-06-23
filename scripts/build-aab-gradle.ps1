# TalkCash — Gradle ile production AAB (EAS yok)
# Usage:
#   mobile/android/app/release.keystore + keystore.properties kurulu ise:
#   .\scripts\build-aab-gradle.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent
$Mobile = Join-Path $Root "mobile"
$Android = Join-Path $Mobile "android"
$Dist = Join-Path $Root "dist"
$Props = Join-Path $Android "keystore.properties"
$Keystore = Join-Path $Android "app\release.keystore"

New-Item -ItemType Directory -Force -Path $Dist | Out-Null

$Sdk = "$env:LOCALAPPDATA\Android\Sdk"
if (Test-Path $Sdk) {
    $env:ANDROID_HOME = $Sdk
    $env:ANDROID_SDK_ROOT = $Sdk
}
$env:GRADLE_USER_HOME = Join-Path $env:LOCALAPPDATA "TalkCashGradle"
$env:EXPO_PUBLIC_API_URL = "https://talkcash-api-prod.onrender.com/api/v1"
$env:EXPO_PUBLIC_APP_ENV = "production"
$env:SENTRY_DISABLE_AUTO_UPLOAD = "true"

if (-not (Test-Path $Props) -and -not (Test-Path $Keystore)) {
    Write-Host "Keystore gerekli. docs/ANDROID_AAB_GRADLE.md dosyasina bakin." -ForegroundColor Red
    exit 1
}

Set-Location $Mobile
if (-not (Test-Path "node_modules")) { npm ci }

Set-Location $Android
.\gradlew.bat bundleRelease --no-daemon -x lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$src = Join-Path $Android "app\build\outputs\bundle\release\app-release.aab"
$dst = Join-Path $Dist "talkcash-prod.aab"
Copy-Item $src $dst -Force
Write-Host "AAB: $dst" -ForegroundColor Green
