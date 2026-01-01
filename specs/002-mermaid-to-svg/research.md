# Research: Mermaid to SVG Rendering

**Feature**: 002-mermaid-to-svg
**Date**: 2025-12-30

## Research Questions

### RQ-001: What is the best approach for server-side Mermaid rendering?

**Decision**: Use `@mermaid-js/mermaid-cli` with Puppeteer.

**Rationale**:
- Official package maintained by Mermaid team
- Full support for all 8 diagram types (flowchart, sequence, class, state, ER, gantt, pie, journey)
- Programmatic Node.js API available via `renderMermaid` function
- Proven stability in production environments
- Active maintenance aligned with Mermaid core releases

**Alternatives Considered**:

| Approach | Rejected Because |
|----------|------------------|
| svgdom + mermaid (no browser) | Requires `htmlLabels: false` which limits diagram features; experimental and not all diagram types work |
| Direct Puppeteer + mermaid | More code to maintain, reinvents what mermaid-cli already provides |
| Kroki external API | Introduces external service dependency, network latency, availability risk |
| CLI shell-out to mmdc | Process overhead, harder error handling, less control |
| Playwright instead of Puppeteer | mermaid-cli officially uses Puppeteer; no benefit for this use case |

### RQ-002: How to achieve deterministic SVG output?

**Decision**: Configure mermaid with `deterministicIds: true` and fixed `deterministicIDSeed`.

**Rationale**:
- Mermaid generates non-deterministic IDs by default using timestamps
- Setting `deterministicIds: true` uses sequential IDs instead
- Optional `deterministicIDSeed` provides reproducible ID prefix
- Satisfies FR-010 (identical inputs = identical SVG) and SC-003 (100% deterministic)

**Configuration**:
```javascript
mermaidConfig: {
  deterministicIds: true,
  deterministicIDSeed: 'mermaid-mcp',
  // For hand-drawn diagrams
  seed: 42
}
```

### RQ-003: What resources require cleanup?

**Decision**: Browser instances must be explicitly closed after each request.

**Resources Identified**:
1. **Puppeteer Browser instance**: Consumes 300MB-1GB RAM per page
2. **Chrome processes**: Must verify only 2-3 processes running per healthy instance
3. **Temp files**: mermaid-cli doesn't create temp files; output goes directly to memory buffer

**Cleanup Strategy**:
```typescript
let browser: Browser;
try {
  browser = await puppeteer.launch({ headless: 'shell' });
  // ... render ...
} finally {
  await browser?.close();
}
```

### RQ-004: What themes are supported?

**Decision**: Support Mermaid's built-in themes as documented in spec.

**Supported Themes**:
- `default` - Standard color scheme
- `dark` - Dark mode colors
- `forest` - Green-focused palette
- `neutral` - Grayscale/accessible palette

**Implementation**: Pass theme via mermaidConfig:
```javascript
mermaidConfig: {
  theme: userProvidedTheme || 'default'
}
```

### RQ-005: How to handle background colors?

**Decision**: Use mermaid-cli's `backgroundColor` option.

**Supported Values**:
- `transparent` - No background
- CSS color values (e.g., `#ffffff`, `white`, `rgb(255,255,255)`)

**Implementation**:
```javascript
parseMMDOptions: {
  backgroundColor: userProvidedBackground || 'white'
}
```

### RQ-006: What is the Node.js API for mermaid-cli?

**Decision**: Use the `renderMermaid` function from `@mermaid-js/mermaid-cli`.

**API Signature** (from source analysis):
```typescript
import { renderMermaid } from '@mermaid-js/mermaid-cli';

const { data, width, height } = await renderMermaid(
  browser,           // Puppeteer Browser instance
  definition,        // Mermaid source code
  'svg',             // Output format
  {
    mermaidConfig: {
      theme: 'default',
      deterministicIds: true
    },
    backgroundColor: 'white'
  }
);
// data is Uint8Array containing SVG content
```

**Note**: The Node.js API is not covered by semver. Pin to specific version and test on upgrade.

### RQ-007: How to parse Mermaid syntax errors?

**Decision**: Catch and translate mermaid parse exceptions to PARSE_ERROR.

**Error Patterns**:
- Mermaid throws exceptions for syntax errors with descriptive messages
- Exception messages contain line/column information when available

**Implementation**:
```typescript
try {
  await renderMermaid(browser, code, 'svg', options);
} catch (error) {
  if (isMermaidParseError(error)) {
    return {
      ok: false,
      error_code: 'PARSE_ERROR',
      message: extractMermaidErrorMessage(error)
    };
  }
  throw error;
}
```

### RQ-008: What are the performance characteristics?

**Findings**:
- Puppeteer launch with `headless: 'shell'`: ~500-1000ms
- Simple diagram render: ~500-2000ms
- Total cold start for simple flowchart: ~1500-3000ms (within 5s SC-001)

**Optimization Path** (not implemented initially):
- Browser pooling could reduce per-request overhead
- Warm browser reduces render time to ~500-1000ms
- Will implement if needed based on real-world usage

## Dependencies Confirmed

| Package | Version | Purpose |
|---------|---------|---------|
| `@mermaid-js/mermaid-cli` | ^11.12.0 | Mermaid rendering engine |
| `puppeteer` | ^23.0.0 | Headless browser (peer dep) |

## Sources

- [GitHub - mermaid-js/mermaid-cli](https://github.com/mermaid-js/mermaid-cli)
- [@mermaid-js/mermaid-cli - npm](https://www.npmjs.com/package/@mermaid-js/mermaid-cli)
- [MermaidConfig Interface](http://mermaid.js.org/config/setup/mermaid/interfaces/MermaidConfig.html)
- [Server Side Support Issue #3650](https://github.com/mermaid-js/mermaid/issues/3650)
- [Deterministic output Issue #727](https://github.com/mermaid-js/mermaid/issues/727)
- [Puppeteer Memory Leak Journey](https://medium.com/@matveev.dina/the-hidden-cost-of-headless-browsers-a-puppeteer-memory-leak-journey-027e41291167)
