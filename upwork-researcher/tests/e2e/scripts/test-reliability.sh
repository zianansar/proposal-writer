#!/bin/bash
# E2E Test Reliability Script
# Runs the full E2E suite 10 times to verify no flakiness (AC-9)
#
# Usage: ./tests/e2e/scripts/test-reliability.sh [runs]
# Default: 10 runs

set -euo pipefail

RUNS=${1:-10}
PASS_COUNT=0
FAIL_COUNT=0
RESULTS=()

echo "=== E2E Reliability Test ==="
echo "Running $RUNS iterations..."
echo ""

for i in $(seq 1 "$RUNS"); do
  echo "--- Run $i/$RUNS ---"
  START_TIME=$(date +%s)

  if npm run test:e2e 2>&1; then
    DURATION=$(($(date +%s) - START_TIME))
    RESULTS+=("Run $i: PASS (${DURATION}s)")
    PASS_COUNT=$((PASS_COUNT + 1))
    echo "  Result: PASS (${DURATION}s)"
  else
    DURATION=$(($(date +%s) - START_TIME))
    RESULTS+=("Run $i: FAIL (${DURATION}s)")
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo "  Result: FAIL (${DURATION}s)"
  fi

  echo ""
done

echo "=== Results Summary ==="
for result in "${RESULTS[@]}"; do
  echo "  $result"
done
echo ""
echo "Passed: $PASS_COUNT/$RUNS"
echo "Failed: $FAIL_COUNT/$RUNS"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo ""
  echo "FLAKINESS DETECTED: $FAIL_COUNT failures in $RUNS runs"
  exit 1
else
  echo ""
  echo "ALL RUNS PASSED: No flakiness detected"
  exit 0
fi
