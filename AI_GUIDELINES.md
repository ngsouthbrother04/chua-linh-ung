# AI Guidelines

> **Audience**: GitHub Copilot, AI Agents, Developers using AI assistance
>
> **Purpose**: Define system invariants, constraints, and non-negotiable rules that AI-generated code MUST follow.
>
> **Last Updated**: 2026-03-25  
> **Version**: 2.0

---

## 1. System Identity

This project is a **Location-Based Food Narration System** (Phố Ẩm Thực).

Core principle:
> **User-controlled food exploration is the priority.** Narration plays *only* when the user explicitly interacts with the app (Tap on Map POI or Scan QR).

**Key References**:
- Source of Truth: `README.md`
- Technical Blueprint: `ARCHITECTURE.md`
- Canonical Specification: `SPEC_CANONICAL.md`
- API Design: `docs/backend_design.md` (§2 – Core API Endpoints)
- Database Schema: `docs/database_design.md` (§2 – PostgreSQL Schema)
- Use Cases: `USE_CASES.md` (8 detailed use cases)
- Test Scenarios: `docs/test_scenarios.md` (16+ test suites)

---

## 2. No Background GPS or Auto-Play

- The system strictly avoids automatic audio triggers.
- Background location tracking is **REMOVED** (foreground-only via `expo-location`).
- Geofences are **REMOVED** (no auto-trigger zones).
- Do not implement ray-casting or complex geolocation math for triggers.

**Geographic Features ONLY**:
- User location displayed as blue dot on map
- Optional visual highlighting of nearby POIs (within ~500m) – **NOT** auto-play
- Backend PostGIS queries for radius search (manual trigger via app UI)

**Reference**: `SPEC_CANONICAL.md` §2 (Non-Negotiable Invariants)

---

## 3. Offline-First Constraint

All POI data & audio MUST be available without internet after initial sync.

**Mandatory Stack**:
- **SQLite** (via `expo-sqlite`): Local POI data mirror (tables: `pois`, `tours`, `sync_metadata`)
- **File System** (via `expo-file-system`): MP3 audio cache for offline playback
- **Server-side sync**: `GET /api/v1/sync/manifest` → detect version → `GET /api/v1/sync/full` (Atomic SQLite write)

**Rules**:
- Network availability MUST NOT be assumed during exploration
- Analytics events buffered locally, batch-uploaded when online
- Audio playback ONLY from cached MP3 files (never stream from server)

**Reference**: 
- `USE_CASES.md` UC8 – Offline Content Access
- `docs/database_design.md` §7 – SQLite Mobile Mirror Tables
- `docs/backend_design.md` §3 – Sync Contract

---

## 4. Single Voice Rule (STRICT)

**Rule**: The app MUST NEVER play two audio narrations simultaneously.

**Enforcement**:
- State Machine enforces: `PLAYING` → `PLAY_EVENT(NewPOI)` → `IDLE` (stop old) → `PLAYING` (new)
- Time: Old audio stops immediately (< 100ms)
- Applies to: Tap-to-Play (UC3), QR Code trigger (UC4)
- No exceptions for paused audio (stop first, then resume not allowed)

**Reference**:
- `ARCHITECTURE.md` §3.2 – Narration State Machine
- `USE_CASES.md` UC3.A1 & UC4.A1 – Single Voice Override
- `docs/test_scenarios.md` TC-3.2, TC-4.2 – Test cases validating rule

### 4.1 Overlapping POI Zones (AI Implementation Contract)

- Overlap is a **map discovery concern**, not an audio trigger concern.
- AI-generated code may rank nearby POIs for "recommended" display, but must keep it deterministic:
  1. shortest distance
  2. higher `tour_priority` (if present)
  3. smallest `poi_id`
- **Never** auto-play based on overlap ranking.
- If multiple nearby POIs are tied, UI can show all as highlighted candidates.

---

## 5. QR Code Usage Rules

- **QR codes** represent fixed, physical POIs (food stalls with physical stickers)
- QR trigger is a **direct interaction path** (same as Tap)
- MUST still pass through **Narration Engine State Machine** (enforces Single Voice Rule)
- QR payload format: POI ID (e.g., "poi_001")
- QR scan workflow: Decode → Lookup in SQLite → Dispatch PLAY_EVENT → State Machine transition

