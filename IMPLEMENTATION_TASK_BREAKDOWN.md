# IMPLEMENTATION_TASK_BREAKDOWN

Execution plan derived from SPEC_CANONICAL.md.

Execution tracker:
- EXECUTION_TODO_ISSUES.md

Status: active
Version: 1.0
Last updated: 2026-03-15

## 1. Scope and Priority

P0 modules (must build first):
1. Auth and Access Gate
2. Content Sync and Offline SQLite Mirror
3. Geofence Engine
4. Narration State Machine and TTS Service
5. QR Manual Fallback
6. Core Analytics Buffer

P1 modules (next):
1. Language and Playback Controls
2. Tour Mode
3. Settings and Re-sync UX
4. Analytics Batch Upload hardening

P2 modules (later):
1. Performance optimization
2. Advanced observability and operational hardening

## 2. Workstream Structure

Workstream A: Backend API and Data
Workstream B: Mobile Core Runtime
Workstream C: Mobile Feature UX
Workstream D: Quality and Release Readiness

## 3. Milestone Plan

M1 Foundation (P0 baseline)
- Complete A1-A4, B1-B5
- Output: app can authenticate, sync once, run offline, trigger narration by geofence, stop on exit

M2 Core Product Behavior (P0 complete)
- Complete B6-B8, C1-C2, D1
- Output: QR fallback, single voice policy, fast movement interrupt, analytics local buffer

M3 Feature Completeness (P1)
- Complete C3-C6, D2-D3
- Output: language switching, playback controls, tour mode, analytics upload

M4 Hardening and Launch Gate
- Complete D4-D6
- Output: test pass, benchmark pass, release checklist ready

## 4. Detailed Task Breakdown

### Workstream A: Backend API and Data

A1. Project Baseline and Environment
- Goal: run backend with Node.js 20+, Express, Prisma, Postgres, Redis.
- Tasks:
  1. Validate backend runtime and scripts.
  2. Add missing environment schema and sample env file.
  3. Confirm docker services (PostGIS and Redis) connectivity.
- Depends on: none
- Done when:
  1. Backend boots and health endpoint returns database and cache status.
  2. Local dev startup is one command sequence from README.

A2. Auth Endpoints
- Goal: implement payment-initiate and claim code auth contracts.
- Tasks:
  1. Create auth routes and request validation.
  2. Implement claim code verification flow and single-use mark.
  3. Issue JWT with expiry and response contract.
- Depends on: A1
- Done when:
  1. Invalid claim returns 401 with stable error body.
  2. Valid claim returns token payload expected by mobile.

A3. Sync Endpoints
- Goal: provide manifest and full content payload for one-load pattern.
- Tasks:
  1. Build manifest endpoint with contentVersion and checksum.
  2. Build full sync endpoint returning pois and tours payload.
  3. Add gzip compression and response size guard.
- Depends on: A1
- Done when:
  1. Mobile can compare local/server versions.
  2. Payload includes trigger metadata for debounce/cooldown defaults.

A4. Analytics Batch Endpoint
- Goal: accept buffered events from mobile.
- Tasks:
  1. Add analytics batch route and schema validation.
  2. Persist events with anonymized device/session model.
  3. Return accepted and failed counts.
- Depends on: A1
- Done when:
  1. Endpoint is idempotent enough for mobile retry.
  2. No PII fields required from client.

### Workstream B: Mobile Core Runtime

B1. App Shell and Navigation Baseline
- Goal: establish auth stack and main tabs.
- Tasks:
  1. Create Auth stack screens (welcome, claim, sync).
  2. Create main tabs (map, tour, settings).
  3. Add secure bootstrap to route by token validity.
- Depends on: none
- Done when:
  1. App routes to auth or main flow correctly.
  2. No hardcoded bypass to main app without auth.

B2. Local Data Layer (SQLite)
- Goal: canonical offline schema and repository layer.
- Tasks:
  1. Define SQLite tables pois, tours, analytics_events.
  2. Create transactional repository helpers.
  3. Add read APIs for map/tour/narration modules.
- Depends on: B1
- Done when:
  1. One transaction can replace POI and tour data atomically.
  2. Query layer is used by all runtime modules.

