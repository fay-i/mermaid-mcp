/**
 * T008: Behavior tests for input validation in mermaid_to_deck tool.
 * Tests empty array, missing code, and size limits.
 */

import { describe, it, expect } from "vitest";
import {
  DeckRequestSchema,
  MAX_DIAGRAMS,
  MAX_DIAGRAM_SIZE,
  MAX_TOTAL_SIZE,
} from "../../../src/schemas/mermaid-to-deck.js";

describe("mermaid_to_deck input validation", () => {
  describe("diagrams array validation", () => {
    it("rejects empty diagrams array", () => {
      const input = {
        diagrams: [],
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("accepts single diagram", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts maximum of 100 diagrams", () => {
      const diagrams = Array.from({ length: 100 }, (_, i) => ({
        code: `graph TD\n  A${i} --> B${i}`,
      }));

      const input = { diagrams };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects more than 100 diagrams", () => {
      const diagrams = Array.from({ length: 101 }, (_, i) => ({
        code: `graph TD\n  A${i} --> B${i}`,
      }));

      const input = { diagrams };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("diagram code validation", () => {
    it("rejects diagram with empty code", () => {
      const input = {
        diagrams: [{ code: "" }],
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects diagram with missing code field", () => {
      const input = {
        diagrams: [{ title: "No Code" }],
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("accepts diagram with valid code", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts diagram with code and optional title", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B", title: "Simple Flow" }],
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.diagrams[0].title).toBe("Simple Flow");
      }
    });
  });

  describe("size limits", () => {
    it("enforces maximum diagram size constant of 1MB", () => {
      expect(MAX_DIAGRAM_SIZE).toBe(1024 * 1024);
    });

    it("enforces maximum total input size constant of 10MB", () => {
      expect(MAX_TOTAL_SIZE).toBe(10 * 1024 * 1024);
    });

    it("enforces maximum diagram count constant of 100", () => {
      expect(MAX_DIAGRAMS).toBe(100);
    });

    it("rejects diagram code larger than 1MB", () => {
      // Create code that exceeds 1MB
      const largeCode = "a".repeat(MAX_DIAGRAM_SIZE + 1);
      const input = {
        diagrams: [{ code: largeCode }],
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("optional parameters with defaults", () => {
    it("applies default page_size of 'letter'", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
      };

      const result = DeckRequestSchema.parse(input);
      expect(result.page_size).toBe("letter");
    });

    it("applies default orientation of 'landscape'", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
      };

      const result = DeckRequestSchema.parse(input);
      expect(result.orientation).toBe("landscape");
    });

    it("applies default show_titles of true", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
      };

      const result = DeckRequestSchema.parse(input);
      expect(result.show_titles).toBe(true);
    });

    it("applies default theme of 'default'", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
      };

      const result = DeckRequestSchema.parse(input);
      expect(result.theme).toBe("default");
    });

    it("applies default background of '#ffffff'", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
      };

      const result = DeckRequestSchema.parse(input);
      expect(result.background).toBe("#ffffff");
    });

    it("applies default timeout_ms of 120000", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
      };

      const result = DeckRequestSchema.parse(input);
      expect(result.timeout_ms).toBe(120000);
    });

    it("applies default drop_shadow of true", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
      };

      const result = DeckRequestSchema.parse(input);
      expect(result.drop_shadow).toBe(true);
    });

    it("applies default google_font of 'Source Code Pro'", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
      };

      const result = DeckRequestSchema.parse(input);
      expect(result.google_font).toBe("Source Code Pro");
    });
  });

  describe("timeout_ms validation", () => {
    it("accepts minimum timeout of 1000ms", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
        timeout_ms: 1000,
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts maximum timeout of 120000ms", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
        timeout_ms: 120000,
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects timeout below 1000ms", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
        timeout_ms: 999,
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects timeout above 120000ms", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
        timeout_ms: 120001,
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("page_size validation", () => {
    it("accepts 'letter' page size", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
        page_size: "letter",
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts 'a4' page size", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
        page_size: "a4",
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts 'legal' page size", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
        page_size: "legal",
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects invalid page size", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
        page_size: "tabloid",
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("orientation validation", () => {
    it("accepts 'landscape' orientation", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
        orientation: "landscape",
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts 'portrait' orientation", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
        orientation: "portrait",
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects invalid orientation", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
        orientation: "sideways",
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("theme validation", () => {
    it("accepts 'default' theme", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
        theme: "default",
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts 'dark' theme", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
        theme: "dark",
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts 'forest' theme", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
        theme: "forest",
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts 'neutral' theme", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
        theme: "neutral",
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects invalid theme", () => {
      const input = {
        diagrams: [{ code: "graph TD\n  A --> B" }],
        theme: "colorful",
      };

      const result = DeckRequestSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
