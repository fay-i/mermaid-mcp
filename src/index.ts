import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { tools } from "./tools/index.js";
import { VERSION } from "./version.js";

const server = new McpServer({
  name: "mermaid-printer",
  version: VERSION,
});

// Register all tools with the MCP server
for (const tool of tools) {
  // Handler type is validated at registration time via inputSchema
  const handler = tool.handler as (
    params: Record<string, unknown>,
  ) => Promise<unknown>;

  server.tool(
    tool.name,
    tool.description,
    tool.inputSchema.shape,
    async (params: Record<string, unknown>) => {
      const result = await handler(params);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("Server error:", error);
  process.exit(1);
});
