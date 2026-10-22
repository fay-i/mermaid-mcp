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
}

export interface RunningHttpServer {
  port: number;
  close(): Promise<void>;
}

const MCP_PATH = "/mcp";
const HEALTH_PATH = "/health";
const MCP_METHODS = ["GET", "POST", "DELETE"];

function pathOf(req: http.IncomingMessage): string {
  return new URL(req.url ?? "/", "http://localhost").pathname;
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const SESSION_HEADER = "mcp-session-id";

function sessionIdOf(req: http.IncomingMessage): string | undefined {
  const value = req.headers[SESSION_HEADER];
  return typeof value === "string" ? value : undefined;
}

export function startHttpServer(
  options: HttpServerOptions,
): Promise<RunningHttpServer> {
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  async function openSession(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    body: unknown,
  ): Promise<void> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      onsessioninitialized: (sessionId) => {
        sessions.set(sessionId, transport);
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
    const existing = sessionId ? sessions.get(sessionId) : undefined;
    if (existing) {
      await existing.handleRequest(req, res);
      return;
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      if (isInitializeRequest(body)) {
        await openSession(req, res, body);
        return;
      }
    }
    res.writeHead(404).end();
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

    if (path === MCP_PATH) {
      if (!MCP_METHODS.includes(req.method ?? "")) {
        res.writeHead(405, { Allow: MCP_METHODS.join(", ") }).end();
        return;
      }
      await handleMcp(req, res);
      return;
    }

    res.writeHead(404).end();
  }

  const server = http.createServer((req, res) => {
    void handleRequest(req, res);
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
