# Implementation Task Breakdown

Execution plan derived from canonical documentation.

Source alignment:
- SPEC_CANONICAL.md
- AI_GUIDELINES.md
- ARCHITECTURE.md
- docs/backend_design.md
- docs/database_design.md
- USE_CASES.md
- docs/test_scenarios.md

Execution tracker:
- EXECUTION_TODO_ISSUES.md

Status: active
Version: 1.1
Last updated: 2026-03-25

Progress update (2026-03-26):
- DONE: ISSUE-001, ISSUE-002, ISSUE-003, ISSUE-003B

Terminology note:
- `AL_GUIDELINES.md` in requests is interpreted as `AI_GUIDELINES.md` in this repository.

## 1. Scope and Priority

P0 modules (must build first):
1. Auth and Access Gate
2. Backend TTS Audio Generation
3. Content Sync and Offline SQLite Mirror
4. Map UI and Marker Engine 
5. Audio Player State Machine (Tap to Play)
6. QR Direct Fallback

P1 modules (next):
1. Language and Playback Controls
2. Tour Mode (Food Routes)
3. Settings and Re-sync UX

## 2. Workstream Structure

Workstream A: Backend API and Data
Workstream B: Mobile Core Runtime & Map Engine
Workstream C: Mobile Feature UX
Workstream D: Quality and Release Readiness

Execution mapping:
- Workstream A -> ISSUE-001, ISSUE-002, ISSUE-003, ISSUE-003B
- Workstream B -> ISSUE-004, ISSUE-005, ISSUE-006, ISSUE-007, ISSUE-008
- Workstream C -> ISSUE-009, ISSUE-010, ISSUE-011
- Workstream D -> ISSUE-012, ISSUE-013

## 3. Detailed Task Breakdown

### Workstream A: Backend API and Data
A1. Boot Backend (Express, Node 20+, Postgres, Local Storage)  
Linked issue: ISSUE-001

A2. Auth/Payment Endpoints (claim + payment initiate + callback/finalize with validation and error contract)  
Linked issue: ISSUE-002  
Acceptance mapping: UC1, TC-1.1 ~ TC-1.5

A3. TTS Generation Integration (server-side queue only; Piper offline; MP3 to Local FS)  
Linked issue: ISSUE-003  
Acceptance mapping: ARCHITECTURE.md §3.3, AI_GUIDELINES.md §7

A4. Sync Endpoints (`GET /api/v1/sync/manifest`, `GET /api/v1/sync/full`, checksum/version + `needsSync`)  
Linked issue: ISSUE-003B  
Acceptance mapping: UC8, TC-8.x, TC-12.x

### Workstream B: Mobile Core Runtime
B1. App Shell and Navigation Stack  
Linked issue: ISSUE-004

B2. Local SQLite Layer for offline sync (`pois`, `tours`, `sync_metadata`) with atomic replace transaction  
Linked issue: ISSUE-005  
Acceptance mapping: docs/database_design.md §7, UC8

B3. Sync Service implementation (manifest compare + full sync + cache-first reads)  
Linked issue: ISSUE-006  
Acceptance mapping: SPEC_CANONICAL.md §8, UC8

B4. **Map UI & Markers**: Display POIs fetched from SQLite onto `react-native-maps`; foreground location blue dot only.  
Linked issue: ISSUE-007  
Guardrail: no geofence or auto-play triggers.

B5. **Audio Player State Machine**: Implement `IDLE -> PLAYING -> PAUSED` using `expo-av` + global store, enforce Single Voice Rule with immediate stop before new play.  
Linked issue: ISSUE-008  
Acceptance mapping: UC3.A1, UC4.A1, TC-3.2, TC-4.2

### Workstream C: Mobile Feature UX
C1. QR Scan Flow: Decode -> SQLite lookup -> PLAY_EVENT through the same State Machine.  
Linked issue: ISSUE-009  
Acceptance mapping: UC4, TC-4.1 ~ TC-4.4

C2. Language Picker & Settings: 15 languages, fallback chain `requested -> en -> vi`, preference persistence.  
Linked issue: ISSUE-010  
Acceptance mapping: UC5, TC-5.x

C3. Playback UI Controls: Play/Pause/Stop via mini player with state-sync to store.  
Linked issue: ISSUE-010  
Acceptance mapping: UC6, TC-6.x

C4. Tour UX: tour list/detail, active tour mode, map filtering by ordered stops from SQLite.  
Linked issue: ISSUE-011  
Acceptance mapping: UC7, TC-7.x

### Workstream D: Quality and Release Readiness
D1. Unit tests for state transitions, Single Voice interruption, pause/resume/stop, and store reducer edge cases.  
Linked issue: ISSUE-012  
Acceptance mapping: TC-3.2, TC-4.2, TC-6.x

D2. Integration/scenario tests across UC1~UC8 (auth, sync, offline, QR, i18n fallback, analytics buffering/upload).  
Linked issue: ISSUE-013  
Acceptance mapping: docs/test_scenarios.md

D3. Performance benchmarking and guardrail validation (tap response, audio start, sync duration, no auto-play regressions).  
Acceptance mapping: SPEC_CANONICAL.md §6, TC-13.x

## 4. Change Management Rule

If any task requires changing semantics:
1. Update SPEC_CANONICAL.md first.
2. Ensure no Geofence/Auto-play code leaks into the repository.
3. Ensure no background GPS tracking path is introduced.
4. Do not mark task DONE unless tests are added/mapped to docs/test_scenarios.md.
