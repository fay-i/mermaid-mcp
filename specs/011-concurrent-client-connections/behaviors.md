# Behaviors: Concurrent Client Connections Without Crashing

## Decisions (confirmed by the owner, 2026-10-22)

| # | Question | Decision |
|---|----------|----------|
| D1 | Transport approach | The server itself speaks Streamable HTTP, with one protocol server per session. No gateway process. |
| D2 | Selecting HTTP mode | `--http=<port>` on the existing binary. With no flag, the server runs stdio exactly as today. There are no new env vars. |
| D3 | Endpoint path | One MCP endpoint, `/mcp`. The old `/sse` and `/message` paths answer **410 Gone** with a hint that names the new transport and path. Any other unknown path answers 404. |
| D4 | Idle timeout | A session is released after **30 minutes** without requests. The period can be set when the HTTP server is constructed, so tests can shorten it. It is not exposed on the CLI. |
| D5 | Origin validation | Any request to `/mcp` that carries an `Origin` header is refused with **403**. Requests without `Origin` (Claude Code, Inspector CLI, curl, probes) pass. |
| D6 | Pull secret | Remove `imagePullSecrets: dockerhub-credentials` from the cluster manifests. |
| D7 | Volume permissions (uid 1000) | Deferred to the follow-up issue. |
| D8 | Compose drift | Change the compose file's transport, port, healthcheck and comments, and **drop the dead 3001 port**. The ignored storage env vars go to the follow-up issue. |
| D9 | "URL resolves" in local mode | For local storage, a file with the rendered bytes exists at the path the `file://` URL names. For S3, fetching the presigned URL within its expiry returns the rendered bytes. |
| D10 | Proving AC-11 | A container smoke test drives the built image with its committed command. After merge, a recorded live checklist covers the cluster manifests. |

**Follow-up issue (to file, not part of this feature):**
- compose storage env vars that `main()` ignores (`STORAGE_TYPE=auto`, `LOCAL_URL_SCHEME`, `CDN_*`, `MERMAID_S3_*`)
- the image volume is not writable by uid 1000
- `file://` artifact URLs cannot be reached by remote clients

---

## B001: Parse the HTTP opt-in flag
**From**: AC-16, AC-11 | **Depends on**: —
**Action**: Read `--http=<port>` from the command line, in any position relative to the data-directory argument.
**Input**: argv: string[]
**Output**: `{ dataDir, httpPort }`. `httpPort` is undefined when the flag is absent.
**Test**: Given argv `["--http=8000", "/data"]`, when parsed, then `httpPort` is 8000 and `dataDir` is `/data`

### Branches
- **B001a: Flag after the data dir**
  Input: `["/data", "--http=8000"]` | Output: same as B001 | Test: Given the flag comes last, when parsed, then the result is identical
- **B001b: No flag**
  Input: `["/data"]` | Output: `httpPort` undefined | Test: Given no flag, when parsed, then the mode is stdio
- **B001c: Port 0**
  Input: `["--http=0", "/data"]` | Output: `httpPort` 0, meaning any free port | Test: Given port 0, when parsed, then it is accepted
- **B001d: Invalid port**
  Input: `--http=abc`, `--http=70000`, `--http=-1`, `--http=` or a bare `--http` | Output: exit 1, with stderr naming the flag and the valid range | Test: Given each invalid form, when the binary runs, then it exits 1 with that message and never listens
- **B001e: S3 mode without data dir**
  Input: `["--http=8000"]` with `STORAGE_TYPE=s3` | Output: accepted, `dataDir` undefined | Test: Given S3 env and only the flag, when parsed, then there is no "data directory required" error
- **B001f: Help text**
  Input: `--help` | Output: usage lists `--http=<port>` | Test: Given `--help`, when run, then stderr documents the flag and exit is 0

## B002: Run over stdio when not opted in
**From**: AC-16 | **Depends on**: B001
**Action**: Without `--http`, serve every tool over stdin/stdout exactly as today.
**Input**: `npx @fay-i/mermaid-mcp <dir>`; each tool call
**Output**: Unchanged responses. Artifacts are stored under `<dir>`, and each call gets its own session, as today.
**Test**: Given the binary started with only a data dir, when the existing stdio integration suite runs every tool, then every check passes unchanged

### Branches
- **B002a: No network listener**
  Input: stdio start | Output: the process opens no listening socket | Test: Given stdio mode, when it starts, then no port is bound

