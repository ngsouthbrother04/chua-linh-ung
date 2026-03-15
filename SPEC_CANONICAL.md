# SPEC_CANONICAL

Single source of truth for implementation and AI code generation.

Status: active
Version: 1.0
Last updated: 2026-03-15

## 1. Product Identity

Location-Based Auto-Narration System for Chua Linh Ung.

Core principle:
Correct narration at the correct physical location is more important than narration completeness.

## 2. Non-Negotiable Invariants

1. Geofence Engine is decision core for automatic location-based narration.
2. GPS tracking alone never triggers audio directly.
3. Stop-on-exit is mandatory.
4. Single voice rule: only one narration at a time.
5. Fast movement handling: EXIT_POI_A then ENTER_POI_B must interrupt A and prioritize B.
6. Offline-first after first successful sync.
7. Analytics logging must not be removed.

## 3. QR Fallback Semantics

1. QR is manual fallback trigger, not automatic location trigger.
2. QR bypasses GPS sensing only.
3. QR still uses Narration Engine state machine and single-voice/interrupt rules.
4. QR is only for fixed POIs.

## 4. Canonical Runtime and Stack

Mobile:
- React Native with Expo managed workflow
- TypeScript
- expo-location
- expo-task-manager
- expo-speech
- expo-sqlite
- zustand
- tanstack/react-query

Backend:
- Node.js 20+
- Express + TypeScript
- PostgreSQL + PostGIS
- Redis

## 5. Canonical State Machine

States:
- IDLE
- DETECTED
- PLAYING
- INTERRUPTED
- COOLDOWN

Transitions:
- IDLE -> ENTER_EVENT -> DETECTED
- DETECTED -> debounce_passed and no_cooldown -> PLAYING
- DETECTED -> EXIT_EVENT before debounce -> IDLE
- PLAYING -> EXIT_EVENT -> COOLDOWN
- PLAYING -> ENTER_NEW_POI -> INTERRUPTED -> PLAYING(new POI)
- COOLDOWN -> timer_expired -> IDLE

## 6. Canonical Timing Defaults

1. Debounce ENTER default: 3 consecutive GPS points inside polygon.
2. Geofence cooldown default: 10 seconds (from trigger metadata).
3. Replay window (anti-duplicate narration) default: 30 seconds.
4. Fast movement window: 3 seconds between EXIT_POI_A and ENTER_POI_B.

## 7. Canonical Data Naming

Backend primary POI table:
- points_of_interest

Mobile offline mirror table:
- pois

Important:
- Do not rename these without migration plan and cross-doc updates.

## 8. Sync Contract

1. App launch or manual refresh checks sync manifest.
2. If server version is newer, perform full sync.
3. SQLite write must be atomic replace.
4. Navigation session reads POI content from SQLite only.

## 9. Implementation Guardrails for AI Codegen

1. Never bypass Geofence Engine in automatic GPS flow.
2. Never continue narration outside POI boundary.
3. Never remove debounce/cooldown.
4. Never assume always-online network.
5. Never implement parallel narration for two POIs.
6. For QR trigger, dispatch a manual narration event through the same state machine.

## 10. Primary References

- AI invariants: AI_GUIDELINES.md
- System architecture: ARCHITECTURE.md
- Use cases: USE_CASES.md
- Mapping: USE_CASE_MAPPING.md
- Implementation breakdown: IMPLEMENTATION_TASK_BREAKDOWN.md
- User PRD index: docs/user/prd/index.md
- Backend design: docs/backend_design.md
- Test scenarios: docs/test_scenarios.md

## 11. Conflict Resolution Rule

If documentation conflicts:
1. SPEC_CANONICAL.md (this file)
2. AI_GUIDELINES.md
3. ARCHITECTURE.md
4. docs/user/prd/*
5. USE_CASES.md and USE_CASE_MAPPING.md
6. README.md

When updating behavior or defaults, update this file first, then propagate to dependent docs and code.