B3. Sync Service (One-Load Pattern)
- Goal: manifest check and full sync with atomic replace.
- Tasks:
  1. Implement manifest compare on launch and manual refresh.
  2. Implement full sync write transaction and version update.
  3. Handle offline-first fallback behavior.
- Depends on: A3, B2
- Done when:
  1. First sync required if no local data.
  2. After sync, navigation session reads SQLite only.

B4. Geofence Engine
- Goal: emit stable ENTER and EXIT events from GPS points.
- Tasks:
  1. Build point-in-polygon ray-casting utility.
  2. Implement debounce with 3 consecutive in-polygon points default.
  3. Implement hysteresis and cooldown checks.
- Depends on: B2
- Done when:
  1. Emits GeofenceEvent with type, poiId, timestamp.
  2. No narration is triggered directly by raw GPS callback.

B5. Narration State Machine and TTS Service
- Goal: central decision logic and single-voice playback.
- Tasks:
  1. Implement IDLE, DETECTED, PLAYING, INTERRUPTED, COOLDOWN states.
  2. Implement transition PLAYING -> EXIT_EVENT -> COOLDOWN.
  3. Wrap expo-speech in service with interrupt and stop-on-exit rules.
- Depends on: B4
- Done when:
  1. Stop-on-exit always occurs immediately.
  2. Entering a new POI interrupts previous playback.

B6. Fast-Movement Handling
- Goal: prioritize POI_B when EXIT_A and ENTER_B are close.
- Tasks:
  1. Detect fast movement window (3 seconds default).
  2. Enforce immediate A stop and B priority path.
  3. Ensure no overlap between narrations.
- Depends on: B5
- Done when:
  1. Scenario EXIT_A then ENTER_B behaves deterministically.

B7. QR Manual Fallback
- Goal: manual trigger path without violating geofence invariants.
- Tasks:
  1. Integrate camera scanning and QR parsing.
  2. Resolve poiId from SQLite.
  3. Dispatch MANUAL_TRIGGER into same narration state machine.
- Depends on: B2, B5
- Done when:
  1. QR bypasses GPS sensing only.
  2. Single voice and interrupt rules still apply.

B8. Analytics Local Buffer
- Goal: local event capture regardless of network.
- Tasks:
  1. Capture ENTER, EXIT, LISTEN_COMPLETE, LISTEN_ABORT, QR_SCAN, MANUAL_TRIGGER.
  2. Store to analytics_events with uploaded flag.
  3. Add periodic flush trigger hooks.
- Depends on: B2
- Done when:
  1. Core interaction events are persisted offline.

### Workstream C: Mobile Feature UX

C1. Map Screen and POI Detail
- Goal: map markers, current location, POI detail entry points.
- Tasks:
  1. Render markers from SQLite pois.
  2. Add bottom sheet with summary and manual play action.
  3. Add my-location and QR quick actions.
- Depends on: B2, B7
- Done when:
  1. POI data visible offline.

C2. Auth and Sync UX
- Goal: user-complete auth and initial sync journey.
- Tasks:
  1. Build claim code screen with clear errors.
  2. Build sync progress with retry/fallback states.
  3. Handle no-network first-sync blocking state.
- Depends on: A2, B3
- Done when:
  1. User can complete first-time flow without hidden steps.

C3. Language Selection and Locale Fallback
- Goal: selected locale controls text and narration.
- Tasks:
  1. Build language picker and preference store integration.
  2. Wire narration locale to TTS service.
  3. Implement fallback when locale voice unavailable.
- Depends on: B5
- Done when:
  1. Next narration respects selected locale.

C4. Playback Controls
- Goal: visible player controls for active narration.
- Tasks:
  1. Add player bar with play and pause behavior.
  2. Ensure exit event overrides paused state.
  3. Add skip behavior into cooldown path.
- Depends on: B5
- Done when:
  1. UI controls reflect state machine truth.

C5. Tour List and Tour Detail
- Goal: tour browsing and route display from SQLite.
- Tasks:
  1. Build tour list cards from local data.
  2. Build detail map polyline and ordered POI list.
  3. Add start and stop tour actions.
