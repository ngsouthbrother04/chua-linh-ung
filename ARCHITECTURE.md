# Architecture & Technical Blueprint

> **Audience**: AI Agents, System Architects, Senior Developers
>
> **Purpose**: Definitive source of truth for the system's technical implementation. This document maps high-level constraints to specific code structures and libraries.
>
> **Last Updated**: 2026-03-25  
> **Version**: 2.0

**Related Documentation**:
- `SPEC_CANONICAL.md` – Canonical rules & invariants
- `AI_GUIDELINES.md` – AI guardrails & technology stack details  
- `docs/backend_design.md` – API endpoints, TTS pipeline, i18n, caching strategy
- `docs/database_design.md` – PostgreSQL schema, SQLite mirror, relationships
- `USE_CASES.md` – 8 detailed use cases with flows
- `docs/test_scenarios.md` – 16+ test suites, 100+ test cases

---

## 1. System Topology

The system operates as a **Hybrid Offline-first Mobile Architecture**.

```mermaid
graph TD
    subgraph "Cloud Infrastructure (Managed)"
        Admin[Admin Dashboard] -->|Content Upd| API["Backend API (Node.js)"]
        API -->|Read/Write| Postgres[(PostgreSQL - Primary)]
        API -->|Cache| Redis[(Redis)]
    end

    subgraph "Mobile Client (React Native / Expo)"
        Sync["Data Sync Service"] -->|REST Fetch| API
        Sync -->|Write| LocalDB[("SQLite - Local Mirror")]
        
        Map[Map Interaction Engine] -->|Read POIs| LocalDB
        Map -->|User Tap Events| State[State Machine]
        
        State -->|Trigger| AudioPlayer["Audio Player (expo-av)"]
        State -->|Log| Analytics[Analytics Buffer]
        
        Analytics -->|Batch Upload| API
    end
```

---

## 2. Technology Stack & Libraries (STRICT)

### 2.1 Mobile Client (Consumer)
- **Framework**: `React Native 0.81.x` (Expo SDK 54)
- **Language**: TypeScript 5.0+
- **Key Libraries**:
  - `expo-location`: Foreground location tracking (for blue dot only).
  - `expo-sqlite`: Local offline database.
  - `expo-av`: **Exclusive** audio playback mechanism for pre-generated audio files.
  - `zustand`: Global state management.
  - `react-native-maps`: Map display and POI marker interactions.

### 2.2 Backend API (Provider)
- **Runtime**: `Node.js 20+`
- **Database**:
  - `PostgreSQL` + `PostGIS`: Stores POIs, Users, Telemetry, and Geospatial Data.
  - **Audio Storage**: Local File System for generated `.mp3` audio files.
  - **Image Storage**: Cloudinary for POI/tour images.
- **Background Jobs**: Dedicated worker process/queue for TTS generation.

---

## 3. Component Deep-Dive

### 3.1 The Interactive Map Engine
> **Constraint**: Handles displaying locations and routing taps to audio.

- **Process**:
  1. Renders `react-native-maps` using POI coordinates fetched from SQLite.
  2. Tracks user location via `expo-location` in the foreground.
  3. When a marker is tapped, displays the bottom sheet.
  4. Dispatches an explicitly User-Triggered `PLAY_EVENT` to the State Machine when "Listen" is pressed.

#### 3.1.1 Overlap Resolution Policy (Nearby POIs)

When multiple POIs fall into the same nearby radius (e.g., 500m), the map engine can highlight all of them.

- **No Auto-play**: overlap detection never dispatches `PLAY_EVENT` by itself.
- **Deterministic recommendation** (if UI needs "best candidate"):
  1) shortest distance
  2) higher `tour_priority`
  3) lexicographically smaller `poi_id`
- **User intent wins**: explicit marker tap always overrides recommendation.

### 3.2 The Narration State Machine
> **Constraint**: Handles the "Single Voice Rule".

**States**:
- `IDLE`: No active audio.
- `PLAYING`: Audio file is actively playing.
- `PAUSED`: User temporarily paused audio.

