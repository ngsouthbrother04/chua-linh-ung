# Spec Canonical

> **Audience**: AI Agents, Developers, System Architects  
> **Purpose**: Official source of truth for system invariants, technology stack, and non-negotiable rules for implementation.  
> **This document is AUTHORITATIVE.** When conflicts arise, consult the hierarchy in §11.  
>
> **Status**: active  
> **Version**: 2.0  
> **Last Updated**: 2026-03-25

**Related Documentation** (read in this order):
1. **README.md** – Project overview & quick start
2. **SPEC_CANONICAL.md** (this file) – Canonical invariants
3. **AI_GUIDELINES.md** – AI guardrails & technology stack
4. **ARCHITECTURE.md** – Technical blueprint & implementation patterns
5. **docs/backend_design.md** – API endpoints & TTS pipeline
6. **docs/database_design.md** – PostgreSQL schema & SQLite mirror
7. **USE_CASES.md** – 8 detailed user stories & flows
8. **docs/test_scenarios.md** – 100+ test cases & validation matrix

## 1. Product Identity

Location-Based Food Narration System (Phố Ẩm Thực).

Core principle:
User-controlled food exploration is the priority. Narration plays ONLY when the user explicitly interacts (Tap/QR).

## 2. Core System Invariants (Non-Negotiable)

### 2.1 User-Triggered Audio (No Auto-Play)
**Rule**: Narration ONLY activates via explicit user interaction.  
**Triggers Allowed**: 
- Tap on map POI marker (UC3)
- Scan QR code (UC4)

**Triggers Forbidden**: 
- ❌ Geofencing auto-trigger
- ❌ Background GPS proximity detection  
- ❌ App startup auto-play
- ❌ Cross-app push notification triggers

**Reference**: AI_GUIDELINES.md §2, ARCHITECTURE.md §3.1

### 2.2 Single Voice Rule (Strict Enforcement)
**Property**: The app MUST NEVER play two audio narrations simultaneously.  
**Behavior**: If user taps POI-B while POI-A is playing → Stop POI-A (< 100ms) → Start POI-B.  
**Exception Handling**: No exceptions allowed (even for paused audio).  
**State Machine**: IDLE ↔ PLAYING ↔ PAUSED (per ARCHITECTURE.md §3.2)

**Reference**: USE_CASES.md UC3.A1 (Single Voice Override), test_scenarios.md TC-3.2

### 2.3 Location Privacy (Foreground-Only, No Tracking)
**GPS Constraint**: Foreground location only (`expo-location`)  
**Allowed Uses**:
- Display user location as blue dot on map
- Optional visual highlighting of nearby POIs (informational only)
- Backend PostGIS radius search (user manually triggers via UI)

**Forbidden**:
- ❌ Background location tracking
- ❌ Battery-draining continuous updates
- ❌ Geofence monitoring
- ❌ Location history storage

**Reference**: AI_GUIDELINES.md §2, SPEC_CANONICAL.md §6 (Non-Goals)

### 2.4 Offline-First Architecture
**Requirement**: All POI data & audio accessible without internet after initial sync.  
**Tech Stack**:
- SQLite (via `expo-sqlite`): Local mirror tables — `pois`, `tours`, `sync_metadata`
- File System (via `expo-file-system`): MP3 audio cache  
- Server Sync: Atomic manifest versioning + SQLite replace

**Reference**: database_design.md §7 (SQLite Mobile Mirror), USE_CASES.md UC8 (Offline Access)

### 2.5 Server-Side TTS Generation (Never On-Device)
**Process**:
1. Admin creates/edits POI via CMS
2. Backend triggers background job queue
3. Piper generates MP3 offline on backend (15 languages)
4. Audio URLs saved to PostgreSQL `audio_urls` JSONB
5. Mobile sync caches MP3 files locally
6. App plays from cache only

**Banned**: On-device TTS (expo-speech forbidden for generation)  
**Reference**: backend_design.md §3 (TTS Pipeline), ARCHITECTURE.md §3.3

### 2.6 Analytics Logging (Mandatory)
**Rule**: Analytics tracking must NOT be removed or disabled.  
**Events Logged**:
- User auth & access (UC1)
- POI interactions (tap, play, pause, stop)
- Language changes
- Offline/online transitions

**Storage**: Buffered locally, batch-uploaded when online.  
**Reference**: test_scenarios.md TC-16 (Integration Tests — Analytics)

### 2.7 Overlapping Nearby-POI Zones (Deterministic, Visual-Only)
**Rule**: Overlapping radius zones are allowed for discovery UI, but MUST NOT auto-trigger playback.

