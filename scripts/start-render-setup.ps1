# Opens Render + Neon + Upstash setup pages and prints env template
$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "=== TalkCash Render Kurulum ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Neon PostgreSQL (Frankfurt)"
Write-Host "   https://console.neon.tech"
Write-Host ""
Write-Host "2. Upstash Redis (eu-central-1)"
Write-Host "   https://console.upstash.com"
Write-Host ""
Write-Host "3. Render Blueprint (repo: kemalhodja/TalkCash)"
Write-Host "   https://dashboard.render.com/blueprints"
Write-Host ""
Write-Host "4. Environment (talkcash-api-prod -> Environment):"
Write-Host "   DATABASE_URL = postgresql+asyncpg://USER:PASS@ep-xxx.neon.tech/neondb?sslmode=require"
Write-Host "   REDIS_URL    = rediss://default:TOKEN@xxx.upstash.io:6379"
Write-Host "   OPENAI_API_KEY = sk-... (opsiyonel)"
Write-Host ""

$open = Read-Host "Tarayicida acilsin mi? (E/h)"
if ($open -ne "h") {
    Start-Process "https://console.neon.tech"
    Start-Sleep -Seconds 1
    Start-Process "https://console.upstash.com"
    Start-Sleep -Seconds 1
    Start-Process "https://dashboard.render.com/blueprints"
}

Write-Host ""
Write-Host "Deploy sonrasi health:"
Write-Host "  .\scripts\deploy-render.ps1 -SkipHealthWait"
Write-Host "  curl https://talkcash-api-prod.onrender.com/health"
Write-Host ""
