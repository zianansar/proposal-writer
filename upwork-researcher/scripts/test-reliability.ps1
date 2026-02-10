# E2E Test Reliability Verification Script (PowerShell)
# Runs tests 10 times to verify deterministic behavior

$RUNS = 10
$PASSED = 0
$FAILED = 0
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LOG_FILE = "test-reliability-$timestamp.log"

"==================================================" | Tee-Object -FilePath $LOG_FILE
"E2E Test Reliability Verification" | Tee-Object -FilePath $LOG_FILE -Append
"==================================================" | Tee-Object -FilePath $LOG_FILE -Append
"Running tests $RUNS times to verify determinism..." | Tee-Object -FilePath $LOG_FILE -Append
"Log file: $LOG_FILE" | Tee-Object -FilePath $LOG_FILE -Append
"" | Add-Content $LOG_FILE

for ($i = 1; $i -le $RUNS; $i++) {
    Write-Host "=========================================="
    Write-Host "Run $i/$RUNS - $(Get-Date)"
    Write-Host "=========================================="

    "" | Add-Content $LOG_FILE
    "==========================================" | Add-Content $LOG_FILE
    "Run $i/$RUNS - $(Get-Date)" | Add-Content $LOG_FILE
    "==========================================" | Add-Content $LOG_FILE

    $output = npm run test:e2e 2>&1 | Out-String
    $output | Add-Content $LOG_FILE

    if ($LASTEXITCODE -eq 0) {
        $PASSED++
        Write-Host "✓ Run $i PASSED" -ForegroundColor Green
        "✓ Run $i PASSED" | Add-Content $LOG_FILE
    } else {
        $FAILED++
        Write-Host "✗ Run $i FAILED" -ForegroundColor Red
        "✗ Run $i FAILED" | Add-Content $LOG_FILE
    }

    "" | Add-Content $LOG_FILE
}

"" | Add-Content $LOG_FILE
Write-Host ""
Write-Host "=========================================="
Write-Host "RELIABILITY TEST RESULTS"
Write-Host "=========================================="
Write-Host "Total runs:  $RUNS"
Write-Host "Passed:      $PASSED"
Write-Host "Failed:      $FAILED"

if ($RUNS -gt 0) {
    $SUCCESS_RATE = [math]::Round(($PASSED * 100 / $RUNS), 1)
    Write-Host "Success rate: $SUCCESS_RATE%"
} else {
    Write-Host "Success rate: N/A"
}

"" | Add-Content $LOG_FILE
"==========================================" | Add-Content $LOG_FILE
"RELIABILITY TEST RESULTS" | Add-Content $LOG_FILE
"==========================================" | Add-Content $LOG_FILE
"Total runs:  $RUNS" | Add-Content $LOG_FILE
"Passed:      $PASSED" | Add-Content $LOG_FILE
"Failed:      $FAILED" | Add-Content $LOG_FILE
"Success rate: $SUCCESS_RATE%" | Add-Content $LOG_FILE

if ($FAILED -gt 0) {
    Write-Host ""
    Write-Host "⚠️  FLAKINESS DETECTED: Tests failed $FAILED out of $RUNS runs" -ForegroundColor Yellow
    Write-Host "Review logs in $LOG_FILE to identify timing issues or race conditions"
    exit 1
} else {
    Write-Host ""
    Write-Host "✅ ALL TESTS PASSED - No flakiness detected" -ForegroundColor Green
    Write-Host "Full logs available in: $LOG_FILE"
    exit 0
}
