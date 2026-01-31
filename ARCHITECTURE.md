# ARCHITECTURE & TECHNICAL BLUEPRINT

> **Audience**: AI Agents, System Architects, Senior Developers
>
> **Purpose**: Definitive source of truth for the system's technical implementation. This document maps high-level constraints to specific code structures and libraries.

---

## 1. System Topology

The system operates as a **Hybrid Offline-First Mobile Architecture**.

```mermaid
graph TD
    subgraph "Cloud Infrastructure (Managed)"
        Admin[Admin Dashboard] -->|Content Upd| API[Backend API (Node.js)]
        API -->|Read/Write| Postgres[(PostgreSQL - Primary)]
        API -->|Cache| Redis[(Redis)]
    end

    subgraph "Mobile Client (React Native / Expo)"
        Sync[Data Sync Service] -->|REST Fetch| API
        Sync -->|Write| LocalDB[(SQLite - Local Mirror)]
        
        Geo[Geofencing Engine] -->|Read Polygons| LocalDB
        Geo -->|Events| State[State Machine]
        
        State -->|Trigger| TTS[TTS Engine (expo-speech)]
        State -->|Log| Analytics[Analytics Buffer]
        
        Analytics -->|Batch Upload| API
    end
```

---

## 2. Technology Stack & Libraries (STRICT)

### 2.1 Mobile Client (Consumer)
- **Framework**: `React Native 0.74+` (Expo SDK 50+ Managed Workflow)
- **Language**: TypeScript 5.0+
- **Key Libraries**:
  - `expo-location`: Foreground & Background location tracking.
  - `expo-task-manager`: Background task orchestration.
  - `expo-sqlite`: Local offline database (Content Layer).
  - `expo-speech`: **Exclusive** audio output mechanism.
  - `zustand`: Global state management (Session state, User preferences).
  - `tanstack/react-query`: Server state & Sync logic.

### 2.2 Backend API (Provider)
- **Runtime**: `Node.js 20+`
- **Framework**: `Express.js` (standard, lightweight)
- **Language**: TypeScript
- **Database**:
  - `PostgreSQL` + `PostGIS`: Stores POIs, Users, Telemetry, and Geospatial Data.
  - **Schema Note**: POIs stored in `pois` table with `GEOMETRY(POLYGON, 4326)` column.

---

## 3. Component Deep-Dive

### 3.1 The Geofence Engine (Core Logic)
> **Constraint**: Must run in Foreground and Background.

- **Input**: Stream of `{ latitude, longitude, accuracy, speed }` from `expo-location`.
- **Process**:
  1. **Ray-Casting Algorithm**: Check if point is inside POI Polygon (fetched from SQLite).
  2. **Debounce Filter**: Require N consecutive points inside polygon to trigger `ENTER`.
  3. **Hysteresis**: Exit radius is slightly larger than Entry radius to prevent flickering.
- **Output**: `GeofenceEvent { type: "ENTER" | "EXIT", poiId: string, timestamp: number }`

### 3.2 The Narration State Machine
> **Constraint**: Handles the "one voice at a time" rule.

**States**:
- `IDLE`: No active POI.
- `DETECTED`: User entered POI, waiting for debounce/cooldown.
- `PLAYING`: TTS is actively speaking.
- `INTERRUPTED`: Fast movement caused stop; ready to switch.
- `COOLDOWN`: User exited, blocking re-entry for X seconds.

**Transitions**:
- `IDLE` -> `ENTER_EVENT` -> `DETECTED`
- `DETECTED` -> `TIMER_EXPIRED` -> `PLAYING` (Trigger `expo-speech.speak()`)
- `PLAYING` -> `EXIT_EVENT` -> `IDLE` (Trigger `expo-speech.stop()`)
- `PLAYING` -> `ENTER_NEW_POI` -> `INTERRUPTED` -> `PLAYING (New POI)`

### 3.3 Data Synchronization (The "One-Load" Pattern)
- **Trigger**: App Launch or Manual Refresh.
- **Flow**:
  1. `GET /api/v1/sync/manifest`: Check Content Version.
  2. Delta check: If ServerVersion > LocalVersion -> `GET /api/v1/sync/full`.
  3. **Atomic Replace**: Transactionally wipe generic POI table in SQLite and populate with new JSON.
  4. Narrations are stored as **Text Strings** in SQLite. Audio generation is strictly JIT (Just-in-Time).

---

## 4. Data Models (TypeScript Interfaces)

### 4.1 POI Object (PostgreSQL Table Structure)
```sql
CREATE TABLE points_of_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_jsonB JSONB NOT NULL, -- { "vi": "...", "en": "..." }
  description_jsonB JSONB NOT NULL, -- Narrations
  geom GEOMETRY(POLYGON, 4326) NOT NULL, -- Spatial Index
  trigger_metadata JSONB DEFAULT '{"debounce": 5}'
);
```

### 4.2 Telemetry Packet
```typescript
interface UserTelemetry {
  deviceId: string; // Anonymized UUID
  sessionPath: { lat: number; lng: number; timestamp: number }[]; // Sparse array
  interactions: {
    poiId: string;
    action: "ENTER" | "EXIT" | "LISTEN_COMPLETE" | "LISTEN_ABORT";
    durationMs: number;
  }[];
}
```

---

## 5. Security & Payment Architecture

### 5.1 Payment Flow (Momo/VNPay)
1. **Request**: Mobile App sends `OrderRequest` to Backend.
2. **Sign**: Backend interacts with VNPay/Momo API, generates `paymentUrl`.
3. **Web**: Mobile App opens `expo-web-browser` with `paymentUrl`.
4. **Callback**:
   - Success -> Backend receives Webhook -> Updates Ticket State in Postgres.
   - Redirect -> Mobile App catches UUID deep link `chualinhung://payment-result?status=success`.

### 5.2 Offline Auth (Claim Code)
- **Algorithm**: `Bcrypt(Code + Salt)` stored in DB.
- **Structure**: 6-digit alphanumeric.
- **Validation**: Mobile sends code -> API verifies -> Returns `AuthToken` + `ContentPack`.

---

## 6. Development Guidelines for Agents

1. **When coding the Mobile App**:
   - Always wrap `expo-speech` calls in a service that checks `AppState` (Foreground/Background).
   - NEVER query the API for POI data during the navigation session; ONLY query SQLite.

2. **When coding the Backend**:
   - Endpoints must be stateless.
   - The `/sync` endpoint must be highly optimized (compress response).

3. **When modifying Geofence Logic**:
   - Unit tests must simulate "Teleportation" (GPS Jump) and "Drift" (Stationary Jitter) to ensure robustness.

---

**End of ARCHITECTURE**