## B003: Start an HTTP server that answers health checks
**From**: AC-10, AC-11 | **Depends on**: B001
**Action**: With `--http=<port>`, listen on that port and answer `GET /health`.
**Input**: `--http=<port>`; `GET /health`
**Output**: 200 with a short healthy body. The bound port is logged to stderr.
**Test**: Given the server started with `--http=0`, when `GET /health` is sent, then the response is 200

### Branches
- **B003a: Port already in use**
  Input: `--http=<busy port>` | Output: exit 1 with a message naming the port | Test: Given an occupied port, when started, then it exits 1 with that message
- **B003b: Wrong method on /mcp**
  Input: `PUT /mcp` | Output: 405 | Test: Given the server, when `PUT /mcp` is sent, then 405 is returned and the server keeps serving

## B004: Open a session on initialize
**From**: AC-1, AC-7 | **Depends on**: B003
**Action**: When a client sends an initialize request to `/mcp` with no session ID, create a new session and return its ID.
**Input**: POST `/mcp` initialize request, no `Mcp-Session-Id`
**Output**: A successful initialize result, plus an `Mcp-Session-Id` response header holding a UUID
**Test**: Given a running HTTP server, when a client completes the handshake, then it receives a UUID session ID

### Branches
- **B004a: Distinct IDs**
  Input: two initializes | Output: two different UUIDs | Test: Given two handshakes, when compared, then the IDs differ

## B005: Serve every tool within a session
**From**: AC-1, AC-3 | **Depends on**: B004
**Action**: Route requests that carry a known session ID to that session, and answer tool listing and tool calls.
**Input**: `tools/list`, plus a call to each of healthcheck, SVG, PDF and deck, all with the session ID
**Output**: All four tools listed, and each call returns the same result shape a stdio client gets for the same input
**Test**: Given an initialized client, when it lists tools and calls each one, then all four are listed and every call succeeds

## B006: End a session on client DELETE
**From**: AC-5, AC-15 | **Depends on**: B005
**Action**: When a client sends DELETE for its session, close that session and release it.
**Input**: DELETE `/mcp` with the session ID
**Output**: A success status. Later requests with that ID are refused (B007).
**Test**: Given an open session, when the client closes it cleanly, then the next request with that ID gets 404

## B007: Refuse unknown, closed, or missing sessions
**From**: AC-15 | **Depends on**: B004
**Action**: Reject requests whose session ID the server does not hold, and non-initialize requests that carry no session ID.
**Input**: POST `/mcp` with a made-up UUID, a closed session's ID, or a non-UUID string
**Output**: 404 with a JSON-RPC error telling the client to start a new session. The server keeps running.
**Test**: Given a running server, when a request names a made-up session ID, then it gets 404 with that error and a following fresh handshake succeeds

### Branches
- **B007a: No session ID on a non-initialize request**
  Input: `tools/list` without `Mcp-Session-Id` | Output: 400 | Test: Given no session header, when a non-initialize request arrives, then 400 is returned
- **B007b: Session from before a restart**
  Input: an ID issued by a previous server instance | Output: 404 | Test: Given a server restarted after issuing an ID, when that ID is used, then 404 is returned
- **B007c: Malformed body**
  Input: POST `/mcp` with invalid JSON | Output: 400 JSON-RPC parse error | Test: Given garbage bytes, when posted, then 400 is returned and the server keeps serving

## B008: Accept twenty sequential clients
**From**: AC-1 | **Depends on**: B005, B006
**Action**: Serve clients that connect, list tools and disconnect one after another.
**Input**: 20 clients in sequence
**Output**: Each connects and lists all four tools. The server process stays alive throughout.
**Test**: Given a running server, when 20 clients each do handshake → list → close in sequence, then all 20 succeed and the same process is still serving

## B009: Survive an abrupt client disconnect
**From**: AC-2 | **Depends on**: B005
**Action**: Keep serving after a client drops its connection without closing its session.
**Input**: Client A initializes, then its sockets are destroyed with no DELETE. Client B then connects.
**Output**: B connects and its tool calls succeed. The server process stays alive.
**Test**: Given client A vanished mid-session, when client B connects and calls a tool, then B succeeds and the server is still the same process

### Branches
- **B009a: Drop while a stream is open**
  Input: A disconnects while holding an open server-to-client stream | Output: same as B009 | Test: Given an open GET stream is cut, when B connects, then B succeeds
