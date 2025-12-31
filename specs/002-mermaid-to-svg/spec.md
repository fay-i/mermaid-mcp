# Feature Specification: Mermaid to SVG Conversion Tool

**Feature Branch**: `002-mermaid-to-svg`
**Created**: 2025-12-30
**Status**: Draft
**Input**: User description: "Implement core mermaid_to_svg MCP tool for converting Mermaid diagram source to SVG"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Convert Mermaid Flowchart to SVG (Priority: P1)

A developer integrating the MCP server wants to convert a Mermaid flowchart diagram into SVG format for embedding in their documentation or web application. They provide the Mermaid source code and receive clean, valid SVG markup in response.

**Why this priority**: This is the core functionality of the tool. Without basic diagram conversion, no other features have value. Flowcharts are the most common Mermaid diagram type.

**Independent Test**: Can be fully tested by providing valid Mermaid flowchart code to the tool and verifying the response contains valid SVG markup that renders the diagram correctly.

**Acceptance Scenarios**:

1. **Given** valid Mermaid flowchart code, **When** the user calls `mermaid_to_svg` with the code, **Then** the response contains `ok: true` and valid SVG markup representing the diagram
2. **Given** valid Mermaid flowchart code with default options, **When** the user calls the tool without specifying theme or background, **Then** the response uses the default theme and produces consistent output
3. **Given** the same Mermaid input with the same options, **When** the user calls the tool multiple times, **Then** each response produces identical SVG output (byte-for-byte deterministic)

---

### User Story 2 - Customize Diagram Appearance (Priority: P2)

A developer wants to customize the appearance of their generated SVG by specifying a theme (dark, forest, neutral) and/or background color to match their application's design system.

**Why this priority**: Customization options are essential for real-world integration but the tool has value even with defaults. This builds on P1's core functionality.

**Independent Test**: Can be tested by providing valid Mermaid code with theme and background parameters, then verifying the SVG output reflects the specified styling.

**Acceptance Scenarios**:

1. **Given** valid Mermaid code and theme set to "dark", **When** the user calls the tool, **Then** the SVG uses dark theme styling
2. **Given** valid Mermaid code and background set to "transparent", **When** the user calls the tool, **Then** the SVG has a transparent background
3. **Given** valid Mermaid code and background set to "#ffffff", **When** the user calls the tool, **Then** the SVG has a white background
4. **Given** valid Mermaid code with custom `config_json` options, **When** the user calls the tool, **Then** the Mermaid renderer applies the configuration

---

### User Story 3 - Handle Various Diagram Types (Priority: P2)

A developer wants to convert different types of Mermaid diagrams (sequence, class, state, ER, gantt, pie, journey) to SVG, not just flowcharts.

**Why this priority**: Multiple diagram type support expands the tool's utility significantly. Shares priority with customization as both extend core functionality.

**Independent Test**: Can be tested by providing valid Mermaid code for each supported diagram type and verifying correct SVG generation.

**Acceptance Scenarios**:

1. **Given** valid Mermaid sequence diagram code, **When** the user calls the tool, **Then** a valid SVG of the sequence diagram is returned
2. **Given** valid Mermaid class diagram code, **When** the user calls the tool, **Then** a valid SVG of the class diagram is returned
3. **Given** valid Mermaid state diagram code, **When** the user calls the tool, **Then** a valid SVG of the state diagram is returned
4. **Given** valid Mermaid ER diagram code, **When** the user calls the tool, **Then** a valid SVG of the ER diagram is returned
5. **Given** valid Mermaid gantt chart code, **When** the user calls the tool, **Then** a valid SVG of the gantt chart is returned
6. **Given** valid Mermaid pie chart code, **When** the user calls the tool, **Then** a valid SVG of the pie chart is returned
7. **Given** valid Mermaid journey diagram code, **When** the user calls the tool, **Then** a valid SVG of the journey diagram is returned

---

### User Story 4 - Receive Clear Error Feedback (Priority: P2)

A developer provides invalid Mermaid syntax or an unsupported diagram type and needs clear, actionable error information to diagnose and fix the problem.

**Why this priority**: Error handling is essential for developer experience. Without good errors, debugging integration issues becomes frustrating.

**Independent Test**: Can be tested by providing various invalid inputs and verifying appropriate error codes and messages are returned.

**Acceptance Scenarios**:

1. **Given** Mermaid code with syntax errors, **When** the user calls the tool, **Then** the response contains `ok: false` with error code `PARSE_ERROR` and a descriptive message
2. **Given** an unsupported diagram type, **When** the user calls the tool, **Then** the response contains `ok: false` with error code `UNSUPPORTED_DIAGRAM`
3. **Given** empty or missing `code` parameter, **When** the user calls the tool, **Then** the response contains `ok: false` with error code `INVALID_INPUT`
4. **Given** malformed `config_json` parameter, **When** the user calls the tool, **Then** the response contains `ok: false` with error code `INVALID_CONFIG`

---

### User Story 5 - Control Rendering Timeout (Priority: P3)

A developer working with complex diagrams wants to specify a custom timeout to allow more time for rendering, or a shorter timeout to fail fast.

