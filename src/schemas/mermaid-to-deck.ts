/**
 * Input schemas for the mermaid_to_deck MCP tool.
 * Generates a multi-page PDF deck from multiple Mermaid diagrams.
 */

import { z } from "zod";

/**
 * A single Mermaid diagram to be included in the deck.
 */
export const DiagramInputSchema = z.object({
  /** Mermaid diagram source code (1 byte to 1MB) */
  code: z.string().min(1).max(1_048_576),
  /** Optional title for this page (max 256 chars) */
  title: z.string().max(256).optional(),
});

export type DiagramInput = z.infer<typeof DiagramInputSchema>;

/**
 * Page margin configuration in points.
 */
export const MarginsSchema = z.object({
  /** Top margin in points (0-144, default 36) */
  top: z.number().int().min(0).max(144).default(36),
  /** Right margin in points (0-144, default 36) */
  right: z.number().int().min(0).max(144).default(36),
  /** Bottom margin in points (0-144, default 36) */
  bottom: z.number().int().min(0).max(144).default(36),
  /** Left margin in points (0-144, default 36) */
  left: z.number().int().min(0).max(144).default(36),
});

export type Margins = z.infer<typeof MarginsSchema>;

/**
 * Default margins (36pt on all sides - approximately 0.5 inch).
 */
export const DEFAULT_MARGINS: Margins = {
  top: 36,
  right: 36,
  bottom: 36,
  left: 36,
};

/**
 * Page size options.
 */
export const PageSizeSchema = z.enum(["letter", "a4", "legal"]);

export type PageSize = z.infer<typeof PageSizeSchema>;

/**
 * Page orientation options.
 */
export const OrientationSchema = z.enum(["landscape", "portrait"]);

export type Orientation = z.infer<typeof OrientationSchema>;

/**
 * Mermaid theme options.
 */
export const ThemeSchema = z.enum(["default", "dark", "forest", "neutral"]);

export type Theme = z.infer<typeof ThemeSchema>;

/**
 * Input to the mermaid_to_deck tool.
 */
export const DeckRequestSchema = z.object({
  /** Array of Mermaid diagrams (1-100 items, total ≤10MB) */
  diagrams: z.array(DiagramInputSchema).min(1).max(100),
  /** PDF page size (default: "letter") */
  page_size: PageSizeSchema.default("letter"),
  /** Page orientation (default: "landscape") */
  orientation: OrientationSchema.default("landscape"),
  /** Display diagram titles on pages (default: true) */
  show_titles: z.boolean().default(true),
  /** Page margins (default: 36pt all sides) */
  margins: MarginsSchema.optional(),
  /** Mermaid color theme (default: "default") */
  theme: ThemeSchema.default("default"),
  /** Page background color as CSS color (default: "#ffffff") */
  background: z.string().default("#ffffff"),
  /** Apply drop shadow to diagram nodes (default: true) */
  drop_shadow: z.boolean().default(true),
  /** Google Font for diagram text (default: "Source Code Pro") */
  google_font: z.string().default("Source Code Pro"),
  /** Global timeout in milliseconds (1000-120000, default: 120000) */
  timeout_ms: z.number().int().min(1000).max(120000).default(120000),
});

export type DeckRequest = z.infer<typeof DeckRequestSchema>;

/**
 * Maximum number of diagrams allowed.
 */
export const MAX_DIAGRAMS = 100;

/**
 * Maximum total input size in bytes (10MB).
 */
export const MAX_TOTAL_SIZE = 10 * 1024 * 1024;

/**
 * Maximum size per diagram in bytes (1MB).
 */
export const MAX_DIAGRAM_SIZE = 1024 * 1024;

/**
 * Default timeout in milliseconds.
 */
export const DEFAULT_TIMEOUT_MS = 120000;

/**
 * Minimum timeout in milliseconds.
 */
export const MIN_TIMEOUT_MS = 1000;

/**
 * Maximum timeout in milliseconds.
 */
export const MAX_TIMEOUT_MS = 120000;

/**
 * Page dimensions in points for each page size.
 * Values are [width, height] in landscape orientation.
 */
export const PAGE_DIMENSIONS: Record<
  PageSize,
  { width: number; height: number }
> = {
  letter: { width: 792, height: 612 },
  a4: { width: 842, height: 595 },
  legal: { width: 1008, height: 612 },
};

/**
 * Get page dimensions for a given page size and orientation.
 */
export function getPageDimensions(
  pageSize: PageSize,
  orientation: Orientation,
): { width: number; height: number } {
  const base = PAGE_DIMENSIONS[pageSize];
  if (orientation === "portrait") {
    return { width: base.height, height: base.width };
  }
  return base;
}
