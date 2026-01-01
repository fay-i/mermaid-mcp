# Data Model: Mermaid to SVG Conversion Tool

**Feature**: 002-mermaid-to-svg
**Date**: 2025-12-30

## Entities

### MermaidToSvgInput

Represents an incoming conversion request.

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `code` | string | Yes | Non-empty, max 1MB | Mermaid diagram source code |
| `theme` | enum | No | default, dark, forest, neutral | Diagram color theme |
| `background` | string | No | Valid CSS color or "transparent" | Background color |
| `config_json` | string | No | Valid JSON object | Advanced Mermaid configuration |
| `timeout_ms` | integer | No | 1000-120000 (default: 30000) | Render timeout in milliseconds |

**Validation Rules**:
- `code` MUST be a non-empty string
- `code` length MUST NOT exceed 1,048,576 bytes (1MB)
- `theme` MUST be one of the enumerated values if provided
- `background` MUST be a valid CSS color value or "transparent" if provided
- `config_json` MUST parse as valid JSON object if provided
- `timeout_ms` MUST be between 1000 and 120000 inclusive if provided

### MermaidToSvgOutput

Represents the tool output for all outcomes.

#### Success Response

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ok` | boolean | Yes | Always `true` for success |
| `request_id` | string | Yes | UUID v4 for request correlation |
| `svg` | string | Yes | Valid SVG 1.1 markup |
| `warnings` | array | Yes | Warning messages (may be empty) |
| `errors` | array | Yes | Empty array for success |

#### Error Response

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ok` | boolean | Yes | Always `false` for errors |
| `request_id` | string | Yes | UUID v4 for request correlation |
| `warnings` | array | Yes | Warning messages (may be empty) |
| `errors` | array | Yes | Array with at least one RenderError |

**Invariants**:
- `request_id` MUST be a valid UUID v4
- `warnings` and `errors` MUST always be present (arrays, possibly empty)
- When `ok=true`: `svg` MUST be present, `errors` MUST be empty
- When `ok=false`: `svg` MUST NOT be present, `errors` MUST have at least one entry

### RenderError

Represents a structured error.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | enum | Yes | Stable error code (see Error Codes) |
| `message` | string | Yes | Human-readable error description |
| `details` | object | No | Additional context (e.g., line/column for parse errors) |

### Warning

Represents a non-fatal issue.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Warning identifier |
| `message` | string | Yes | Human-readable warning description |

## Error Codes

Stable error codes mapped to failure scenarios:

| Code | Description | When |
|------|-------------|------|
| `INVALID_INPUT` | Missing or empty required input | `code` is empty or missing |
| `INPUT_TOO_LARGE` | Input exceeds size limit | `code` exceeds 1MB |
| `PARSE_ERROR` | Mermaid syntax error | Invalid diagram syntax |
| `UNSUPPORTED_DIAGRAM` | Diagram type not supported | Unrecognized diagram directive |
| `INVALID_CONFIG` | Invalid config_json | JSON parse fails or invalid schema |
| `INVALID_TIMEOUT` | Timeout out of range | timeout_ms < 1000 or > 120000 |
| `RENDER_TIMEOUT` | Render exceeded timeout | Timeout reached during render |
| `RENDER_FAILED` | Renderer crashed | Puppeteer/Mermaid crash |

## State Transitions

```
┌──────────────┐
│   Received   │
└──────┬───────┘
       │ validate input
       ▼
   ┌───────┐     validation failed     ┌─────────────┐
   │ Valid │ ───────────────────────▶  │ Error (400) │
   └───┬───┘                           └─────────────┘
       │ start render
       ▼
┌──────────────┐
│  Rendering   │
└──────┬───────┘
       │
   ┌───┴───────────────┬──────────────────┐
   ▼                   ▼                  ▼
┌─────────┐      ┌───────────┐      ┌───────────┐
│ Success │      │  Timeout  │      │   Crash   │
└────┬────┘      └─────┬─────┘      └─────┬─────┘
     │                 │                  │
     ▼                 ▼                  ▼
 ok: true        RENDER_TIMEOUT      RENDER_FAILED
```

## Relationships

```
MermaidToSvgInput
       │
       │ 1 produces 1
       ▼
MermaidToSvgOutput
       │
       ├── contains 0..n Warning
       │
       └── contains 0..n RenderError
```

## Zod Schema (TypeScript)

```typescript
import { z } from 'zod';

// Input
export const MermaidToSvgInputSchema = z.object({
  code: z.string().min(1).max(1_048_576),
  theme: z.enum(['default', 'dark', 'forest', 'neutral']).optional(),
  background: z.string().optional(),
  config_json: z.string().optional(),
  timeout_ms: z.number().int().min(1000).max(120000).optional(),
});

// Error codes
export const ErrorCodeSchema = z.enum([
  'INVALID_INPUT',
  'INPUT_TOO_LARGE',
  'PARSE_ERROR',
  'UNSUPPORTED_DIAGRAM',
  'INVALID_CONFIG',
  'INVALID_TIMEOUT',
  'RENDER_TIMEOUT',
  'RENDER_FAILED',
]);

// Error structure
export const RenderErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

// Warning structure
export const WarningSchema = z.object({
  code: z.string(),
  message: z.string(),
});

// Success output
export const MermaidToSvgSuccessSchema = z.object({
  ok: z.literal(true),
  request_id: z.string().uuid(),
  svg: z.string(),
  warnings: z.array(WarningSchema),
  errors: z.array(RenderErrorSchema).length(0),
});

// Error output
export const MermaidToSvgErrorSchema = z.object({
  ok: z.literal(false),
  request_id: z.string().uuid(),
  warnings: z.array(WarningSchema),
  errors: z.array(RenderErrorSchema).min(1),
});

// Combined output
export const MermaidToSvgOutputSchema = z.discriminatedUnion('ok', [
  MermaidToSvgSuccessSchema,
  MermaidToSvgErrorSchema,
]);

// Type exports
export type MermaidToSvgInput = z.infer<typeof MermaidToSvgInputSchema>;
export type MermaidToSvgOutput = z.infer<typeof MermaidToSvgOutputSchema>;
export type RenderError = z.infer<typeof RenderErrorSchema>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
```
