/**
 * B007: Requests naming a session the server does not hold, or carrying no
 * session on a non-initialize request, are refused without harming the server.
 */

import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startHttpServer } from "../../../src/http-server.js";
import {
  connectClient,
  MCP_HEADERS,
  postInitialize,
  postInSession,
  startTestServer,
  type TestServer,
} from "./helpers.js";

interface JsonRpcError {
  jsonrpc: string;
  error: { code: number; message: string };
}

describe("refusing unknown or missing sessions", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  it.each([
    ["a made-up UUID", randomUUID()],
    ["a non-UUID string", "not-a-session"],
  ])("answers %s with 404 telling the client to start a new session", async (_, id) => {
    const response = await postInSession(server.running.port, id);

    expect(response.status).toBe(404);
    const body = (await response.json()) as JsonRpcError;
    expect(body.jsonrpc).toBe("2.0");
    expect(body.error.message).toMatch(/start a new session/i);

    const fresh = await postInitialize(server.running.port);
    expect(fresh.status).toBe(200);
  });

  it("answers GET and DELETE for an unknown session with 404", async () => {
    for (const method of ["GET", "DELETE"]) {
      const response = await fetch(server.url, {
        method,
        headers: { ...MCP_HEADERS, "mcp-session-id": randomUUID() },
      });
      expect(response.status, method).toBe(404);
    }
  });

  it("answers a non-initialize request without a session ID with 400", async () => {
    const response = await fetch(server.url, {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as JsonRpcError;
    expect(body.error.message).toMatch(/session/i);
  });

  it("answers a GET without a session ID with 400", async () => {
    const response = await fetch(server.url, {
      method: "GET",
      headers: MCP_HEADERS,
    });
    expect(response.status).toBe(400);
  });

  it("answers invalid JSON with a 400 parse error and keeps serving", async () => {
    const response = await fetch(server.url, {
      method: "POST",
      headers: MCP_HEADERS,
      body: "{not json",
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as JsonRpcError;
    expect(body.error.code).toBe(-32700);

    const { client } = await connectClient(server.url);
    await expect(client.listTools()).resolves.toBeDefined();
    await client.close();
  });

  it("answers a session from a previous server instance with 404", async () => {
    const { client, sessionId } = await connectClient(server.url);
    await client.close();
    await server.stop();
    server = await startTestServer();

    const response = await postInSession(server.running.port, sessionId);
    expect(response.status).toBe(404);
  });
});

describe("a failing session factory", () => {
  it("answers 500 and keeps serving", async () => {
    const failing = await startHttpServer({
      port: 0,
      createMcpServer: () => {
        throw new Error("factory exploded");
      },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await postInitialize(failing.port);
    expect(response.status).toBe(500);
    const health = await fetch(`http://127.0.0.1:${failing.port}/health`);
    expect(health.status).toBe(200);

    errorSpy.mockRestore();
    await failing.close();
  });
});