**Behavior Contract**:
- Nearby highlighting can display multiple POIs at once.
- Playback still requires explicit user action (Tap marker or Scan QR).
- If system needs a single "recommended" POI in overlap areas, use deterministic ranking:
  1) shortest distance
  2) higher `tour_priority` (if configured)
  3) lexicographically smaller `poi_id` as final tie-break

**Forbidden**:
- ❌ Auto-play based on overlap result
- ❌ Hidden/random tie-breaking that changes between requests

**Reference**: ARCHITECTURE.md §3.1 (Map Engine), docs/test_scenarios.md (Overlap tests)

### 2.8 TTS Queue at Scale (Single Backend, Controlled Concurrency)
**Rule**: Keep monolith architecture, but queue processing must be explicit and scalable.

**Queue Contract**:
- Use one logical queue for TTS jobs (BullMQ/Redis).
- Job idempotency key: `{poiId}:{language}:{contentVersion}`.
- Concurrency is configurable (start with 5 workers).
- Retries use exponential backoff (e.g., 3 attempts, 2s/8s/30s).
- Failed jobs move to DLQ/failed set for admin retry.

**Forbidden**:
- ❌ Fire-and-forget TTS without persisted job state
- ❌ Switching to Kafka/RabbitMQ for MVP

**Reference**: docs/backend_design.md §3 (TTS Pipeline), ARCHITECTURE.md §3.3

### 2.9 Online Users Metric (Canonical Definition)
**Rule**: "Online now" is an operational metric, not a billing/security identity metric.

**Definition**:
- `online_now`: unique devices/users with heartbeat in the last 90 seconds.
- `active_5m`: unique devices/users with heartbeat or interaction event in the last 5 minutes.
- Heartbeat interval target: every 30 seconds while app is foreground.

**Notes**:
- Presence data TTL-based (ephemeral), not long-term tracking.
- Dashboard must label definitions clearly to avoid misunderstanding.

**Reference**: docs/backend_design.md (Analytics endpoints), docs/test_scenarios.md (Presence tests)

## 3. QR Code Mechanics

### 3.1 QR Semantics
- **Represents**: Fixed physical POI (food stall with physical QR sticker)
- **Trigger Type**: Direct user interaction (explicit scan)
- **Payload Format**: POI ID (e.g., `poi_001`)
- **Flow**: Decode → Lookup in SQLite → Dispatch PLAY_EVENT → State Machine transition

### 3.2 State Machine Integration
- QR scan triggers PLAY_EVENT (same as tap)
- Enforces Single Voice Rule (previous audio stops immediately)
- No exceptions for geofence or background triggers

**Reference**: USE_CASES.md UC4 (Scan QR Code), test_scenarios.md TC-4.x

## 4. Canonical Technology Stack (STRICT)

### 4.1 Mobile Client Stack
| Component | Technology | Purpose | Constraint |
|-----------|-----------|---------|----------|-
| Framework | React Native 0.81+ (Expo SDK 54) | UI & interactions | Managed workflow only |
| Language | TypeScript 5.0+ | Type safety | No JavaScript escape |
| Location | `expo-location` | Foreground GPS only | No background tracking |
| Audio | `expo-av` | Playback pre-generated MP3 | NO on-device TTS |
| Offline | `expo-sqlite` | Local POI mirror | Atomic sync only |
| Files | `expo-file-system` | MP3 cache | ~100-500MB per device |
| State | `zustand` | Audio & app state | Use for Single Voice Rule |
| Maps | `react-native-maps` | POI display & interaction | No custom geofencing |

**Reference**: AI_GUIDELINES.md §2.1, ARCHITECTURE.md §2.1

### 4.2 Backend API Stack
| Component | Technology | Purpose | Details |
|-----------|-----------|---------|--------|-
| Runtime | Node.js 20+ | Server process | TypeScript recommended |
| Framework | Express.js | HTTP routing | REST API only |
| Primary DB | PostgreSQL 14+ | Source of truth | With PostGIS extension |
| Cache | Redis | Query caching | Sync manifest versioning |
| TTS Engine | Piper (offline, free, no account) | Audio generation | Background job queue |
| Storage | Audio local filesystem + Image Cloudinary | Audio & media files | `/audio/...` for MP3, Cloudinary URL for images |
| ORM | Prisma | Database access | Auto-generated TypeScript |
| Jobs | BullMQ / Node-Schedule | Background TTS processing | No Kafka/RabbitMQ |

