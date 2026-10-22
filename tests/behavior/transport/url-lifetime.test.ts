/**
 * B017: Ending a session (DELETE or idle release) leaves its stored
 * artifacts in place, so their URLs keep resolving.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  callTool,
  connectClient,
  postInSession,
  startTestServer,
  type TestServer,
} from "./helpers.js";

const IDLE_MS = 300;

async function comeAndGo(server: TestServer): Promise<void> {
  for (let i = 0; i < 2; i++) {
    const visitor = await connectClient(server.url);
    await callTool(visitor.client, "mermaid_to_svg", {
      code: `graph TD; Visitor${i}-->Gone`,
    });
    await visitor.transport.terminateSession();
    await visitor.client.close();
  }
}

describe("artifact URL lifetime", () => {
  let server: TestServer;

  afterEach(async () => {
    await server.stop();
  });

  it("keeps the URL resolving after the session is deleted", async () => {
    server = await startTestServer();
    const a = await connectClient(server.url);
    const result = await callTool(a.client, "mermaid_to_svg", {
      code: "graph TD; Keep-->Me",
    });
    const path = fileURLToPath(String(result.download_url));
    const original = await readFile(path);

    await a.transport.terminateSession();
    await a.client.close();
    await comeAndGo(server);

    expect((await readFile(path)).equals(original)).toBe(true);
  }, 60_000);

  it("keeps the URL resolving after the session is released for idling", async () => {
    server = await startTestServer({ idleTimeoutMs: IDLE_MS });
    const a = await connectClient(server.url);
    const result = await callTool(a.client, "mermaid_to_svg", {
      code: "graph TD; Idle-->Kept",
    });
    const path = fileURLToPath(String(result.download_url));
    const original = await readFile(path);

    await new Promise((resolve) => setTimeout(resolve, IDLE_MS * 2));
    expect((await postInSession(server.running.port, a.sessionId)).status).toBe(
      404,
    );
    await a.client.close();
    await comeAndGo(server);

    expect((await readFile(path)).equals(original)).toBe(true);
  }, 60_000);
});
