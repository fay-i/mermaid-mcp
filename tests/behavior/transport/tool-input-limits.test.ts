/**
 * B029: Tool calls with far more input elements than any real call are
 * refused before validation, and the session keeps serving.
 * B030: In-session bodies as large as the largest valid deck are accepted;
 * larger ones get 413, and the session keeps serving.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  connectClient,
  openRawSession,
  postInSession,
  sessionHeaders,
  startTestServer,
  type TestClient,
  type TestServer,
} from "./helpers.js";

interface ToolResult {
  isError?: boolean;
  content: { type: string; text: string }[];
}

const ELEMENT_LIMIT_MESSAGE = /more than the maximum of \d+ elements/;

describe("tool input element limit", () => {
  let server: TestServer;
  let connection: TestClient;

  beforeEach(async () => {
    server = await startTestServer();
    connection = await connectClient(server.url);
  });

  afterEach(async () => {
    await connection.client.close();
    await server.stop();
  });

  it("refuses a call whose arguments hold 5,000 elements and keeps the session", async () => {
    const result = (await connection.client.callTool({
      name: "mermaid_to_svg",
      arguments: { code: Array.from({ length: 5000 }, (_, i) => i) },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(ELEMENT_LIMIT_MESSAGE);
    await expect(connection.client.listTools()).resolves.toBeDefined();
  });

  it("does not refuse the largest real call for its element count", async () => {
    const diagrams = Array.from({ length: 100 }, (_, i) => ({
      code: "graph TD; A-->B",
      title: `Diagram ${i}`,
    }));

    const result = (await connection.client.callTool({
      name: "mermaid_to_deck",
      arguments: {
        diagrams,
        page_size: "a4",
        orientation: "portrait",
        show_titles: true,
        margins: { top: 10, right: 10, bottom: 10, left: 10 },
        theme: "dark",
        background: "#000000",
        drop_shadow: false,
        google_font: "Inter",
        timeout_ms: 1,
      },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).not.toMatch(ELEMENT_LIMIT_MESSAGE);
    expect(result.content[0].text).toMatch(/timeout_ms/);
  });
});

describe("in-session request body bound", () => {
  let server: TestServer;
  let sessionId: string;

  beforeEach(async () => {
    server = await startTestServer();
    sessionId = await openRawSession(server.running.port);
  });

  afterEach(async () => {
    await server.stop();
  });

  function postBody(body: string): Promise<Response> {
    return fetch(server.url, {
      method: "POST",
      headers: sessionHeaders(sessionId),
      body,
    });
  }

  it("lets a deck carrying 10 MiB of diagram code reach the tool", async () => {
    const diagram = { code: "x".repeat(1_048_576) };
    const response = await postBody(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "mermaid_to_deck",
          arguments: {
            diagrams: Array.from({ length: 10 }, () => diagram),
            timeout_ms: 1,
          },
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toMatch(/timeout_ms/);
  });

  it("answers a 17 MiB body with 413 and keeps the session", async () => {
    const response = await postBody(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/list",
        params: { padding: "x".repeat(17 * 1024 * 1024) },
      }),
    );

    expect(response.status).toBe(413);
    const list = await postInSession(server.running.port, sessionId);
    expect(list.status).toBe(200);
    expect(await list.text()).toMatch(/mermaid_to_svg/);
  });
});
