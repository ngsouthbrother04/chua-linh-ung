# Swagger/OpenAPI Specification Convention

**Document Purpose**: Guidelines to prevent common Swagger spec drift issues.

**Effective Date**: 2026-04-06  
**Version**: 1.0

---

## Problem Statement (Rủi ro)

1. **Schema không chi tiết** - Request/response vẫn do autogen suy luận nên chưa chính xác
2. **Spec drift** - Route thay đổi nhưng quên regenerate spec trước commit
3. **Inconsistent commits** - Swagger changes mixed with unrelated code changes

---

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    OPENAPI LIFECYCLE                            │
└─────────────────────────────────────────────────────────────────┘

Code Change → Test locally → Generate Spec → Validation → Commit → Review

1. GENERATE    (npm run openapi:generate)
   ├─ source: src/index.ts + JSDoc comments in routes
   ├─ swagger-autogen produces raw spec
   └─ post-processing adds security, tags, error schemas

2. VALIDATE    (npm run openapi:check && npm run openapi:lint)
   ├─ JSON syntax validation
   ├─ Redocly linting (operationId, security, servers)
   └─ Exit non-zero on violations

3. CONSISTENCY (npm run openapi:diff-check [--strict])
   ├─ Hash-based route change detection
   ├─ Warns if spec appears out of date
   └─ Can block commit in CI (--strict mode)

4. COMMIT      (git commit)
   ├─ Separate commit for routes vs. spec changes
   └─ Clear commit message linking to ticket
```

---

## Mandatory Practices

### ✅ DO: Document All Routes

Every route MUST have JSDoc comments describing:
- Summary (one-liner)
- Description (detailed intent)
- Request/response parameters with types
- All possible HTTP status codes

**Example**:

```typescript
/**
 * POST /api/v1/pois/search/radius
 * @summary Search POIs by radius
 * @description Find Points of Interest within specified geographic radius
 * @tags POIs
 * @param {object} request.body.required - Search criteria
 * @param {number} request.body.latitude.required - User latitude (decimal)
 * @param {number} request.body.longitude.required - User longitude (decimal)
 * @param {number} request.body.radiusM.required - Search radius in meters
 * @param {number} request.body.limit - Max results (default: 20)
 * @return {object} 200 - Success response with nearby POIs and distance ranking
 * @return {object} 400 - Invalid lat/lng/radius values
 * @return {object} 401 - Unauthorized (token required)
 * @return {object} 500 - Internal Server Error
 */
router.post('/search/radius', requireAuth, asyncHandler(async (req, res) => {
  // implementation
}));
```

### ✅ DO: Generate Before Every Commit

```bash
# Before committing route changes:
npm run openapi:generate

# Verify it passed validation:
npm run openapi:check
npm run openapi:lint

# Check consistency:
npm run openapi:diff-check --strict  # Optional: use in pre-commit hook
```

### ✅ DO: Separate Commits

- **Commit 1**: Route code changes
  ```
  git commit -m "feat(api): add new /pois/search/radius endpoint
  
  - Add geographic search capability with PostGIS
  - Filter results by user premium status
  - Proper pagination and limits
  
  Relates to: UC3 - Explore Nearby POIs"
  ```

- **Commit 2**: OpenAPI spec generation (if changed)
  ```
  git commit -m "docs(openapi): regenerate spec after route changes
  
  - Updated /pois/search/radius documentation
  - Added JSDoc for all parameters
  - Verified with npm run openapi:lint"
  ```

### ✅ DO: Use Tags Correctly

Swagger postprocessor automatically assigns tags. Keep tags in sync:

| Path Pattern | Tag | Auth Type |
|---|---|---|
| `/api/v1/auth` | Auth | Bearer or None |
| `/api/v1/sync` | Sync | Bearer |
| `/api/v1/pois` | POIs | Bearer |
| `/api/v1/tours` | Tours | Bearer |
| `/api/v1/analytics` | Analytics | Bearer |
| `/api/v1/admin` | Admin | Admin Key |

### ❌ DON'T: Manually Edit openapi.json

Never hand-edit the generated `openapi.json`. Instead:

1. Modify route JSDoc comments
2. Run `npm run openapi:generate` to regenerate
3. Commit the regenerated file

**Why**: Manual edits will be lost on next generation run.

### ❌ DON'T: Mix Spec Changes with Unrelated Code

```bash
# ❌ BAD - Don't do this in single commit:
git commit -m "feat: add search API and fix import bug and update docs"

# ✅ GOOD - Break into separate commits:
git commit -m "feat(api): add search endpoint"  # Commit 1
git commit -m "fix(import): resolve circular dependency"  # Commit 2
git commit -m "docs(openapi): regenerate spec"  # Commit 3
```

### ❌ DON'T: Forget to Generate

```bash
# ❌ Don't do this:
# (Modify route)
git add .
git commit -m "new endpoint"  # Forgot to generate!

