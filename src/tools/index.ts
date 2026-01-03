import { healthcheckTool } from "./healthcheck.js";
import { mermaidToSvgTool, mermaidToSvgS3 } from "./mermaid-to-svg.js";
import { mermaidToPdfTool, mermaidToPdfS3 } from "./mermaid-to-pdf.js";
import { mermaidToDeckTool, mermaidToDeckS3 } from "./mermaid-to-deck.js";
import { fetchArtifactTool } from "./fetch-artifact.js";

// Use a readonly tuple to preserve the specific types of each tool
export const tools = [
  healthcheckTool,
  mermaidToSvgTool,
  mermaidToPdfTool,
  mermaidToDeckTool,
  fetchArtifactTool,
] as const;

export {
  healthcheckTool,
  mermaidToSvgTool,
  mermaidToPdfTool,
  mermaidToDeckTool,
  fetchArtifactTool,
  // S3 storage handlers
  mermaidToSvgS3,
  mermaidToPdfS3,
  mermaidToDeckS3,
};
