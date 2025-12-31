import {
  HealthcheckInputSchema,
  type HealthcheckInput,
  type HealthcheckOutput,
} from "../schemas/healthcheck.js";
import { VERSION } from "../version.js";
import type { ToolConfig } from "./types.js";

/**
 * Healthcheck tool for verifying server connectivity.
 * Returns status, version, timestamp, and optional echo.
 */
export const healthcheckTool: ToolConfig<
  typeof HealthcheckInputSchema.shape,
  HealthcheckOutput
> = {
  name: "healthcheck",
  description:
    "Verify the MCP server is running and responding. Returns status, version, and optional echo.",
  inputSchema: HealthcheckInputSchema,
  handler: async (params: HealthcheckInput): Promise<HealthcheckOutput> => {
    const response: HealthcheckOutput = {
      ok: true,
      status: "healthy",
      version: VERSION,
      timestamp: new Date().toISOString(),
    };

    // Only include echo if provided in input
    if (params.echo !== undefined) {
      response.echo = params.echo;
    }

    return response;
  },
};
