#!/usr/bin/env bash
#
# Integration tests for MCP server using MCP Inspector CLI
# Runs against the built server (dist/index.js)
#
# Usage: ./scripts/integration-test.sh
#
# Prerequisites:
#   - npm run build must have been run first
#   - Node.js and npx available
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more tests failed
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_CMD="node dist/index.js"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

log_info() {
  echo -e "${YELLOW}[INFO]${NC} $1"
}

log_pass() {
  echo -e "${GREEN}[PASS]${NC} $1"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  TESTS_FAILED=$((TESTS_FAILED + 1))
}

# Run MCP Inspector CLI and capture output
# Usage: run_mcp_cli <method> [additional args...]
run_mcp_cli() {
  local method="$1"
  shift
  cd "$PROJECT_ROOT"
  npx --yes @modelcontextprotocol/inspector --cli $SERVER_CMD --method "$method" "$@" 2>/dev/null
}

# Assert that output contains expected string
# Usage: assert_contains <output> <expected> <test_name>
assert_contains() {
  local output="$1"
  local expected="$2"
  local test_name="$3"
  TESTS_RUN=$((TESTS_RUN + 1))

  if echo "$output" | grep -q "$expected"; then
    log_pass "$test_name"
    return 0
  else
    log_fail "$test_name - expected to contain: $expected"
    echo "  Actual output: $output"
    return 1
  fi
}

# Assert JSON field equals expected value
# Usage: assert_json_field <output> <field> <expected> <test_name>
assert_json_field() {
  local output="$1"
  local field="$2"
  local expected="$3"
  local test_name="$4"
  TESTS_RUN=$((TESTS_RUN + 1))

  # Extract the inner JSON from the MCP response
  local inner_json
  inner_json=$(echo "$output" | grep -o '"text": *"[^"]*"' | sed 's/"text": *"//;s/"$//' | sed 's/\\n/\n/g' | sed 's/\\"/"/g')

  local actual
  actual=$(echo "$inner_json" | grep -o "\"$field\": *\"[^\"]*\"" | sed "s/\"$field\": *\"//;s/\"$//" || echo "$inner_json" | grep -o "\"$field\": *[^,}]*" | sed "s/\"$field\": *//" | tr -d ' ')

  if [[ "$actual" == "$expected" ]]; then
    log_pass "$test_name"
    return 0
  else
    log_fail "$test_name - expected $field=$expected, got $field=$actual"
    return 1
  fi
}

# ============================================================================
# Test Suite
# ============================================================================

echo ""
echo "========================================"
echo "MCP Server Integration Tests"
echo "========================================"
echo ""

# Check that dist/index.js exists
if [[ ! -f "$PROJECT_ROOT/dist/index.js" ]]; then
  echo -e "${RED}ERROR:${NC} dist/index.js not found. Run 'npm run build' first."
  exit 1
fi

log_info "Testing server: $SERVER_CMD"
echo ""

# ----------------------------------------------------------------------------
# Test: tools/list - Server exposes healthcheck tool
# ----------------------------------------------------------------------------
log_info "Test: tools/list - Server exposes healthcheck tool"

output=$(run_mcp_cli "tools/list")
assert_contains "$output" '"name": "healthcheck"' "healthcheck tool is listed"
assert_contains "$output" '"description":' "tool has description"
assert_contains "$output" '"inputSchema":' "tool has input schema"

echo ""

# ----------------------------------------------------------------------------
# Test: healthcheck - Basic invocation (no params)
# ----------------------------------------------------------------------------
log_info "Test: healthcheck - Basic invocation (no params)"

output=$(run_mcp_cli "tools/call" --tool-name healthcheck)
# Note: Output contains escaped JSON within a JSON string, patterns match escaped format
assert_contains "$output" 'ok\\": true' "returns ok=true"
assert_contains "$output" 'status\\": \\"healthy' "returns status=healthy"
assert_contains "$output" 'version\\":' "returns version"
assert_contains "$output" 'timestamp\\":' "returns timestamp"

echo ""

# ----------------------------------------------------------------------------
# Test: healthcheck - Echo parameter
# ----------------------------------------------------------------------------
log_info "Test: healthcheck - Echo parameter"

output=$(run_mcp_cli "tools/call" --tool-name healthcheck --tool-arg "echo=integration-test-value")
assert_contains "$output" 'echo\\": \\"integration-test-value' "echoes exact value"

echo ""

# ----------------------------------------------------------------------------
# Test: healthcheck - Special characters in echo
# ----------------------------------------------------------------------------
log_info "Test: healthcheck - Special characters in echo"

output=$(run_mcp_cli "tools/call" --tool-name healthcheck --tool-arg "echo=hello-world-123")
assert_contains "$output" 'echo\\": \\"hello-world-123' "handles alphanumeric with dashes"

echo ""

# ============================================================================
# Summary
# ============================================================================

echo "========================================"
echo "Integration Test Summary"
echo "========================================"
echo ""
echo "Tests run:    $TESTS_RUN"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [[ $TESTS_FAILED -gt 0 ]]; then
  echo -e "${RED}INTEGRATION TESTS FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}ALL INTEGRATION TESTS PASSED${NC}"
  exit 0
fi
