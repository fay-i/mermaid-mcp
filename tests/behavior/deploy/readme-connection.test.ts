/**
 * B026: The README documents exactly one connection address and transport for
 * the deployed server, with the exact Claude Code commands, and no SSE setup.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readme = readFileSync("README.md", "utf8");
const DEPLOYED_URL = "http://10.42.1.81:8100/mcp";

describe("README remote-client instructions", () => {
  it("names exactly one MCP connection address", () => {
    const urls = new Set(readme.match(/https?:\/\/[^\s)"'`]+\/mcp\b/g));
    expect([...urls]).toEqual([DEPLOYED_URL]);
  });

  it("gives the exact Claude Code commands to switch over", () => {
    expect(readme).toContain("claude mcp remove --scope user mermaid-mcp");
    expect(readme).toContain(
      `claude mcp add --scope user --transport http mermaid-mcp ${DEPLOYED_URL}`,
    );
  });

  it("documents no SSE connection", () => {
    expect(readme).not.toContain("--transport sse");
    expect(readme).not.toMatch(/\/sse\b/);
  });

  it("keeps the local stdio npx configuration", () => {
    expect(readme).toContain(
      '"args": ["-y", "@fay-i/mermaid-mcp", "/absolute/path/to/mermaid-artifacts"]',
    );
  });
});
