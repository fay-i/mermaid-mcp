/**
 * Builds dist/ once per test run, and again before each watch-mode rerun.
 * Several behavior tests spawn the real binary, so a stale or missing build
 * would test old code.
 */

import { execFileSync } from "node:child_process";
import type { TestProject } from "vitest/node";

const BUILT_FLAG = "MERMAID_MCP_TEST_BUILD_DONE";

function build(): void {
  execFileSync("npx", ["tsc"], { stdio: "inherit" });
}

export default function buildOnce(project: TestProject): void {
  if (process.env[BUILT_FLAG]) return;
  build();
  process.env[BUILT_FLAG] = "1";
  // Rerun handlers are shared by every project, so registering one here,
  // on the first build only, rebuilds once per rerun.
  project.onTestsRerun(build);
}
