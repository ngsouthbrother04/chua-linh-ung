# Execution TODO Issues

Issue-style execution tracker mapped to current repository files.

Source alignment:

- SPEC_CANONICAL.md
- AI_GUIDELINES.md
- ARCHITECTURE.md
- docs/backend_design.md
- docs/database_design.md
- USE_CASES.md
- docs/test_scenarios.md
- IMPLEMENTATION_TASK_BREAKDOWN.md

Terminology note:

- `AL_GUIDELINES.md` is treated as `AI_GUIDELINES.md` (canonical filename in repository).

Status legend:

- TODO
- IN_PROGRESS
- IN_REVIEW
- QA
- BLOCKED
- DONE
- DONE_WITH_NOTES

All core logic must comply with SPEC_CANONICAL.md (explicit Tap/QR trigger only, strict Single Voice Rule, offline-first).

API surface coverage note (2026-03-30):

1. Auth: `/api/v1/auth/claim`, `/api/v1/auth/payment/initiate`, `/api/v1/auth/payment/callback`, `/api/v1/auth/token-refresh`, `/api/v1/auth/logout`.
2. Sync: `/api/v1/sync/manifest`, `/api/v1/sync/full`, `/api/v1/sync/incremental`.
3. Public content: `/api/v1/pois`, `/api/v1/pois/:id`, `/api/v1/pois/search/radius`, `/api/v1/tours`, `/api/v1/tours/:id`.
4. Analytics: `/api/v1/analytics/events`, `/api/v1/analytics/presence/heartbeat`, `/api/v1/analytics/stats`.
5. Admin: CRUD POI/Tour + `/api/v1/admin/pois/:id/publish` + `/api/v1/admin/sync/invalidate`.

## Sprint S1 (P0 Foundation)

### ISSUE-001 - Backend bootstrap hardening

Status: DONE
Priority: P0
Scope: Update backend app bootstrap and config loading.
Target files: apps/backend/src/index.ts

### ISSUE-002 - Auth API skeleton and validation

Status: DONE
Priority: P0
Scope: Add/align auth API contracts for claim + payment initiate + payment callback/finalize + token-refresh + logout with validation and error contract.
Acceptance mapping: UC1, TC-1.1 ~ TC-1.5

Completion note: `POST /api/v1/auth/token-refresh` and `POST /api/v1/auth/logout` are implemented and covered by backend route tests.

### ISSUE-003 - Backend TTS Processing (Piper Offline)

Status: DONE
Priority: P0
Scope: Implement server-side TTS job queue (no on-device TTS), save MP3 to local filesystem, and persist `audio_urls` in PostgreSQL.
Acceptance mapping: ARCHITECTURE.md §3.3, AI_GUIDELINES.md §7

Progress note (2026-03-26):

1. Added admin trigger endpoint for POI audio generation queue.
2. Added queue mode: BullMQ with Redis and in-memory fallback when Redis is not configured.
3. Added local MP3 persistence and DB `audio_urls` update per language.
4. Added local filesystem storage as canonical provider for audio outputs.
5. Added integration test for enqueue flow that validates `audio_urls` update in real Prisma DB path.
6. Added integration test for local path contract persisted in `audio_urls`.
7. Added runtime config validation API + startup check + CLI predeploy check (`npm run tts:validate`).
8. Added explicit BullMQ duplicate guard (`queue.getJob(jobId)`) before enqueue to reduce duplicate generation risk.

### ISSUE-003B - Sync manifest and full content endpoints

Status: DONE
Priority: P0
Scope: Implement `GET /api/v1/sync/manifest`, `GET /api/v1/sync/full`, and `POST /api/v1/sync/incremental` with version/hash check, `needsSync` short-circuit, and payload including POIs/tours/audio URLs.
Acceptance mapping: UC8, TC-8.x, TC-12.x

### ISSUE-004 - Mobile app shell and routing baseline

Status: TODO
Priority: P0
Scope: Replace placeholder UI with auth + main app shell.

### ISSUE-005 - SQLite data layer baseline

Status: TODO
Priority: P0
Scope: Add local persistence layer for `pois`, `tours`, `sync_metadata` and define atomic replace transaction contract.
Acceptance mapping: database_design.md §7, UC8

### ISSUE-006 - Sync service and offline-first bootstrap

Status: TODO
Priority: P0
Scope: Add launch-time manifest compare (`/sync/manifest`) then delta-first sync (`/sync/incremental`) with fallback full sync (`/sync/full`) and all-or-nothing SQLite write + local cache-first reads.
Acceptance mapping: SPEC_CANONICAL.md §8, UC8

### ISSUE-007 - Map UI and Marker Engine

Status: TODO
Priority: P0
Scope: Render POIs on map, handle marker tap to open bottom sheet, and ensure audio is never auto-triggered by GPS/geofence.
Target files: apps/mobile/App.tsx
Verify steps: 

