# Build production AAB and submit to Google Play (internal track)
param(
    [switch]$BuildOnly,
    [switch]$SubmitOnly
)

$ErrorActionPreference = "Stop"
$ScriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptsDir
$Mobile = Join-Path $Root "mobile"

if (-not $env:EXPO_TOKEN) {
    $whoami = npx --yes eas-cli whoami 2>$null
    if (-not $whoami) {
        Write-Host "Authenticate: eas login  OR  `$env:EXPO_TOKEN = '...'" -ForegroundColor Red
        exit 1
    }
}

if (-not $env:EAS_PROJECT_ID) {
    Write-Host "Set EAS_PROJECT_ID (Expo project UUID)" -ForegroundColor Red
    exit 1
}
if ($env:EAS_PROJECT_ID -eq "00000000-0000-0000-0000-000000000000") {
    Write-Host "EAS_PROJECT_ID cannot be placeholder UUID" -ForegroundColor Red
    exit 1
}

Push-Location $Mobile
try {
    if (-not $SubmitOnly) {
        Write-Host "==> Production Android build (AAB)..." -ForegroundColor Cyan
        npx --yes eas-cli build --profile production --platform android --non-interactive --wait
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }

    if (-not $BuildOnly) {
        Write-Host "==> Submit to Play Console (internal track)..." -ForegroundColor Cyan
        npx --yes eas-cli submit --profile production --platform android --latest --non-interactive
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        Write-Host "Done. Play Console -> Internal testing" -ForegroundColor Green
    } else {
        Write-Host "Build complete (SubmitOnly skipped)." -ForegroundColor Green
    }
} finally {
    Pop-Location
}
