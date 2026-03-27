# USE CASE ↔ TEST SCENARIO ↔ ARCHITECTURE MAPPING

> Purpose: Demonstrate traceability between use cases, test scenarios, and architecture implementation.
>
> Value: Alignment artifact for technical review, QA handoff, and project defense.

---

## Source Alignment

- SPEC_CANONICAL.md
- AI_GUIDELINES.md
- ARCHITECTURE.md
- docs/backend_design.md
- docs/database_design.md
- USE_CASES.md
- docs/test_scenarios.md
- IMPLEMENTATION_TASK_BREAKDOWN.md
- EXECUTION_TODO_ISSUES.md

Terminology note:
- AL_GUIDELINES.md in requests is treated as AI_GUIDELINES.md (canonical filename in repository).

---

## Canonical 1-1 Traceability Matrix (UC -> AC -> Test Gate)

Rule cứng: mỗi UC map đúng 1 AC chính và đúng 1 test gate chính. Các test còn lại là supporting tests.

| UC | AC (1-1) | Primary Test Gate (1-1) | Supporting Tests | Architecture Components | Implementation / Tracker Link |
|----|----------|--------------------------|------------------|-------------------------|-------------------------------|
| UC1 - Access & Authorization | AC-UC1 | TC-1.1 | TC-1.2 -> TC-1.5, TC-15.1, TC-15.2 | Auth API + payment callback flow, secure token storage, sync bootstrap (`/api/v1/sync/manifest`, `/api/v1/sync/full`) | ISSUE-002, ISSUE-003B |
| UC2 - Explore Map (POI Discovery) | AC-UC2 | TC-2.2 | TC-2.1, TC-2.3, TC-2.4 | Map Interaction Engine (`react-native-maps`), foreground location (`expo-location`), SQLite read model (`expo-sqlite`) | ISSUE-007 |
| UC3 - Play POI Narration (Tap-to-Play) | AC-UC3 | TC-3.2 | TC-3.1, TC-3.3, TC-3.4, TC-3.5 | Narration State Machine (`IDLE/PLAYING/PAUSED`), Audio Player (`expo-av`), analytics buffer | ISSUE-008, ISSUE-012 |
| UC4 - Scan QR Code for Narration | AC-UC4 | TC-4.1 | TC-4.2, TC-4.3, TC-4.4 | QR handler (`expo-camera`/`expo-barcode-scanner`) -> SQLite lookup -> same PLAY_EVENT pipeline | ISSUE-009, ISSUE-008 |
| UC5 - Switch Language & Settings | AC-UC5 | TC-5.1 | TC-5.2, TC-5.3, TC-5.4, TC-5.5, TC-11.x, TC-12.1 | Preference store (`zustand` + SecureStore), i18n fallback (`requested -> en -> vi`) | ISSUE-010 |
| UC6 - Control Audio Playback | AC-UC6 | TC-6.3 | TC-6.1, TC-6.2, TC-6.4 | Audio controls (Pause/Resume/Stop) bound to same state machine and `expo-av` playback state | ISSUE-010, ISSUE-012 |
| UC7 - View Food Tour & Exploration | AC-UC7 | TC-7.1 | TC-7.2, TC-7.3, TC-7.4 | Tour module, ordered POI filtering on map, SQLite tour data (`tours`) | ISSUE-011 |
| UC8 - Offline Content Access | AC-UC8 | TC-8.1 | TC-8.2, TC-8.3, TC-9.x, TC-10.x, TC-15.4 | Offline-first sync contract, atomic SQLite replace (`pois`, `tours`, `sync_metadata`), file cache (`expo-file-system`) | ISSUE-005, ISSUE-006, ISSUE-003B, ISSUE-013 |

### Traceability Integrity Checks

1. Không tạo AC-UCx phụ nếu chưa tạo UC mới (ví dụ UC3 phải chỉ có AC-UC3).
2. Mọi checklist release phải kiểm tra đủ 8 primary gate test cases (TC-1.1, 2.2, 3.2, 4.1, 5.1, 6.3, 7.1, 8.1).
3. Supporting tests không thay thế được primary gate.
4. Nếu đổi hành vi UC, phải cập nhật đồng thời: USE_CASES -> AC -> test gate row trong bảng này.

---

## Architectural Trace Examples

### UC3 - Play POI Narration (Tap-to-Play)

- Trigger: User taps Listen on POI bottom sheet (explicit interaction only).
- Decision: Map UI dispatches PLAY_EVENT to global narration store.
- Execution: State machine transitions IDLE -> PLAYING (or PLAYING -> IDLE -> PLAYING for override).
- Output: `expo-av` plays pre-generated MP3 from local cache.
- Guardrails: No auto-play, no geofence trigger, no on-device TTS generation.
- Logging: Analytics event buffered locally and uploaded in batch.

### UC4 - QR Scan Activation

- Trigger: User scans physical POI QR code.
- Execution path: Decode payload -> SQLite lookup -> dispatch PLAY_EVENT -> same state machine as UC3.
- Invariant: Single Voice Rule applies identically to tap path (current audio must stop before next play).

### UC8 - Offline Access

- Trigger points: app launch, manual refresh, network transition.
- Sync path: `/api/v1/sync/manifest` compare -> `/api/v1/sync/full` when newer.
- Data integrity: SQLite write is atomic (all-or-nothing transaction).
- Runtime behavior: exploration and playback continue from local SQLite + file cache without internet.

---

## Canonical Guardrails (Must Hold Across All Mappings)

- Narration is triggered only by explicit Tap or QR interaction.
- Single Voice Rule is strict: never play two POI audios simultaneously.
- GPS is foreground-only for blue dot / visual highlight; no background tracking.
- TTS generation is server-side only; mobile side only plays pre-generated MP3 via `expo-av`.
- A feature is not DONE unless mapped tests in docs/test_scenarios.md are implemented and passing.

---

## Defense Notes

- This document is required and should be kept: it links functional intent (UC), verification (TC), and implementation components in one place.
- It is the fastest artifact for audit/review to prove end-to-end traceability and canonical compliance.

---

End of USE CASE MAPPING
