# TalkCash Fly.io production — first-time setup (Windows)
# Usage: .\scripts\setup-fly-prod.ps1
# Requires: flyctl logged in + billing card on https://fly.io/dashboard

$ErrorActionPreference = "Stop"

$APP = if ($env:FLY_APP) { $env:FLY_APP } else { "talkcash-api-prod" }
$DB = if ($env:FLY_DB) { $env:FLY_DB } else { "talkcash-db-prod" }
$REGION = if ($env:FLY_REGION) { $env:FLY_REGION } else { "fra" }

$fly = if (Get-Command flyctl -ErrorAction SilentlyContinue) { "flyctl" }
       elseif (Test-Path "$env:USERPROFILE\.fly\bin\flyctl.exe") { "$env:USERPROFILE\.fly\bin\flyctl.exe" }
       else { throw "flyctl not found. Install: iwr https://fly.io/install.ps1 -useb | iex" }

Write-Host "==> TalkCash Fly.io PRODUCTION setup"
Write-Host "    App: $APP  DB: $DB  Region: $REGION"
Write-Host ""

& $fly auth whoami | Out-Null

$apps = & $fly apps list 2>$null | Out-String
if ($apps -notmatch $APP) {
    Write-Host "==> Creating app $APP..."
    & $fly apps create $APP --org personal
}

$pgList = & $fly postgres list 2>$null | Out-String
if ($pgList -notmatch $DB) {
    Write-Host "==> Creating PostgreSQL cluster $DB (may take a few minutes)..."
    & $fly postgres create `
        --name $DB `
        --region $REGION `
        --initial-cluster-size 1 `
        --vm-size shared-cpu-1x `
        --volume-size 1 `
        --detach
}

$secrets = & $fly secrets list -a $APP 2>$null | Out-String
if ($secrets -notmatch "DATABASE_URL") {
    Write-Host "==> Attaching database to $APP..."
    & $fly postgres attach $DB -a $APP
}

if ($secrets -notmatch "SECRET_KEY") {
    $secretKey = -join ((1..32) | ForEach-Object { "{0:x2}" -f (Get-Random -Maximum 256) })
    Write-Host "==> Setting SECRET_KEY..."
    & $fly secrets set "SECRET_KEY=$secretKey" -a $APP
}

if ($secrets -notmatch "ALLOWED_ORIGINS") {
    Write-Host "==> Setting ALLOWED_ORIGINS..."
    & $fly secrets set "ALLOWED_ORIGINS=*" -a $APP
}

if ($secrets -notmatch "S3_ENABLED") {
    Write-Host "==> Setting S3_ENABLED=false (enable R2 later for receipt images)..."
    & $fly secrets set "S3_ENABLED=false" -a $APP
}

Write-Host ""
Write-Host "==> Optional secrets (set before full production use):"
Write-Host "  & `$fly secrets set REDIS_URL='redis://...' -a $APP"
Write-Host "  & `$fly secrets set OPENAI_API_KEY='sk-...' -a $APP"
Write-Host "  & `$fly secrets set S3_ENABLED=true S3_ENDPOINT=... S3_ACCESS_KEY=... S3_SECRET_KEY=... S3_BUCKET=talkcash-prod S3_REGION=auto -a $APP"
Write-Host ""
Write-Host "==> Deploy:"
Write-Host "  cd backend"
Write-Host "  & `$fly deploy --config fly.prod.toml -a $APP"
Write-Host ""
Write-Host "==> Health check after deploy:"
Write-Host "  curl https://${APP}.fly.dev/health"
