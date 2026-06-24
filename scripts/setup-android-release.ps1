# EAS oturumundan keystore cek, GitHub secret yaz, workflow tetikle
$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent

Write-Host "==> EAS keystore indiriliyor..." -ForegroundColor Cyan
node "$Root\scripts\fetch-eas-android-credentials.cjs"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> GitHub secrets yaziliyor..." -ForegroundColor Cyan
& "$Root\scripts\setup-github-android-secrets.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> GitHub Actions AAB build tetikleniyor..." -ForegroundColor Cyan
gh workflow run android-aab-local.yml -R kemalhodja/TalkCash
Start-Sleep 3
gh run list -R kemalhodja/TalkCash --workflow=android-aab-local.yml -L 1

Write-Host "==> Tamam. Actions sekmesinden build durumunu izleyin." -ForegroundColor Green
