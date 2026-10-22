#!/usr/bin/env bash
#
# Container smoke test: builds the image and runs it with its committed
# command (no overrides), then drives it over Streamable HTTP.
#
# Usage: ./scripts/container-smoke-test.sh
#
# Prerequisites: a running Docker daemon, Node.js and npx.
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE="mermaid-mcp:smoke-test"
CONTAINER="mermaid-mcp-smoke-$$"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILURES=0

log_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  FAILURES=$((FAILURES + 1))
}

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

CLIENT_TIMEOUT_SECONDS=90
# Pinned so a new Inspector release cannot silently change client behavior
INSPECTOR="@modelcontextprotocol/inspector@2.12.0"

# Runs one Inspector CLI call, killed after CLIENT_TIMEOUT_SECONDS so a server
# that never answers fails the check instead of hanging the script.
inspector() {
  npx --yes "$INSPECTOR" --cli \
    --server-url "$MCP_URL" --transport http "$@" 2>/dev/null &
  local pid=$!
  ( sleep "$CLIENT_TIMEOUT_SECONDS" && kill "$pid" 2>/dev/null ) &
  local watchdog=$!
  local status=0
  wait "$pid" || status=$?
  kill "$watchdog" 2>/dev/null || true
  return "$status"
}

# Prints "true" when a tools/call result's JSON payload has ok: true.
tool_ok() {
  node -e '
    let raw = "";
    process.stdin.on("data", (c) => (raw += c));
    process.stdin.on("end", () => {
      try {
        const result = JSON.parse(raw);
        console.log(JSON.parse(result.content[0].text).ok === true);
      } catch {
        console.log(false);
      }
    });
  '
}

log_info "Building image"
docker build -q -t "$IMAGE" "$PROJECT_ROOT" >/dev/null

CMD_JSON=$(docker image inspect --format '{{json .Config.Cmd}}' "$IMAGE")
if [[ "$CMD_JSON" == *'"--http=8000"'* && "$CMD_JSON" != *supergateway* ]]; then
  log_pass "Image command runs the server with --http=8000: $CMD_JSON"
else
  log_fail "Image command is not the server binary with --http=8000: $CMD_JSON"
fi

HEALTHCHECK_JSON=$(docker image inspect --format '{{json .Config.Healthcheck}}' "$IMAGE")
if [[ "$HEALTHCHECK_JSON" == *"/health"* ]]; then
  log_pass "Image declares a health check on /health"
else
  log_fail "Image declares no /health health check: $HEALTHCHECK_JSON"
fi

if docker run --rm --entrypoint sh "$IMAGE" -c 'command -v supergateway' >/dev/null 2>&1; then
  log_fail "supergateway is still installed in the image"
else
  log_pass "No gateway installed in the image"
fi

log_info "Starting container with its committed command"
docker run -d --name "$CONTAINER" -p 127.0.0.1::8000 "$IMAGE" >/dev/null
HOST_PORT=$(docker port "$CONTAINER" 8000/tcp | head -1 | sed 's/.*://')
BASE_URL="http://127.0.0.1:${HOST_PORT}"
MCP_URL="${BASE_URL}/mcp"

for _ in $(seq 1 60); do
  if curl -fsS --max-time 5 "${BASE_URL}/health" >/dev/null 2>&1; then break; fi
  sleep 1
done

if [[ "$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "${BASE_URL}/health")" == "200" ]]; then
  log_pass "/health answers 200"
else
  log_fail "/health did not answer 200"
  docker logs "$CONTAINER" || true
fi

SSE_BODY=$(mktemp)
SSE_STATUS=$(curl -s --max-time 5 -o "$SSE_BODY" -w '%{http_code}' "${BASE_URL}/sse" || true)
if [[ "$SSE_STATUS" == "410" ]] && grep -q -- "--transport http" "$SSE_BODY"; then
  log_pass "/sse answers 410 with the new-transport hint"
else
  log_fail "/sse answered $SSE_STATUS without the hint"
fi
rm -f "$SSE_BODY"

log_info "Running two HTTP clients concurrently"
LIST_A_FILE=$(mktemp)
LIST_B_FILE=$(mktemp)
inspector --method tools/list >"$LIST_A_FILE" &
PID_A=$!
inspector --method tools/list >"$LIST_B_FILE" &
PID_B=$!
wait "$PID_A" "$PID_B" || true
for listing_file in "$LIST_A_FILE" "$LIST_B_FILE"; do
  listing=$(cat "$listing_file")
  if [[ "$listing" == *mermaid_to_svg* && "$listing" == *mermaid_to_deck* ]]; then
    log_pass "Client listed tools"
  else
    log_fail "Client could not list tools: $listing"
  fi
done
rm -f "$LIST_A_FILE" "$LIST_B_FILE"

RENDER_A_FILE=$(mktemp)
RENDER_B_FILE=$(mktemp)
inspector --method tools/call --tool-name mermaid_to_svg \
  --tool-arg 'code=graph TD; Alpha-->Beta' >"$RENDER_A_FILE" &
PID_A=$!
inspector --method tools/call --tool-name mermaid_to_svg \
  --tool-arg 'code=graph TD; Gamma-->Delta' >"$RENDER_B_FILE" &
PID_B=$!
wait "$PID_A" "$PID_B" || true
for render in "$RENDER_A_FILE" "$RENDER_B_FILE"; do
  if [[ "$(tool_ok <"$render")" == "true" ]]; then
    log_pass "Concurrent client render succeeded"
  else
    log_fail "Concurrent client render failed: $(cat "$render")"
  fi
done
rm -f "$RENDER_A_FILE" "$RENDER_B_FILE"

RUNNING=$(docker inspect --format '{{.State.Running}} {{.RestartCount}}' "$CONTAINER")
if [[ "$RUNNING" == "true 0" ]]; then
  log_pass "Container still running with no restarts"
else
  log_fail "Container state after clients: $RUNNING"
  docker logs "$CONTAINER" || true
fi

if [[ "$FAILURES" -gt 0 ]]; then
  echo -e "${RED}${FAILURES} container smoke check(s) failed${NC}"
  exit 1
fi
echo -e "${GREEN}All container smoke checks passed${NC}"
