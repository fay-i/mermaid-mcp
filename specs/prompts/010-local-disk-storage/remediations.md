# Specification Remediations: 010-local-disk-storage

**Generated**: January 6, 2026  
**Source**: `/speckit.analyze` output  
**Status**: ✅ APPLIED

---

## Applied Remediations

| ID | Severity | Decision | Files Modified |
|----|----------|----------|----------------|
| R1 | HIGH | Option A (separate files) | tasks.md, plan.md |
| R2 | HIGH | Updated S3 backward compat scenarios | tasks.md, contracts/storage-backend.md |
| R3 | MEDIUM | Option A (new local-file-handler.ts) | plan.md |
| R4 | MEDIUM | Added T015a, T024a | tasks.md |
| R5 | LOW | Added T054a, T059a | tasks.md |

---

## Clarifications Applied

- **S3 URLs**: Presigned URLs returned as-is from AWS/MinIO (scheme determined by provider, not us)
- **Local storage**: Primary is `file://` URLs (FR-004)
- **CDN proxy**: `http://` fallback for consumers who can't use `file://`
- **HTTPS**: Out of scope - consumers implement in their own stack

---

## Summary

This document contains concrete remediation suggestions for issues identified during specification analysis. Each remediation includes the exact file edits needed. **Do not apply these changes without explicit approval.**

---

## Remediation R1: Resolve File Organization Inconsistency (F1 - HIGH)

### Issue
`plan.md` lists `src/storage/errors.ts` as a separate file, but `tasks.md` T001 and T003 both reference `src/storage/types.ts` for interfaces. The contracts file shows `StorageError` as a class. It's unclear whether errors should be in a separate file or consolidated.

### Decision Required
Choose one approach:

**Option A: Separate files (recommended for maintainability)**
- `types.ts` - Interfaces and type definitions
- `errors.ts` - Error classes and error codes

**Option B: Single file**
- `types.ts` - Everything (interfaces, types, and errors)

### Recommended Edit (Option A)

**File**: `specs/010-local-disk-storage/tasks.md`

**Current** (lines 37-41):
```markdown
- [ ] T001 Create storage types and interfaces in src/storage/types.ts
- [ ] T002 [P] Create storage error classes (StorageError, ArtifactNotFoundError, StorageFullError) in src/storage/errors.ts
- [ ] T003 [P] Create StorageResult interface and Zod schema in src/storage/types.ts
```

**Replace with**:
```markdown
- [ ] T001 Create StorageBackend interface, StorageResult interface, and StorageErrorCode type in src/storage/types.ts
- [ ] T002 [P] Create StorageError base class and specific error subclasses (ArtifactNotFoundError, StorageFullError, StoragePermissionError) in src/storage/errors.ts
- [ ] T003 [P] Create Zod schemas for StorageResult validation in src/storage/schemas.ts
```

**File**: `specs/010-local-disk-storage/plan.md`

**Current** (lines 64-67):
```markdown
1. `src/storage/types.ts` - Interface, result types, error classes
2. `src/storage/config.ts` - Configuration loader with validation
3. `tests/behavior/storage/config.test.ts` - Config validation tests
```

**Replace with**:
```markdown
1. `src/storage/types.ts` - StorageBackend interface, StorageResult type, StorageErrorCode type
2. `src/storage/errors.ts` - StorageError base class and subclasses
3. `src/storage/schemas.ts` - Zod schemas for runtime validation
4. `src/storage/config.ts` - Configuration loader with validation
5. `tests/behavior/storage/config.test.ts` - Config validation tests
```

---

## Remediation R2: Add Explicit S3 Backward Compatibility Tests (D1 - HIGH)

### Issue
T042 mentions "existing S3 behavior unchanged" but no explicit test scenarios are defined. This is critical for FR-012 (zero breaking changes to S3 deployments).

### Recommended Edit

**File**: `specs/010-local-disk-storage/tasks.md`

**Current** (line 127):
```markdown
- [ ] T042 [US2] Integration test: existing S3 behavior unchanged in tests/behavior/storage/s3-tool-integration.test.ts
```

**Replace with**:
```markdown
- [ ] T042 [US2] Integration test: S3 backward compatibility in tests/behavior/storage/s3-tool-integration.test.ts
  - Verify: mermaid_to_svg with S3 returns https:// presigned URL (existing format)
  - Verify: S3 artifact key format unchanged ({artifact_id}.{ext})
  - Verify: Presigned URL expiration behavior unchanged
  - Verify: S3 error codes map correctly (no new error formats)
  - Verify: Existing environment variables (S3_ENDPOINT, S3_BUCKET, etc.) still work
```

**Additionally**, add to `specs/010-local-disk-storage/contracts/storage-backend.md` after line 270:

