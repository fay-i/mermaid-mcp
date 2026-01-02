import { healthcheckTool } from "./healthcheck.js";
import { mermaidToSvgTool, mermaidToSvgS3 } from "./mermaid-to-svg.js";
import { mermaidToPdfTool, mermaidToPdfS3 } from "./mermaid-to-pdf.js";
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
  // S3 storage handlers
  mermaidToSvgS3,
  mermaidToPdfS3,
};
