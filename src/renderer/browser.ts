/**
 * Puppeteer browser lifecycle management for Mermaid rendering.
 */

import { existsSync, readFileSync } from "node:fs";
import puppeteer, { type Browser } from "puppeteer";

/**
 * Detect if running inside a Docker container.
 * Checks for /.dockerenv file or docker in cgroup.
 */
function isRunningInDocker(): boolean {
  try {
    // Check for .dockerenv file (most reliable)
    if (existsSync("/.dockerenv")) {
      return true;
    }
    // Check cgroup for docker (Linux-specific)
    if (existsSync("/proc/1/cgroup")) {
      const cgroup = readFileSync("/proc/1/cgroup", "utf8");
      return cgroup.includes("docker");
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Launch a headless browser instance for Mermaid rendering.
 * Uses 'shell' mode for faster startup.
 * Disables sandbox in CI environments or Docker containers where it's not available.
 */
export async function launchBrowser(): Promise<Browser> {
  const args: string[] = [];

  // Disable sandbox in CI environments (GitHub Actions, etc.) or Docker containers
  if (process.env.CI || isRunningInDocker()) {
    args.push("--no-sandbox", "--disable-setuid-sandbox");
  }

  return puppeteer.launch({
    headless: "shell",
    args: args.length > 0 ? args : undefined,
  });
}

/**
 * Gracefully close a browser instance.
 */
export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}
