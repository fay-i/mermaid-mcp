import { healthcheckTool } from "./healthcheck.js";
import { mermaidToSvgTool } from "./mermaid-to-svg.js";
import { mermaidToPdfTool } from "./mermaid-to-pdf.js";
import { fetchArtifactTool } from "./fetch-artifact.js";

// Use a readonly tuple to preserve the specific types of each tool
export const tools = [
  healthcheckTool,
  mermaidToSvgTool,
  mermaidToPdfTool,
  fetchArtifactTool,
] as const;

export {
  healthcheckTool,
  mermaidToSvgTool,
  mermaidToPdfTool,
  fetchArtifactTool,
};
