/**
 * B010: Sessions with no requests for the idle period are released; their
 * next request gets 404 so the client re-initializes.
 */

import { tmpdir } from "node:os";
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it } from "vitest";
import { startHttpServer } from "../../../src/http-server.js";
import { createServer } from "../../../src/index.js";
import { LocalStorageBackend } from "../../../src/storage/local-backend.js";
import {
  callTool,
  connectClient,
  openRawSession,
  sessionHeaders,
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
    const sessionId = await openRawSession(server.running.port);
    const controller = new AbortController();
    const stream = await fetch(server.url, {
      method: "GET",
      headers: { ...sessionHeaders(sessionId), Accept: "text/event-stream" },
      signal: controller.signal,
    });
    expect(stream.status).toBe(200);

    await sleep(IDLE_MS * 2);

    expect((await postInSession(server.running.port, sessionId)).status).toBe(
      404,
    );
    controller.abort();
  });
});

describe("closed sessions release their idle clock", () => {
  // A full collection lets the test see whether anything still holds a
  // closed session's server; a pending idle timer would.
  function collectGarbage(): void {
    setFlagsFromString("--expose-gc");
    (runInNewContext("gc") as () => void)();
  }

  it("lets sessions ended by DELETE be garbage collected", async () => {
    const created: WeakRef<object>[] = [];
    const storage = new LocalStorageBackend({
      basePath: tmpdir(),
      hostPath: tmpdir(),
      urlScheme: "file",
    });
    const running = await startHttpServer({
      port: 0,
      createMcpServer: () => {
        const server = createServer(storage);
        const connect = server.connect.bind(server);
        server.connect = (transport) => {
          created.push(new WeakRef(transport));
          return connect(transport);
        };
        return server;
      },
    });
    const url = new URL(`http://127.0.0.1:${running.port}/mcp`);

    for (let i = 0; i < 10; i++) {
      const { client, transport } = await connectClient(url);
      await transport.terminateSession();
      await client.close();
    }
    await sleep(50);
    collectGarbage();
    await sleep(50);
    collectGarbage();

    const retained = created.filter((ref) => ref.deref() !== undefined).length;
    expect(retained).toBe(0);
    await running.close();
  });
});