**Reference**: `USE_CASES.md` UC4 – Manual POI Activation (QR Code)

---

## 6. Explicit Non-Goals (DO NOT)

AI MUST NOT:
- ❌ Implement Geofencing or Auto-play audio triggers
- ❌ Run continuous GPS tracking in the background
- ❌ Assume continuous internet connectivity
- ❌ Generate TTS on-device (mobile side) – **Server-side only**
- ❌ Use microservices, event queues (Kafka, RabbitMQ) for TTS – **Monolith backend**
- ❌ Implement parallel audio playback (streaming, mixing)
- ❌ Store user PII (email, phone, location history)
- ❌ Treat dashboard "online now" as exact real-time truth without TTL window disclosure

**Reference**: `SPEC_CANONICAL.md` §9 – Implementation Guardrails

---

## 7. Multi-Language (i18n) Requirements

**Support**: 15 languages (VI, EN, KO, JA, FR, DE, ES, PT, RU, ZH, TH, ID, HI, AR, TR)

**Backend Implementation**:
- All POI text stored as JSONB: `{ "vi": "Phở Thìn", "en": "Pho Thin", ... }`
- API response returns single language per request (query param: `?language=vi`)
- Fallback chain: requested → English → Vietnamese

**TTS Generation** (Server-side only):
- Admin creates/edits POI text → Backend triggers background job
- For each language: Call Piper offline TTS engine
- Generate MP3 file, save to local filesystem
- Save URL to `audioUrls` JSONB field
- Mobile syncs, downloads, caches MP3 files

**Mobile Implementation**:
- User Language preference in settings → Zustand store + SecureStore
- On POI tap, load text & audio for selected language from SQLite
- Language change: Re-query SQLite, update UI (no API call needed if cached)

**Reference**:
- `docs/database_design.md` §5 – Multi-Language Data Handling
- `docs/backend_design.md` §4 – Xử lý Đa Ngôn Ngữ
- `USE_CASES.md` UC5 – Switch Language & Settings
- `docs/test_scenarios.md` TC-5.x, TC-11.x – Language test cases

---

## 8. Strict Unit Testing Mandate (CRITICAL)

**Rule**: A feature is **NOT COMPLETE** without comprehensive tests.

**Requirements**:
- ✅ **No Code Merge Without Tests**: Every feature, service, route, component MUST have unit tests
- ✅ **Passing Tests Only**: Tests must pass locally before marking task DONE
- ✅ **AAA Pattern**: Arrange-Act-Assert (setup, execute, verify)
- ✅ **Test Framework**:
  - **Mobile**: Jest (React Native)
  - **Backend**: Jest / Vitest (Node.js)
- ✅ **Coverage Target**: Minimum 70% code coverage per file

**Test Organization**:
- Unit tests colocated with source (e.g., `service.test.ts` next to `service.ts`)
- Integration tests in `tests/` folder grouped by feature
- Mock external dependencies (API, file system, database)

**Reference**: `SPEC_CANONICAL.md` §9 – Strict Testing Requirement

### 8.1 Additional Mandatory Tests for New Architecture Concerns

AI-generated test plans must include:
- Overlap-zone deterministic ranking tests (same input => same recommended POI)
- TTS queue idempotency tests (`{poiId}:{language}:{contentVersion}` not duplicated)
- Presence heartbeat tests (`online_now` based on last 90 seconds)

---

## 9. Code Generation Prompt Hint

When generating code, assume:

> "This system prioritizes **explicit user interaction** (Tap to Play), **offline-first** architecture, **strict Single Voice Rule**, **server-side TTS**, and **comprehensive test coverage**. No background geolocation, no auto-play, no network assumptions."

### Frontend Code Hint:
- Use `expo-av.Sound` for audio playback (never `expo-speech` for TTS)
- Manage state via `zustand` + state machine (IDLE, PLAYING, PAUSED)
- All data from SQLite or file cache (no API calls during exploration)
- Location via `expo-location` foreground only

### Backend Code Hint:
- REST API design with clear [language] query param
- Async TTS job queue (Bull / Node-schedule)
- Prisma ORM for PostgreSQL (avoid raw SQL)
- Error handling with structured `ApiError` class
- Comprehensive error & edge case tests

