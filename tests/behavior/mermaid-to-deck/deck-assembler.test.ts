/**
 * T011-T012: Behavior tests for HTML template generation and PDF assembly.
 */

import { describe, it, expect } from "vitest";
import {
  createPageHtml,
  assembleDeck,
  detectDiagramType,
  buildPageMetadata,
  type PageOptions,
} from "../../../src/renderer/deck-assembler.js";

describe("deck-assembler", () => {
  describe("T011: HTML template generation", () => {
    const defaultPageOptions: PageOptions = {
      width: 792,
      height: 612,
      margins: { top: 36, right: 36, bottom: 36, left: 36 },
      background: "#ffffff",
      showTitle: true,
    };

    it("creates valid HTML document structure", () => {
      const svg = '<svg width="100" height="100"></svg>';
      const result = createPageHtml(svg, "Test Title", defaultPageOptions);

      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("<html>");
      expect(result.html).toContain("</html>");
      expect(result.html).toContain("<head>");
      expect(result.html).toContain("<body>");
    });

    it("includes SVG content in diagram container", () => {
      const svg = '<svg width="100" height="100"><rect/></svg>';
      const result = createPageHtml(svg, undefined, defaultPageOptions);

      expect(result.html).toContain(svg);
      expect(result.html).toContain('class="diagram"');
    });

    it("includes title when showTitle is true and title provided", () => {
      const svg = '<svg width="100" height="100"></svg>';
      const result = createPageHtml(svg, "My Diagram", defaultPageOptions);

      expect(result.html).toContain("My Diagram");
      expect(result.html).toContain('class="title"');
    });

    it("excludes title when showTitle is false", () => {
      const svg = '<svg width="100" height="100"></svg>';
      const options = { ...defaultPageOptions, showTitle: false };
      const result = createPageHtml(svg, "My Diagram", options);

      expect(result.html).not.toContain('class="title"');
    });

    it("excludes title when title is undefined", () => {
      const svg = '<svg width="100" height="100"></svg>';
      const result = createPageHtml(svg, undefined, defaultPageOptions);

      expect(result.html).not.toContain('class="title"');
    });

    it("applies page dimensions", () => {
      const svg = '<svg width="100" height="100"></svg>';
      const result = createPageHtml(svg, undefined, defaultPageOptions);

      expect(result.html).toContain("width: 792px");
      expect(result.html).toContain("height: 612px");
      expect(result.width).toBe(792);
      expect(result.height).toBe(612);
    });

    it("applies background color", () => {
      const svg = '<svg width="100" height="100"></svg>';
      const options = { ...defaultPageOptions, background: "#f0f0f0" };
      const result = createPageHtml(svg, undefined, options);

      expect(result.html).toContain("background: #f0f0f0");
    });

    it("applies margins", () => {
      const svg = '<svg width="100" height="100"></svg>';
      const options = {
        ...defaultPageOptions,
        margins: { top: 48, right: 24, bottom: 48, left: 24 },
      };
      const result = createPageHtml(svg, undefined, options);

      expect(result.html).toContain("padding: 48px 24px 48px 24px");
    });

    it("escapes HTML in title to prevent XSS", () => {
      const svg = '<svg width="100" height="100"></svg>';
      const maliciousTitle = '<script>alert("xss")</script>';
      const result = createPageHtml(svg, maliciousTitle, defaultPageOptions);

      expect(result.html).not.toContain("<script>");
      expect(result.html).toContain("&lt;script&gt;");
    });
  });

  describe("T012: PDF page assembly", () => {
    it("assembles single page PDF", async () => {
      // Create a minimal valid PDF buffer
      const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
192
%%EOF`;

      const pageBuffer = Buffer.from(pdfContent);
      const result = await assembleDeck([pageBuffer]);

      expect(result.pageCount).toBe(1);
      expect(result.sizeBytes).toBeGreaterThan(0);
      expect(result.pdfBuffer).toBeDefined();
    });

    it("assembles multi-page PDF from multiple single-page PDFs", async () => {
      // Create two minimal valid PDF buffers
      const createMinimalPdf = () => {
        return Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
192
%%EOF`);
      };

      const pageBuffers = [createMinimalPdf(), createMinimalPdf()];
      const result = await assembleDeck(pageBuffers);

      expect(result.pageCount).toBe(2);
      expect(result.sizeBytes).toBeGreaterThan(0);

      // Verify output is valid PDF
      const header = result.pdfBuffer.slice(0, 5).toString();
      expect(header).toBe("%PDF-");
    });

    it("returns correct page count", async () => {
      const createMinimalPdf = () => {
        return Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
192
%%EOF`);
      };

      const pageBuffers = [
        createMinimalPdf(),
        createMinimalPdf(),
        createMinimalPdf(),
      ];
      const result = await assembleDeck(pageBuffers);

      expect(result.pageCount).toBe(3);
    });

    it("returns accurate size_bytes", async () => {
      const createMinimalPdf = () => {
        return Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
192
%%EOF`);
      };

      const result = await assembleDeck([createMinimalPdf()]);

      expect(result.sizeBytes).toBe(result.pdfBuffer.length);
    });
  });

  describe("detectDiagramType", () => {
    it("detects flowchart with 'graph TD'", () => {
      expect(detectDiagramType("graph TD\n  A --> B")).toBe("flowchart");
    });

    it("detects flowchart with 'flowchart LR'", () => {
      expect(detectDiagramType("flowchart LR\n  A --> B")).toBe("flowchart");
    });

    it("detects sequenceDiagram", () => {
      expect(detectDiagramType("sequenceDiagram\n  Alice->>Bob: Hi")).toBe(
        "sequence",
      );
    });

    it("detects classDiagram", () => {
      expect(detectDiagramType("classDiagram\n  class Animal")).toBe("class");
    });

    it("detects stateDiagram", () => {
      expect(detectDiagramType("stateDiagram-v2\n  [*] --> State1")).toBe(
        "state",
      );
    });

    it("detects erDiagram", () => {
      expect(detectDiagramType("erDiagram\n  CUSTOMER ||--o{ ORDER")).toBe(
        "er",
      );
    });

    it("detects journey", () => {
      expect(detectDiagramType("journey\n  title My Journey")).toBe("journey");
    });

    it("detects gantt", () => {
      expect(detectDiagramType("gantt\n  title A Gantt")).toBe("gantt");
    });

    it("detects pie", () => {
      expect(detectDiagramType('pie\n  "A": 40')).toBe("pie");
    });

    it("detects mindmap", () => {
      expect(detectDiagramType("mindmap\n  root")).toBe("mindmap");
    });

    it("detects timeline", () => {
      expect(detectDiagramType("timeline\n  2020")).toBe("timeline");
    });

    it("detects quadrantChart", () => {
      expect(detectDiagramType("quadrantChart\n  title Q")).toBe("quadrant");
    });

    it("detects gitGraph", () => {
      expect(detectDiagramType("gitGraph\n  commit")).toBe("git");
    });

    it("returns unknown for unrecognized diagram type", () => {
      expect(detectDiagramType("unknown\n  stuff")).toBe("unknown");
    });

    it("ignores comment lines", () => {
      expect(detectDiagramType("%% Comment\ngraph TD\n  A --> B")).toBe(
        "flowchart",
      );
    });

    it("ignores empty lines", () => {
      expect(detectDiagramType("\n\ngraph TD\n  A --> B")).toBe("flowchart");
    });
  });

  describe("buildPageMetadata", () => {
    it("builds metadata for single diagram", () => {
      const diagrams = [{ code: "graph TD\n  A --> B", title: "Flow" }];
      const result = buildPageMetadata(diagrams);

      expect(result).toHaveLength(1);
      expect(result[0].index).toBe(0);
      expect(result[0].title).toBe("Flow");
      expect(result[0].diagram_type).toBe("flowchart");
    });

    it("builds metadata for multiple diagrams", () => {
      const diagrams = [
        { code: "graph TD\n  A --> B", title: "Flow" },
        { code: "sequenceDiagram\n  A->>B: Hi", title: "Seq" },
        { code: 'pie\n  "A": 50', title: "Pie" },
      ];
      const result = buildPageMetadata(diagrams);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        index: 0,
        title: "Flow",
        diagram_type: "flowchart",
      });
      expect(result[1]).toEqual({
        index: 1,
        title: "Seq",
        diagram_type: "sequence",
      });
      expect(result[2]).toEqual({
        index: 2,
        title: "Pie",
        diagram_type: "pie",
      });
    });

    it("handles diagrams without titles", () => {
      const diagrams = [{ code: "graph TD\n  A --> B" }];
      const result = buildPageMetadata(diagrams);

      expect(result[0].title).toBeUndefined();
    });
  });
});
