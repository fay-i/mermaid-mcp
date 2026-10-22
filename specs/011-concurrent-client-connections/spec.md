# Spec: Concurrent Client Connections Without Crashing

## User Story
**As a** developer running Claude Code sessions on several machines against the one deployed mermaid server,
**I want to** connect, use every tool, and disconnect whenever I like, at the same time as other sessions or one after another,
**So that** no session is refused or cut off because another session connected or left, and the server stays up instead of restarting.

## Current Behavior (why this matters)

- The deployed server accepts exactly one client connection for its whole life. The second connection, even after the first has gone, crashes the process, and the cluster restarts it. The homelab pod has restarted 3,207 times in 155 days. In practice every other client fails to connect, and a session in progress drops whenever someone else connects.
- Artifact separation today is **per tool call, not per client**. Behind the deployed server the tool handlers never receive a session identity, so each render gets a freshly generated session of its own. "Separated by session" therefore means no two calls ever share a session; it does not mean one client's artifacts are grouped together.

## Acceptance Criteria

### AC-1: Sequential connections all succeed
- **Given** the deployed server is running
- **When** twenty clients connect one after another, each completing the protocol handshake, listing tools, and disconnecting cleanly
- **Then** every one of the twenty connects and lists all tools, and the server process never restarts

### AC-2: An abrupt disconnect does not break the next client
- **Given** a client is connected to the deployed server
- **When** that client vanishes without closing its session (killed process, dropped network), and a new client then connects
- **Then** the new client connects and its tool calls succeed, and the server process never restarts

### AC-3: Concurrent clients each get working tools
- **Given** two clients are connected to the deployed server at the same time
- **When** each calls every tool (healthcheck, SVG, PDF, deck)
- **Then** each receives a successful result for every call, matching what a lone client would get for the same input

### AC-4: Overlapping calls are not crossed
- **Given** two clients are connected at the same time
- **When** both start renders of different diagrams at the same moment
- **Then** each client receives the result for its own diagram, never the other client's

### AC-5: One client leaving does not end another's session
- **Given** clients A and B are connected
- **When** A disconnects, cleanly or abruptly, including while B has a render in progress
- **Then** B's in-progress render completes, and B's next tool calls succeed in the same session with no reconnect

### AC-6: Different clients' artifacts never mix
- **Given** clients A and B are connected at the same time
- **When** each renders artifacts
- **Then** no artifact of A's is stored under a session that holds B's artifacts, and the reverse

### AC-7: A client's artifacts are grouped under its session
- **Given** a client is connected
- **When** it renders several artifacts during one connection
- **Then** those artifacts are grouped under one session belonging to that connection

### AC-8: Both storage modes keep working
- **Given** the server is deployed with local disk storage, or separately with cloud object storage
- **When** concurrent clients render artifacts
- **Then** every artifact is stored by the configured mode and its returned URL resolves to the rendered file

### AC-9: Artifact URLs outlive the connection
- **Given** a client rendered an artifact and received its URL
- **When** that client disconnects, and other clients connect and leave afterwards
- **Then** the URL still resolves to the same file

### AC-10: Health check keeps answering
- **Given** the deployed server is running
- **When** the cluster's liveness and readiness probes call the health check while no clients are connected, while several are connected, and while renders are in progress
- **Then** every probe gets a healthy answer, and probes are never counted or handled as client sessions

### AC-11: The repo's deploy produces the working server
- **Given** the image published by CI from `main`, and the repo's cluster manifests and compose file
- **When** the server is deployed by applying those files as they are in the repo, with no hand edits
- **Then** the running server meets AC-1 through AC-10 at the connection address the README documents

### AC-12: One documented connection for clients
- **Given** a user reads the README to connect a remote client
- **When** they follow its client configuration instructions
- **Then** the README names exactly one connection address and one transport for the deployed server, including the exact Claude Code command to add it, and following it yields a working connection

### AC-13: Re-adding the known client
- **Given** one machine's Claude Code is configured with the old address (`claude mcp add --scope user --transport sse mermaid-mcp http://10.42.1.81:8100/sse`)
- **When** its owner removes that entry and re-adds the server with the command the README documents
- **Then** that Claude Code connects and every tool works

### AC-14: Old client configuration fails safely
- **Given** a client still configured with the old connection address and transport
- **When** it tries to connect to the updated server
- **Then** it gets a clear refusal, and the server keeps running and keeps serving other clients

### AC-15: Unknown or expired sessions are refused safely
- **Given** the deployed server is running
- **When** a request arrives naming a session the server does not know (made up, already closed, or from before a restart)
- **Then** the request is refused with an error telling the client to start a new session, and the server keeps running

### AC-16: Local use over standard input/output is unchanged
- **Given** the published package started locally with a data directory (`npx @fay-i/mermaid-mcp <dir>`)
- **When** a client uses every tool over standard input/output
- **Then** every tool behaves exactly as it does today, including where artifacts are stored

## Edge Cases
- A client opens a connection but never completes the handshake; the server keeps serving others and releases that connection's resources eventually.
- Many clients connect in a rapid burst; none crash the server.
- A client loses its network briefly and reconnects; it gets a working session (a new one if the old one is gone).
- The server restarts (deploy, node reboot); connected clients must reconnect, and the new sessions work.
- A client disconnects while its own render is in flight; the render ends or is discarded without leaking resources or affecting other clients.
- A client idles for a long time without disconnecting; its session is released after an idle period without disturbing active clients.

## Out of Scope
- Authentication or access control
- TLS
- An ingress, DNS name, or any new public address
- Running more than one replica, or sessions shared across replicas
- Sessions that survive a server restart
- Moving or regrouping artifacts already stored
- Any change to tool inputs, outputs, or error codes

## Clarifications (confirmed by the owner, 2026-10-22)

**Q1. Should the old connection address keep working alongside the new one?**
Answer: **no.** One documented address and transport, as the brief asks. A client on the old configuration gets a clear refusal, never a crash (AC-14), and re-adds with the README command (AC-13).

**Q2. Should a client's artifacts share one session for the whole connection, or keep today's one-session-per-call?**
Answer: **one session per connection.** That is what "separated by session" most plausibly means, and it is what the session plumbing was built for. It changes today's layout, where every call gets its own session: new artifacts from one connection land together. Artifacts already stored are left where they are.

**Q3. Should sessions whose client vanished without disconnecting be released after an idle period?**
Answer: **yes**, released after an idle period the plan picks. Already-stored artifacts and their URLs are unaffected (AC-9).