- **B009b: Drop during its own render**
  Input: A's sockets are destroyed while A's own render is in flight | Output: the render settles (completes or is discarded) without crashing the server, and the next client's render succeeds | Test: Given A mid-render, when A vanishes, then the server stays up and B's render that follows succeeds

## B010: Release idle sessions
**From**: AC-2 (spec Q3), Edge cases | **Depends on**: B007
**Action**: Close a session that has had no requests for the idle period (default 30 minutes).
**Input**: A session idle longer than the configured period
**Output**: The session is released, and its next request gets 404 (B007), so the client re-initializes
**Test**: Given a server built with a short idle period, when a session sits idle past it, then its next request gets 404

### Branches
- **B010a: Activity resets the clock**
  Input: requests spaced shorter than the idle period | Output: the session stays open | Test: Given regular requests, when total time exceeds the period, then the session still works
- **B010b: Handshake never followed up**
  Input: initialize, then silence | Output: released after the idle period | Test: Given a session with no follow-up, when the period passes, then it is gone
- **B010c: Other clients undisturbed**
  Input: one idle session and one active session | Output: only the idle one is released | Test: Given both, when the period passes, then the active client's calls keep succeeding

## B011: Serve concurrent clients with every tool
**From**: AC-3 | **Depends on**: B005
**Action**: Serve two connected clients at the same time, each calling every tool.
**Input**: Clients A and B both initialized; each calls healthcheck, SVG, PDF and deck
**Output**: Every call succeeds, with results matching what a lone client gets for the same input
**Test**: Given two open sessions, when both call all four tools concurrently, then all eight calls succeed with the expected result shapes

## B012: Keep overlapping renders separate
**From**: AC-4 | **Depends on**: B011
**Action**: When two clients start renders of different diagrams at the same moment, return each client's own result.
**Input**: A renders diagram X and B renders diagram Y, started together
**Output**: A gets X's artifact and B gets Y's, never swapped
**Test**: Given distinguishable diagrams X and Y started concurrently, when results return, then A's artifact contains X's content and B's contains Y's

## B013: Isolate one client's departure from another's session
**From**: AC-5 | **Depends on**: B006, B009, B011
**Action**: When client A leaves, keep client B's session and any in-progress render intact.
**Input**: A disconnects (cleanly by DELETE, or abruptly) while B has a render in flight
**Output**: B's render completes successfully, and B's next calls succeed with the same session ID and no reconnect
**Test**: Given B mid-render, when A disconnects, then B's render returns successfully and B's next tool call succeeds in the same session

### Branches
- **B013a: Clean departure** | Input: A sends DELETE | Output: as B013 | Test: as B013
- **B013b: Abrupt departure** | Input: A's sockets are destroyed | Output: as B013 | Test: as B013

## B014: Group one connection's artifacts under its session
**From**: AC-7 | **Depends on**: B005
**Action**: Store every artifact a client renders during one connection under that connection's session ID.
**Input**: One client renders an SVG, a PDF and a deck
**Output**: All artifacts are stored under one session, equal to the client's `Mcp-Session-Id`
**Test**: Given one session, when it renders three artifacts, then every artifact's storage location carries that session ID

## B015: Keep different clients' artifacts apart
**From**: AC-6 | **Depends on**: B014, B011
**Action**: Store each client's artifacts only under its own session.
**Input**: A and B each render artifacts concurrently
**Output**: No artifact of A's sits under B's session, and the reverse
**Test**: Given two sessions rendering concurrently, when their artifact locations are compared, then the two sets share no session

## B016: Store concurrent artifacts in either storage mode
**From**: AC-8 | **Depends on**: B015
**Action**: Store concurrent clients' artifacts using whichever storage mode is configured, and return a URL that resolves to the rendered file (D9).
**Input**: Concurrent renders, with local storage configured
**Output**: Each artifact exists at the path its `file://` URL names, with the rendered bytes
**Test**: Given local storage and two concurrent clients, when each renders, then each returned URL's path holds the rendered bytes

### Branches
- **B016a: S3 storage**
  Input: concurrent renders with `STORAGE_TYPE=s3`, against an object-store test double | Output: each artifact is stored under its session, and its presigned URL resolves to the rendered bytes | Test: Given S3 mode and two concurrent clients, when each renders, then each object exists under its client's session key and its URL resolves

