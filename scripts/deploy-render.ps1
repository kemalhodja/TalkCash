# TalkCash — Render production deploy helper
# Usage: .\scripts\deploy-render.ps1
# Requires: Neon DATABASE_URL + Upstash REDIS_URL (paste when prompted)

param(
    [string]$ApiUrl = "https://talkcash-api-prod.onrender.com",
    [switch]$SkipHealthWait
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$EnvFile = Join-Path $Root ".env.render"

function Convert-NeonUrl([string]$url) {
    if ($url -match "^postgresql://") {
        $url = $url -replace "^postgresql://", "postgresql+asyncpg://"
    }
    if ($url -notmatch "sslmode=") {
        $url += $(if ($url -match "\?") { "&" } else { "?" }) + "sslmode=require"
    }
    return $url
}

Write-Host ""
Write-Host "=== TalkCash Render Deploy ===" -ForegroundColor Cyan
Write-Host "API hedef: $ApiUrl"
Write-Host ""

if (-not (Test-Path $EnvFile)) {
    Write-Host "Neon + Upstash hazir olunca asagidaki bilgileri girin." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Neon: https://console.neon.tech (Frankfurt / eu-central)" -ForegroundColor Gray
    Write-Host "Upstash: https://console.upstash.com (eu-central-1)" -ForegroundColor Gray
    Write-Host ""

    $neon = Read-Host "Neon connection string (postgresql://...)"
    $redis = Read-Host "Upstash REDIS_URL (rediss://...)"
    $openai = Read-Host "OPENAI_API_KEY (sk-... bos birakilabilir)"

    $dbUrl = Convert-NeonUrl $neon.Trim()

    @"
DATABASE_URL=$dbUrl
REDIS_URL=$($redis.Trim())
OPENAI_API_KEY=$($openai.Trim())
"@ | Set-Content -Path $EnvFile -Encoding UTF8

    Write-Host ""
    Write-Host "Kaydedildi: .env.render" -ForegroundColor Green
}

Write-Host ""
Write-Host "--- Render Dashboard adimlari ---" -ForegroundColor Cyan
Write-Host "1. https://dashboard.render.com -> New -> Blueprint"
Write-Host "2. GitHub repo: kemalhodja/TalkCash"
Write-Host "3. render.yaml otomatik algilanir -> Apply"
Write-Host "4. talkcash-api-prod -> Environment -> asagidaki secret'lari yapistir:"
Write-Host ""

Get-Content $EnvFile | ForEach-Object { Write-Host "   $_" -ForegroundColor White }

Write-Host ""
Write-Host "5. Manual Deploy (veya git push ile otomatik deploy)"
Write-Host "6. Ilk deploy ~5-10 dk (migration entrypoint'te calisir)"
Write-Host ""

if (-not $SkipHealthWait) {
    Write-Host "Health bekleniyor ($ApiUrl/health)..." -ForegroundColor Yellow
    Write-Host "Render'da deploy baslattiktan sonra Enter'a basin." -ForegroundColor Yellow
    Read-Host "Deploy basladi mi? (Enter)"

    $ok = $false
    for ($i = 1; $i -le 30; $i++) {
        try {
            $r = Invoke-WebRequest -Uri "$ApiUrl/health" -TimeoutSec 15 -UseBasicParsing
            $body = $r.Content | ConvertFrom-Json
            Write-Host "  [$i] status=$($body.status) db=$($body.checks.database) redis=$($body.checks.redis)" -ForegroundColor Gray
            if ($body.status -eq "ok" -or $body.status -eq "degraded") {
                if ($body.checks.database) {
                    $ok = $true
                    Write-Host ""
                    Write-Host "API hazir: $ApiUrl/api/v1" -ForegroundColor Green
                    break
                }
            }
        } catch {
            Write-Host "  [$i] bekleniyor..." -ForegroundColor DarkGray
        }
        Start-Sleep -Seconds 20
    }

    if (-not $ok) {
        Write-Host ""
        Write-Host "Health henuz gelmedi. Render loglarini kontrol et." -ForegroundColor Red
        Write-Host "Logs: Dashboard -> talkcash-api-prod -> Logs"
        exit 1
    }
}

Write-Host ""
Write-Host "--- Sonraki adim: mobil build #18 ---" -ForegroundColor Cyan
Write-Host "eas.json zaten Render URL kullaniyor. Yeni AAB:"
Write-Host "  cd mobile"
Write-Host "  `$env:EAS_PROJECT_ID='d7cfbb2e-a657-49a6-bfc9-bcfc4e120230'"
Write-Host "  npx eas-cli build --profile production --platform android"
Write-Host ""
