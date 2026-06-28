# TalkCash Maestro CLI wrapper (Windows). Usage: .\scripts\maestro.ps1 test .maestro/smoke.yaml
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$maestroBin = Join-Path $env:USERPROFILE ".maestro\maestro\bin"
$adbBin = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools"

if (-not (Test-Path (Join-Path $maestroBin "maestro.bat"))) {
    Write-Error "Maestro not found. See https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli"
    exit 1
}

if (Test-Path $adbBin) {
    $env:Path = "$maestroBin;$adbBin;" + $env:Path
} else {
    $env:Path = "$maestroBin;" + $env:Path
    Write-Warning "Android platform-tools not found at $adbBin. Start an emulator first."
}

if ($Args.Count -eq 0) {
    & maestro --help
    exit $LASTEXITCODE
}

$mobileDir = Join-Path $PSScriptRoot "..\mobile"
Push-Location $mobileDir
try {
    & maestro @Args
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
