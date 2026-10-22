/**
 * Shared helpers for Streamable HTTP behavior tests.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "../../../src/index.js";
import {
  startHttpServer,
  type HttpServerOptions,
  type RunningHttpServer,
} from "../../../src/http-server.js";
import { LocalStorageBackend } from "../../../src/storage/local-backend.js";
import type { StorageBackend } from "../../../src/storage/index.js";

export const INITIALIZE_REQUEST = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "http-test", version: "1.0.0" },
  },
};

export const MCP_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function postInitialize(port: number): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: MCP_HEADERS,
    body: JSON.stringify(INITIALIZE_REQUEST),
  });
}

export interface TestServer {
  running: RunningHttpServer;
  dataDir: string;
  url: URL;
  stop(): Promise<void>;
}

export async function startTestServer(
  overrides: Omit<Partial<HttpServerOptions>, "createMcpServer"> & {
    storage?: StorageBackend;
  } = {},
): Promise<TestServer> {
  const dataDir = await mkdtemp(join(tmpdir(), "mermaid-mcp-http-"));
  const { storage: storageOverride, ...httpOverrides } = overrides;
  const storage =
    storageOverride ??
    new LocalStorageBackend({
      basePath: dataDir,
      hostPath: dataDir,
      urlScheme: "file",
    });
  await storage.initialize();
  const running = await startHttpServer({
    port: 0,
    createMcpServer: () => createServer(storage),
    ...httpOverrides,
  });
  return {
    running,
    dataDir,
    url: new URL(`http://127.0.0.1:${running.port}/mcp`),
    stop: async () => {
      await running.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

export interface TestClient {
  client: Client;
  transport: StreamableHTTPClientTransport;
  sessionId: string;
}

export async function connectClient(url: URL): Promise<TestClient> {
  const client = new Client({ name: "http-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(url);
  await client.connect(transport);
  return { client, transport, sessionId: transport.sessionId ?? "" };
}

export function parseToolResult(result: unknown): Record<string, unknown> {
  const content = (result as { content: { type: string; text: string }[] })
    .content;
  return JSON.parse(content[0].text);
}

export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return parseToolResult(await client.callTool({ name, arguments: args }));
}

export const TOOL_CALLS: { name: string; args: Record<string, unknown> }[] = [
  { name: "healthcheck", args: { echo: "ping" } },
  { name: "mermaid_to_svg", args: { code: "graph TD; A-->B" } },
  { name: "mermaid_to_pdf", args: { code: "graph TD; A-->B" } },
  {
    name: "mermaid_to_deck",
    args: {
      diagrams: [{ code: "graph TD; A-->B" }, { code: "graph LR; C-->D" }],
    },
  },
];

export const ALL_TOOL_NAMES = [
  "healthcheck",
  "mermaid_to_deck",
  "mermaid_to_pdf",
  "mermaid_to_svg",
];

export function postInSession(
  port: number,
  sessionId: string,
  message: Record<string, unknown> = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  },
): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: {
      ...MCP_HEADERS,
      "mcp-session-id": sessionId,
      "mcp-protocol-version": "2025-06-18",
    },
    body: JSON.stringify(message),
  });
}

export async function openRawSession(port: number): Promise<string> {
  const response = await postInitialize(port);
  await response.text();
  const sessionId = response.headers.get("mcp-session-id") ?? "";
  const headers = {
    ...MCP_HEADERS,
    "mcp-session-id": sessionId,
    "mcp-protocol-version": "2025-06-18",
  };
  await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  });
  return sessionId;
}

export function sessionHeaders(sessionId: string): Record<string, string> {
  return {
    ...MCP_HEADERS,
    "mcp-session-id": sessionId,
    "mcp-protocol-version": "2025-06-18",
  };
}
