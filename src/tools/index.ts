import { healthcheckTool } from "./healthcheck.js";
import { mermaidToSvgTool } from "./mermaid-to-svg.js";

// Use a readonly tuple to preserve the specific types of each tool
export const tools = [healthcheckTool, mermaidToSvgTool] as const;

export { healthcheckTool, mermaidToSvgTool };
