import type { z } from "zod";

export type ZodObjectShape = Record<string, z.ZodTypeAny>;

export interface ToolConfig<
  TShape extends ZodObjectShape = ZodObjectShape,
  TOutput = unknown,
> {
  name: string;
  description: string;
  inputSchema: z.ZodObject<TShape>;
  handler: (params: z.infer<z.ZodObject<TShape>>) => Promise<TOutput>;
}
