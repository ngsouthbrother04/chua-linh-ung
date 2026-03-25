# Execution TODO Issues

Issue-style execution tracker mapped to current repository files.

Source alignment:
- SPEC_CANONICAL.md
- IMPLEMENTATION_TASK_BREAKDOWN.md

Status legend:
- TODO
- IN_PROGRESS
- IN_REVIEW
- QA
- BLOCKED
- DONE
- DONE_WITH_NOTES

All core logic must comply with SPEC_CANONICAL.md (Single Voice Rule, Map Tap Triggers).

## Sprint S1 (P0 Foundation)

### ISSUE-001 - Backend bootstrap hardening
Status: TODO
Priority: P0
Scope: Update backend app bootstrap and config loading.
Target files: apps/backend/src/index.ts

### ISSUE-002 - Auth API skeleton and validation
Status: TODO
Priority: P0
Scope: Add payment-initiate and claim-code API contracts.

### ISSUE-003 - Backend TTS Processing (Google Cloud)
Status: TODO
Priority: P0
Scope: Implement job to call Cloud TTS, save MP3 files to S3/Local, and store audio_urls in PostgreSQL.

### ISSUE-003B - Sync manifest and full content endpoints
Status: TODO
Priority: P0
Scope: Implement manifest check and full sync response for POIs (including audio_urls).

### ISSUE-004 - Mobile app shell and routing baseline
Status: TODO
Priority: P0
Scope: Replace placeholder UI with auth + main app shell.

### ISSUE-005 - SQLite data layer baseline
Status: TODO
Priority: P0
Scope: Add local persistence layer for pois, tours.

### ISSUE-006 - Sync service and offline-first bootstrap
Status: TODO
Priority: P0
Scope: Add launch-time manifest compare and sync flow.

### ISSUE-007 - Map UI and Marker Engine
Status: TODO
Priority: P0
Scope: Renders POIs on the map and handles user tap interactions.
Target files: apps/mobile/App.tsx
Verify steps: 
1. Map displays markers. 
2. Tapping markers opens bottom sheet.

### ISSUE-008 - Audio Player State Machine using expo-av
Status: TODO
Priority: P0
Scope: Add IDLE, PLAYING, PAUSED transitions via `expo-av` and enforce Single Voice Rule so only one POI's audio plays at a time.

## Sprint S2 (P0 Completion + P1 Core UX)

### ISSUE-009 - QR manual fallback path
Status: TODO
Priority: P0
Scope: Implement QR trigger through same narration State Machine.

### ISSUE-010 - Language and playback controls
Status: TODO
Priority: P1
Scope: Add language selection and player controls (Play/Pause/Stop).

### ISSUE-011 - Tour list/detail and active mode
Status: TODO
Priority: P1
Scope: Build tour browsing and filter map to show current tour stops.

## Sprint S3 (Quality + Hardening)

### ISSUE-012 - Unit tests for State Machine
Status: TODO
Priority: P1
Scope: Test the Single Voice Rule (interruptions) and Play/Pause logic.

### ISSUE-013 - Integration and scenario tests
Status: TODO
Priority: P1
Scope: Validate core end-to-end scenarios from docs/test_scenarios.md.

## Current blockers snapshot
1. Mobile dependencies required by canonical spec are not installed yet.
2. Backend route structure is still single-file and needs modularization.

## Rules for execution
1. Any behavior/default change must update SPEC_CANONICAL.md first.
2. Do not merge changes that violate the single-voice invariants or attempt to add auto-play geo logic.

## Release Checklist - Branch 3122560001

Release scope:
- DB-01: Prisma schema + baseline migrations + seed flow.
- AUTH-01: claim, payment initiate, payment callback/finalize.
- SYNC-01: sync manifest endpoint.
- SYNC-02: full sync endpoint.
- Runtime hardening: gzip compression + centralized API error handling.
- Validation: backend unit tests and TypeScript build.

### AC mapping

| AC / Task | Status | Evidence | Notes |
|---|---|---|---|
| DB-01 - Canonical backend tables available | PASS | Prisma migrations created and applied (`20260325120000_db01_init`, `20260325133000_auth_tables`, `20260325143000_payment_callback_hardening`) | Includes `points_of_interest`, `tours`, `analytics_events`, `claim_codes`, `payment_transactions`, `payment_callback_events` |
| AUTH-01 - Claim code auth flow | PASS | `POST /api/v1/auth/claim` implemented + tests in `apps/backend/tests/auth.routes.test.ts` | Returns token payload and enforces claim validation |
| AUTH-01 - Payment initiation flow | PASS | `POST /api/v1/auth/payment/initiate` implemented + tests in `apps/backend/tests/auth.routes.test.ts` | Supports `vnpay` and `momo` mapping to provider enum |
| AUTH-01 - Payment callback/finalize flow | PASS | `POST /api/v1/auth/payment/callback` implemented + tests in `apps/backend/tests/auth.routes.test.ts` | Includes HMAC verification, callback timestamp TTL, idempotency key persistence |
| SYNC-01 - Manifest endpoint | PASS | `GET /api/v1/sync/manifest` implemented + tests in `apps/backend/tests/sync.routes.test.ts` | Checksum uses content-aware stable hash |
| SYNC-02 - Full sync endpoint | PASS | `GET /api/v1/sync/full` implemented + unit/runtime tests in `apps/backend/tests/sync.routes.test.ts` and `apps/backend/tests/sync.integration.test.ts` | Requires Bearer token format, validates version query, and short-circuits when client version is already current (`needsSync=false`) |
| CORE-01 - Schema/config merge conflict management | PASS | `git diff --name-status origin/main...3122560001 -- apps/backend/prisma/schema.prisma apps/backend/package.json apps/backend/tsconfig.json apps/backend/src/index.ts` | No divergence on conflict-sensitive files; branch conflict risk for backend core schema/config is currently clear |
| Error handling utility integration | PASS | ApiError + async handler + global/not-found middleware in backend | Tests in `apps/backend/tests/error-handling.middleware.test.ts` |
| Gzip response compression | PASS | `compression` middleware enabled in backend bootstrap | Configured with threshold `0` |
| Regression check - tests and build | PASS | `npm test` => 22/22 passed; `npm run build` => success | Re-run confirmed green on 2026-03-25 |

### Residual risks

| Risk | Level | Impact | Mitigation / Next action |
|---|---|---|---|
| Provider-specific webhook verification not yet fully aligned to real VNPay/MoMo signature specs | MEDIUM | Callback security may not match production gateway requirements | Implement gateway-specific verifier per provider docs before production rollout |
| Payment finalize/idempotency paths still lack dedicated DB integration tests | LOW | Runtime regressions in payment callback transaction edges may be missed | Add integration tests against test DB for payment finalize/idempotency paths |
| Auth token generation currently uses internal JWT signing without key rotation workflow | LOW | Long-term ops/security maintainability risk | Add key rotation strategy and secret management policy for production |

### Go / No-Go

- Recommendation: GO for merge to main for branch 3122560001 scope.
- Conditions:
	- Keep provider-specific webhook verification as immediate post-merge hardening ticket for production release.
	- Keep DB integration tests as next quality increment.