---

## 10. Technology Stack (MANDATORY)

### 10.1 Mobile Application
- **Framework**: React Native 0.81+ with **Expo SDK 54** (managed workflow)
- **TypeScript**: 5.0+
- **Key Libraries**:
  - `expo-location` (foreground GPS only)
  - `expo-av` (audio playback ONLY – pre-generated MP3)
  - `expo-sqlite` (offline POI data)
  - `expo-file-system` (MP3 cache)
  - `expo-camera` / `expo-barcode-scanner` (QR code)
  - `zustand` (state management + audio state machine)
  - `react-native-maps` (map UI + POI markers)

### 10.2 Backend API
- **Runtime**: Node.js 20+ + Express (TypeScript)
- **Architecture**: Monolith (no microservices)
- **Protocol**: REST API with versioning (`/api/v1/...`)
- **TTS Generation**: 
  - Backend background job (BullMQ / Node-schedule)
  - Calls Piper offline TTS engine (self-hosted, free, no account)
  - Saves MP3 files to local filesystem
  - Updates PostgreSQL `audioUrls` JSONB field
- **ORM**: Prisma (TypeScript-first, auto-generated types)

### 10.3 Database & Storage

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Primary DB** | PostgreSQL 14+ | Source of truth (POIs, users, analytics) |
| **PostGIS** | Extension | Geo-spatial queries (radius search) |
| **Cache** | Redis | Query caching, sync manifest cache |
| **Offline DB** | SQLite | Mobile mirror (pois, tours, metadata) |
| **File Storage** | Local filesystem (audio) + Cloudinary (images) | MP3 audio files, images |

### 10.4 Payment Processing
- **Gateways**: VNPay (primary), Momo (alternative)
- **Flow**: Mobile WebView → Backend receives callback → User authorized
- **Reference**: `docs/backend_design.md` §2.2.A (Auth endpoints)

---

## 11. Collaboration with Other Documents

**Always Cross-Reference**:
1. **Implementing a feature?** → Check `USE_CASES.md` for detailed flow
2. **Writing API endpoint?** → Follow `docs/backend_design.md` §2 spec
3. **Designing database query?** → Reference `docs/database_design.md` schema
4. **Writing tests?** → Follow patterns in `docs/test_scenarios.md`
5. **Uncertain about rule?** → Check `SPEC_CANONICAL.md` (it's the final arbiter)

**Conflict Resolution Order** (from SPEC_CANONICAL.md §11):
1. `README.md` (Absolute Source of Truth)
2. `SPEC_CANONICAL.md` (Canonical Rules)
3. `AI_GUIDELINES.md` (AI Invariants)
4. `ARCHITECTURE.md` (Technical Blueprint)
5. `docs/backend_design.md` (API + TTS pipeline)
6. `docs/database_design.md` (Schema + relationships)
7. `USE_CASES.md` (User flows)
8. `docs/test_scenarios.md` (Validation matrix)
9. `docs/prd/*` (Supplementary PRD)

---

## 12. Quick Reference Checklist

Before submitting code, verify:

- [ ] ✅ All audio triggered by explicit user action (Tap/QR), never by GPS
- [ ] ✅ Single Voice Rule enforced (previous audio stops immediately)
- [ ] ✅ Offline-first (SQLite + file cache, no network assumptions)
- [ ] ✅ i18n working (15 languages, fallback chain)
- [ ] ✅ TTS server-side only (backend job queue, MP3 files)
- [ ] ✅ Tests written & passing (AAA pattern, 70%+ coverage)
- [ ] ✅ Foreground-only GPS (no background location)
- [ ] ✅ No microservices / event queues (monolith backend)
- [ ] ✅ Error handling with ApiError class
- [ ] ✅ Overlap-zone logic is deterministic and visual-only (no auto-play)
- [ ] ✅ TTS jobs are idempotent, retriable, and observable in queue status
- [ ] ✅ Online dashboard clearly uses TTL definitions (`online_now`, `active_5m`)
- [ ] ✅ References checked (README → SPEC → docs)

---

**Version**: 2.0 | **Last Updated**: 2026-03-25  
**End of AI_GUIDELINES**
