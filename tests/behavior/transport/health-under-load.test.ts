/**
 * B018: /health answers healthy under any load and is never treated as a
 * client session.
 */

import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  callTool,
  connectClient,
  startTestServer,
  type TestServer,
} from "./helpers.js";

describe("health probes under load", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  async function probe(headers: Record<string, string> = {}) {
    const response = await fetch(
      `http://127.0.0.1:${server.running.port}/health`,
      { headers },
    );
    await response.text();
    return response;
  }

  async function expectHealthy(times: number): Promise<void> {
    const responses = await Promise.all(
      Array.from({ length: times }, () => probe()),
    );
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.headers.get("mcp-session-id")).toBeNull();
    }
  }

  it("answers with no clients connected", async () => {
    await expectHealthy(10);
  });

  it("answers with several clients connected and renders in progress", async () => {
    const clients = await Promise.all(
      [0, 1, 2].map(() => connectClient(server.url)),
    );
    await expectHealthy(10);

    const renders = clients.map((session, i) =>
      callTool(session.client, "mermaid_to_pdf", {
        code: `graph TD; Busy${i}-->Probe`,
      }),
    );
    await expectHealthy(20);
    for (const result of await Promise.all(renders)) {
      expect(result.ok).toBe(true);
    }

    for (const session of clients) await session.client.close();
  }, 60_000);

  it("ignores a stray session header on a probe", async () => {
    const response = await probe({ "mcp-session-id": randomUUID() });
    expect(response.status).toBe(200);
  });
});
