# Data Model: PDF Deck Builder

**Date**: 2026-01-03
**Branch**: `009-pdf-deck-builder`

## Overview

This document defines the key entities, their fields, relationships, and validation rules for the PDF deck builder MCP tool.

---

## Entities

### 1. DiagramInput

A single Mermaid diagram to be included in the deck.

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `code` | string | Yes | 1 byte - 1MB, non-empty | Mermaid diagram source code |
| `title` | string | No | max 256 chars | Optional title for this page |

**Relationships**: Many DiagramInput → One DeckRequest

### 2. DeckRequest

The input to the `mermaid_to_deck` tool.

| Field | Type | Required | Default | Validation | Description |
|-------|------|----------|---------|------------|-------------|
| `diagrams` | DiagramInput[] | Yes | - | 1-100 items, total ≤10MB | Array of diagrams |
| `page_size` | enum | No | "letter" | letter, a4, legal | PDF page size |
| `orientation` | enum | No | "landscape" | landscape, portrait | Page orientation |
| `show_titles` | boolean | No | true | - | Display diagram titles on pages |
| `margins` | Margins | No | 36pt all | see Margins | Page margins |
| `theme` | enum | No | "default" | default, dark, forest, neutral | Mermaid color theme |
| `background` | string | No | "#ffffff" | valid CSS color | Page background color |
| `drop_shadow` | boolean | No | true | - | Apply drop shadow to nodes |
| `google_font` | string | No | "Source Code Pro" | valid Google Font name | Font for diagrams |
| `timeout_ms` | integer | No | 120000 | 1000-120000 | Global timeout in ms |

**Relationships**: One DeckRequest → Many DiagramInput

### 3. Margins

Page margin configuration.

| Field | Type | Required | Default | Validation | Description |
|-------|------|----------|---------|------------|-------------|
| `top` | integer | No | 36 | 0-144 | Top margin in points |
| `right` | integer | No | 36 | 0-144 | Right margin in points |
| `bottom` | integer | No | 36 | 0-144 | Bottom margin in points |
| `left` | integer | No | 36 | 0-144 | Left margin in points |

### 4. PageMetadata

Information about a rendered page in the deck.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `index` | integer | Yes | Zero-based page index |
| `title` | string | No | Title if provided in input |
| `diagram_type` | string | Yes | Detected Mermaid diagram type |

**Detected Types**: flowchart, sequence, class, state, er, journey, gantt, pie, mindmap, timeline, quadrant, git, unknown

### 5. S3Location

S3 storage location details (reused from existing schema).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bucket` | string | Yes | S3 bucket name |
| `key` | string | Yes | Object key (artifact_id.pdf) |
| `region` | string | Yes | AWS region |

### 6. DeckSuccessResponse

Successful deck generation response.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ok` | literal true | Yes | Success indicator |
| `request_id` | uuid | Yes | Unique request identifier |
| `artifact_id` | uuid | Yes | Generated artifact ID |
| `download_url` | string (url) | Yes | Presigned S3 download URL |
| `cdn_url` | string (url) | No | CDN URL (when configured) |
| `curl_command` | string | Yes | Ready-to-use download command |
| `s3` | S3Location | Yes | S3 location details |
| `expires_in_seconds` | integer | Yes | URL expiration time |
| `content_type` | literal "application/pdf" | Yes | MIME type |
| `size_bytes` | integer | Yes | PDF file size |
| `page_count` | integer | Yes | Number of pages in deck |
| `pages` | PageMetadata[] | Yes | Per-page metadata |
| `warnings` | Warning[] | Yes | Non-fatal warnings (may be empty) |
| `errors` | RenderError[] | Yes | Empty for success |

### 7. DeckErrorResponse

Failed deck generation response.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ok` | literal false | Yes | Failure indicator |
| `request_id` | uuid | Yes | Unique request identifier |
| `warnings` | Warning[] | Yes | Non-fatal warnings |
| `errors` | RenderError[] | Yes | At least one error |

### 8. RenderError

Error details (extends existing error schema).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | ErrorCode | Yes | Stable error code |
| `message` | string | Yes | Human-readable description |
| `details` | object | No | Additional context |
| `details.diagram_index` | integer | No | Index of failing diagram |
| `details.line` | integer | No | Line number for parse errors |

**Error Codes** (from existing `error-codes.ts`):
- `INVALID_INPUT` - Empty diagrams array, missing code
- `INPUT_TOO_LARGE` - Exceeds size/count limits
- `PARSE_ERROR` - Mermaid syntax error
- `RENDER_TIMEOUT` - Global timeout exceeded
- `RENDER_FAILED` - Browser/renderer crash
- `PDF_GENERATION_FAILED` - PDF assembly failure
- `STORAGE_FAILED` - S3 upload failure

---

## Page Size Dimensions

| Size | Portrait (points) | Landscape (points) |
|------|-------------------|-------------------|
| letter | 612 × 792 | 792 × 612 |
| a4 | 595 × 842 | 842 × 595 |
| legal | 612 × 1008 | 1008 × 612 |

---

## State Transitions

The deck generation process follows this state machine:

```
[Request Received]
       ↓
[Validate Input]
  ├── Invalid → [Error: INVALID_INPUT | INPUT_TOO_LARGE]
  └── Valid ↓
[Launch Browser]
       ↓
[Render Diagrams] (loop)
  ├── Parse Error → [Error: PARSE_ERROR]
  ├── Timeout → [Error: RENDER_TIMEOUT]
  ├── Crash → [Error: RENDER_FAILED]
  └── Success → [Next Diagram or Assemble]
       ↓
[Assemble PDF]
  ├── Failure → [Error: PDF_GENERATION_FAILED]
  └── Success ↓
[Upload to S3]
  ├── Failure → [Error: STORAGE_FAILED]
  └── Success ↓
[Return Success Response]
```

**Invariant**: Browser is always closed in finally block, regardless of success or failure.

---

## Validation Rules Summary

| Rule | Limit | Error Code |
|------|-------|------------|
| Diagrams array empty | min 1 | INVALID_INPUT |
| Diagrams count | max 100 | INPUT_TOO_LARGE |
| Total input size | max 10MB | INPUT_TOO_LARGE |
| Per-diagram code size | max 1MB | INPUT_TOO_LARGE |
| Timeout range | 1000-120000ms | INVALID_TIMEOUT |
| Diagram code empty | non-empty | INVALID_INPUT |
