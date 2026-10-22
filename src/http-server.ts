/**
 * Streamable HTTP entry path: serves MCP at /mcp and a liveness probe at /health.
 * Each client session gets its own MCP server instance and transport.
 */

import http from "node:http";
import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

export interface HttpServerOptions {
  port: number;
  createMcpServer: () => McpServer;
  idleTimeoutMs?: number;
}

export interface RunningHttpServer {
  port: number;
  close(): Promise<void>;
}

const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const MCP_PATH = "/mcp";
const HEALTH_PATH = "/health";
const MCP_METHODS = ["GET", "POST", "DELETE"];
const REMOVED_SSE_PATHS = ["/sse", "/message"];

function pathOf(req: http.IncomingMessage): string {
  return new URL(req.url ?? "/", "http://localhost").pathname;
}

// Only sessionless requests (initialize) are read here; the SDK transport
// reads and limits in-session bodies. A real initialize is well under 1 KiB.
const MAX_SESSIONLESS_BODY_BYTES = 1024 * 1024;

// The deck tool accepts up to 10 MiB of diagram code; this leaves room for
// JSON escaping. The SDK's default (4 MiB) would refuse valid decks.
const MAX_SESSION_BODY_BYTES = 16 * 1024 * 1024;

class BodyTooLargeError extends Error {}

// Buffers at most the cap. Past it, the rest of the body is drained and
// discarded so the client can still read the 413.
function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytesRead = 0;
    let tooLarge = false;
    req.on("data", (chunk: Buffer) => {
      if (tooLarge) return;
      bytesRead += chunk.length;
      if (bytesRead > MAX_SESSIONLESS_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        reject(new BodyTooLargeError());
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooLarge) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

const SESSION_HEADER = "mcp-session-id";
const START_NEW_SESSION =
  "start a new session by sending initialize without an Mcp-Session-Id header";

function sendJsonRpcError(
  res: http.ServerResponse,
  status: number,
  code: number,
  message: string,
): void {
  res
    .writeHead(status, { "Content-Type": "application/json" })
    .end(
      JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }),
    );
}

interface Session {
  transport: StreamableHTTPServerTransport;
  requestsInFlight: number;
  idleTimer?: NodeJS.Timeout;
}

function sessionIdOf(req: http.IncomingMessage): string | undefined {
  const value = req.headers[SESSION_HEADER];
  return typeof value === "string" ? value : undefined;
}

export function startHttpServer(
  options: HttpServerOptions,
): Promise<RunningHttpServer> {
  const idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  const sessions = new Map<string, Session>();

  function forgetSession(sessionId: string): Session | undefined {
    const session = sessions.get(sessionId);
    if (session) {
      clearTimeout(session.idleTimer);
      sessions.delete(sessionId);
    }
    return session;
  }

  function releaseSession(sessionId: string): void {
    void forgetSession(sessionId)?.transport.close();
  }

  function restartIdleClock(sessionId: string, session: Session): void {
    clearTimeout(session.idleTimer);
    if (session.requestsInFlight === 0) {
      session.idleTimer = setTimeout(
        () => releaseSession(sessionId),
        idleTimeoutMs,
      ).unref();
    }
  }

  async function handleInSession(
    sessionId: string,
    session: Session,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    // A long-lived GET stream is passive: it must not keep a vanished client alive.
    if (req.method !== "GET") {
      session.requestsInFlight++;
      res.once("close", () => {
        session.requestsInFlight--;
        restartIdleClock(sessionId, session);
      });
    }
    restartIdleClock(sessionId, session);
    await session.transport.handleRequest(req, res);
  }

  async function openSession(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    body: unknown,
  ): Promise<void> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      maxRequestBodySize: MAX_SESSION_BODY_BYTES,
      onsessioninitialized: (sessionId) => {
        const session: Session = { transport, requestsInFlight: 0 };
        sessions.set(sessionId, session);
        restartIdleClock(sessionId, session);
      },
      onsessionclosed: (sessionId) => {
        forgetSession(sessionId);
      },
    });
    await options.createMcpServer().connect(transport);
    await transport.handleRequest(req, res, body);
  }

  async function handleMcp(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const sessionId = sessionIdOf(req);
    if (sessionId !== undefined) {
      const existing = sessions.get(sessionId);
      if (existing) {
        await handleInSession(sessionId, existing, req, res);
      } else {
        sendJsonRpcError(
          res,
          404,
          -32001,
          `Session not found: ${START_NEW_SESSION}`,
        );
      }
      return;
    }

    if (req.method === "POST") {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch (error) {
        if (error instanceof BodyTooLargeError) {
          sendJsonRpcError(
            res,
            413,
            -32600,
            `Request body exceeds ${MAX_SESSIONLESS_BODY_BYTES} bytes`,
          );
          return;
        }
        sendJsonRpcError(res, 400, -32700, "Parse error: invalid JSON");
        return;
      }
      if (isInitializeRequest(body)) {
        await openSession(req, res, body);
        return;
      }
    }
    sendJsonRpcError(
      res,
      400,
      -32000,
      `Bad Request: Mcp-Session-Id header is required; ${START_NEW_SESSION}`,
    );
  }

  async function handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const path = pathOf(req);

    if (path === HEALTH_PATH) {
      res.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
      return;
    }

    if (REMOVED_SSE_PATHS.includes(path)) {
      const url = `http://${req.headers.host ?? "<host>:<port>"}${MCP_PATH}`;
      res.writeHead(410, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          error: `The SSE transport was removed. Reconnect with --transport http to ${url}`,
        }),
      );
      return;
    }

    if (path === MCP_PATH) {
      if (!MCP_METHODS.includes(req.method ?? "")) {
        res.writeHead(405, { Allow: MCP_METHODS.join(", ") }).end();
        return;
      }
      // No browser client is supported, so any Origin means a web page is driving this request.
      if (req.headers.origin !== undefined) {
        sendJsonRpcError(res, 403, -32000, "Forbidden: Origin not allowed");
        return;
      }
      await handleMcp(req, res);
      return;
    }

    res.writeHead(404).end();
  }

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((error: unknown) => {
      console.error(
        `[mermaid-mcp] HTTP request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (!res.headersSent) {
        sendJsonRpcError(res, 500, -32603, "Internal error");
      } else {
        res.end();
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, () => {
      const address = server.address();
      const port =
        typeof address === "object" && address ? address.port : options.port;
      resolve({
        port,
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      });
    });
  });
}
