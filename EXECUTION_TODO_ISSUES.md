# EXECUTION_TODO_ISSUES

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

Priority legend:
- P0: Critical path
- P1: Important, follows P0
- P2: Hardening and optimization

Owner convention:
- TBA: chưa gán người phụ trách

Update policy:
1. Mỗi issue phải có Owner, ETA, AC mapping trước khi chuyển IN_PROGRESS.
2. Mỗi lần đổi trạng thái phải cập nhật Progress note và Last update.
3. Nếu thay đổi invariant/default behavior, phải cập nhật SPEC_CANONICAL.md trước.

## Tracker Fields (chuẩn dùng xuyên suốt)

Mỗi issue phải có:
1. Status
2. Priority
3. Sprint
4. Owner
5. ETA
6. Story points
7. Dependencies
8. AC mapping
9. Target files
10. Verify steps
11. Definition of done
12. Progress notes
13. Last update

## Sprint S1 (P0 Foundation)

### ISSUE-001 - Backend bootstrap hardening
Status: TODO
Priority: P0
Sprint: S1
Owner: TBA
ETA: TBA
Story points: 2
Dependencies: none
AC mapping: N/A (foundation)
Scope:
- Update backend app bootstrap and config loading.
Target files:
- apps/backend/src/index.ts
- apps/backend/package.json
- apps/backend/tsconfig.json
Verify steps:
1. npm run dev:backend
2. GET / responds with DB readiness payload
Definition of done:
1. Backend starts with structured startup logs.
2. Health endpoint includes DB readiness check.
3. Start/build scripts are stable for local run.
Progress notes: none
Last update: 2026-03-15

### ISSUE-002 - Auth API skeleton and validation
Status: TODO
Priority: P0
Sprint: S1
Owner: TBA
ETA: TBA
Story points: 5
Dependencies: ISSUE-001
AC mapping:
- AC-001
- AC-002
Scope:
- Add payment-initiate and claim-code API contracts.
Target files:
- apps/backend/src/index.ts
- apps/backend/prisma/schema.prisma
Verify steps:
1. POST auth claim with invalid code -> 401
2. POST auth claim with valid code -> 200 + token contract
Definition of done:
1. Claim endpoint returns 401 for invalid code and 200 for valid code.
2. Token response contract matches user PRD/API docs.
3. Single-use claim logic is represented in data model.
Progress notes: none
Last update: 2026-03-15

### ISSUE-003 - Sync manifest and full content endpoints
Status: TODO
Priority: P0
Sprint: S1
Owner: TBA
ETA: TBA
Story points: 5
Dependencies: ISSUE-001
AC mapping:
- AC-003
Scope:
- Implement manifest check and full sync response.
Target files:
- apps/backend/src/index.ts
- apps/backend/prisma/schema.prisma
Verify steps:
1. GET /api/v1/sync/manifest returns contentVersion/checksum
2. GET /api/v1/sync/full returns pois/tours payload
Definition of done:
1. Manifest returns contentVersion and checksum.
2. Full sync returns POI and Tour payload including trigger metadata.
3. Response path is ready for gzip optimization.
Progress notes: none
Last update: 2026-03-15

### ISSUE-004 - Mobile app shell and routing baseline
Status: TODO
Priority: P0
Sprint: S1
Owner: TBA
ETA: TBA
Story points: 3
Dependencies: none
AC mapping:
- AC-001
- AC-002
- AC-003
Scope:
- Replace placeholder UI with auth + main app shell.
Target files:
- apps/mobile/App.tsx
- apps/mobile/index.ts
- apps/mobile/app.json
Verify steps:
1. npm run dev:mobile
2. App render được auth shell và main shell
Definition of done:
1. App can render unauthenticated and authenticated shell states.
2. Placeholder screen is removed.
3. Base app state model is ready for sync/auth integration.
Progress notes: none
Last update: 2026-03-15

### ISSUE-005 - SQLite data layer baseline
Status: TODO
Priority: P0
Sprint: S1
Owner: TBA
ETA: TBA
Story points: 5
Dependencies: ISSUE-004
AC mapping:
- AC-003
- AC-013
- AC-017
Scope:
- Add local persistence layer for pois, tours, analytics_events.
Target files:
- apps/mobile/App.tsx
- apps/mobile/package.json
Verify steps:
1. Khởi tạo schema local thành công
2. Đọc dữ liệu pois/tours từ local API helper
Definition of done:
1. Local schema initialization runs at app bootstrap.
2. CRUD access helpers are available for POI and Tour reads.
3. Atomic replace operation exists for sync writes.
Progress notes: none
Last update: 2026-03-15

