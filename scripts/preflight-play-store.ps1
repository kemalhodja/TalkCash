# TalkCash Google Play preflight (Windows)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = Split-Path -Parent $Root
$Fail = 0

function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }
function Bad($msg) { Write-Host "  FAIL $msg" -ForegroundColor Red; $script:Fail++ }
function Warn($msg) { Write-Host "  WARN $msg" -ForegroundColor Yellow }

Write-Host "=== Google Play Preflight ===" -ForegroundColor Cyan

# Assets
$assets = @(
    "docs/PLAY_STORE_LISTING.md",
    "docs/GOOGLE_PLAY_RELEASE.md",
    "docs/GOOGLE_PLAY_DATA_SAFETY.md",
    "docs/GOOGLE_PLAY_SUBSCRIPTIONS.md",
    "docs/PRIVACY.md",
    "docs/TERMS.md",
    "mobile/assets/icon.png",
    "mobile/assets/adaptive-icon.png",
    "mobile/assets/splash.png",
    "mobile/app.json",
    "mobile/eas.json",
    "scripts/submit-play-store.sh"
)
foreach ($rel in $assets) {
    if (Test-Path (Join-Path $Repo $rel)) { Ok $rel } else { Bad "missing $rel" }
}

# Package name
$appJson = Get-Content (Join-Path $Repo "mobile/app.json") -Raw | ConvertFrom-Json
if ($appJson.expo.android.package -eq "io.talkcash.app") {
    Ok "package io.talkcash.app"
} else {
    Bad "android.package must be io.talkcash.app"
}

# Version
$ver = $appJson.expo.version
if ($ver) { Ok "app version $ver" } else { Bad "expo.version missing" }

# Billing permission
$manifest = Get-Content (Join-Path $Repo "mobile/app.json") -Raw
if ($manifest -match "com.android.vending.BILLING") {
    Ok "BILLING permission in app.json"
} else {
    Bad "missing com.android.vending.BILLING"
}

# SKU alignment
$mobileSkus = Select-String -Path (Join-Path $Repo "mobile/services/storeBilling.ts") -Pattern 'talkcash_\w+_monthly' -AllMatches |
    ForEach-Object { $_.Matches.Value } | Sort-Object -Unique
$backendFile = Get-Content (Join-Path $Repo "backend/app/services/billing/google_play.py") -Raw
foreach ($sku in $mobileSkus) {
    if ($backendFile -match [regex]::Escape($sku)) { Ok "SKU $sku synced" }
    else { Bad "SKU $sku missing in backend google_play.py" }
}

# eas.json production
$eas = Get-Content (Join-Path $Repo "mobile/eas.json") -Raw | ConvertFrom-Json
if ($eas.build.production.android.buildType -eq "app-bundle") {
    Ok "production buildType app-bundle"
} else {
    Bad "production must use app-bundle (AAB)"
}
if ($eas.build.production.env.EXPO_PUBLIC_API_URL -match "^https://") {
    Ok "production HTTPS API URL"
} else {
    Bad "production EXPO_PUBLIC_API_URL must be HTTPS"
}
if ($eas.submit.production.android.track) {
    Ok "submit track: $($eas.submit.production.android.track)"
}

# Env tokens
if ($env:EXPO_TOKEN) { Ok "EXPO_TOKEN set" } else { Warn "EXPO_TOKEN not set (required for build/submit)" }
if ($env:EAS_PROJECT_ID) { Ok "EAS_PROJECT_ID set" } else { Warn "EAS_PROJECT_ID not set" }

# Optional API smoke
$apiUrl = $eas.build.production.env.EXPO_PUBLIC_API_URL -replace "/api/v1/?$", ""
try {
    $health = Invoke-RestMethod -Uri "$apiUrl/health" -TimeoutSec 15
    if ($health.status -in @("ok", "degraded")) {
        Ok "production health $($health.status)"
        if ($health.features.micro_savings) { Ok "micro_savings feature flag" }
    } else {
        Warn "production health returned $($health.status)"
    }
} catch {
    Warn "cannot reach production API at $apiUrl (deploy first?)"
}

Write-Host ""
if ($Fail -gt 0) {
    Write-Host "Preflight FAILED ($Fail checks)" -ForegroundColor Red
    exit 1
}
Write-Host "Preflight PASSED - ready for EAS build + Play submit" -ForegroundColor Green
Write-Host "Next: .\scripts\submit-play-store.ps1" -ForegroundColor Cyan
exit 0
