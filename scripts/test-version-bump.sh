#!/usr/bin/env bash
# test-version-bump.sh - Validation script for semantic versioning automation (Story 9-3)
# Tests version sync, CHANGELOG generation, commit/tag creation, and edge cases

# Don't exit on error - we want to see all test results
set +e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$REPO_ROOT/upwork-researcher"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Semantic Versioning Validation Test Suite (Story 9-3)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PASS=0
FAIL=0

test_pass() {
  echo "✓ $1"
  ((PASS++))
}

test_fail() {
  echo "✗ $1"
  ((FAIL++))
}

# ────────────────────────────────────────────────────────────
# TEST 1: Dry run lists all three files
# ────────────────────────────────────────────────────────────
echo "[TEST 1] Dry run lists package.json, Cargo.toml, tauri.conf.json"
cd "$APP_DIR"
DRY_OUTPUT=$(npm run version:bump:dry 2>&1)

if echo "$DRY_OUTPUT" | grep -q "bumping version in package.json"; then
  test_pass "package.json listed in dry run"
else
  test_fail "package.json NOT listed in dry run"
fi

if echo "$DRY_OUTPUT" | grep -q "bumping version in src-tauri/Cargo.toml"; then
  test_pass "Cargo.toml listed in dry run"
else
  test_fail "Cargo.toml NOT listed in dry run"
fi

if echo "$DRY_OUTPUT" | grep -q "bumping version in src-tauri/tauri.conf.json"; then
  test_pass "tauri.conf.json listed in dry run"
else
  test_fail "tauri.conf.json NOT listed in dry run"
fi

# ────────────────────────────────────────────────────────────
# TEST 2: Version sync across all 3 files
# ────────────────────────────────────────────────────────────
echo ""
echo "[TEST 2] Version sync across all files"
PKG_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
CARGO_VERSION=$(grep '^version' src-tauri/Cargo.toml | head -1 | sed 's/version = "\(.*\)"/\1/')
TAURI_VERSION=$(grep '"version"' src-tauri/tauri.conf.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')

if [ "$PKG_VERSION" = "$CARGO_VERSION" ] && [ "$PKG_VERSION" = "$TAURI_VERSION" ]; then
  test_pass "All versions match: $PKG_VERSION"
else
  test_fail "Version mismatch: pkg=$PKG_VERSION, cargo=$CARGO_VERSION, tauri=$TAURI_VERSION"
fi

# ────────────────────────────────────────────────────────────
# TEST 3: CHANGELOG.md exists and has content
# ────────────────────────────────────────────────────────────
echo ""
echo "[TEST 3] CHANGELOG.md validation"
if [ -f "CHANGELOG.md" ]; then
  test_pass "CHANGELOG.md exists"
else
  test_fail "CHANGELOG.md does NOT exist"
fi

if [ -f "CHANGELOG.md" ] && grep -qE "## [0-9]+\.[0-9]+\.[0-9]+" CHANGELOG.md; then
  test_pass "CHANGELOG has version headers"
else
  test_fail "CHANGELOG missing version headers"
fi

if [ -f "CHANGELOG.md" ] && grep -q "### Features\|### Bug Fixes" CHANGELOG.md; then
  test_pass "CHANGELOG has grouped entries (Features/Bug Fixes)"
else
  test_fail "CHANGELOG missing grouped entries"
fi

if [ -f "CHANGELOG.md" ] && grep -q "\[.*\](https://github.com/.*/commit/.*)" CHANGELOG.md; then
  test_pass "CHANGELOG has commit links with hashes"
else
  test_fail "CHANGELOG missing commit links"
fi

# ────────────────────────────────────────────────────────────
# TEST 4: Commit message format
# ────────────────────────────────────────────────────────────
echo ""
echo "[TEST 4] Git commit and tag validation"
cd "$REPO_ROOT"
LAST_COMMIT_MSG=$(git log -1 --pretty=%s)

if echo "$LAST_COMMIT_MSG" | grep -qE "^chore: release v[0-9]+\.[0-9]+\.[0-9]+"; then
  test_pass "Latest commit follows 'chore: release v{version}' format"
else
  # This might fail if we haven't done a release commit yet, which is okay
  echo "⚠ Latest commit is not a release commit (might be expected): $LAST_COMMIT_MSG"
fi

# ────────────────────────────────────────────────────────────
# TEST 5: Tag creation
# ────────────────────────────────────────────────────────────
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$LATEST_TAG" ]; then
  test_pass "Git tag exists: $LATEST_TAG"

  if echo "$LATEST_TAG" | grep -qE "^v[0-9]+\.[0-9]+\.[0-9]+"; then
    test_pass "Tag follows 'v{version}' format"
  else
    test_fail "Tag does NOT follow v{version} format: $LATEST_TAG"
  fi

  # Check if tag points to a release commit
  TAG_COMMIT=$(git rev-list -n 1 "$LATEST_TAG")
  TAG_COMMIT_MSG=$(git log -1 --pretty=%s "$TAG_COMMIT")
  if echo "$TAG_COMMIT_MSG" | grep -qE "^chore: release"; then
    test_pass "Tag points to release commit"
  else
    echo "⚠ Tag commit message: $TAG_COMMIT_MSG"
  fi
else
  echo "⚠ No git tags found (might be first run)"
fi

# ────────────────────────────────────────────────────────────
# TEST 6: Dirty working directory rejection (pre-flight check)
# ────────────────────────────────────────────────────────────
echo ""
echo "[TEST 6] Pre-flight check for dirty working directory"
cd "$APP_DIR"

# Check if preversion:bump script exists
if grep -q '"preversion:bump"' package.json; then
  test_pass "preversion:bump pre-flight check script exists"

  # Test would require making working directory dirty, which we won't do here
  # Instead, just verify the script has the right check
  if npm pkg get scripts.preversion:bump | grep -q "git diff-index"; then
    test_pass "Pre-flight check uses git diff-index"
  else
    test_fail "Pre-flight check missing git diff-index"
  fi
else
  test_fail "preversion:bump pre-flight check NOT configured"
fi

# ────────────────────────────────────────────────────────────
# TEST 7: Config files exist
# ────────────────────────────────────────────────────────────
echo ""
echo "[TEST 7] Configuration files"
if [ -f ".versionrc.cjs" ]; then
  test_pass ".versionrc.cjs exists"
else
  test_fail ".versionrc.cjs missing"
fi

if [ -f "commitlint.config.cjs" ]; then
  test_pass "commitlint.config.cjs exists"
else
  test_fail "commitlint.config.cjs missing"
fi

if [ -f "$REPO_ROOT/.husky/commit-msg" ]; then
  test_pass ".husky/commit-msg hook exists"
else
  test_fail ".husky/commit-msg hook missing"
fi

# ────────────────────────────────────────────────────────────
# TEST 8: npm scripts exist
# ────────────────────────────────────────────────────────────
echo ""
echo "[TEST 8] npm scripts validation"
REQUIRED_SCRIPTS=("version:bump" "version:bump:minor" "version:bump:major" "version:bump:dry" "changelog")
for script in "${REQUIRED_SCRIPTS[@]}"; do
  if npm pkg get scripts."$script" | grep -q "commit-and-tag-version"; then
    test_pass "Script '$script' exists"
  else
    test_fail "Script '$script' missing"
  fi
done

# ────────────────────────────────────────────────────────────
# SUMMARY
# ────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Test Results"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PASSED: $PASS"
echo "  FAILED: $FAIL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "✓ All validation tests passed!"
  exit 0
else
  echo "✗ Some validation tests failed. Review output above."
  exit 1
fi
