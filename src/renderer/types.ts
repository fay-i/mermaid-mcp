/**
 * Renderer types for Mermaid diagram rendering.
 */

/**
 * Options for rendering a Mermaid diagram.
 */
export interface RenderOptions {
  /** Mermaid diagram source code */
  code: string;
  /** Diagram color theme */
  theme?: "default" | "dark" | "forest" | "neutral";
  /** Background color (CSS color value or 'transparent') */
  background?: string;
  /** Advanced Mermaid configuration */
  config?: Record<string, unknown>;
  /** Render timeout in milliseconds */
  timeoutMs: number;
  /** Apply drop shadow to nodes and clusters */
  dropShadow?: boolean;
  /** Google Font to load (e.g., "Source Code Pro") */
  googleFont?: string;
}

/**
 * Result of a successful Mermaid render operation.
 */
export interface RenderResult {
  /** Valid SVG 1.1 markup */
  svg: string;
  /** SVG width in pixels */
  width: number;
  /** SVG height in pixels */
  height: number;
}
