# TalkCash — run all automated tests (Windows)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== Backend unit tests ===" -ForegroundColor Cyan
Push-Location (Join-Path $Root "backend")
python -m pytest tests/ --ignore=tests/e2e -q
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
Pop-Location

Write-Host "=== Mobile Jest ===" -ForegroundColor Cyan
Push-Location (Join-Path $Root "mobile")
npm test -- --passWithNoTests
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
Pop-Location

Write-Host "=== API smoke ===" -ForegroundColor Cyan
python (Join-Path $Root "scripts/smoke_test.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nALL TESTS PASSED" -ForegroundColor Green
