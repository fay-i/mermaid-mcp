# Feature Specification: Mermaid Printer MCP Server

**Feature Branch**: `001-mermaid-svg-tool`
**Created**: 2025-12-30
**Status**: Draft
**Input**: User description: "Create an MCP server that behaves like a printer: given Mermaid source code, it produces vector artifacts (SVG and PDF), plus optional parsed metadata (AST). This is not an editor and has no UI."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Render Mermaid to SVG (Priority: P1)

As an AI agent or developer tool, I want to submit Mermaid diagram source code and receive a clean SVG string so that I can embed vector diagrams in documents, web pages, or other outputs.

**Why this priority**: SVG rendering is the core value proposition. Without this, the server provides no utility. This is the primary use case that all other features build upon.

**Independent Test**: Can be fully tested by sending valid Mermaid syntax (e.g., a simple flowchart) to the `mermaid_to_svg` tool and receiving a valid SVG string that can be rendered in a browser.

**Acceptance Scenarios**:

1. **Given** valid Mermaid flowchart syntax, **When** I call `mermaid_to_svg` with the code, **Then** I receive a response with `ok: true` and a valid SVG string in the output
2. **Given** valid Mermaid syntax with theme "dark", **When** I call `mermaid_to_svg` with code and theme, **Then** I receive an SVG styled with the dark theme
3. **Given** valid Mermaid syntax with background "transparent", **When** I call `mermaid_to_svg`, **Then** I receive an SVG with transparent background
4. **Given** the same Mermaid source and options, **When** I call `mermaid_to_svg` multiple times, **Then** I receive identical SVG output each time (deterministic)

---

### User Story 2 - Handle Invalid Mermaid Syntax (Priority: P1)

As an AI agent, I want clear error messages when I submit invalid Mermaid syntax so that I can understand what went wrong and correct my input.

**Why this priority**: Error handling is equally critical to success handling. Without proper error responses, the tool is unreliable and frustrating to use.

**Independent Test**: Can be fully tested by sending malformed Mermaid syntax and verifying the error response contains actionable information.

**Acceptance Scenarios**:

1. **Given** invalid Mermaid syntax, **When** I call `mermaid_to_svg`, **Then** I receive a response with `ok: false` and an error array containing a descriptive error with code and message
2. **Given** empty code input, **When** I call `mermaid_to_svg`, **Then** I receive a validation error indicating code is required
3. **Given** syntactically incorrect Mermaid (e.g., missing arrow in flowchart), **When** I call `mermaid_to_svg`, **Then** I receive an error that helps identify the syntax problem

---

### User Story 3 - Handle Rendering Timeouts (Priority: P2)

As an AI agent, I want rendering operations to respect timeout limits so that a malformed or complex diagram doesn't hang indefinitely.

**Why this priority**: Timeouts are essential for reliability but secondary to core rendering. Complex diagrams or renderer issues could otherwise block the caller indefinitely.

**Independent Test**: Can be tested by submitting a diagram with a very short timeout and verifying the timeout error response.

**Acceptance Scenarios**:

1. **Given** valid Mermaid syntax and a custom timeout of 5000ms, **When** rendering completes within 5 seconds, **Then** I receive the SVG successfully
2. **Given** valid Mermaid syntax and a timeout of 1000ms (minimum), **When** rendering takes longer than 1 second, **Then** I receive a timeout error with code and message
3. **Given** no timeout specified, **When** I call `mermaid_to_svg`, **Then** the default timeout of 30000ms is applied

---

### User Story 4 - Apply Custom Mermaid Configuration (Priority: P3)

As an AI agent, I want to pass custom Mermaid configuration so that I can control diagram appearance beyond theme and background.

**Why this priority**: Advanced configuration is a power-user feature. Most users will be satisfied with theme and background options.

**Independent Test**: Can be tested by passing configuration that affects diagram rendering (e.g., flowchart direction) and verifying the output reflects those settings.

**Acceptance Scenarios**:

1. **Given** valid Mermaid syntax and config_json with flowchart direction "LR", **When** I call `mermaid_to_svg`, **Then** the resulting SVG shows a left-to-right flowchart layout
2. **Given** invalid config_json structure, **When** I call `mermaid_to_svg`, **Then** I receive a validation error about invalid configuration

---

### Edge Cases

- What happens when code contains unsupported diagram types? → Return error with unsupported diagram type code
- What happens when code is extremely large (>1MB)? → Return validation error about input size limits
- How does system handle concurrent rendering requests? → Each request is independent and isolated
- What happens when timeout_ms is below minimum (1000)? → Reject with validation error
- What happens when timeout_ms exceeds maximum (120000)? → Reject with validation error
- How does system handle renderer crashes/failures? → Return error with appropriate code and cleanup resources

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose an MCP tool named `mermaid_to_svg` that accepts Mermaid source code and returns SVG
- **FR-002**: System MUST return all responses as valid JSON matching the defined output schema
- **FR-003**: Every response MUST include: `ok` (boolean), `request_id` (UUID), `warnings` (array), and `errors` (array)
- **FR-004**: System MUST validate that `code` input is a non-empty string
- **FR-005**: System MUST support optional `theme` parameter with values like "default", "dark", "forest", "neutral"
- **FR-006**: System MUST support optional `background` parameter accepting color values (e.g., "transparent", "#ffffff")
- **FR-007**: System MUST support optional `config_json` parameter for advanced Mermaid configuration
- **FR-008**: System MUST support optional `timeout_ms` parameter with default 30000, minimum 1000, maximum 120000
- **FR-009**: System MUST return identical output for identical inputs (deterministic rendering)
- **FR-010**: System MUST return `ok: false` with populated `errors` array when rendering fails
- **FR-011**: System MUST include at least one error object with `code` and `message` when `ok: false`
- **FR-012**: System MUST omit tool-specific payloads (like SVG content) when `ok: false`
- **FR-013**: System MUST enforce timeout limits and return timeout error when exceeded
- **FR-014**: System MUST clean up renderer resources after each request (success or failure)
- **FR-015**: System MUST generate a unique UUID for each request's `request_id`

### Key Entities

- **MCP Tool Request**: Input containing Mermaid source code and optional rendering parameters (theme, background, config, timeout)
- **MCP Tool Response**: Standardized JSON output with status, request tracking, warnings, errors, and optional rendered content
- **Error Object**: Structured error information containing error code, human-readable message, and optional details
- **Rendering Context**: Isolated execution environment for each rendering operation with resource cleanup

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users receive valid SVG output for valid Mermaid input in under 5 seconds for typical diagrams (under 100 nodes)
- **SC-002**: Error responses provide actionable information that allows users to correct their input 90% of the time without external documentation
- **SC-003**: System handles 10 concurrent rendering requests without degradation
- **SC-004**: Identical inputs produce byte-for-byte identical outputs across multiple invocations
- **SC-005**: No resource leaks occur after 1000 consecutive requests (memory, file handles, processes)
- **SC-006**: Timeout enforcement is accurate within 500ms of specified limit
- **SC-007**: All supported Mermaid diagram types (flowchart, sequence, class, state, ER, gantt, pie, journey) render successfully

## Assumptions

- The Mermaid CLI or library will be used for rendering (specific tool choice deferred to implementation)
- Themes are limited to those supported by the underlying Mermaid renderer
- SVG output format follows standard SVG 1.1 specification
- The server operates in a single-process model with async request handling
- Resource cleanup includes any temporary files, child processes, or browser instances used for rendering