### ISSUE-006 - Sync service and offline-first bootstrap
Status: TODO
Priority: P0
Sprint: S1
Owner: TBA
ETA: TBA
Story points: 5
Dependencies: ISSUE-003, ISSUE-005
AC mapping:
- AC-003
Scope:
- Add launch-time manifest compare and sync flow.
Target files:
- apps/mobile/App.tsx
- apps/mobile/package.json
Verify steps:
1. First run không data local -> bắt buộc sync
2. Có data local + offline -> app vẫn vào được flow chính
Definition of done:
1. First run without local data requires sync.
2. Existing local data allows offline app start.
3. Sync writes are transactional.
Progress notes: none
Last update: 2026-03-15

### ISSUE-007 - Geofence event engine
Status: TODO
Priority: P0
Sprint: S1
Owner: TBA
ETA: TBA
Story points: 8
Dependencies: ISSUE-005
AC mapping:
- AC-004
- AC-005
- AC-007
Scope:
- Add point-in-polygon and debounce/hysteresis behavior.
Target files:
- apps/mobile/App.tsx
Verify steps:
1. Simulate enter polygon -> ENTER emitted
2. Simulate exit polygon -> EXIT emitted
3. Debounce default 3 points hoạt động đúng
Definition of done:
1. Emits ENTER and EXIT events from location stream.
2. Debounce default is 3 points.
3. Engine does not call TTS directly.
Progress notes: none
Last update: 2026-03-15

### ISSUE-008 - Narration state machine and TTS service
Status: TODO
Priority: P0
Sprint: S1
Owner: TBA
ETA: TBA
Story points: 8
Dependencies: ISSUE-007
AC mapping:
- AC-004
- AC-005
- AC-006
- AC-011
- AC-012
Scope:
- Add IDLE/DETECTED/PLAYING/INTERRUPTED/COOLDOWN transitions.
Target files:
- apps/mobile/App.tsx
- apps/mobile/package.json
Verify steps:
1. PLAYING + EXIT -> COOLDOWN
2. Stop-on-exit xảy ra ngay
3. Không có overlap audio
Definition of done:
1. EXIT from PLAYING transitions to COOLDOWN.
2. Stop-on-exit is immediate.
3. Single-voice rule is enforced.
Progress notes: none
Last update: 2026-03-15

## Sprint S2 (P0 Completion + P1 Core UX)

### ISSUE-009 - Fast movement interrupt policy
Status: TODO
Priority: P0
Sprint: S2
Owner: TBA
ETA: TBA
Story points: 3
Dependencies: ISSUE-008
AC mapping:
- AC-006
Scope:
- Prioritize POI_B on fast transitions.
Target files:
- apps/mobile/App.tsx
Verify steps:
1. Simulate EXIT_A then ENTER_B within 3s
2. A stop trước, B start sau debounce
Definition of done:
1. EXIT_POI_A plus ENTER_POI_B in 3s window stops A and starts B path.
2. No overlapping narration.
Progress notes: none
Last update: 2026-03-15

### ISSUE-010 - QR manual fallback path
Status: TODO
Priority: P0
Sprint: S2
Owner: TBA
ETA: TBA
Story points: 5
Dependencies: ISSUE-008
AC mapping:
- AC-008
Scope:
- Implement QR trigger through same narration state machine.
Target files:
- apps/mobile/App.tsx
- apps/mobile/package.json
Verify steps:
1. Valid QR -> trigger narration
2. Invalid QR -> hiển thị lỗi rõ ràng
3. Đảm bảo qua cùng state machine
Definition of done:
1. QR bypasses GPS sensing only.
2. Manual trigger uses same single-voice and interrupt logic.
3. Invalid QR shows clear error message.
Progress notes: none
Last update: 2026-03-15

### ISSUE-011 - Analytics local buffer
Status: TODO
Priority: P0
Sprint: S2
Owner: TBA
ETA: TBA
Story points: 5
Dependencies: ISSUE-005, ISSUE-008
AC mapping: N/A (supporting quality/telemetry)
Scope:
- Persist interaction events offline.
Target files:
- apps/mobile/App.tsx
Verify steps:
1. ENTER/EXIT/QR/MANUAL events được lưu local
2. uploaded flag có mặt trong dữ liệu
Definition of done:
1. ENTER/EXIT/LISTEN_COMPLETE/LISTEN_ABORT/QR_SCAN/MANUAL_TRIGGER events are saved.
2. Uploaded flag model exists for later batch upload.
Progress notes: none
Last update: 2026-03-15

### ISSUE-012 - Language and playback controls
Status: TODO
Priority: P1
Sprint: S2
Owner: TBA
ETA: TBA
Story points: 5
Dependencies: ISSUE-008
AC mapping:
- AC-009
- AC-010
- AC-011
- AC-012
Scope:
- Add language selection and player controls.
Target files:
- apps/mobile/App.tsx
- apps/mobile/package.json
Verify steps:
1. Đổi locale -> narration tiếp theo dùng locale mới
2. Pause/resume hoặc fallback replay đúng platform
3. EXIT override pause
Definition of done:
1. Selected locale applies to next narration.
2. Pause/resume or fallback replay behavior is explicit per platform.
3. Exit event overrides paused state.
Progress notes: none
Last update: 2026-03-15