**Transitions**:
- `IDLE` -> `PLAY_EVENT(New POI)` -> `PLAYING`
- `PLAYING` -> `PAUSE_EVENT` -> `PAUSED`
- `PAUSED` -> `RESUME_EVENT` -> `PLAYING`
- `PLAYING` / `PAUSED` -> `STOP_EVENT` -> `IDLE`
- `PLAYING` -> `PLAY_EVENT(New POI)` -> `IDLE` (kills old audio) -> `PLAYING (New POI)`

### 3.3 Backend TTS Processing

Admin creates/updates POI content → Backend triggers background job → Piper generates MP3 offline → Files saved to local storage → URLs saved to PostgreSQL.

**Flow Details**:
1. Admin via CMS: Create/Edit POI with text in 15 languages
2. Backend receives request, validates, starts background job (BullMQ/Node-schedule)
3. For each language:
  - Call Piper offline TTS engine
   - Receive generated MP3 stream
  - Save to local path `/audio/pois/${poiId}_${language}.mp3`
4. Update PostgreSQL:
   ```sql
   UPDATE points_of_interest 
  SET audio_urls = '{"vi": "/audio/...vi.mp3", "en": "/audio/...en.mp3", ...}',
       content_version = content_version + 1
   WHERE id = '${poiId}';
   ```
5. Sync manifest updated (version++)
6. Mobile clients detect version change via `/api/v1/sync/manifest`
7. Download full sync → Update SQLite → Download MP3 files to cache
8. On POI tap → Load text & audio from local SQLite + file cache

**Technology Stack** (Backend TTS):
- **Audio Generation**: Piper (offline, free, no account)
- **Job Queue**: Bull (Redis-backed) or Node-schedule (simpler, for < 100 POIs)
- **Storage**: Local Filesystem (`/app/public/audio/`)
- **ORM**: Prisma for PostgreSQL updates

#### 3.3.1 Queue Scalability Contract

- **Job key (idempotency)**: `{poiId}:{language}:{contentVersion}`.
- **Concurrency control**: configurable worker pool (default 5), tune by provider limits.
- **Retry policy**: exponential backoff, max 3 attempts.
- **Failure handling**: failed jobs must be queryable in admin queue status for manual retry.
- **Architecture boundary**: keep single backend + Redis queue (no Kafka/RabbitMQ for MVP).

**Key Constraint**: No on-device TTS generation. Mobile uses `expo-av` to playback pre-generated MP3 files only.

**Reference**: `docs/backend_design.md` §3 – Text-to-Speech Pipeline

### 3.4 Data Synchronization (The "One-Load" Pattern)
- **Flow**:
  1. `GET /api/v1/sync/manifest`
  2. If ServerVersion > LocalVersion -> `GET /api/v1/sync/full`.
  3. **Atomic Replace** in SQLite.
  4. Audio files are downloaded/cached by the client for offline playback.

---

## 4. Data Models & Database Schema

### 4.1 PostgreSQL Primary Schema

**Core Tables** (detailed schema in `docs/database_design.md`):

| Table | Rows (Phase 1) | Purpose |
|-------|---|---------|
| `points_of_interest` | 10-50 | POI data (name, description, audio URLs, location) |
| `tours` | 3-10 | Food tours (ordered POI lists) |
| `users` | 100-1000 | User sessions, auth, device fingerprint |
| `claim_codes` | 100-500 | Claim/voucher codes for authorization |
| `analytics_events` | 10K-100K/day | Usage telemetry (play, pause, stop, QR scan) |
| `payment_transactions` | 10-100/day | Payment records (VNPay, Momo) |
| `payment_callback_events` | 10-100/day | Webhook callbacks from payment providers |
| `app_settings` | <10 | System config (version, feature flags) |

### 4.2 POI Object (Detailed)

