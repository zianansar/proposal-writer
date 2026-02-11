# E2E Test Reliability Script (PowerShell)
# Runs the full E2E suite 10 times to verify no flakiness (AC-9)
#
# Usage: .\tests\e2e\scripts\test-reliability.ps1 [-Runs 10]

param(
    [int]$Runs = 10
)

$ErrorActionPreference = "Continue"

$passCount = 0
$failCount = 0
$results = @()

Write-Host "=== E2E Reliability Test ===" -ForegroundColor Cyan
Write-Host "Running $Runs iterations..."
Write-Host ""

for ($i = 1; $i -le $Runs; $i++) {
    Write-Host "--- Run $i/$Runs ---" -ForegroundColor Yellow
    $startTime = Get-Date

    $output = npm run test:e2e 2>&1
    $exitCode = $LASTEXITCODE
    $duration = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)

    if ($exitCode -eq 0) {
        $results += "Run $i`: PASS (${duration}s)"
        $passCount++
        Write-Host "  Result: PASS (${duration}s)" -ForegroundColor Green
    } else {
        $results += "Run $i`: FAIL (${duration}s)"
        $failCount++
        Write-Host "  Result: FAIL (${duration}s)" -ForegroundColor Red
    }

    Write-Host ""
}

Write-Host "=== Results Summary ===" -ForegroundColor Cyan
foreach ($result in $results) {
    Write-Host "  $result"
}
Write-Host ""
Write-Host "Passed: $passCount/$Runs"
Write-Host "Failed: $failCount/$Runs"

if ($failCount -gt 0) {
    Write-Host ""
    Write-Host "FLAKINESS DETECTED: $failCount failures in $Runs runs" -ForegroundColor Red
    exit 1
} else {
    Write-Host ""
    Write-Host "ALL RUNS PASSED: No flakiness detected" -ForegroundColor Green
    exit 0
}
