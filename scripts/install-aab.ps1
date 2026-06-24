# TalkCash — production AAB indir ve emulator/cihaza yukle
# Usage: .\scripts\install-aab.ps1
#        .\scripts\install-aab.ps1 -AabUrl "https://expo.dev/artifacts/eas/....aab"

param(
    [string]$AabUrl = "https://expo.dev/artifacts/eas/y2kXlEt3uNT7rqgtqwKnCGZojmNK2rZUtRQ_qyrywik.aab",
    [string]$Package = "io.talkcash.app"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent
$Dist = Join-Path $Root "dist"
$Aab = Join-Path $Dist "talkcash-prod.aab"
$Apks = Join-Path $Dist "talkcash-prod.apks"
$Bt = Join-Path $Dist "bundletool.jar"
$Sdk = "$env:LOCALAPPDATA\Android\Sdk"
$Adb = Join-Path $Sdk "platform-tools\adb.exe"
$Emu = Join-Path $Sdk "emulator\emulator.exe"

New-Item -ItemType Directory -Force -Path $Dist | Out-Null
$env:Path = "$(Split-Path $Adb);$env:Path"

if (-not (Test-Path $Bt)) {
    Write-Host "bundletool indiriliyor..."
    Invoke-WebRequest -Uri "https://github.com/google/bundletool/releases/download/1.17.2/bundletool-all-1.17.2.jar" -OutFile $Bt -UseBasicParsing
}

$devices = & $Adb devices | Select-String "device$"
if (-not $devices) {
    $avd = & $Emu -list-avds 2>$null | Select-Object -First 1
    if (-not $avd) { throw "Cihaz/emulator yok. Device Manager'dan AVD olustur." }
    Write-Host "Emulator baslatiliyor: $avd"
    Start-Process $Emu -ArgumentList "-avd", $avd
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep 5
        $devices = & $Adb devices | Select-String "device$"
        if ($devices) { break }
    }
    if (-not $devices) { throw "Emulator acilamadi" }
}

if (-not (Test-Path $Aab)) {
    Write-Host "AAB indiriliyor..."
    Invoke-WebRequest -Uri $AabUrl -OutFile $Aab -UseBasicParsing
}

Write-Host "APK set olusturuluyor..."
java -jar $Bt build-apks --bundle=$Aab --output=$Apks --connected-device --overwrite
Write-Host "Yukleniyor..."
java -jar $Bt install-apks --apks=$Apks
Write-Host "Baslatiliyor: $Package"
& $Adb shell monkey -p $Package -c android.intent.category.LAUNCHER 1 | Out-Null
Write-Host "TalkCash yuklendi ve acildi." -ForegroundColor Green