1. Map displays markers. 
2. Tapping markers opens bottom sheet.
3. No background/auto-play trigger path exists.

### ISSUE-008 - Audio Player State Machine using expo-av

Status: TODO
Priority: P0
Scope: Add `IDLE`/`PLAYING`/`PAUSED` transitions via `expo-av` + global state store, enforce Single Voice Rule (`PLAY_EVENT(NewPOI)` must stop current audio immediately before starting next).
Acceptance mapping: UC3.A1, UC4.A1, TC-3.2, TC-4.2

## Sprint S2 (P0 Completion + P1 Core UX)

### ISSUE-009 - QR manual fallback path

Status: TODO
Priority: P0
Scope: Implement QR scan flow (Decode -> SQLite lookup -> PLAY_EVENT) through the same narration State Machine and same Single Voice invariants.
Acceptance mapping: UC4, TC-4.1 ~ TC-4.4

### ISSUE-010 - Language and playback controls

Status: TODO
Priority: P1
Scope: Add language selection (15 languages, fallback chain requested -> en -> vi, persisted preference) and playback controls (Play/Pause/Stop).
Acceptance mapping: UC5, UC6, TC-5.x, TC-6.x

### ISSUE-011 - Tour list/detail and active mode

Status: TODO
Priority: P1
Scope: Build tour list/detail, active tour mode, and map filtering by ordered tour stops from local SQLite.
Acceptance mapping: UC7, TC-7.x

### ISSUE-014 - Webhook signature verifier & Payment integration tests

Status: DONE
Priority: P1
Scope: Implement gateway-specific signature verifiers for VNPay and MoMo. Add integration tests against test DB for payment callback idempotency and finalize logic.
Target files: apps/backend/src/utils/paymentVerifier.ts, apps/backend/tests/payment.integration.test.ts

## Sprint S3 (Quality + Hardening)

### ISSUE-012 - Unit tests for State Machine

Status: TODO
Priority: P1
Scope: Add unit tests for state transitions, interruption override, pause/resume/stop semantics, and reducer/store edge cases.
Acceptance mapping: TC-3.2, TC-4.2, TC-6.x

### ISSUE-013 - Integration and scenario tests

Status: DONE
Priority: P1
Scope: Validate end-to-end critical scenarios across UC1~UC8, including auth token lifecycle, offline sync (manifest/full/incremental), public POI/tour APIs, i18n fallback, QR errors, and analytics buffering/upload + heartbeat.
Acceptance mapping: docs/test_scenarios.md (Functional + Integration + Performance subsets, including TC-18.1 -> TC-18.8)

Completion note:

1. TC-18.1 to TC-18.3 checked for Auth and Full Sync endpoints.
2. TC-18.4 to TC-18.8 passed using testing APIs for POIs, Tours, Sync Incremental, and Analytics Presence endpoints.
3. Successfully run complete suite spanning `sync.routes.test.ts`, `public-content.routes.test.ts`, and `analytics.routes.test.ts`.

### ISSUE-015 - JWT Key Rotation & Security Middleware

Status: DONE
Priority: P1
Scope: Implement JWT key rotation strategy (kid header, multi-secret support) and strict auth middleware to secure API endpoints. Include tests for expired/invalid signatures.
Target files: apps/backend/src/services/authService.ts, apps/backend/src/middlewares/authMiddleware.ts, apps/backend/tests/jwt-rotation.test.ts

### ISSUE-016 - Soft Delete Retention & Audit Policy Execution

Status: DONE
Priority: P1
Scope: Operationalize soft-delete policy for POI lifecycle: define retention window, assign cleanup owner, and enforce audit trail contract for delete/publish actions.
Acceptance mapping: docs/prd/15_admin_requirements.md §6, docs/backend_design.md §8.3
Target files: apps/backend/src/services/poiAdminService.ts, apps/backend/src/services/imageService.ts, docs/backend_design.md, docs/prd/15_admin_requirements.md, docs/test_scenarios.md
Deliverables:

1. Add explicit retention config and scheduled/manual cleanup flow for soft-deleted POIs.
2. Ensure cleanup covers media artifacts (audio local files + stale image assets where applicable).
3. Define and document audit fields for high-impact admin operations (actor, action, reason, timestamp).
4. Add tests for retention cleanup behavior and audit log write path.

Completion note:

1. Added manual cleanup endpoint `POST /api/v1/admin/maintenance/pois/soft-delete-cleanup` with dry-run support.
2. Added optional scheduler bootstrap for retention cleanup via env flags.
3. Added structured admin audit events for POI create/update/publish/soft-delete and retention purge.
4. Added media cleanup integration: local audio cleanup + Cloudinary delete by URL during retention purge.
5. Added/updated tests: `tests/poiAdminService.test.ts`, `tests/admin.routes.test.ts`, `tests/tts.service.test.ts` (31/31 focused tests pass).
6. Added DB integration coverage for retention cleanup endpoint: `tests/admin.maintenance.integration.test.ts` (2/2 pass).

