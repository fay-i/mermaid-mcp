/**
 * B013: When one client leaves, cleanly or abruptly, another client's
 * in-progress render completes and its session keeps working.
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

const DEPARTURES = {
  clean: async (port: number) => {
    const a = await connectClient(new URL(`http://127.0.0.1:${port}/mcp`));
    return async () => {
      await a.transport.terminateSession();
      await a.client.close();
    };
  },
  abrupt: async (port: number) => {
    const sessionId = await openRawSession(port);
    const controller = new AbortController();
    const stream = fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "GET",
      headers: { ...sessionHeaders(sessionId), Accept: "text/event-stream" },
      signal: controller.signal,
    }).catch(() => undefined);
    return async () => {
      controller.abort();
      await stream;
    };
  },
};

describe("one client leaving", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  it.each(Object.entries(DEPARTURES))(
    "keeps the other session's in-flight render and session intact (%s)",
    async (_, depart) => {
      const leave = await depart(server.running.port);
      const b = await connectClient(server.url);

      const render = callTool(b.client, "mermaid_to_pdf", {
        code: "graph TD; Stay-->Here",
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      await leave();

      expect((await render).ok).toBe(true);
      expect(b.transport.sessionId).toBe(b.sessionId);
      const next = await callTool(b.client, "healthcheck", {});
      expect(next.ok).toBe(true);
      expect(b.transport.sessionId).toBe(b.sessionId);

      await b.client.close();
    },
    60_000,
  );
});
