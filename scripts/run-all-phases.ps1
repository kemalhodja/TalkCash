# TalkCash — unattended full release phases (no prompts)
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\run-all-phases.ps1

param(
    [switch]$SkipBuild,
    [switch]$SkipTunnel
)

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$StatusFile = Join-Path $Root "DEPLOY_STATUS.json"
$Log = @()

function Log-Phase([string]$Phase, [string]$Status, [string]$Detail = "") {
    $entry = @{ phase = $Phase; status = $Status; detail = $Detail; at = (Get-Date -Format "o") }
    $script:Log += $entry
    $color = switch ($Status) { "ok" { "Green" } "warn" { "Yellow" } default { "Red" } }
    Write-Host "[$Phase] $Status — $Detail" -ForegroundColor $color
}

Set-Location $Root

# --- Faz 0: Local API + tunnel ---
Log-Phase "0-docker" "start" "docker compose up"
& powershell -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\run-local-api.ps1") 2>&1 | Out-Null
Start-Sleep -Seconds 20

$localHealth = $null
try {
    $localHealth = (Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 15).Content | ConvertFrom-Json
    Log-Phase "0-health" "ok" "local status=$($localHealth.status) db=$($localHealth.checks.database)"
} catch {
    Log-Phase "0-health" "fail" $_.Exception.Message
}

$tunnelUrl = $null
if (-not $SkipTunnel) {
    & powershell -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\start-cloudflare-tunnel.ps1") 2>&1 | Out-Null
    $urlFile = Join-Path $Root ".tunnel-url"
    if (Test-Path $urlFile) {
        $tunnelUrl = (Get-Content $urlFile -Raw).Trim()
        Log-Phase "0-tunnel" "ok" $tunnelUrl
    } else {
        Log-Phase "0-tunnel" "warn" "tunnel URL not captured"
    }
}

# --- Faz 1: Tests ---
Log-Phase "1-tests" "start" "backend + mobile"
Push-Location (Join-Path $Root "backend")
python -m pytest tests/ --ignore=tests/e2e -q 2>&1 | Tee-Object -Variable pytestOut | Out-Null
$pytestOk = $LASTEXITCODE -eq 0
Pop-Location
Log-Phase "1-backend" $(if ($pytestOk) { "ok" } else { "fail" }) ($pytestOut | Select-Object -Last 1)

Push-Location (Join-Path $Root "mobile")
npm test -- --watchAll=false --passWithNoTests 2>&1 | Out-Null
$jestOk = $LASTEXITCODE -eq 0
npx tsc --noEmit 2>&1 | Tee-Object -Variable tscOut | Out-Null
$tscOk = $LASTEXITCODE -eq 0
Pop-Location
Log-Phase "1-mobile" $(if ($jestOk -and $tscOk) { "ok" } else { "fail" }) "jest=$jestOk tsc=$tscOk"

$smokeOk = $false
if ($tunnelUrl) {
    $env:API_URL = $tunnelUrl
    python (Join-Path $Root "scripts\smoke_test.py") 2>&1 | Tee-Object -Variable smokeOut | Out-Null
    $smokeOk = $LASTEXITCODE -eq 0
    Log-Phase "1-smoke" $(if ($smokeOk) { "ok" } else { "fail" }) ($smokeOut | Select-Object -Last 3)
} else {
    $env:API_URL = "http://localhost:8000"
    python (Join-Path $Root "scripts\smoke_test.py") 2>&1 | Out-Null
    $smokeOk = $LASTEXITCODE -eq 0
    Log-Phase "1-smoke" $(if ($smokeOk) { "ok" } else { "fail" }) "localhost"
}

# --- Faz 2: Render prod check ---
$renderHealth = $null
try {
    $renderHealth = (Invoke-WebRequest -Uri "https://talkcash-api-prod.onrender.com/health" -UseBasicParsing -TimeoutSec 20).Content | ConvertFrom-Json
    Log-Phase "2-render" "ok" "status=$($renderHealth.status)"
} catch {
    Log-Phase "2-render" "warn" "not live — push render.yaml + Blueprint Apply on dashboard.render.com"
}

# --- Faz 3: EAS build ---
if (-not $SkipBuild) {
    Push-Location (Join-Path $Root "mobile")
    $env:EAS_PROJECT_ID = "d7cfbb2e-a657-49a6-bfc9-bcfc4e120230"
    npx eas-cli build:list --platform android --limit 1 --non-interactive 2>&1 | Tee-Object -Variable buildList | Out-Null
    $latestStatus = ($buildList | Select-String "Status").ToString()
    if ($latestStatus -match "in queue|in progress") {
        Log-Phase "3-eas" "warn" "build already running: $latestStatus"
    } else {
        npx eas-cli build --profile production --platform android --non-interactive 2>&1 | Tee-Object -Variable buildOut | Out-Null
        $buildOk = $LASTEXITCODE -eq 0
        Log-Phase "3-eas" $(if ($buildOk) { "ok" } else { "fail" }) ($buildOut | Select-Object -Last 2)
    }
    Pop-Location
}

# --- Faz 4: GitHub vars (best effort) ---
if (Get-Command gh -ErrorAction SilentlyContinue) {
    gh variable set EXPO_PUBLIC_API_URL --body "https://talkcash-api-prod.onrender.com/api/v1" 2>&1 | Out-Null
    gh variable set EAS_PROJECT_ID --body "d7cfbb2e-a657-49a6-bfc9-bcfc4e120230" 2>&1 | Out-Null
    Log-Phase "4-github" "ok" "repo variables set"
} else {
    Log-Phase "4-github" "warn" "gh CLI missing"
}

# --- Summary ---
$summary = @{
    generated_at = (Get-Date -Format "o")
    local_api = "http://localhost:8000"
    tunnel_url = $tunnelUrl
    render_api = "https://talkcash-api-prod.onrender.com"
    render_live = ($null -ne $renderHealth)
    phases = $Log
}
$summary | ConvertTo-Json -Depth 5 | Set-Content $StatusFile -Encoding UTF8
Write-Host ""
Write-Host "Status written: DEPLOY_STATUS.json" -ForegroundColor Cyan