```typescript
interface PointOfInterest {
  id: UUID;                    // Primary key
  
  // Multi-language content (JSONB)
  name: {
    vi: "Phở Thìn";
    en: "Pho Thin";
    ko: "포 띠인";
    // ... 10 more languages
  };
  description: { [lang: string]: string };
  
  // Audio URLs (JSONB) - pre-generated, server-side
  audioUrls: {
    vi: "/audio/poi_001_vi.mp3";
    en: "/audio/poi_001_en.mp3";
    // ... per language
  };
  
  // Location
  latitude: Decimal(9, 6);     // PostGIS searchable
  longitude: Decimal(9, 6);
  
  // Metadata
  type: "FOOD" | "DRINK" | "SNACK" | "WC";
  image: string;               // Main POI image URL (Cloudinary)
  
  // Versioning for sync
  contentVersion: 1;           // Increments on update
  
  // Timestamps
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

### 4.3 Tour Object

```typescript
interface Tour {
  id: UUID;
  name: { [lang: string]: string };           // Multi-language
  description: { [lang: string]: string };
  poiIds: ["poi_001", "poi_003", "poi_005"];  // Ordered array
  estimatedTime: 120;                          // Minutes
  image: string;
  contentVersion: 1;
}
```

### 4.4 Analytics Event

```typescript
interface AnalyticsEvent {
  id: BigInt;
  deviceId: string;                            // Device fingerprint
  sessionId: string;
  poiId?: UUID;                                // NULL for app-level events
  action: "PLAY" | "PAUSE" | "STOP" | "QR_SCAN" | "TAP";
  durationMs?: number;                         // For PLAY action
  language: string;                            // Language during event
  timestamp: BigInt;                           // Unix milliseconds
  uploaded: boolean;                           // Batch sync flag
  deviceInfo?: { os, appVersion };
  createdAt: DateTime;
}
```

### 4.5 SQLite Mobile Mirror (Offline Cache)

Mobile device maintains local SQLite tables (simplified, single-language):

```sql
CREATE TABLE pois (
  id TEXT PRIMARY KEY,
  name TEXT,                     -- Current language only
  description TEXT,
  latitude REAL,
  longitude REAL,
  type TEXT,
  image_url TEXT,
  audio_url TEXT,                -- Current language only
  content_version INTEGER,
  synced_at INTEGER              -- Unix timestamp
);

CREATE TABLE tours (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  poi_ids TEXT,                  -- JSON array as string
  estimated_time INTEGER,
  synced_at INTEGER
);

CREATE TABLE sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER
);
-- Keys: "server_version", "last_sync_time", "data_checksum"
```

**Reference**: `docs/database_design.md` §2-7 – Detailed schema definitions, relationships, multi-language handling, performance indexing

---

## 5. Multi-Language (i18n) Architecture

### 5.1 Data Storage

- **Server**: All text stored as JSONB with language keys
  ```json
  {
    "name": {
      "vi": "Phở Thìn", "en": "Pho Thin", "ko": "포 띠인", ...
    },
    "description": {
      "vi": "Phở bò nổi tiếng...", "en": "Famous beef pho...", ...
    },
    "audioUrls": {
      "vi": "/audio/.../vi.mp3", "en": "/audio/.../en.mp3", ...
    }
  }
  ```

### 5.2 API Contract

```
GET /api/v1/pois?language=vi
→ Returns text in Vietnamese, audio URL for Vietnamese MP3

If language missing in JSONB:
→ Fallback: English → Vietnamese
```

### 5.3 Mobile Implementation

```typescript
// Settings UI: User selects language
const setUserLanguage = (lang: string) => {
  store.setLanguage(lang);           // Zustand store
  await SecureStore.setItemAsync('userLanguage', lang);
};

// POI Tap: Load with selected language
const handlePoiTap = async (poiId: string) => {
  const lang = store.userLanguage;
  const poi = await db.getPOI(poiId, lang);  // SQLite query
  
  return {
    name: poi.name,                    // Vietnamese or English
    description: poi.description,
    audioUrl: poi.audio_url,           // MP3 for selected language
    language: lang
  };
};