```markdown
### S3 Backward Compatibility Guarantees

The S3StorageBackend wrapper MUST preserve these existing behaviors:

1. **URL Format**: Presigned URLs match existing pattern:
   ```
   https://{endpoint}/{bucket}/{artifact_id}.{ext}?X-Amz-Algorithm=...
   ```

2. **Environment Variables**: These existing variables MUST continue working:
   - `S3_ENDPOINT` or `AWS_ENDPOINT_URL`
   - `S3_BUCKET`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`

3. **Response Format**: Tool responses MUST include same fields:
   - `artifact_id`, `download_url`, `content_type`, `size_bytes`
   - `expires_in_seconds` for presigned URLs
   - `s3` object with `bucket`, `key`, `region`

4. **Error Codes**: Existing S3 error handling preserved (no new error codes for existing failure modes)
```

---

## Remediation R3: Clarify CDN Proxy File Structure (F2 - MEDIUM)

### Issue
`plan.md` Phase 5 mentions updating `src/cdn-proxy/handlers/artifact.ts`, but `tasks.md` Phase 4 (T050-T054) references creating a new `src/cdn-proxy/handlers/local-file-handler.ts`. This inconsistency could cause implementation confusion.

### Decision Required
Choose one approach:

**Option A: New handler file (recommended - separation of concerns)**
- Create `local-file-handler.ts` for local file serving
- Keep `artifact.ts` for routing/dispatching
- Router decides which handler to use based on storage type

**Option B: Extend existing artifact.ts**
- Add local file logic directly to `artifact.ts`
- Single handler with conditional logic

### Recommended Edit (Option A)

**File**: `specs/010-local-disk-storage/plan.md`

**Current** (lines 87-93):
```markdown
**Files**:
1. `src/cdn-proxy/local-fetcher.ts` - Local file reading
2. `src/cdn-proxy/handlers/artifact.ts` - Route to local or S3
3. `src/cdn-proxy/handlers/health.ts` - Report storage type
4. `src/cdn-proxy/config.ts` - Detect storage backend
```

**Replace with**:
```markdown
**Files**:
1. `src/cdn-proxy/local-fetcher.ts` - Local file reading utility
2. `src/cdn-proxy/handlers/local-file-handler.ts` - NEW: Handler for local storage requests
3. `src/cdn-proxy/handlers/artifact.ts` - UPDATE: Add routing logic to dispatch to local or S3 handler
4. `src/cdn-proxy/handlers/health.ts` - UPDATE: Report storage type
5. `src/cdn-proxy/config.ts` - UPDATE: Detect storage backend at startup
```

---

## Remediation R4: Add Missing Startup Validation Task (FR-008 - MEDIUM)

### Issue
FR-008 requires "System MUST verify write access to the storage path during startup and fail fast if unavailable." No explicit task covers this requirement.

### Recommended Edit

**File**: `specs/010-local-disk-storage/tasks.md`

**After T015** (line ~59), add:
```markdown
- [ ] T015a [US1] Implement startup write access validation (FR-008) in src/storage/local-backend.ts
  - Create test file on initialization
  - Delete test file after successful write
  - Throw StoragePermissionError if write fails
  - Log success message on validation pass
```

**And add corresponding test task after T024** (line ~70):
```markdown
- [ ] T024a [US1] Unit test for startup write access validation in tests/behavior/storage/local-backend.test.ts
```

---

## Remediation R5: Add Explicit Range Request Rejection Test (FR-013a - LOW)

### Issue
FR-013a specifies "CDN proxy MUST support only full file downloads (HTTP 200 OK), not range requests (HTTP 206 Partial Content)." Task T052 mentions "streaming" but doesn't explicitly test range request rejection.

### Recommended Edit

**File**: `specs/010-local-disk-storage/tasks.md`

**After T054** (line ~120), add:
```markdown
- [ ] T054a [US3] Verify Range header requests return 200 OK (not 206 Partial) in src/cdn-proxy/handlers/local-file-handler.ts
```

**After T059** (line ~125), add to test tasks:
```markdown
- [ ] T059a [P] [US3] Unit test: Range header ignored, full content returned with 200 OK
```

---

## Remediation Summary

| ID | Severity | Files Affected | Effort |
|----|----------|----------------|--------|
| R1 | HIGH | tasks.md, plan.md | Low (text edits) |
| R2 | HIGH | tasks.md, contracts/storage-backend.md | Medium (add test scenarios) |
| R3 | MEDIUM | plan.md | Low (clarification) |
| R4 | MEDIUM | tasks.md | Low (add 2 tasks) |
| R5 | LOW | tasks.md | Low (add 2 tasks) |

---

## Approval Checklist

Before applying remediations:

- [ ] R1: Confirm file organization choice (Option A or B)
- [ ] R2: Review backward compatibility scenarios for completeness
- [ ] R3: Confirm CDN handler approach (Option A or B)
- [ ] R4: Approve new task numbering (T015a, T024a)
- [ ] R5: Approve range request test addition

---

**To apply**: Reply with "Apply R1, R2, R3, R4, R5" (or subset) after making decisions on options.
