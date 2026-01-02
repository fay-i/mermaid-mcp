/**
 * Cache storage layer for file system operations.
 * Per research.md Decision 3: File system layout and operations.
 * T008: Implement storage module with write/read/delete operations.
 */

import { mkdir, rm, readFile, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Result of a write operation.
 */
export interface WriteResult {
  sizeBytes: number;
}

/**
 * Check if a file or directory exists.
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    // ENOENT means file doesn't exist
    if (
      error instanceof Error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}

/**
 * Write artifact content to a file.
 * Creates parent directories if they don't exist.
 *
 * @param filePath - Absolute path to the file
 * @param content - File content as Buffer
 * @returns WriteResult with file size
 */
export async function writeArtifactToFile(
  filePath: string,
  content: Buffer,
): Promise<WriteResult> {
  // Create parent directories if needed
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });

  // Write file
  await writeFile(filePath, content);

  return { sizeBytes: content.length };
}

/**
 * Read artifact content from a file.
 *
 * @param filePath - Absolute path to the file
 * @returns File content as Buffer
 * @throws Error with ENOENT code if file doesn't exist
 */
export async function readArtifactFromFile(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

/**
 * Create a session directory.
 *
 * @param rootDirectory - Cache root directory
 * @param sessionId - Session identifier
 * @returns Absolute path to the session directory
 */
export async function createSessionDirectory(
  rootDirectory: string,
  sessionId: string,
): Promise<string> {
  const sessionDir = join(rootDirectory, sessionId);
  await mkdir(sessionDir, { recursive: true });
  return sessionDir;
}

/**
 * Delete a session directory and all its contents.
 * Does not throw if directory doesn't exist.
 *
 * @param sessionDir - Absolute path to the session directory
 */
export async function deleteSessionDirectory(
  sessionDir: string,
): Promise<void> {
  await rm(sessionDir, { recursive: true, force: true });
}
