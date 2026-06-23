# TalkCash — Docker ile Gradle AAB (EAS yok)
# Usage:
#   mobile/android/app/release.keystore + keystore.properties hazir olmali
#   .\scripts\build-aab-docker.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent
$Image = "talkcash-android-aab"
$Dist = Join-Path $Root "dist"
$Props = Join-Path $Root "mobile\android\keystore.properties"
$Keystore = Join-Path $Root "mobile\android\app\release.keystore"

New-Item -ItemType Directory -Force -Path $Dist | Out-Null

if (-not (Test-Path $Props) -and -not (Test-Path $Keystore)) {
    Write-Host "Keystore gerekli — docs/ANDROID_AAB_GRADLE.md" -ForegroundColor Red
    exit 1
}

Write-Host "==> Docker image ($Image)..." -ForegroundColor Cyan
docker build -t $Image (Join-Path $Root "docker\android-aab")

Write-Host "==> Gradle AAB build..." -ForegroundColor Cyan
docker run --rm `
    -v "${Root}:/app" `
    -v "${Dist}:/dist" `
    -e ANDROID_KEYSTORE_FILE=release.keystore `
    -e EXPO_PUBLIC_API_URL=https://talkcash-api-prod.onrender.com/api/v1 `
    -e EXPO_PUBLIC_APP_ENV=production `
    -e SENTRY_DISABLE_AUTO_UPLOAD=true `
    -e DIST_DIR=/dist `
    $Image bash /app/scripts/build-aab-gradle.sh

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if (-not (Test-Path (Join-Path $Dist "talkcash-prod.aab"))) {
    Write-Host "AAB olusturulamadi." -ForegroundColor Red
    exit 1
}
Write-Host "==> Tamamlandi: $Dist\talkcash-prod.aab" -ForegroundColor Green
