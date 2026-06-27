# Cloudflare Quick Tunnel — telefondan yerel API'ye HTTPS erisimi
# Usage: .\scripts\start-cloudflare-tunnel.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent
Set-Location $Root

function Find-Cloudflared {
    $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $paths = @(
        "$env:ProgramFiles\Cloudflare\cloudflared\cloudflared.exe",
        "$env:ProgramFiles\cloudflared\cloudflared.exe",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe",
        (Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter "cloudflared.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName)
    )
    foreach ($p in $paths) {
        if (Test-Path $p) { return $p }
    }
    return $null
}

$cf = Find-Cloudflared
if (-not $cf) {
    Write-Host "cloudflared bulunamadi. Kurulum:"
    Write-Host "  winget install Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements"
    exit 1
}

try {
    $health = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5
    if ($health.StatusCode -ne 200) { throw "bad status" }
} catch {
    Write-Host "Yerel API calismiyor. Once:"
    Write-Host "  .\scripts\run-local-api.ps1"
    exit 1
}

$logFile = Join-Path $Root ".cloudflare-tunnel.log"
$urlFile = Join-Path $Root ".tunnel-url"
$pidFile = Join-Path $Root ".cloudflare-tunnel.pid"

# Stop existing tunnel if any
if (Test-Path $pidFile) {
    $oldPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
        Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
    }
}

if (Test-Path $logFile) { Remove-Item $logFile -Force }

Write-Host "==> Cloudflare Tunnel baslatiliyor..."
$proc = Start-Process -FilePath $cf -ArgumentList "tunnel", "--url", "http://localhost:8000", "--logfile", $logFile, "--loglevel", "info" -PassThru -WindowStyle Hidden
$proc.Id | Set-Content $pidFile

$tunnelUrl = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $logFile) {
        $log = Get-Content $logFile -Raw -ErrorAction SilentlyContinue
        if ($log -match "(https://[a-z0-9-]+\.trycloudflare\.com)") {
            $tunnelUrl = $Matches[1]
            break
        }
    }
}

if (-not $tunnelUrl) {
    Write-Host "Tunnel URL henuz alinamadi. Log:"
    if (Test-Path $logFile) { Get-Content $logFile -Tail 15 }
    Write-Host ""
    Write-Host "Birkac saniye bekleyip su dosyaya bakin: $logFile"
    exit 1
}

$apiUrl = "$tunnelUrl/api/v1"
$tunnelUrl | Set-Content $urlFile
Write-Host ""
Write-Host "Tunnel hazir!"
Write-Host "  HTTPS:  $tunnelUrl"
Write-Host "  API:    $apiUrl"
Write-Host "  Health: $tunnelUrl/health"
Write-Host ""
Write-Host "Mobil (.env veya Expo):"
Write-Host "  EXPO_PUBLIC_API_URL=$apiUrl"
Write-Host ""

# Update mobile/.env if exists
$mobileEnv = Join-Path $Root "mobile\.env"
if (Test-Path $mobileEnv) {
    $content = Get-Content $mobileEnv -Raw
    if ($content -match "EXPO_PUBLIC_API_URL=") {
        $content = $content -replace "EXPO_PUBLIC_API_URL=.*", "EXPO_PUBLIC_API_URL=$apiUrl"
    } else {
        $content += "`nEXPO_PUBLIC_API_URL=$apiUrl`n"
    }
    Set-Content $mobileEnv $content.TrimEnd()
    Write-Host "mobile\.env guncellendi."
} else {
    @("EXPO_PUBLIC_API_URL=$apiUrl") | Set-Content $mobileEnv
    Write-Host "mobile\.env olusturuldu."
}

Write-Host ""
Write-Host "Tunnel arka planda calisiyor (PID $($proc.Id))."
Write-Host "Durdurmak icin: Stop-Process -Id $($proc.Id)"
