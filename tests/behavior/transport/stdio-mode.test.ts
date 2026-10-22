/**
 * B002: Without --http, the server serves every tool over stdio exactly as before.
 */

import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function parseToolResult(result: unknown): Record<string, unknown> {
  const { content, isError } = result as {
    content: { type: string; text: string }[];
    isError?: boolean;
  };
  expect(isError, content[0].text).not.toBe(true);
  return JSON.parse(content[0].text);
}

// The SDK's stdio transport passes the child only a minimal environment. The
// server reads CI to disable Chromium's sandbox where the runner lacks one,
// so the child gets the full environment, as the Inspector integration suite does.
function inheritedEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

describe("stdio mode (no --http flag)", () => {
  let dataDir: string;
  let client: Client;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "mermaid-mcp-stdio-"));
    client = new Client({ name: "stdio-test", version: "1.0.0" });
    await client.connect(
      new StdioClientTransport({
        command: "node",
        args: ["dist/index.js", dataDir],
        cwd: process.cwd(),
        env: inheritedEnvironment(),
        stderr: "ignore",
      }),
    );
  });

  afterEach(async () => {
    await client.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("lists every tool", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "healthcheck",
      "mermaid_to_deck",
      "mermaid_to_pdf",
      "mermaid_to_svg",
    ]);
  });

  it("stores each render under the data dir, one session per call", async () => {
    const render = async () =>
      parseToolResult(
        await client.callTool({
          name: "mermaid_to_svg",
          arguments: { code: "graph TD; A-->B" },
        }),
      );

    const first = await render();
    const second = await render();

    expect(first.ok).toBe(true);
    const firstPath = fileURLToPath(String(first.download_url));
    const secondPath = fileURLToPath(String(second.download_url));
    expect(firstPath.startsWith(dataDir)).toBe(true);
    expect(await readFile(firstPath, "utf8")).toContain("<svg");

    const sessionOf = (path: string) => relative(dataDir, path).split(sep)[0];
    expect(sessionOf(firstPath)).not.toBe(sessionOf(secondPath));
  }, 60_000);
});