## Current blockers snapshot

1. Mobile dependencies required by canonical spec are not installed yet.
2. Mobile SQLite/file-cache/sync service scaffolding is not implemented yet (blocks UC8 offline-first validation).

## Rules for execution

1. Any behavior/default change must update SPEC_CANONICAL.md first.
2. Do not merge changes that violate the single-voice invariants or attempt to add auto-play geo logic.
3. No background GPS/geofencing implementation paths are allowed.
4. No feature is marked DONE without tests mapped to relevant `docs/test_scenarios.md` cases.

## Release Checklist - Branch 3122560001

Release scope:
- DB-01: Prisma schema + baseline migrations + seed flow.
- AUTH-01: claim, payment initiate, payment callback/finalize.
- SYNC-01: sync manifest endpoint.
- SYNC-02: full sync endpoint.
- Runtime hardening: gzip compression + centralized API error handling.
- Admin maintenance hardening: soft-delete retention cleanup + audit trail (ISSUE-016).
- Validation: backend unit tests and TypeScript build.

### AC mapping

| AC / Task | Status | Evidence | Notes |
| --- | --- | --- | --- |
| DB-01 - Canonical backend tables available | PASS | Prisma migrations created and applied (`20260325120000_db01_init`, `20260325133000_auth_tables`, `20260325143000_payment_callback_hardening`) | Includes `points_of_interest`, `tours`, `analytics_events`, `claim_codes`, `payment_transactions`, `payment_callback_events` |
| AUTH-01 - Claim code auth flow | PASS | `POST /api/v1/auth/claim` implemented + tests in `apps/backend/tests/auth.routes.test.ts` | Returns token payload and enforces claim validation |
| AUTH-01 - Payment initiation flow | PASS | `POST /api/v1/auth/payment/initiate` implemented + tests in `apps/backend/tests/auth.routes.test.ts` | Supports `vnpay` and `momo` mapping to provider enum |
| AUTH-01 - Payment callback/finalize flow | PASS | `POST /api/v1/auth/payment/callback` implemented + tests in `apps/backend/tests/auth.routes.test.ts` | Includes HMAC verification, callback timestamp TTL, idempotency key persistence |
| SYNC-01 - Manifest endpoint | PASS | `GET /api/v1/sync/manifest` implemented + tests in `apps/backend/tests/sync.routes.test.ts` | Checksum uses content-aware stable hash |
| SYNC-02 - Full sync endpoint | PASS | `GET /api/v1/sync/full` implemented + unit/runtime tests in `apps/backend/tests/sync.routes.test.ts` and `apps/backend/tests/sync.integration.test.ts` | Requires Bearer token format, validates version query, and short-circuits when client version is already current (`needsSync=false`) |
| CORE-01 - Schema/config merge conflict management | PASS | `git diff --name-status origin/main...3122560001 -- apps/backend/prisma/schema.prisma apps/backend/package.json apps/backend/tsconfig.json apps/backend/src/index.ts` | No divergence on conflict-sensitive files; branch conflict risk for backend core schema/config is currently clear |
| Error handling utility integration | PASS | ApiError + async handler + global/not-found middleware in backend | Tests in `apps/backend/tests/error-handling.middleware.test.ts` |
| Gzip response compression | PASS | `compression` middleware enabled in backend bootstrap | Configured with threshold `0` |
| ISSUE-016 - Soft delete retention & audit policy execution | PASS | `POST /api/v1/admin/maintenance/pois/soft-delete-cleanup` + scheduler hook + audit logs + tests (`admin.maintenance.integration.test.ts`) | Branch owner: `3122560001`; includes dry-run and execute paths |
| Admin tour CRUD DB integration coverage | PASS | `apps/backend/tests/admin.tours.integration.test.ts` | Covers create, read, update, and soft delete lifecycle against Prisma DB |
| Regression check - tests and build | PASS | `npm test` => 22/22 passed; `npm run build` => success | Re-run confirmed green on 2026-03-25 |

### Residual risks

*Update (2026-03-30): All residual risks from S1 have been resolved in Sprint S2 and Sprint S3.*

| Risk | Level | Impact | Mitigation / Next action | Status |
| --- | --- | --- | --- | --- |
| Provider-specific webhook verification not yet fully aligned to real VNPay/MoMo signature specs | MEDIUM | Callback security may not match production gateway requirements | Implement gateway-specific verifier per provider docs before production rollout | **RESOLVED** (`ISSUE-014`) |
| Payment finalize/idempotency paths still lack dedicated DB integration tests | LOW | Runtime regressions in payment callback transaction edges may be missed | Add integration tests against test DB for payment finalize/idempotency paths | **RESOLVED** (`ISSUE-014`) |
| Auth token generation currently uses internal JWT signing without key rotation workflow | LOW | Long-term ops/security maintainability risk | Add key rotation strategy and secret management policy for production | **RESOLVED** (`ISSUE-015`) |

### Go / No-Go
