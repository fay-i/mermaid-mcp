/**
 * B020: Any /mcp request carrying an Origin header is refused with 403, so a
 * web page cannot drive the server through a user's browser.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  connectClient,
  INITIALIZE_REQUEST,
  MCP_HEADERS,
  sessionHeaders,
  startTestServer,
  type TestServer,
} from "./helpers.js";

describe("Origin validation", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  it("refuses an initialize with an Origin header and opens no session", async () => {
    const response = await fetch(server.url, {
      method: "POST",
      headers: { ...MCP_HEADERS, Origin: "http://evil.example" },
      body: JSON.stringify(INITIALIZE_REQUEST),
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("mcp-session-id")).toBeNull();
  });

  it("refuses an in-session request with an Origin header", async () => {
    const { client, sessionId } = await connectClient(server.url);
    const response = await fetch(server.url, {
      method: "POST",
      headers: { ...sessionHeaders(sessionId), Origin: "http://localhost" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 9, method: "tools/list" }),
    });

    expect(response.status).toBe(403);
    await expect(client.listTools()).resolves.toBeDefined();
    await client.close();
  });
});
