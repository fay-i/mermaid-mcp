import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { healthcheckTool } from "./tools/index.js";
import {
  mermaidToSvg,
  mermaidToSvgWithStorage,
} from "./tools/mermaid-to-svg.js";
import {
  mermaidToPdf,
  mermaidToPdfWithStorage,
} from "./tools/mermaid-to-pdf.js";
import { mermaidToDeckWithStorage } from "./tools/mermaid-to-deck.js";
import { VERSION } from "./version.js";
import { createStorageBackend, type StorageBackend } from "./storage/index.js";
import { MermaidToSvgInputSchema } from "./schemas/mermaid-to-svg.js";
import { MermaidToPdfInputSchema } from "./schemas/mermaid-to-pdf.js";
import { DeckRequestSchema } from "./schemas/mermaid-to-deck.js";
import { extractSessionId, type RequestHandlerExtra } from "./cache/session.js";

const server = new McpServer({
  name: "mermaid-printer",
  version: VERSION,
});

// Storage backend (initialized in main())
let storageBackend: StorageBackend | null = null;

// Register healthcheck tool
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

// Register mermaid_to_svg tool (storage backend or inline mode)
server.tool(
  "mermaid_to_svg",
  storageBackend
    ? "Render Mermaid diagram source code to SVG format. Returns a download URL (file:// for local, https:// for S3)."
    : "Render Mermaid diagram source code to SVG format. Supports flowcharts, sequence diagrams, class diagrams, and more.",
  MermaidToSvgInputSchema.shape,
  async (params: Record<string, unknown>, extra?: RequestHandlerExtra) => {
    const input = MermaidToSvgInputSchema.parse(params);
    const sessionId = extractSessionId(extra);

    const result = storageBackend
      ? await mermaidToSvgWithStorage(input, storageBackend, sessionId)
      : await mermaidToSvg(input);

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  },
);

// Register mermaid_to_pdf tool (storage backend or inline mode)
server.tool(
  "mermaid_to_pdf",
  storageBackend
    ? "Render Mermaid diagram source code to PDF format. Returns a download URL (file:// for local, https:// for S3)."
    : "Render Mermaid diagram source code to PDF format. Supports flowcharts, sequence diagrams, class diagrams, and more.",
  MermaidToPdfInputSchema.shape,
  async (params: Record<string, unknown>, extra?: RequestHandlerExtra) => {
    const input = MermaidToPdfInputSchema.parse(params);
    const sessionId = extractSessionId(extra);

    const result = storageBackend
      ? await mermaidToPdfWithStorage(input, storageBackend, sessionId)
      : await mermaidToPdf(input);

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  },
);

// Register mermaid_to_deck tool (storage backend required)
server.tool(
  "mermaid_to_deck",
  "Generate a multi-page PDF deck from multiple Mermaid diagrams. Each diagram is rendered on its own page, scaled to fit. Returns a download URL (file:// for local, https:// for S3). Requires storage backend to be configured.",
  DeckRequestSchema.shape,
  async (params: Record<string, unknown>, extra?: RequestHandlerExtra) => {
    if (!storageBackend) {
      throw new Error("mermaid_to_deck requires a storage backend");
    }
    const input = DeckRequestSchema.parse(params);
    const sessionId = extractSessionId(extra);
    const backend = storageBackend as StorageBackend;
    const result = await mermaidToDeckWithStorage(input, backend, sessionId);
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  },
);

async function main(): Promise<void> {
  // Initialize storage backend (local or S3 based on configuration)
  try {
    storageBackend = await createStorageBackend();
    console.error(
      `[mermaid-mcp] Storage backend enabled: ${storageBackend.getType()}`,
    );
  } catch (error) {
    console.error(
      `[mermaid-mcp] Storage backend not configured, using inline mode: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("Server error:", error);
  process.exit(1);
});
