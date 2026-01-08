#!/usr/bin/env node
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { healthcheckTool } from "./tools/index.js";
import { mermaidToSvgWithStorage } from "./tools/mermaid-to-svg.js";
import { mermaidToPdfWithStorage } from "./tools/mermaid-to-pdf.js";
import { mermaidToDeckWithStorage } from "./tools/mermaid-to-deck.js";
import { VERSION } from "./version.js";
import { createStorageBackend, type StorageBackend } from "./storage/index.js";
import { LocalStorageBackend } from "./storage/local-backend.js";
import { MermaidToSvgInputSchema } from "./schemas/mermaid-to-svg.js";
import { MermaidToPdfInputSchema } from "./schemas/mermaid-to-pdf.js";
import { DeckRequestSchema } from "./schemas/mermaid-to-deck.js";
import { extractSessionId, type RequestHandlerExtra } from "./cache/session.js";

/**
 * Parse command line arguments.
 * Usage: mermaid-mcp <data-dir>
 *
 * @returns Parsed arguments
 * @throws Error if required arguments are missing
 */
export function parseArgs(argv: string[] = process.argv): { dataDir: string } {
  const args = argv.slice(2);

  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    console.error(`Usage: mermaid-mcp <data-dir>

Arguments:
  data-dir    Required. Directory for storing generated artifacts.
              Will be created if it doesn't exist.

Environment Variables (optional, for S3 storage):
  STORAGE_TYPE=s3              Use S3 instead of local storage
  S3_ENDPOINT                  S3/MinIO endpoint URL
  S3_BUCKET                    S3 bucket name
  AWS_ACCESS_KEY_ID            AWS access key
  AWS_SECRET_ACCESS_KEY        AWS secret key
  AWS_REGION                   AWS region (default: us-east-1)

Examples:
  mermaid-mcp ./data/artifacts
  mermaid-mcp /tmp/mermaid-output
`);
    process.exit(0);
  }

  // Check for version flag
  if (args.includes("--version") || args.includes("-v")) {
    console.error(`mermaid-mcp v${VERSION}`);
    process.exit(0);
  }

  // Require data directory argument (unless S3 is configured)
  const isS3Mode = process.env.STORAGE_TYPE === "s3";
  if (args.length === 0 && !isS3Mode) {
    console.error("Error: data directory argument is required.\n");
    console.error("Usage: mermaid-mcp <data-dir>");
    console.error("       mermaid-mcp --help    Show help");
    process.exit(1);
  }

  const dataDir = args[0] ? resolve(args[0]) : "";
  return { dataDir };
}

/**
 * Helper function to register a storage-aware tool with the MCP server.
 * Handles common pattern: parse params, extract sessionId, call handler, wrap response.
 */
function registerStorageTool<TInput, TOutput>(
  server: McpServer,
  name: string,
  description: string,
  schema: {
    parse: (params: unknown) => TInput;
    shape: Record<string, unknown>;
  },
  handler: (
    input: TInput,
    storage: StorageBackend,
    sessionId?: string,
  ) => Promise<TOutput>,
  storage: StorageBackend,
): void {
  server.tool(
    name,
    description,
    schema.shape,
    async (params: Record<string, unknown>, extra?: RequestHandlerExtra) => {
      const input = schema.parse(params);
      const sessionId = extractSessionId(extra);
      const result = await handler(input, storage, sessionId);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}

/**
 * Create and start the MCP server.
 * Exported for testing.
 */
export function createServer(storage: StorageBackend): McpServer {
  const server = new McpServer({
    name: "mermaid-printer",
    version: VERSION,
  });

  // Register healthcheck tool (no storage needed)
  server.tool(
    healthcheckTool.name,
    healthcheckTool.description,
    healthcheckTool.inputSchema.shape,
    async (params: Record<string, unknown>) => {
      const result = await healthcheckTool.handler(params);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );

  // Register storage-aware tools using helper
  registerStorageTool(
    server,
    "mermaid_to_svg",
    "Render Mermaid diagram source code to SVG format. Returns a download URL (file:// for local, https:// for S3).",
    MermaidToSvgInputSchema,
    mermaidToSvgWithStorage,
    storage,
  );

  registerStorageTool(
    server,
    "mermaid_to_pdf",
    "Render Mermaid diagram source code to PDF format. Returns a download URL (file:// for local, https:// for S3).",
    MermaidToPdfInputSchema,
    mermaidToPdfWithStorage,
    storage,
  );

  registerStorageTool(
    server,
    "mermaid_to_deck",
    "Generate a multi-page PDF deck from multiple Mermaid diagrams. Each diagram is rendered on its own page, scaled to fit. Returns a download URL (file:// for local, https:// for S3).",
    DeckRequestSchema,
    mermaidToDeckWithStorage,
    storage,
  );

  return server;
}

async function main(): Promise<void> {
  const { dataDir } = parseArgs();

  // Initialize storage backend - storage is always required
  let storageBackend: StorageBackend;
  try {
    if (process.env.STORAGE_TYPE === "s3") {
      // S3 mode: use environment-based configuration
      storageBackend = await createStorageBackend();
      console.error(
        `[mermaid-mcp] Storage backend enabled: ${storageBackend.getType()}`,
      );
    } else {
      // Local mode: use command line argument
      const localConfig = {
        basePath: dataDir,
        hostPath: dataDir,
        urlScheme: "file" as const,
      };
      storageBackend = new LocalStorageBackend(localConfig);
      await storageBackend.initialize();
      console.error(
        `[mermaid-mcp] Storage backend enabled: local (${dataDir})`,
      );
    }
  } catch (error) {
    console.error(
      `[mermaid-mcp] Storage initialization failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }

  const server = createServer(storageBackend);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Only run main() when executed directly, not when imported for testing
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((error: unknown) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
