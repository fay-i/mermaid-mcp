/**
 * Builds dist/ once per test run. Several behavior tests spawn the real
 * binary, so a stale or missing build would test old code.
 */

import { execFileSync } from "node:child_process";

const BUILT_FLAG = "MERMAID_MCP_TEST_BUILD_DONE";

export default function buildOnce(): void {
  if (process.env[BUILT_FLAG]) return;
  execFileSync("npx", ["tsc"], { stdio: "inherit" });
  process.env[BUILT_FLAG] = "1";
}
