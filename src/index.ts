import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  healthcheckTool,
  mermaidToSvgS3,
  mermaidToPdfS3,
} from "./tools/index.js";
import { mermaidToSvg } from "./tools/mermaid-to-svg.js";
import { mermaidToPdf } from "./tools/mermaid-to-pdf.js";
import { VERSION } from "./version.js";
import { loadS3Config, S3Storage } from "./storage/index.js";
import { MermaidToSvgInputSchema } from "./schemas/mermaid-to-svg.js";
import { MermaidToPdfInputSchema } from "./schemas/mermaid-to-pdf.js";

const server = new McpServer({
  name: "mermaid-printer",
  version: VERSION,
});

// Try to initialize S3 storage (optional - falls back to inline mode)
let s3Storage: S3Storage | null = null;
try {
  const s3Config = loadS3Config();
  s3Storage = new S3Storage(s3Config);
  console.error("[mermaid-mcp] S3 storage enabled");
} catch {
  console.error("[mermaid-mcp] S3 storage not configured, using inline mode");
}

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

// Register mermaid_to_svg tool (S3 or inline mode)
server.tool(
  "mermaid_to_svg",
  s3Storage
    ? "Render Mermaid diagram source code to SVG format. Returns a presigned download URL."
    : "Render Mermaid diagram source code to SVG format. Supports flowcharts, sequence diagrams, class diagrams, and more.",
  MermaidToSvgInputSchema.shape,
  async (params: Record<string, unknown>) => {
    const input = MermaidToSvgInputSchema.parse(params);
    const result = s3Storage
      ? await mermaidToSvgS3(input, s3Storage)
      : await mermaidToSvg(input);

    // Opportunistic cleanup (don't await, fire-and-forget)
    if (s3Storage) {
      s3Storage.cleanupOldArtifacts().catch(() => {});
    }

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  },
);

// Register mermaid_to_pdf tool (S3 or inline mode)
server.tool(
  "mermaid_to_pdf",
  s3Storage
    ? "Render Mermaid diagram source code to PDF format. Returns a presigned download URL."
    : "Render Mermaid diagram source code to PDF format. Supports flowcharts, sequence diagrams, class diagrams, and more.",
  MermaidToPdfInputSchema.shape,
  async (params: Record<string, unknown>) => {
    const input = MermaidToPdfInputSchema.parse(params);
    const result = s3Storage
      ? await mermaidToPdfS3(input, s3Storage)
      : await mermaidToPdf(input);

    // Opportunistic cleanup (don't await, fire-and-forget)
    if (s3Storage) {
      s3Storage.cleanupOldArtifacts().catch(() => {});
    }

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("Server error:", error);
  process.exit(1);
});