// Audio Playback
const playAudio = async (audioUrl: string) => {
  const cachedPath = `${FileSystem.cacheDirectory}/audio/${poiId}_${lang}.mp3`;
  const { sound } = await Audio.Sound.createAsync({ uri: cachedPath });
  await sound.playAsync();
};
```

**Reference**: `docs/backend_design.md` §4 – i18n Implementation

---

## 6. Offline-First Sync Architecture

### 6.1 Manifest Check

```
Mobile Launch:
  1. GET /api/v1/sync/manifest
     → Returns: { serverVersion: 3, lastUpdated: "2026-03-24T15:30:00Z" }
  
  2. Compare with local sync_metadata.server_version
  
  3a. If LOCAL == SERVER:
      → Skip full sync, use SQLite cache
  
  3b. If LOCAL < SERVER:
      → GET /api/v1/sync/full?language=vi (or user's language)
      → Atomic SQLite replace (delete + insert)
      → Download MP3 files to cache
      → Update sync_metadata.server_version
```

### 6.2 Offline Exploration

```
Internet OFF:
  1. Open app → launches with SQLite data (no API call)
  2. Tap POI → load from SQLite
  3. Listen → play from file cache (expo-file-system)
  4. Explore offline seamlessly
  5. When online → batch upload analytics, check for new content
```

**Reference**: `USE_CASES.md` UC1 (Auth & Sync), UC8 (Offline Access)

---

## 7. Single Voice Rule & State Machine

### 7.1 Event-Driven Architecture

```
User Action (Tap/QR) → Dispatch PLAY_EVENT → State Machine transition

State Machine:
  IDLE ──PLAY──> PLAYING
  PLAYING ──PAUSE──> PAUSED
  PAUSED ──RESUME──> PLAYING
  [PLAYING | PAUSED] ──STOP──> IDLE
  PLAYING ──PLAY(NewPOI)──> IDLE (stop old audio) → PLAYING (new)
```

### 7.2 Enforcement

```typescript
// Zustand + zustand-persist for state
const useAudioStore = create((set) => ({
  state: 'IDLE',  // 'IDLE' | 'PLAYING' | 'PAUSED'
  currentPoiId: null,
  currentSound: null,
  
  play: async (poiId, audioUrl) => {
    // Transition logic
    if (state === 'PLAYING') {
      await currentSound.stopAsync();  // Stop old immediately
    }
    
    // Load new audio
    const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
    await sound.playAsync();
    
    set({ state: 'PLAYING', currentPoiId: poiId, currentSound: sound });
  },
  
  pause: async () => {
    if (state === 'PLAYING') {
      await currentSound.pauseAsync();
      set({ state: 'PAUSED' });
    }
  }
}));
```

**Reference**: 
- `ARCHITECTURE.md` §3.2 – State Machine
- `USE_CASES.md` UC3 (Tap-to-Play), UC4 (QR trigger)
- `docs/test_scenarios.md` TC-3.2, TC-4.2 – Validation tests

---

## 8. Security & Authentication Architecture

### 8.1 Authorization Flow

```
User opens app (no auth)
  ↓
Select: Claim Code OR Payment
  ↓
Path A: Claim Code
  POST /api/v1/auth/claim → Validate claim_code
  ↓ (if valid, not expired, not max-uses)
  Returns: { authToken: JWT, expiresIn: 86400 }
  
Path B: Payment
  Open WebView → VNPay/Momo gateway
  ↓ (user completes payment)
  Webhook callback → /api/v1/auth/payment/callback
  → Backend processes callback, marks user authorized
  ↓
  Both paths: Trigger sync manifest → full sync
```

### 8.2 JWT Token Storage

- **Mobile**: SecureStore (encrypted) – `SecureStore.setItemAsync('authToken', jwt)`
- **Backend**: Sign JWT with secret, include device_id in claims
- **Expiration**: 24 hours, refresh via `/auth/token-refresh`

### 8.3 Payment Webhook

```
VNPay → HTTPS POST /api/v1/auth/payment/callback
  ├─ Validate signature (HMAC)
  ├─ Update payment_transactions.status
  ├─ Mark user authorized (claim_codes or payment_transactions)
  ├─ Return acknowledgment (status=0 for VNPay)
```

**Reference**: `docs/backend_design.md` §2.2 – API Endpoints (Auth, Payment)

### 8.4 Presence & Online Users Dashboard Architecture

#### 8.4.1 Canonical Presence Signals

- Mobile sends a lightweight heartbeat every 30s while app is foreground.
- Mobile sends best-effort final heartbeat on background transition.
- Backend stores heartbeat with short TTL (ephemeral presence index).

#### 8.4.2 Dashboard Metrics

- `online_now`: unique devices/users seen in the last 90s.
- `active_5m`: unique devices/users seen in the last 5 minutes.
- `currently_playing`: subset of `online_now` with audio state = PLAYING.

#### 8.4.3 Implementation Notes

- Presence is approximate operational telemetry, not exact billing identity.
- Dashboard labels must show metric windows (90s, 5m) to prevent misinterpretation.

---

## 9. Performance & Constraints

### 9.1 Key Targets

| Metric | Target | How |
|--------|--------|-----|
| API Response | < 200ms (p95) | Use Redis cache, query optimization |
| Sync Time | < 5s (first load) | 50 POIs, 15 languages, API + download |
| Map Load | < 2s | Render from SQLite (no API call) |
| Audio Start | < 1-2s | Play from file cache (already downloaded) |
| Memory | < 150MB | No leaks during 30min exploration |
| Battery | < 10% | During 30min offline exploration |
| Uptime | 99.9% | Managed PaaS (Heroku, Railway, Azure) |

### 9.2 Database Optimization

- **Indexes**: Type, content_version, geo (GiST), uploaded, timestamp
- **Partitioning**: Optional time-based for analytics_events (if > 100M rows)
- **Query patterns**: All essential data from SQLite on mobile (no API during exploration)

**Reference**: `docs/backend_design.md` §9 – Performance Metrics & SLAs

---

## 10. Development Guidelines for AI Agents & Developers

### 10.1 When Implementing Mobile App Features

1. **Data Source**: SQLite ONLY during exploration (no API calls)
2. **Audio**: Use `expo-av.Sound` for *.mp3 playback (never `expo-speech`)
3. **State Management**: Zustand store with state machine pattern
4. **Location**: `expo-location` foreground only (blue dot, no auto-triggers)
5. **Language**: Query SQLite with `WHERE language = userLanguage`
6. **Offline**: Assume no network after initial sync – buffer analytics locally
7. **Testing**: Jest unit tests, mock file system & database

**Example Feature: POI Tap**
```typescript
// Component (UI layer)
const MapScreen = () => {
  const handleMarkerPress = (poiId: string) => {
    dispatchEvent({ type: 'POI_TAP', poiId });
    showBottomSheet();
  };
};

// Store (State Management)
const useAudioStore = create((set, get) => ({
  play: async (poiId: string) => {
    const lang = store.userLanguage;  // Zustand store
    const poi = await db.getPOI(poiId, lang);  // SQLite query
    
    // Single Voice Rule
    if (get().state === 'PLAYING') {
      await get().currentSound.stopAsync();
    }
    
    // Load & play
    const sound = await Audio.Sound.createAsync({ uri: poi.audioUrl });
    await sound.playAsync();
    
    set({ state: 'PLAYING', currentPoiId: poiId });
    logAnalyticsEvent('PLAY', poiId, lang);
  }
}));
```

### 10.2 When Implementing Backend API Endpoints

1. **TTS**: Trigger background job on POI create/update, don't block HTTP
2. **Multi-language**: Return single language per request (`?language=vi`)
3. **Sync**: Compare manifest version, return only changed data
4. **Error Handling**: Use consistent ApiError class
5. **Testing**: Mock local file storage, database, Piper TTS calls
6. **Documentation**: Swagger/OpenAPI for all endpoints

**Example Backend Service: POI Create**
```typescript
// Controller
app.post('/admin/pois', validateAdmin, async (req, res) => {
  const poiData = req.body;  // { name: {...}, description: {...}, ... }
  
  try {
    const poi = await poiService.createPOI(poiData);
    
    // Trigger background TTS job (non-blocking)
    ttsQueue.add('generate-tts', { poiId: poi.id, texts: poiData.description });
    
    res.json({ status: 'created', poi });
  } catch (error) {
    throw new ApiError(error.code, error.message);
  }
});

// Service
const createPOI = async (data: POIInput) => {
  // Validate all 15 language fields
  // Generate unique audio file names
  // Save to PostgreSQL
  const poi = await prisma.pointOfInterest.create({
    data: {
      name: data.name,          // JSONB
      description: data.description,
      audioUrls: {},            // Empty, will be filled by TTS job
      latitude: data.latitude,
      longitude: data.longitude,
      type: data.type,
      image: data.image,
      contentVersion: 1
    }
  });
  
  return poi;
};

// Background Job
const ttsGenerator = async (job) => {
  const { poiId, texts } = job.data;
  const audioUrls = {};
  
  for (const [lang, text] of Object.entries(texts)) {
    const mp3Buffer = await piper.synthesize(text, lang);
    const fileName = `${poiId}_${lang}.mp3`;
    await localStorage.save(`/audio/pois/${fileName}`, mp3Buffer);
    audioUrls[lang] = `/audio/pois/${fileName}`;
  }
  
  // Update database with audio URLs
  await prisma.pointOfInterest.update({
    where: { id: poiId },
    data: { audioUrls, contentVersion: { increment: 1 } }
  });
};
```

### 10.3 Testing Requirements

- **Unit Tests**: Service/component logic (AAA pattern)
- **Integration Tests**: API endpoints with mock DB
- **End-to-End**: Auth flow, sync, exploration, analytics upload
- **Coverage**: Minimum 70% per file
- **Test Categories**: Functional, edge cases, offline, multi-language, performance

**Reference**: `docs/test_scenarios.md` – 16 test suites with 100+ test cases

---

## 11. Deployment & Infrastructure

### 11.1 Recommended Stack

| Component | Service |
|-----------|---------|
| **API Host** | Heroku / Railway.app / Azure App Service |
| **Database** | AWS RDS PostgreSQL / Azure Database for PostgreSQL |
| **Cache** | Redis Cloud / Azure Cache for Redis |
| **Storage** | Audio local filesystem (`/app/public/audio`) + Image Cloudinary |
| **TTS Compute** | In-process worker (default) or optional serverless worker in same codebase |
| **Monitoring** | Datadog / New Relic / Azure Monitor |
| **CI/CD** | GitHub Actions |

Monolith clarification: serverless worker ở đây chỉ là cách chạy nền cho TTS của cùng backend, không phải tách thành microservice riêng.

### 11.2 Environment Variables

```
DATABASE_URL=postgresql://user:pass@host:5432/pho_am_thuc
REDIS_URL=redis://host:6379
TTS_STORAGE_PROVIDER=local
TTS_LOCAL_AUDIO_DIR=./public/audio
TTS_ENGINE=piper
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
VNPAY_MERCHANT_ID=...
MOMO_MERCHANT_ID=...
JWT_SECRET=...
NODE_ENV=production
```

**Reference**: `docs/backend_design.md` §7 – Deployment & Scaling

---

## 12. References & Conflict Resolution

**Mandatory Reading Order**:
1. `README.md` – Product overview
2. `SPEC_CANONICAL.md` – Canonical rules (this is law)
3. `AI_GUIDELINES.md` – AI guardrails
4. `ARCHITECTURE.md` (this file) – Technical blueprint
5. `docs/backend_design.md` – API & service details
6. `docs/database_design.md` – Schema & relationships
7. `USE_CASES.md` – User flows
8. `docs/test_scenarios.md` – Quality checklist

**Conflict Resolution** (if documents conflict):
1. `README.md` (Absolute Source of Truth)
2. `SPEC_CANONICAL.md` (Canonical Rules)
3. This document (`ARCHITECTURE.md`)
4. Supporting docs

---

**Version**: 2.0 | **Last Updated**: 2026-03-25  
**End of ARCHITECTURE**