- Depends on: B2
- Done when:
  1. Tour screens function fully offline.

C6. Tour Active Mode
- Goal: constrain geofence triggers to selected tour context.
- Tasks:
  1. Scope geofence events to selected tour POIs.
  2. Mark visited POIs in active session.
  3. Show completion state when tour ends.
- Depends on: B4, B5, C5
- Done when:
  1. Non-tour POIs do not interrupt active tour narration.

### Workstream D: Quality and Release Readiness

D1. Unit Tests for Core Logic
- Goal: robust behavior for spatial and state transitions.
- Tasks:
  1. Test ray-casting edge cases.
  2. Test debounce and cooldown defaults.
  3. Test full narration transition matrix.
- Depends on: B4, B5
- Done when:
  1. Critical transition tests are green.

D2. Integration Tests
- Goal: verify end-to-end behavior between modules.
- Tasks:
  1. Auth to sync to map bootstrap flow test.
  2. Geofence to narration stop-on-exit flow test.
  3. QR manual trigger flow test.
- Depends on: A2, A3, B3, B5, B7
- Done when:
  1. P0 acceptance scenarios are reproducible.

D3. E2E and Scenario Tests
- Goal: validate test_scenarios coverage.
- Tasks:
  1. Explore mode scenario execution.
  2. Tour mode scenario execution.
  3. Critical geofence scenarios execution.
  4. Offline mode scenario execution.
- Depends on: C1-C6
- Done when:
  1. Scenario pass report is documented.

D4. Performance Verification
- Goal: meet NFR thresholds.
- Tasks:
  1. Measure geofence event handling latency.
  2. Measure cold start and sync duration.
  3. Measure SQLite query timings and battery profile.
- Depends on: M3 complete
- Done when:
  1. Metrics satisfy target thresholds or have documented waivers.

D5. Release Checklist
- Goal: launch confidence and rollback readiness.
- Tasks:
  1. Final docs and environment checklist.
  2. Data migration and seed verification.
  3. Rollback steps documented.
- Depends on: D1-D4
- Done when:
  1. Launch checklist is signed off.

D6. Post-Launch Observability Baseline
- Goal: minimal production visibility for incidents.
- Tasks:
  1. Error boundaries and crash reporting hooks.
  2. API error and sync failure counters.
  3. Monitoring dashboard starter metrics.
- Depends on: M4
- Done when:
  1. Operational owner can detect and triage major failures.

## 5. Dependency Graph Summary

Critical path:
A1 -> A2 and A3 -> B3 -> B4 -> B5 -> B6 -> C4 -> D2 -> D3 -> D5

Parallel path examples:
1. A2 and A3 can proceed in parallel after A1.
2. C1 can proceed with B2 while B4/B5 are in progress.
3. D1 can start once B4/B5 stabilize.

## 6. Definition of Ready (DoR)

A task is ready when:
1. Input contract is documented.
2. Acceptance criteria is explicit and testable.
3. Dependency tasks are complete or mocked.
4. Owner and target milestone are assigned.

## 7. Definition of Done (DoD)

A task is done when:
1. Code is merged with tests for changed behavior.
2. No invariant in SPEC_CANONICAL is violated.
3. Relevant docs are updated if contracts changed.
4. Manual verification notes are recorded for user-facing flows.

## 8. Recommended Execution Order for Next Sprint

Sprint candidate S1:
1. A1 Environment baseline
2. A2 Auth endpoints
3. A3 Sync endpoints
4. B1 App shell
5. B2 SQLite layer
6. B3 Sync service
7. B4 Geofence engine
8. B5 Narration state machine
9. D1 Core unit tests

Sprint candidate S2:
1. B6 Fast-movement handling
2. B7 QR manual fallback
3. C1 Map and POI detail
4. C2 Auth and sync UX
5. C3 Language and fallback
6. C4 Playback controls
7. D2 Integration tests
8. D3 Scenario tests

## 9. Change Management Rule

If any task requires changing timing defaults, state transitions, or invariant semantics:
1. Update SPEC_CANONICAL.md first.
2. Propagate to dependent docs.
3. Update tests in same change set.