**Why this priority**: Timeout control is a performance tuning feature. The tool is fully functional with reasonable defaults.

**Independent Test**: Can be tested by providing valid Mermaid code with various `timeout_ms` values and verifying timeout enforcement.

**Acceptance Scenarios**:

1. **Given** valid Mermaid code and `timeout_ms` set to 5000, **When** the tool is called, **Then** the tool enforces the 5-second timeout (within 500ms accuracy)
2. **Given** `timeout_ms` set below 1000 (minimum), **When** the user calls the tool, **Then** the response contains `ok: false` with error code `INVALID_TIMEOUT`
3. **Given** `timeout_ms` set above 120000 (maximum), **When** the user calls the tool, **Then** the response contains `ok: false` with error code `INVALID_TIMEOUT`
4. **Given** a diagram that takes too long to render, **When** the timeout is exceeded, **Then** the response contains `ok: false` with error code `RENDER_TIMEOUT`

---

### User Story 6 - Handle Resource Limits Gracefully (Priority: P3)

A developer accidentally provides extremely large input or triggers resource-intensive operations. The tool should protect itself and provide clear feedback.

**Why this priority**: Resource protection prevents abuse and ensures stability but is not required for basic functionality.

**Independent Test**: Can be tested by providing oversized input and verifying appropriate error handling and resource cleanup.

**Acceptance Scenarios**:

1. **Given** Mermaid code exceeding 1MB, **When** the user calls the tool, **Then** the response contains `ok: false` with error code `INPUT_TOO_LARGE`
2. **Given** any rendering request (success or failure), **When** the request completes, **Then** all resources (temp files, processes, browser instances) are cleaned up
3. **Given** a renderer crash during processing, **When** the failure occurs, **Then** the response contains `ok: false` with error code `RENDER_FAILED` and resources are still cleaned up

---

### Edge Cases

- What happens when the Mermaid code contains valid syntax but produces an empty diagram?
- How does the system handle Unicode characters and special symbols in diagram labels?
- What happens when the theme parameter contains an invalid value (not one of: default, dark, forest, neutral)?
- How does the system handle concurrent rendering requests (each request should be isolated)?
- What happens when the background color format is invalid?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept Mermaid diagram source code as a required input parameter (`code`)
- **FR-002**: System MUST return valid SVG 1.1 markup when rendering succeeds
- **FR-003**: System MUST support optional theme parameter accepting values: default, dark, forest, neutral
- **FR-004**: System MUST support optional background parameter accepting: "transparent", CSS color names (e.g., "white", "black"), or hex colors in format "#RRGGBB" or "#RGB"
- **FR-005**: System MUST support optional config_json parameter for advanced Mermaid configuration
- **FR-006**: System MUST support optional timeout_ms parameter with range 1000-120000 (default: 30000)
- **FR-007**: System MUST return consistent JSON response structure for all outcomes (ok, request_id, warnings, errors)
- **FR-008**: System MUST generate unique request_id (UUID) for each request
- **FR-009**: System MUST return descriptive error codes for all failure scenarios
- **FR-010**: System MUST produce deterministic output (identical inputs produce identical SVG)
- **FR-011**: System MUST support flowchart, sequence, class, state, ER, gantt, pie, and journey diagram types
- **FR-012**: System MUST clean up all resources after each request (temp files, processes, browser instances)
- **FR-013**: System MUST reject input exceeding 1MB with INPUT_TOO_LARGE error
- **FR-014**: System MUST enforce timeout within 500ms accuracy of specified value
- **FR-015**: System MUST isolate each rendering request (no shared state between renders)
- **FR-016**: System MUST omit tool-specific payload (svg) from response when ok=false

### Key Entities

- **RenderRequest**: Represents an incoming conversion request with code, optional theme, background, config_json, and timeout_ms
- **RenderResponse**: Represents the tool output containing ok status, request_id, warnings array, errors array, and svg string (when successful)
- **RenderError**: Represents an error with code (INVALID_INPUT, PARSE_ERROR, etc.), message, and optional details object

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can convert a simple Mermaid flowchart to SVG in under 5 seconds
- **SC-002**: All 8 supported diagram types successfully render to valid SVG
- **SC-003**: 100% of rendering requests produce deterministic output (same input = identical SVG)
- **SC-004**: Users receive error messages within 1 second that include: (a) stable error code, (b) human-readable description, (c) for PARSE_ERROR: line/column number when available from Mermaid parser
- **SC-005**: System cleans up all resources after every request (zero resource leaks)
- **SC-006**: Timeout enforcement accuracy within 500ms of specified value
- **SC-007**: Users can customize diagram appearance using theme and background parameters
- **SC-008**: Invalid inputs are rejected with appropriate error codes before rendering attempts

## Assumptions

- The MCP server foundation (001-mcp-hello-world) is already implemented and functioning
- Users are developers integrating the MCP server into their toolchain
- SVG 1.1 specification is the target output format for maximum compatibility
- Default timeout of 30 seconds is sufficient for typical diagram complexity
- 1MB input limit is reasonable for legitimate use cases (covers diagrams with hundreds of nodes)
- Concurrent requests are handled independently with no performance degradation guarantees beyond isolation
