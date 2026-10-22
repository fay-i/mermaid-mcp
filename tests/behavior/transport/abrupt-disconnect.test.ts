/**
 * B009: A client that vanishes without closing its session does not break
 * the server or the next client.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  callTool,
  connectClient,
  openRawSession,
  sessionHeaders,
  startTestServer,
  type TestServer,
} from "./helpers.js";

describe("abrupt client disconnects", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  async function expectNextClientWorks(): Promise<void> {
    const { client, transport } = await connectClient(server.url);
    const result = await callTool(client, "mermaid_to_svg", {
      code: "graph TD; X-->Y",
    });
    expect(result.ok).toBe(true);
    await transport.terminateSession();
    await client.close();
  }

  it("serves a new client after one vanishes without DELETE", async () => {
    const abandoned = await openRawSession(server.running.port);
    expect(abandoned).not.toBe("");

    await expectNextClientWorks();
  }, 60_000);

  it("serves a new client after an open stream is cut", async () => {
    const sessionId = await openRawSession(server.running.port);
    const controller = new AbortController();
    const stream = await fetch(server.url, {
      method: "GET",
      headers: { ...sessionHeaders(sessionId), Accept: "text/event-stream" },
      signal: controller.signal,
    });
    expect(stream.status).toBe(200);
    controller.abort();

    await expectNextClientWorks();
  }, 60_000);

  it("stays up when a client vanishes during its own render", async () => {
    const sessionId = await openRawSession(server.running.port);
    const controller = new AbortController();
    const render = fetch(server.url, {
      method: "POST",
      headers: sessionHeaders(sessionId),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: {
          name: "mermaid_to_pdf",
          arguments: { code: "graph TD; A-->B" },
        },
      }),
      signal: controller.signal,
    }).catch((error: unknown) => error);
    await new Promise((resolve) => setTimeout(resolve, 200));
    controller.abort();
    await render;

    await expectNextClientWorks();
  }, 60_000);
});
