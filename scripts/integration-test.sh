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

# ----------------------------------------------------------------------------
# Test: tools/list - Server exposes mermaid_to_svg tool
# ----------------------------------------------------------------------------
log_info "Test: tools/list - Server exposes mermaid_to_svg tool"

output=$(run_mcp_cli "tools/list")
assert_contains "$output" '"name": "mermaid_to_svg"' "mermaid_to_svg tool is listed"
assert_contains "$output" 'Render Mermaid diagram source code to SVG' "mermaid_to_svg has description"

echo ""

# ----------------------------------------------------------------------------
# Test: mermaid_to_svg - Basic flowchart rendering
# ----------------------------------------------------------------------------
log_info "Test: mermaid_to_svg - Basic flowchart rendering"

output=$(run_mcp_cli "tools/call" --tool-name mermaid_to_svg --tool-arg "code=graph TD; A-->B;")
assert_contains "$output" 'ok\\": true' "returns ok=true"
assert_contains "$output" 'request_id\\":' "returns request_id"
assert_contains "$output" '<svg' "returns SVG content"

echo ""

# ----------------------------------------------------------------------------
# Test: mermaid_to_svg - Invalid syntax returns error
# ----------------------------------------------------------------------------
log_info "Test: mermaid_to_svg - Invalid syntax returns error"

output=$(run_mcp_cli "tools/call" --tool-name mermaid_to_svg --tool-arg "code=invalid mermaid syntax @#$%")
assert_contains "$output" 'ok\\": false' "returns ok=false for invalid syntax"
assert_contains "$output" 'RENDER_FAILED' "returns RENDER_FAILED error code"

echo ""

# ----------------------------------------------------------------------------
# Test: mermaid_to_svg - Theme parameter
# ----------------------------------------------------------------------------
log_info "Test: mermaid_to_svg - Theme parameter"

output=$(run_mcp_cli "tools/call" --tool-name mermaid_to_svg --tool-arg "code=graph TD; A-->B;" --tool-arg "theme=dark")
assert_contains "$output" 'ok\\": true' "renders with dark theme"
assert_contains "$output" '<svg' "returns SVG content with theme"

echo ""

# ----------------------------------------------------------------------------
# Test: mermaid_to_svg - All 8 diagram types (T037)
# Note: Using "<svg" as assertion since it's simpler to grep in multiline output
# ----------------------------------------------------------------------------
log_info "Test: mermaid_to_svg - Flowchart diagram type"
output=$(run_mcp_cli "tools/call" --tool-name mermaid_to_svg --tool-arg "code=graph TD; A-->B-->C;")
assert_contains "$output" '<svg' "flowchart renders successfully"

