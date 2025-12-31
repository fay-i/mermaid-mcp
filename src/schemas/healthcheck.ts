import { z } from "zod";

/**
 * Input schema for the healthcheck MCP tool.
 * Optional echo parameter for round-trip verification.
 */
export const HealthcheckInputSchema = z.object({
  echo: z.string().optional(),
});

/**
 * Output schema for the healthcheck MCP tool.
 * Returns server health status, version, timestamp, and optional echo.
 */
export const HealthcheckOutputSchema = z.object({
  ok: z.literal(true),
  status: z.literal("healthy"),
  version: z.string(),
  timestamp: z.string().datetime(),
  echo: z.string().optional(),
});

export type HealthcheckInput = z.infer<typeof HealthcheckInputSchema>;
export type HealthcheckOutput = z.infer<typeof HealthcheckOutputSchema>;
