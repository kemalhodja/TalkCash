#Requires -Version 5.1
<#
.SYNOPSIS
  Fix Render prod env vars that block startup validation.

  Usage:
    $env:RENDER_API_KEY = "rnd_..."
    .\scripts\render-fix-prod-env.ps1
    .\scripts\render-fix-prod-env.ps1 -Deploy
#>
param(
    [string]$ServiceName = "talkcash-api-prod",
    [switch]$Deploy,
)

$ErrorActionPreference = "Stop"
$ApiKey = $env:RENDER_API_KEY
if (-not $ApiKey) {
    Write-Error "RENDER_API_KEY not set. https://dashboard.render.com/u/settings#api-keys"
}

$Headers = @{
    Authorization = "Bearer $ApiKey"
    Accept        = "application/json"
    "Content-Type" = "application/json"
}

function Invoke-RenderApi {
    param([string]$Method, [string]$Path, [object]$Body = $null)
    $uri = "https://api.render.com/v1$Path"
    if ($Body) {
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $Headers -Body ($Body | ConvertTo-Json -Depth 8)
    }
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $Headers
}

$newInternal = -join ((48..57 + 65..90 + 97..122 | Get-Random -Count 48 | ForEach-Object { [char]$_ }))
$fixes = @{
    BILLING_PREMIUM_UNLOCKED = "false"
    GOOGLE_PLAY_VERIFY_MOCK  = "false"
    INTERNAL_UPGRADE_SECRET  = $newInternal
}

Write-Host "==> Finding service $ServiceName..." -ForegroundColor Cyan
$services = Invoke-RenderApi GET "/services?limit=50"
$service = $services | ForEach-Object { $_.service } | Where-Object { $_.name -eq $ServiceName } | Select-Object -First 1
if (-not $service) { Write-Error "Service not found: $ServiceName" }
$serviceId = $service.id
Write-Host "Service ID: $serviceId" -ForegroundColor Green

Write-Host "==> Current env (launch blockers only)..." -ForegroundColor Cyan
$existing = Invoke-RenderApi GET "/services/$serviceId/env-vars?limit=100"
$byKey = @{}
foreach ($row in $existing) {
    $ev = $row.envVar
    if ($ev.key -in $fixes.Keys) {
        $byKey[$ev.key] = $ev
        $display = if ($ev.key -eq "INTERNAL_UPGRADE_SECRET") { "***" } else { $ev.value }
        Write-Host "  $($ev.key) = $display"
    }
}

Write-Host "==> Applying fixes..." -ForegroundColor Yellow
foreach ($key in $fixes.Keys) {
    $value = $fixes[$key]
    if ($byKey.ContainsKey($key)) {
        $id = $byKey[$key].id
        Invoke-RenderApi PUT "/services/$serviceId/env-vars/$id" @{ value = $value } | Out-Null
        Write-Host "  Updated $key" -ForegroundColor Green
    } else {
        Invoke-RenderApi POST "/services/$serviceId/env-vars" @{ envVar = @{ key = $key; value = $value } } | Out-Null
        Write-Host "  Created $key" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Done. Save INTERNAL_UPGRADE_SECRET from Render dashboard if you need admin scripts." -ForegroundColor Cyan
Write-Host "New INTERNAL_UPGRADE_SECRET was generated (not printed)." -ForegroundColor Gray

if ($Deploy) {
    Write-Host "==> Triggering deploy..." -ForegroundColor Cyan
    Invoke-RenderApi POST "/services/$serviceId/deploys" @{ clearCache = "do_not_clear" } | Out-Null
    Write-Host "Deploy triggered. Watch logs in Render dashboard." -ForegroundColor Green
} else {
    Write-Host "Run with -Deploy to trigger a new deploy, or Manual Deploy in Render dashboard." -ForegroundColor Yellow
}
