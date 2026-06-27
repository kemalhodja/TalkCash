#Requires -Version 5.1
<#
.SYNOPSIS
  TalkCash Render production deploy via API + health gate.

  Set env: RENDER_API_KEY from https://dashboard.render.com/u/settings#api-keys

  Usage:
    $env:RENDER_API_KEY = "rnd_..."
    .\scripts\render-api-deploy.ps1
    .\scripts\render-api-deploy.ps1 -TriggerOnly
#>
param(
    [string]$ServiceName = "talkcash-api-prod",
    [string]$ApiBase = "https://talkcash-api-prod.onrender.com",
    [switch]$TriggerOnly,
    [int]$WaitMinutes = 15
)

$ErrorActionPreference = "Stop"
$ApiKey = $env:RENDER_API_KEY
if (-not $ApiKey) {
    Write-Error "RENDER_API_KEY not set. Dashboard -> Account Settings -> API Keys"
}

$Headers = @{
    Authorization = "Bearer $ApiKey"
    Accept        = "application/json"
}

function Invoke-RenderApi {
    param([string]$Method, [string]$Path, [object]$Body = $null)
    $uri = "https://api.render.com/v1$Path"
    if ($Body) {
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $Headers -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 8)
    }
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $Headers
}

Write-Host "==> Fetching Render services..." -ForegroundColor Cyan
$services = Invoke-RenderApi GET "/services?limit=50"
$service = $services | ForEach-Object { $_.service } | Where-Object { $_.name -eq $ServiceName } | Select-Object -First 1
if (-not $service) {
    Write-Error "Service '$ServiceName' not found. Apply Blueprint first: dashboard.render.com/blueprints"
}

$serviceId = $service.id
Write-Host "Found service: $($service.name) ($serviceId)" -ForegroundColor Green
Write-Host "URL: $($service.serviceDetails.url)"

Write-Host "==> Triggering deploy..." -ForegroundColor Cyan
Invoke-RenderApi POST "/services/$serviceId/deploys" @{ clearCache = "do_not_clear" } | Out-Null

if ($TriggerOnly) {
    Write-Host "Deploy triggered (TriggerOnly)." -ForegroundColor Green
    exit 0
}

Write-Host "==> Waiting for health (max ${WaitMinutes}m)..." -ForegroundColor Yellow
$deadline = (Get-Date).AddMinutes($WaitMinutes)
$ok = $false
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 20
    try {
        $health = Invoke-RestMethod -Uri "$ApiBase/health" -TimeoutSec 60
        $lr = $health.launch_readiness
        $db = $health.checks.database
        Write-Host "  status=$($health.status) db=$db premium_unlocked=$($health.features.premium_unlocked)" -ForegroundColor Gray
        if ($db -and $health.features.premium_unlocked -eq $false) {
            if ($lr) {
                $ready = ($lr.PSObject.Properties | Where-Object { $_.Name -ne 'apple_configured' } | ForEach-Object { $_.Value }) -notcontains $false
                if ($ready) { $ok = $true; break }
            } else {
                $ok = $true
                break
            }
        }
    } catch {
        Write-Host "  waiting..." -ForegroundColor DarkGray
    }
}

if ($ok) {
    Write-Host ""
    Write-Host "Render deploy OK: $ApiBase/api/v1" -ForegroundColor Green
    $health = Invoke-RestMethod -Uri "$ApiBase/health" -TimeoutSec 60
    if ($health.launch_readiness) {
        $health.launch_readiness | ConvertTo-Json
    }
    exit 0
}

Write-Host ""
Write-Host "Deploy did not pass health gate. Check Render logs and Environment secrets." -ForegroundColor Red
Write-Host "Required: S3_*, SMTP_*, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, SENTRY_DSN (see docs/PRODUCTION_CHECKLIST.md)"
exit 1
