/**
 * B029: Tool calls with far more input elements than any real call are
 * refused before validation, and the session keeps serving.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  connectClient,
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
