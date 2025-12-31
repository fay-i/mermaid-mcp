# Data Model: MCP Server Foundation - Hello World

**Date**: 2025-12-30
**Status**: Complete

## Entities

### HealthcheckInput

The request payload for the healthcheck tool.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `echo` | string | No | Optional value to echo back for round-trip verification |

**Validation Rules**:
- `echo`: If provided, must be a string (no length limit for this foundation)

**Zod Schema**:
```typescript
const HealthcheckInputSchema = z.object({
  echo: z.string().optional(),
});
```

### HealthcheckOutput

The response payload from the healthcheck tool.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ok` | boolean | Yes | Always `true` for successful healthcheck |
| `status` | string | Yes | Health status, always `"healthy"` when responding |
| `version` | string | Yes | Server version from package.json |
| `timestamp` | string | Yes | ISO 8601 timestamp when response was generated |
| `echo` | string | No | Echoed value if `echo` was provided in input |

**Validation Rules**:
- `ok`: Must be `true` (if false, server wouldn't respond)
- `status`: Literal `"healthy"`
- `version`: Non-empty string matching semver pattern
- `timestamp`: Valid ISO 8601 format (e.g., `2025-12-30T12:00:00.000Z`)
- `echo`: Present only if input contained `echo`

**Zod Schema**:
```typescript
const HealthcheckOutputSchema = z.object({
  ok: z.literal(true),
  status: z.literal("healthy"),
  version: z.string(),
  timestamp: z.string().datetime(),
  echo: z.string().optional(),
});
```

## Relationships

```text
HealthcheckInput (request) → HealthcheckOutput (response)
```

No persistent entities or state transitions - this is a stateless healthcheck.

## MCP Tool Registration

The healthcheck tool is registered with the MCP server using:

```typescript
server.tool(
  "healthcheck",
  "Verify the MCP server is running and responding. Returns status, version, and optional echo.",
  HealthcheckInputSchema,
  async (params) => HealthcheckOutput
);
```

## Error Handling

The healthcheck tool does not have explicit error cases in this foundation. If the server is unhealthy, it simply won't respond. Future tools (like `mermaid_to_svg`) will have explicit error schemas.

## Version Source

The `version` field is read dynamically from `package.json`:

```typescript
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pkg = require("../package.json");
export const VERSION = pkg.version;
```

This ensures the healthcheck always reports the actual deployed version.
