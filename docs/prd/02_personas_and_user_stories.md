# 02. Personas and User Stories

[Back to Index](index.md)

---

## 1. Personas

### Persona A: Domestic Food Explorer

1. Uses mobile map while walking around food street.
2. Expects quick tap-to-listen flow and offline reliability.
3. Prefers Vietnamese narration and simple controls.

### Persona B: International Visitor

1. Needs language switching with consistent UI and audio.
2. Uses QR stickers at stalls as a direct trigger path.
3. Is sensitive to unstable mobile data roaming.

### Persona C: Content Operator (Admin)

1. Maintains POI and Tour content quality.
2. Publishes updates and validates generated audio assets.
3. Uses analytics to prioritize content improvements.

## 2. User Stories (Aligned with UC1-UC8)

| ID | Story | Priority | Use Case | Acceptance Ref |
|---|---|---|---|---|
| US-001 | As a visitor, I want to authorize by claim code or payment to unlock access. | P0 | UC1 | AC-UC1 |
| US-002 | As a visitor, I want initial sync to cache content so the app works offline. | P0 | UC1, UC8 | AC-UC1, AC-UC8 |
| US-003 | As a visitor, I want to browse POIs on map and open details by tap. | P0 | UC2 | AC-UC2 |
| US-004 | As a visitor, I want narration to start only after I explicitly tap Listen. | P0 | UC3 | AC-UC3 |
| US-005 | As a visitor, I want audio from POI-B to stop POI-A immediately. | P0 | UC3, UC4 | AC-UC3, AC-UC4 |
| US-006 | As a visitor, I want to scan QR at a stall to trigger narration directly. | P0 | UC4 | AC-UC4 |
| US-007 | As a visitor, I want to switch language and get localized text/audio fallback. | P0 | UC5 | AC-UC5 |
| US-008 | As a visitor, I want pause/resume/stop controls in mini player. | P1 | UC6 | AC-UC6 |
| US-009 | As a visitor, I want guided tour lists and ordered stops on map. | P1 | UC7 | AC-UC7 |
| US-010 | As a visitor, I want exploration to continue without network. | P0 | UC8 | AC-UC8 |

## 3. Priority Rules

1. P0 stories are release blockers.
2. P1 stories are required for usability completion.
3. No story is DONE unless mapped tests exist in [test_scenarios.md](../test_scenarios.md).
