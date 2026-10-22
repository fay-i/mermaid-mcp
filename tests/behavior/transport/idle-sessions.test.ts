/**
 * B010: Sessions with no requests for the idle period are released; their
 * next request gets 404 so the client re-initializes.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  callTool,
  connectClient,
  MCP_HEADERS,
  postInSession,
  startTestServer,
  type TestServer,
} from "./helpers.js";

const IDLE_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("idle session release", () => {
  let server: TestServer;

  afterEach(async () => {
    await server.stop();
  });

  it("releases a session idle past the period", async () => {
    server = await startTestServer({ idleTimeoutMs: IDLE_MS });
    const { client, sessionId } = await connectClient(server.url);

    await sleep(IDLE_MS * 2);

    const response = await postInSession(server.running.port, sessionId);
    expect(response.status).toBe(404);
    await client.close();
  });

  it("keeps a session open while requests keep arriving", async () => {
    server = await startTestServer({ idleTimeoutMs: IDLE_MS });
    const { client, sessionId } = await connectClient(server.url);

    for (let i = 0; i < 6; i++) {
      await sleep(IDLE_MS / 3);
      const response = await postInSession(server.running.port, sessionId);
      expect(response.status, `request ${i}`).toBe(200);
    }
    await client.close();
  });

  it("releases only the idle session, not an active one", async () => {
    server = await startTestServer({ idleTimeoutMs: IDLE_MS });
    const idle = await connectClient(server.url);
    const active = await connectClient(server.url);

    for (let i = 0; i < 6; i++) {
      await sleep(IDLE_MS / 3);
      await active.client.listTools();
    }

    expect(
      (await postInSession(server.running.port, idle.sessionId)).status,
    ).toBe(404);
    await expect(active.client.listTools()).resolves.toBeDefined();
    await idle.client.close();
    await active.client.close();
  });

  it("defaults to keeping sessions for longer than a short pause", async () => {
    server = await startTestServer();
    const { client, sessionId } = await connectClient(server.url);

    await sleep(IDLE_MS * 2);

    expect((await postInSession(server.running.port, sessionId)).status).toBe(
      200,
    );
    await client.close();
  });
});

describe("idle clock and in-flight work", () => {
  let server: TestServer;

  afterEach(async () => {
    await server.stop();
  });

  it("does not release a session while a render outlasts the period", async () => {
    server = await startTestServer({ idleTimeoutMs: IDLE_MS });
    const { client } = await connectClient(server.url);

    const result = await callTool(client, "mermaid_to_deck", {
      diagrams: [{ code: "graph TD; A-->B" }, { code: "graph LR; C-->D" }],
    });

    expect(result.ok).toBe(true);
    await expect(client.listTools()).resolves.toBeDefined();
    await client.close();
  }, 60_000);

  it("releases an idle session even while it holds an open stream", async () => {
    server = await startTestServer({ idleTimeoutMs: IDLE_MS });
    const { client, sessionId } = await connectClient(server.url);
    const controller = new AbortController();
    const stream = await fetch(server.url, {
      method: "GET",
      headers: {
        ...MCP_HEADERS,
        Accept: "text/event-stream",
        "mcp-session-id": sessionId,
        "mcp-protocol-version": "2025-06-18",
      },
      signal: controller.signal,
    });
    expect(stream.status).toBe(200);

    await sleep(IDLE_MS * 2);

    expect((await postInSession(server.running.port, sessionId)).status).toBe(
      404,
    );
    controller.abort();
    await client.close();
  });
});
