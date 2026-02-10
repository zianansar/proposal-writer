#!/bin/bash
set -e

RUNS=10
PASSED=0
FAILED=0
LOG_FILE="test-reliability-$(date +%Y%m%d-%H%M%S).log"

echo "==================================================" | tee "$LOG_FILE"
echo "E2E Test Reliability Verification" | tee -a "$LOG_FILE"
echo "==================================================" | tee -a "$LOG_FILE"
echo "Running tests $RUNS times to verify determinism..." | tee -a "$LOG_FILE"
echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

for i in $(seq 1 $RUNS); do
  echo "=========================================="
  echo "Run $i/$RUNS - $(date)"
  echo "=========================================="

  {
    echo ""
    echo "=========================================="
    echo "Run $i/$RUNS - $(date)"
    echo "=========================================="
  } >> "$LOG_FILE"

  if npm run test:e2e >> "$LOG_FILE" 2>&1; then
    PASSED=$((PASSED + 1))
    echo "✓ Run $i PASSED"
    echo "✓ Run $i PASSED" >> "$LOG_FILE"
  else
    FAILED=$((FAILED + 1))
    echo "✗ Run $i FAILED"
    echo "✗ Run $i FAILED" >> "$LOG_FILE"
  fi

  echo "" | tee -a "$LOG_FILE"
done

echo "" | tee -a "$LOG_FILE"
echo "=========================================="
echo "RELIABILITY TEST RESULTS"
echo "=========================================="
echo "Total runs:  $RUNS"
echo "Passed:      $PASSED"
echo "Failed:      $FAILED"

if [ $RUNS -gt 0 ]; then
  SUCCESS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASSED * 100 / $RUNS)}")
  echo "Success rate: ${SUCCESS_RATE}%"
else
  echo "Success rate: N/A"
fi

{
  echo ""
  echo "=========================================="
  echo "RELIABILITY TEST RESULTS"
  echo "=========================================="
  echo "Total runs:  $RUNS"
  echo "Passed:      $PASSED"
  echo "Failed:      $FAILED"
  echo "Success rate: ${SUCCESS_RATE}%"
} >> "$LOG_FILE"

if [ $FAILED -gt 0 ]; then
  echo ""
  echo "⚠️  FLAKINESS DETECTED: Tests failed $FAILED out of $RUNS runs"
  echo "Review logs in $LOG_FILE to identify timing issues or race conditions"
  exit 1
else
  echo ""
  echo "✅ ALL TESTS PASSED - No flakiness detected"
  echo "Full logs available in: $LOG_FILE"
  exit 0
fi