## B017: Keep artifact URLs valid after the connection ends
**From**: AC-9 | **Depends on**: B016, B006, B010
**Action**: Leave stored artifacts untouched when their session closes, by DELETE, abrupt drop or idle release.
**Input**: Client A renders and gets its URL, disconnects, then other clients connect and leave
**Output**: A's URL still resolves to the same bytes (within the presign window for S3)
**Test**: Given A's URL captured, when A's session ends and two more clients come and go, then the URL still resolves to identical bytes

## B018: Answer health probes under any load without creating sessions
**From**: AC-10 | **Depends on**: B003, B011
**Action**: Answer `/health` with healthy status at all times, apart from session handling.
**Input**: `GET /health` with no clients, with several clients connected, and during in-progress renders
**Output**: 200 every time. No `Mcp-Session-Id` header is issued, and no session is created.
**Test**: Given each load condition, when `/health` is probed repeatedly, then every response is 200 and carries no session ID

### Branches
- **B018a: Probe carries a stray session header**
  Input: `GET /health` with a bogus `Mcp-Session-Id` | Output: 200 | Test: Given a junk header, when probed, then health still answers 200

## B019: Refuse old SSE clients clearly
**From**: AC-14 | **Depends on**: B003
**Action**: Answer requests on the old SSE endpoints with 410 and a hint that names the new transport and path (D3).
**Input**: `GET /sse`, `POST /message`
**Output**: 410 with a body naming `--transport http` and the `/mcp` path. The server keeps serving.
**Test**: Given a running server, when `GET /sse` is sent, then 410 is returned with the hint and a following `/mcp` handshake succeeds

### Branches
- **B019a: POST /message** | Input: `POST /message?sessionId=x` | Output: 410 with the hint | Test: as B019
- **B019b: Any other path** | Input: `GET /nope` | Output: 404 | Test: Given an unknown path, when requested, then 404 is returned
- **B019c: Real SSE client** | Input: an old-transport protocol client pointed at `/sse` | Output: the client reports a connection error, and the server stays up | Test: Given an SSE-transport client, when it connects, then it fails and a new HTTP client then succeeds

## B020: Refuse requests that carry an Origin header
**From**: AC-14, AC-15 (protocol security MUST) | **Depends on**: B004
**Action**: Reject any `/mcp` request that carries an `Origin` header (D5).
**Input**: POST `/mcp` initialize with `Origin: http://evil.example`
**Output**: 403, and no session is created
**Test**: Given an `Origin` header, when an initialize is posted, then 403 is returned and no `Mcp-Session-Id` is issued

### Branches
- **B020a: No Origin** | Input: no `Origin` header | Output: normal handling | Test: covered by B004

## B021: Survive a burst of connections
**From**: AC-1, Edge cases | **Depends on**: B004
**Action**: Accept many handshakes that arrive at once.
**Input**: 25 clients initializing concurrently
**Output**: All get distinct sessions and can list tools. The server stays up.
**Test**: Given 25 concurrent handshakes, when all complete, then each succeeds with a unique session ID

### Branches
- **B021a: Connection that never sends a request**
  Input: a raw TCP connection that opens and stays silent | Output: other clients are unaffected | Test: Given a silent socket, when a real client connects, then it succeeds

## B022: Close sessions gracefully on shutdown
**From**: AC-11, Edge cases (server restart) | **Depends on**: B005
**Action**: On SIGTERM, close every open session, stop listening, and exit 0.
**Input**: SIGTERM with two open sessions
**Output**: The process exits 0 promptly, and open streams end rather than hang
**Test**: Given two connected clients, when the process gets SIGTERM, then it exits 0 within a few seconds

## B023: Serve HTTP from the container image's own command
**From**: AC-11 | **Depends on**: B008, B011, B018, B019
**Action**: The published image, started with its committed command and no overrides, serves `/mcp` and `/health` on port 8000.
**Input**: `docker run` of the built image with port 8000 published
**Output**: `/health` returns 200, two HTTP clients each list tools and render, and `/sse` returns 410
**Test**: Given a freshly built image, when the container smoke test runs, then all checks pass and the container is still running

### Branches
- **B023a: No gateway in the image**
  Input: the built image | Output: the container's command runs the server binary directly | Test: Given the image, when its configured command is inspected, then it is the server binary with `--http=8000`