**Reference**: AI_GUIDELINES.md §2.2, backend_design.md §1 (Architecture)

### 4.3 Non-Negotiable Technology Constraints
| Constraint | Reason |
|-----------|--------|-
| ❌ Microservices | Keep monolith simple, owner accountability |
| ❌ Kafka / RabbitMQ | Over-engineered for MVP, use job queue instead |
| ❌ GraphQL | Stick to REST for clarity |
| ❌ On-Device TTS | Server-side maintains consistency across devices |
| ❌ Background GPS | Battery drain, privacy concerns |
| ❌ Real-Time Sync (WebSocket) | Polling + manifest versioning sufficient |

**Reference**: SPEC_CANONICAL.md §6 (Non-Goals), AI_GUIDELINES.md §6

## 5. Narration State Machine (Canonical)

### 5.1 State Definitions
- **IDLE**: No active audio, ready to play
- **PLAYING**: Audio file actively playing
- **PAUSED**: User temporarily paused audio (can resume)

### 5.2 Valid Transitions
```
IDLE → PLAY_EVENT(POI-A) → PLAYING
PLAYING → PAUSE_EVENT → PAUSED
PAUSED → RESUME_EVENT → PLAYING
PLAYING/PAUSED → STOP_EVENT → IDLE

[CRITICAL] Single Voice Override:
PLAYING → PLAY_EVENT(POI-B) → [STOP POI-A immediately < 100ms] → IDLE → PLAYING(POI-B)
```

### 5.3 Implementation Contract
- **Framework**: Zustand global store (mobile)
- **Event Dispatcher**: React components on POI tap or QR scan
- **Timing**: State transition < 50ms, audio stop < 100ms
- **Concurrency**: No parallel PLAY events (reject if PLAYING)

**Reference**: ARCHITECTURE.md §3.2 (The Narration State Machine), test_scenarios.md TC-3.2

## 6. Performance Targets (SLA)

| Metric | Target | Method |
|--------|--------|--------|-
| Tap Response | < 500ms (sheet open) | User perception test |
| Audio Start | < 1-2s from "Nghe" tap | P95 latency measurement |
| API Response | < 200ms P95 | Backend load test |
| Full Sync | < 5s (first run) | Network simulation |
| Offline Startup | < 2s (no network) | Device cold start test |
| Memory Usage | < 150MB peak | iOS/Android profiler |
| Battery Impact | < 10% per hour | Battery drain test |
| Uptime | 99.9% | Monitoring SLA |

**Reference**: backend_design.md §6 (Caching) & §7 (Deployment), test_scenarios.md TC-13 (Performance Tests)

## 7. Canonical Data Model & Naming

### 7.1 Primary Tables (PostgreSQL)
| Table | Rows | Purpose | Reference |
|-------|------|---------|----------|-
| `points_of_interest` | 10-50 | Food POIs (backend source) | database_design.md §2.2 |
| `tours` | 3-10 | Ordered POI sequences | database_design.md §2.3 |
| `users` | 100-1000 | User accounts & auth | database_design.md §2.4 |
| `claim_codes` | 100-500 | Access vouchers | database_design.md §2.5 |
| `analytics_events` | 10K+/day | Usage telemetry | database_design.md §2.6 |
| `payment_transactions` | 10+/day | Payment records | database_design.md §2.7 |
| `payment_callback_events` | 10+/day | Webhook logs | database_design.md §2.8 |
| `app_settings` | <10 | System config | database_design.md §2.9 |

### 7.2 Mobile Mirror Table (SQLite)
| Table | Schema | Purpose |
|-------|--------|--------|-
| `pois` | Simplified version of `points_of_interest` | Offline POI data |
| `tours` | Subset of `tours` | Offline tour data |
| `sync_metadata` | `{table_name, last_sync_version, last_sync_at}` | Manifest tracking |

**Critical**: Table names are locked. No renaming without full migration plan & testing.  
**Reference**: database_design.md §7 (SQLite Mobile Mirror)

## 8. Offline-First Sync Contract

### 8.1 Sync Trigger Points
1. **App Launch**: Check sync manifest version
2. **Manual Refresh**: User swipes down (pull-to-refresh)
3. **Network Change**: Detect WiFi/cellular transition

### 8.2 Manifest Check Flow
```
Mobile GET /api/v1/sync/manifest
  ↓ (returns: { latest_version, timestamp, content_hash })
  ↓ Compare with local sync_metadata.last_sync_version
  ↓ If server newer:
    └→ GET /api/v1/sync/full (download all POIs, tours, audio URLs)
    └→ ATOMIC: Delete local tables → Insert new data (all-or-nothing)
    └→ Update sync_metadata.last_sync_version = server.latest_version
  ↓ Else: Use local cache
```