log_info "Test: mermaid_to_svg - Sequence diagram type"
output=$(run_mcp_cli "tools/call" --tool-name mermaid_to_svg --tool-arg "code=sequenceDiagram
    Alice->>Bob: Hello
    Bob-->>Alice: Hi")
assert_contains "$output" '<svg' "sequence diagram renders successfully"

log_info "Test: mermaid_to_svg - Class diagram type"
output=$(run_mcp_cli "tools/call" --tool-name mermaid_to_svg --tool-arg "code=classDiagram
    Animal <|-- Duck
    Animal : +int age")
assert_contains "$output" '<svg' "class diagram renders successfully"

log_info "Test: mermaid_to_svg - State diagram type"
output=$(run_mcp_cli "tools/call" --tool-name mermaid_to_svg --tool-arg "code=stateDiagram-v2
    [*] --> Still
    Still --> Moving")
assert_contains "$output" '<svg' "state diagram renders successfully"

log_info "Test: mermaid_to_svg - ER diagram type"
output=$(run_mcp_cli "tools/call" --tool-name mermaid_to_svg --tool-arg "code=erDiagram
    CUSTOMER ||--o{ ORDER : places")
assert_contains "$output" '<svg' "ER diagram renders successfully"

log_info "Test: mermaid_to_svg - Gantt chart type"
output=$(run_mcp_cli "tools/call" --tool-name mermaid_to_svg --tool-arg "code=gantt
    title Project
    section Phase
    Task1 :a1, 2024-01-01, 30d")
assert_contains "$output" '<svg' "gantt chart renders successfully"

log_info "Test: mermaid_to_svg - Pie chart type"
output=$(run_mcp_cli "tools/call" --tool-name mermaid_to_svg --tool-arg 'code=pie title Pets
    "Dogs" : 50
    "Cats" : 30')
assert_contains "$output" '<svg' "pie chart renders successfully"

log_info "Test: mermaid_to_svg - Journey diagram type"
output=$(run_mcp_cli "tools/call" --tool-name mermaid_to_svg --tool-arg "code=journey
    title My Day
    section Morning
      Wake up: 5: Me")
assert_contains "$output" '<svg' "journey diagram renders successfully"

echo ""

# ----------------------------------------------------------------------------
# Test: tools/list - Server exposes mermaid_to_pdf tool
# ----------------------------------------------------------------------------
log_info "Test: tools/list - Server exposes mermaid_to_pdf tool"

output=$(run_mcp_cli "tools/list")
assert_contains "$output" '"name": "mermaid_to_pdf"' "mermaid_to_pdf tool is listed"
assert_contains "$output" 'Render Mermaid diagram source code to PDF' "mermaid_to_pdf has description"
assert_contains "$output" 'base64-encoded PDF' "mermaid_to_pdf describes base64 output"

echo ""

# ----------------------------------------------------------------------------
# Test: mermaid_to_pdf - Basic flowchart rendering
# ----------------------------------------------------------------------------
log_info "Test: mermaid_to_pdf - Basic flowchart rendering"

output=$(run_mcp_cli "tools/call" --tool-name mermaid_to_pdf --tool-arg "code=graph TD; A-->B;")
assert_contains "$output" 'ok\\": true' "returns ok=true"
assert_contains "$output" 'request_id\\":' "returns request_id"
assert_contains "$output" 'pdf\\":' "returns pdf field"
# PDF magic bytes in base64: %PDF- = JVBERi (first 6 chars of base64-encoded "%PDF-")
assert_contains "$output" 'JVBERi' "returns base64-encoded PDF content"

echo ""

# ----------------------------------------------------------------------------
# Test: mermaid_to_pdf - Invalid syntax returns error
# ----------------------------------------------------------------------------
log_info "Test: mermaid_to_pdf - Invalid syntax returns error"

output=$(run_mcp_cli "tools/call" --tool-name mermaid_to_pdf --tool-arg "code=invalid mermaid syntax @#$%")
assert_contains "$output" 'ok\\": false' "returns ok=false for invalid syntax"

echo ""

# ----------------------------------------------------------------------------
# Test: mermaid_to_pdf - Theme parameter
# ----------------------------------------------------------------------------
log_info "Test: mermaid_to_pdf - Theme parameter"

output=$(run_mcp_cli "tools/call" --tool-name mermaid_to_pdf --tool-arg "code=graph TD; A-->B;" --tool-arg "theme=dark")
assert_contains "$output" 'ok\\": true' "renders with dark theme"
assert_contains "$output" 'JVBERi' "returns PDF content with theme"

echo ""

# ----------------------------------------------------------------------------
# Test: mermaid_to_pdf - Sequence diagram rendering
# ----------------------------------------------------------------------------
log_info "Test: mermaid_to_pdf - Sequence diagram rendering"

output=$(run_mcp_cli "tools/call" --tool-name mermaid_to_pdf --tool-arg "code=sequenceDiagram
    Alice->>Bob: Hello
    Bob-->>Alice: Hi")
assert_contains "$output" 'ok\\": true' "sequence diagram renders to PDF"
assert_contains "$output" 'JVBERi' "returns PDF content for sequence diagram"

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
