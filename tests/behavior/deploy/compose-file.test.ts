/**
 * B025: The compose file runs the server in HTTP mode on 8000, health-checks
 * /health, publishes only 8000, and no longer describes SSE.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface ComposeService {
  build?: unknown;
  command?: unknown;
  ports: string[];
  healthcheck: { test: string[] };
}

const source = readFileSync("docker-compose.yml", "utf8");
const compose: { services: Record<string, ComposeService> } = parse(source);
const server = compose.services["mermaid-mcp"];

describe("compose file", () => {
  it("builds the image and keeps its HTTP command", () => {
    expect(server.build).toBe(".");
    expect(server.command).toBeUndefined();
  });

  it("publishes only port 8000", () => {
    expect(server.ports).toEqual(["8000:8000"]);
  });

  it("health-checks /health on 8000", () => {
    expect(server.healthcheck.test.join(" ")).toContain(
      "http://localhost:8000/health",
    );
  });

  it("describes Streamable HTTP at /mcp, not SSE", () => {
    expect(source).not.toMatch(/\bsse\b/i);
    expect(source).toContain("/mcp");
  });
});
