/**
 * Session ID extraction helper.
 * Per research.md Decision 1: Use MCP SDK's RequestHandlerExtra.sessionId.
 * T016: Add session ID extraction helper.
 */

/**
 * MCP SDK RequestHandlerExtra interface (simplified for our use).
 * The sessionId is automatically propagated from the transport layer.
 */
export interface RequestHandlerExtra {
  sessionId?: string;
}

/**
 * Extract session ID from MCP SDK RequestHandlerExtra.
 * Returns undefined for stdio transport (no session context).
 *
 * @param extra - RequestHandlerExtra from MCP SDK tool handler
 * @returns Session ID or undefined if not available
 */
export function extractSessionId(
  extra: RequestHandlerExtra | undefined,
): string | undefined {
  return extra?.sessionId;
}