### ISSUE-013 - Tour list/detail and active mode
Status: TODO
Priority: P1
Sprint: S2
Owner: TBA
ETA: TBA
Story points: 8
Dependencies: ISSUE-005, ISSUE-007, ISSUE-008
AC mapping:
- AC-013
- AC-014
- AC-015
- AC-016
- AC-017
- AC-018
Scope:
- Build tour browsing and active tour filtering.
Target files:
- apps/mobile/App.tsx
Verify steps:
1. Tour list/detail đọc từ SQLite
2. Active tour chỉ trigger POI thuộc tour
3. Hiển thị progress/completion
Definition of done:
1. Tour list and detail read from SQLite.
2. Active tour limits geofence triggers to selected tour POIs.
3. Completion state is visible.
Progress notes: none
Last update: 2026-03-15

### ISSUE-014 - Analytics batch API integration
Status: TODO
Priority: P1
Sprint: S2
Owner: TBA
ETA: TBA
Story points: 5
Dependencies: ISSUE-011, ISSUE-003
AC mapping: N/A (supporting quality/telemetry)
Scope:
- Connect local buffer to backend batch upload endpoint.
Target files:
- apps/backend/src/index.ts
- apps/mobile/App.tsx
Verify steps:
1. Mobile gửi batch khi có mạng
2. API trả accepted/failed
3. Events được mark uploaded local
Definition of done:
1. Mobile sends batches when network is available.
2. Server returns accepted and failed counts.
3. Uploaded events are marked locally.
Progress notes: none
Last update: 2026-03-15

## Sprint S3 (Quality + Hardening)

### ISSUE-015 - Unit tests for geofence and state machine
Status: TODO
Priority: P1
Sprint: S3
Owner: TBA
ETA: TBA
Story points: 5
Dependencies: ISSUE-007, ISSUE-008, ISSUE-009
AC mapping:
- AC-004
- AC-005
- AC-006
- AC-007
Scope:
- Add deterministic tests for spatial and state transitions.
Target files:
- apps/mobile/tsconfig.json
- apps/backend/tsconfig.json
Verify steps:
1. Unit tests chạy pass
2. Có coverage cho debounce/cooldown/fast movement
Definition of done:
1. Debounce/cooldown/transition tests pass.
2. Fast movement behavior is covered by tests.
Progress notes: none
Last update: 2026-03-15

### ISSUE-016 - Integration and scenario tests
Status: TODO
Priority: P1
Sprint: S3
Owner: TBA
ETA: TBA
Story points: 5
Dependencies: ISSUE-010, ISSUE-012, ISSUE-013, ISSUE-014
AC mapping:
- AC-001..AC-018 (theo phạm vi scenario)
Scope:
- Validate core end-to-end scenarios from docs.
Target files:
- docs/test_scenarios.md
- apps/mobile/App.tsx
- apps/backend/src/index.ts
Verify steps:
1. Chạy đầy đủ scenario Explore/Tour/Critical/Offline
2. Xuất pass-fail report
Definition of done:
1. Explore mode, tour mode, geofence critical, and offline scenarios are reproducible.
2. Pass/fail report is documented.
Progress notes: none
Last update: 2026-03-15

### ISSUE-017 - Performance and release checklist
Status: TODO
Priority: P2
Sprint: S3
Owner: TBA
ETA: TBA
Story points: 3
Dependencies: ISSUE-015, ISSUE-016
AC mapping: N/A (release gate)
Scope:
- Benchmark against NFR targets and finalize release gate.
Target files:
- IMPLEMENTATION_TASK_BREAKDOWN.md
- SPEC_CANONICAL.md
- README.md
Verify steps:
1. Ghi baseline metrics
2. Đối chiếu NFR target
3. Hoàn tất checklist release
Definition of done:
1. Baseline metrics are recorded.
2. Known gaps are documented with owner and mitigation.
3. Release checklist is ready.
Progress notes: none
Last update: 2026-03-15

## Current blockers snapshot

1. Mobile dependencies required by canonical spec are not installed yet.
2. Backend route structure is still single-file and needs modularization.
3. Test harness is not configured yet for mobile and backend.

## Rules for execution

1. Any behavior/default change must update SPEC_CANONICAL.md first.
2. Keep geofence automatic flow and QR manual fallback semantics intact.
3. Do not merge changes that violate stop-on-exit and single-voice invariants.

## Change log

- 2026-03-15: Upgraded tracker format for project-wide use (owner/eta/ac/verify/status lifecycle).