## B024: Make the cluster manifests deployable as committed
**From**: AC-11 | **Depends on**: B023
**Action**: Applying the committed cluster manifests produces a pod that uses the S3 secret, serves on the documented address, and passes its probes.
**Input**: The committed manifests
**Output**: The deployment pulls its env from the `mermaid-s3-credentials` secret by name, has no `imagePullSecrets`, has no port named `sse`, and probes `/health` on 8000. The Service keeps 8100 → 8000.
**Test**: Given the committed manifests, when parsed, then each property above holds.
**Live checklist (post-merge, results recorded in the PR):**
1. CI publishes `:latest`.
2. Run `kubectl apply -k k8s/` and `kubectl -n mermaid-mcp rollout restart deploy/mermaid-mcp`.
3. `kubectl diff -k k8s/` shows only server-managed fields.
4. The restart count stays flat across 20 sequential connections and one abrupt drop.

## B025: Align the compose file with HTTP mode
**From**: AC-11 | **Depends on**: B023
**Action**: The compose file runs the server in HTTP mode on 8000 and health-checks `/health`.
**Input**: The committed compose file
**Output**: The only published port is 8000 (3001 removed, D8). The healthcheck targets `/health`. Comments describe Streamable HTTP at `/mcp`, not SSE.
**Test**: Given the committed compose file, when parsed, then the ports, healthcheck and absence of SSE references hold

## B026: Document exactly one remote connection
**From**: AC-12 | **Depends on**: B023
**Action**: The README gives a single remote-client section with one address, one transport, and the exact Claude Code command.
**Input**: The README
**Output**: The section names `http://10.42.1.81:8100/mcp` and transport `http`, and includes `claude mcp add --scope user --transport http mermaid-mcp http://10.42.1.81:8100/mcp`. Nothing documents `--transport sse` or `/sse` as a connection option. The stdio `npx` section is unchanged.
**Test**: Given the README, when scanned, then exactly one remote address and transport appear with that command, and no SSE connection instructions remain

## B027: Re-add the known client with the documented commands
**From**: AC-13 | **Depends on**: B024, B026
**Action**: A Claude Code configured with the old SSE entry is switched over using the README's remove and add commands.
**Input**: `claude mcp remove --scope user mermaid-mcp`, then the README's add command
**Output**: Claude Code connects, and every tool works
**Test (live checklist)**: Given the deployed server, when the old entry is removed and re-added, then `claude mcp list` shows it connected and each of the four tools succeeds from a session

## B028: Keep a slow PDF phase from crashing the server
**From**: AC-3, AC-10 (server never restarts) | **Depends on**: B011
**Added during implementation**: full-suite runs under concurrent load hit an unhandled `PDF_TIMEOUT` rejection in `mermaid_to_pdf`. Its timer started before page setup was awaited, so nothing was listening when it fired. In a long-lived HTTP server, Node turns that into a process crash. The deck renderer had already fixed the same bug.
**Action**: Race the whole PDF phase (page setup and printing) against its time budget.
**Input**: A PDF render whose page setup is slower than the PDF budget, or never settles
**Output**: `RENDER_TIMEOUT` within budget, and no unhandled rejection
**Test**: Given a page whose setContent outlasts the budget, when `mermaid_to_pdf` runs, then it returns RENDER_TIMEOUT and no unhandled rejection is raised

### Branches
- **B028a: Hung setContent**
  Input: setContent never settles | Output: RENDER_TIMEOUT within budget | Test: Given a hung setContent, when rendering, then it returns within 2 s with RENDER_TIMEOUT

---

## Coverage Matrix
| AC | Behaviors |
|----|-----------|
| AC-1 | B004, B005, B008, B021 |
| AC-2 | B009, B010 |
| AC-3 | B005, B011, B028 |
| AC-4 | B012 |
| AC-5 | B006, B013 |
| AC-6 | B015 |
| AC-7 | B004, B014 |
| AC-8 | B016 |
| AC-9 | B017 |
| AC-10 | B003, B018, B028 |
| AC-11 | B001, B003, B022, B023, B024, B025 |
| AC-12 | B026 |
| AC-13 | B027 |
| AC-14 | B019, B020 |
| AC-15 | B006, B007, B020 |
| AC-16 | B001, B002 |

| Edge case | Behaviors |
|-----------|-----------|
| Handshake never completed | B010b, B021a |
| Rapid burst of connections | B021 |
| Brief network loss and reconnect | B007, B009 |
| Server restart | B007b, B022 |
| Disconnect during own render | B009b |
| Long idle without disconnecting | B010 |