### 8.3 Read During Exploration
- **All POI queries**: Use SQLite (never hit server)
- **Audio playback**: Use cached MP3 files only
- **No API dependency**: Network loss does not block exploration

### 8.4 Atomic Guarantee
- SQLite write must be **all-or-nothing** (BEGIN TRANSACTION → INSERT → COMMIT or ROLLBACK)
- Partial states forbidden (corrupted data = force resync)

**Reference**: AI_GUIDELINES.md §3, USE_CASES.md UC8 (Offline Access), backend_design.md §3 (Sync Contract)

## 9. Implementation Guardrails for AI Code Generation

### 9.1 Forbidden Patterns (DO NOT Implement)
- ❌ **Geofencing** or background location tracking
- ❌ **Auto-play** audio on any trigger except explicit user tap/QR scan
- ❌ **Always-online** assumptions (cache audio locally, buffer analytics offline)
- ❌ **Parallel narration** for two POIs (strict Single Voice Rule enforcement)
- ❌ **Microservices** or Kafka/RabbitMQ (keep TTS in monolith job queue)
- ❌ **On-device TTS** generation (backend-only, 15 languages per POI)
- ❌ **Streaming audio** (pre-generated MP3 files only)
- ❌ **Real-time sync** via WebSocket (polling + manifest versioning sufficient)
- ❌ **PII storage** in analytics (anonymize user IDs, no personal data)
- ❌ **Location history** logging (foreground blue dot only, no trails)

### 9.2 Mandatory Testing Requirement
**CRITICAL**: A feature is NOT complete until tests are written and passing.  
**Standards**:
- **Unit Tests**: AAA pattern (Arrange-Act-Assert)
- **Framework**: Jest (backend), Jest/Vitest (mobile)
- **Coverage**: Minimum 70% per feature
- **Test Cases**: Map to test_scenarios.md TC-*.* matrix
- **CI/CD**: Tests must pass before PR merge

**Reference**: AI_GUIDELINES.md §8 (Strict Testing Mandate), test_scenarios.md (16+ suites)

### 9.3 Code Quality Standards
- **TypeScript**: Strict mode enabled (`strict: true` in tsconfig.json)
- **Linting**: ESLint with Airbnb config
- **Code Review**: Every commit reviewed against AI_GUIDELINES.md §12 (10-item checklist)
- **Documentation**: Every component has JSDoc comments

## 10. Multi-Language (i18n) Requirements

### 10.1 Supported Languages (15 Total)
1. Vietnamese (vi) — Primary
2. English (en)
3. Korean (ko)
4. Japanese (ja)
5. French (fr)
6. German (de)
7. Spanish (es)
8. Portuguese (pt)
9. Russian (ru)
10. Chinese Simplified (zh)
11. Thai (th)
12. Indonesian (id)
13. Hindi (hi)
14. Arabic (ar)
15. Turkish (tr)

### 10.2 Data Storage Strategy
- **POI Text**: JSONB `{ "vi": "...", "en": "...", ..., "ar": "..." }`
- **Audio Files**: `audioUrls` JSONB keyed by language code
- **API Contract**: Client requests single language via query param `?language=vi`
- **Fallback Chain**: Requested → English → Vietnamese

### 10.3 Mobile Implementation
- **Device Locale**: Auto-detect from system settings
- **User Override**: Settings page allows manual language selection
- **Persistence**: Store selection in SecureStore
- **API Request**: Use language query param (for example: `GET /api/v1/pois?language=ar`)

### 10.4 Backend TTS Generation
- **Admin CMS**: Create POI with text in all 15 languages
- **Backend Job**: Generate MP3 per language via Piper offline TTS
- **Storage**: `/audio/pois/{poiId}_{language}.mp3`
- **Database**: Update `audio_urls` JSONB with all 15 URLs

**Reference**: AI_GUIDELINES.md §7, backend_design.md §4 (i18n Architecture), account for database_design.md §2.2 (JSONB multi-language)

## 11. Documentation Conflict Resolution Hierarchy

**When documents conflict, resolve in this order**:

