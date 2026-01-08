import { healthcheckTool } from "./healthcheck.js";
import {
  mermaidToSvgTool,
  mermaidToSvgS3,
  mermaidToSvgWithStorage,
} from "./mermaid-to-svg.js";
import {
  mermaidToPdfTool,
  mermaidToPdfS3,
  mermaidToPdfWithStorage,
} from "./mermaid-to-pdf.js";
import {
  mermaidToDeckTool,
  mermaidToDeckS3,
  mermaidToDeckWithStorage,
} from "./mermaid-to-deck.js";
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
  // S3 storage handlers (backward compatibility)
  mermaidToSvgS3,
  mermaidToPdfS3,
  mermaidToDeckS3,
  // StorageBackend handlers
  mermaidToSvgWithStorage,
  mermaidToPdfWithStorage,
  mermaidToDeckWithStorage,
};