# ✅ Instead, always do this first:
npm run openapi:generate
# (now spec is updated)
git add .
git commit -m "feat(api): new endpoint"
# (next commit)
git commit -m "docs(openapi): regenerate"
```

---

## Detection & Mitigation

### Phase 1: Development

```bash
# After modifying routes:
npm run openapi:generate
npm run openapi:check        # Syntax check
npm run openapi:lint         # Redocly compliance
npm run openapi:diff-check   # Warn if out of date
```

### Phase 2: Pre-commit (Optional via Husky)

```bash
# In .husky/pre-commit (if configured):
npm run openapi:diff-check --strict  # Block if spec out of date
```

### Phase 3: Review

PR reviewers should verify:
- ✓ New routes have JSDoc comments
- ✓ `npm run openapi:generate` produces clean output
- ✓ openapi.json is included in commit if routes changed
- ✓ Spec commit is separate from code commits

---

## Error Resolution

### Scenario 1: "Spec appears out of date"

```bash
# Happens when:
# 1. You modified routes
# 2. Forgot to regenerate spec

# Fix:
npm run openapi:generate
git add apps/backend/openapi.json
git commit -m "docs(openapi): regenerate spec"
```

### Scenario 2: "Redocly linting failed"

```bash
# Happens when:
# 1. Missing operationId on operation
# 2. Missing security scheme definition
# 3. Empty servers array

# Check detailed errors:
npm run openapi:lint

# Most are auto-fixed by postprocess, verify:
npm run openapi:generate
npm run openapi:lint
```

### Scenario 3: "Route and spec inconsistent during review"

```bash
# Reviewer notice spec missing a new operation

# Fix:
1. Ensure all routes have JSDoc (see "Mandatory Practices - DO")
2. npm run openapi:generate
3. Verify output includes new operation
4. Commit: git commit -m "docs(openapi): regenerate"
```

---

## Swagger Generation Pipeline

### Step 1: Raw Generation (swagger-autogen)

**Input**: `src/index.ts` + JSDoc comments in route handlers  
**Config**: `swagger.config.cjs`  
**Output**: `openapi.json` (raw)

```bash
npm run openapi:generate:raw
```

### Step 2: Post-processing

**Input**: `openapi.json` (raw)  
**Config**: `scripts/openapi-postprocess.cjs`  
**Output**: `openapi.json` (enhanced)

Enhancements:
- Add operation tags (Auth, Sync, POIs, etc.)
- Apply security requirements (Bearer, AdminKey, None)
- Inject standard error schemas
- Generate operationId if missing
- Remove internal endpoints (e.g., /api-docs/swagger.json)

```bash
npm run openapi:postprocess
```

### Step 3: Validation

```bash
npm run openapi:check    # JSON well-formed?
npm run openapi:lint     # Spec compliant? (Redocly)
npm run openapi:diff-check --strict  # Routes changed?
```

---

## Why This Matters

### Risk 1: Schema Inaccuracy

**Without proper JSDoc**: Autogen produces `{ "type": "object", "properties": { "any": {} } }`

**With JSDoc + postprocess**: Spec includes actual types, descriptions, examples

**Impact**: Mobile client developers can't reliably build against spec  
**Mitigation**: Enforce JSDoc review, postprocessing adds structure

---

### Risk 2: Spec Drift

**Scenario**: Engineer modifies `/api/v1/pois` endpoint but forgets `npm run openapi:generate`

**Result**: Spec in repo doesn't match live code → API docs are stale

**Impact**: Integration issues, mobile team uses outdated info, support tickets  
**Mitigation**: `npm run openapi:diff-check --strict` in pre-commit hook (CI or local)

---

### Risk 3: Hard-to-Review PRs

**Without separation**: Commit mixes route + spec + tests + docs

**With separation**: Clear sequence of commits, each reason is obvious

**Impact**: Easier code review, better git history, easier revert if needed  
**Mitigation**: Enforce separate commits in PR guidelines

---

## Checklist for PR Reviewers

- [ ] All new/modified routes have @summary and @description
- [ ] All parameters documented with @param
- [ ] All response codes documented with @return
- [ ] JSDoc format is consistent with existing routes
- [ ] `npm run openapi:generate` output is clean
- [ ] openapi.json changes are visible and make sense
- [ ] openapi.json commit is separate from code commits
- [ ] Tag assignment is correct (Auth, POIs, etc.)
- [ ] Security scheme matches endpoint sensitivity

---

## References

- **swagger-autogen**: https://github.com/davibaltar/swagger-autogen
- **JSDoc Format**: https://swagger.io/docs/specification/using-jsdoc/
- **Redocly**: https://redocly.com/docs/cli/
- **OpenAPI 3.0 Spec**: https://spec.openapis.org/oas/v3.0.3
- **Project Spec**: See `SPEC_CANONICAL.md` §2.8 (TTS Queue), `backend_design.md` §2 (API)