| Priority | Document | Authority | Scope |
|----------|----------|-----------|-------|-
| **1. HIGHEST** | README.md | Product vision & quick start | Overrides all others |
| **2** | SPEC_CANONICAL.md (this file) | System invariants & non-negotiables | Overrides 3-8 |
| **3** | AI_GUIDELINES.md | AI guardrails, tech stack, testing | Overrides 4-8 |
| **4** | ARCHITECTURE.md | Technical implementation patterns | Overrides 5-8 |
| **5** | docs/backend_design.md | API endpoints, TTS pipeline | Overrides 6-8 |
| **6** | docs/database_design.md | Database schema, relationships | Overrides 7-8 |
| **7** | USE_CASES.md | User flows, preconditions | Overrides 8 |
| **8. LOWEST** | docs/test_scenarios.md | Test cases & validation matrix | Reference for implementation |
| **Supplementary** | docs/prd/* | Product requirements & admin rules | Informational, not binding |

**Example**: If ARCHITECTURE.md says "use Zustand" but AI_GUIDELINES.md says "use Redux", follow AI_GUIDELINES.md (priority 3 > 4).

**Reference**: AI_GUIDELINES.md §11 (Cross-Reference Guide)

## 12. Admin CMS Rules (Canonical for Backend & AI Codegen)

**Scope**: Admin Dashboard is a **separate Web CMS** (not in mobile app).  
All codegen for Admin features must follow these invariants:

### 12.1 Non-Negotiable Admin Invariants
#### 12.1.1 Server-Side TTS Generation Only
- **Admin action**: Create/Edit POI → Trigger background job
- **Backend flow**: Call Piper offline TTS engine to generate MP3 for **15 languages**
- **Mobile**: **Never** generates TTS (expo-av playback only, pre-generated files)
- **Audio storage**: Save `audioUrls` JSONB per language in `points_of_interest`
- **Regeneration**: Provide "Regenerate Audio" button per POI (regenerate only changed languages)

**Reference**: backend_design.md §3 (TTS Pipeline), ARCHITECTURE.md §3.3

#### 12.1.2 Atomic Publish Flow
- **Draft mode**: Admin edits POI/Tour, changes stored as unsigned
- **Publish action**: Admin clicks "Publish" → `contentVersion` increments → Sync Manifest updates
- **Mobile view**: Until Publish, mobile sees old `contentVersion`  
- **Consistency**: All changes become visible atomically across all users

**Reference**: backend_design.md §2.1 (API Endpoints — POST /api/v1/pois/{id}/publish)

#### 12.1.3 Media Handling
- **Images**: Upload to Cloudinary and store Cloudinary URL in DB (per docs/prd/10_technical_constraints.md)
- **Audio**: Pre-generated MP3, stored as URLs in `audioUrls` JSONB
- **Versioning**: Increment `content_version` on any publish
- **Testing**: Validate audio URLs resolve before allowing publish

#### 12.1.4 No Impact on Mobile User Rules
- Admin CRUD **MUST NOT** violate user constraints:
  - ❌ Single Voice Rule still enforced
  - ❌ User-trigger only (Tap/QR) — no auto-play on admin update
  - ❌ Offline-first — mobile reads SQLite, not API
  - ❌ Foreground GPS only — no new geofences
- **Backend role**: Data provider; Mobile reads from SQLite Mirror (never bypasses)

### 12.2 Related Documentation
- **Full Admin Spec**: docs/prd/15_admin_requirements.md
- **Backend Implementation**: ARCHITECTURE.md §3.3 (TTS), backend_design.md §1.2 (Admin Endpoints)
- **Database**: database_design.md §2.2 (points_of_interest schema with audio_urls)

### 12.3 AI Code Generation Guardrail
**Checklist before completing Admin backend code**:
1. ✅ TTS job triggered on POI create/edit (server-side only)
2. ✅ `contentVersion` incremented on publish
3. ✅ Sync manifest updated after publish
4. ✅ Audio URLs saved to `audio_urls` JSONB
5. ✅ Mobile continues to use SQLite (no direct Admin API calls)
6. ✅ Tests validate publish flow, audio availability, version incrementing

---

## 13. Governance & Updates

**When updating behavior or defaults, align with README.md first.**

**Document ownership**:
- README.md: Product Manager
- SPEC_CANONICAL.md: Lead Architect (this file)
- AI_GUIDELINES.md: AI Safety Officer & Tech Lead
- ARCHITECTURE.md: System Architect
- docs/backend_design.md, docs/database_design.md: Backend Team Lead
- USE_CASES.md, docs/test_scenarios.md: Product & QA

**Update process**:
1. Propose change in GitHub issue
2. Get consensus from 2+ stakeholders
3. Update relevant doc(s)
4. Add entry to Revision History
5. Update version number & last-updated date
6. Communicate to team (Slack message or standup)

**This document is the law. Do not work around it.**
