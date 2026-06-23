# Keystore + keystore.properties okuyup GitHub Actions secret'larina yazar.
# Once: eas credentials -p android → production → Keystore → Download
# Usage: .\scripts\setup-github-android-secrets.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent
$Keystore = Join-Path $Root "mobile\android\app\release.keystore"
$Props = Join-Path $Root "mobile\android\keystore.properties"

if (-not (Test-Path $Keystore)) {
    Write-Host "release.keystore bulunamadi: $Keystore" -ForegroundColor Red
    Write-Host "Once: cd mobile && npx eas-cli credentials -p android"
    exit 1
}
if (-not (Test-Path $Props)) {
    Write-Host "keystore.properties bulunamadi: $Props" -ForegroundColor Red
    Write-Host "keystore.properties.example dosyasini kopyalayip doldurun."
    exit 1
}

$p = @{}
Get-Content $Props | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $p[$Matches[1].Trim()] = $Matches[2].Trim()
    }
}

foreach ($key in @("storePassword", "keyAlias", "keyPassword")) {
    if (-not $p[$key]) {
        Write-Host "keystore.properties icinde $key eksik" -ForegroundColor Red
        exit 1
    }
}

$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($Keystore))

Write-Host "GitHub secret'lari yaziliyor (kemalhodja/TalkCash)..." -ForegroundColor Cyan
gh secret set ANDROID_KEYSTORE_BASE64 -R kemalhodja/TalkCash -b "$b64"
gh secret set ANDROID_KEYSTORE_PASSWORD -R kemalhodja/TalkCash -b "$($p.storePassword)"
gh secret set ANDROID_KEY_ALIAS -R kemalhodja/TalkCash -b "$($p.keyAlias)"
gh secret set ANDROID_KEY_PASSWORD -R kemalhodja/TalkCash -b "$($p.keyPassword)"

Write-Host "Tamam. Workflow tetiklemek icin:" -ForegroundColor Green
Write-Host "  gh workflow run android-aab-local.yml -R kemalhodja/TalkCash"
