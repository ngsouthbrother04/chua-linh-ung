# Section 8: Data Requirements

← [Back to Index](index.md)

---

## 8. Data Requirements

### 8.1 POI Data Model (SQLite – Local Mirror)

```typescript
interface POI {
  id: string;                           // UUID (từ PostgreSQL)
  name: Record<string, string>;         // { "vi": "...", "en": "...", "ko": "..." }
  description: Record<string, string>;  // Short description, đa ngôn ngữ
  narration: Record<string, string>;    // Full narration text cho TTS, đa ngôn ngữ
  latitude: number;                     // Tâm POI (float64)
  longitude: number;                    // Tâm POI (float64)
  polygon: GeoJSONPolygon;             // GeoJSON Polygon - dùng cho Ray-Casting
  radius: number;                       // Bán kính xấp xỉ (meters) - display only
  type: POIType;                        // MAIN | WC | TICKET | PARKING | BOAT
  image: string;                        // URL ảnh đại diện
  triggerMetadata: TriggerMetadata;     // Cấu hình debounce/cooldown
  distance?: string;                    // Khoảng cách hiển thị (runtime, không persist)
}

interface TriggerMetadata {
  debouncePoints: number;  // Số điểm GPS liên tiếp cần trước khi ENTER (default: 3)
  cooldownSeconds: number; // Thời gian cooldown sau EXIT (default: 10)
  exitRadiusMultiplier: number; // Hệ số mở rộng bán kính thoát (default: 1.15)
}

type GeoJSONPolygon = {
  type: "Polygon";
  coordinates: [number, number][][]; // [lng, lat] pairs
};

enum POIType {
  MAIN    = 'Điểm chính',
  WC      = 'WC',
  TICKET  = 'Bán vé',
  PARKING = 'Gửi xe',
  BOAT    = 'Bến thuyền'
}
```

**SQLite Schema:**

```sql
CREATE TABLE pois (
  id TEXT PRIMARY KEY,
  name_json TEXT NOT NULL,          -- JSON string của Record<string, string>
  description_json TEXT NOT NULL,   -- JSON string
  narration_json TEXT NOT NULL,     -- JSON string
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  polygon_json TEXT NOT NULL,       -- GeoJSON Polygon serialized
  radius INTEGER NOT NULL,
  type TEXT NOT NULL,
  image TEXT,
  trigger_metadata_json TEXT NOT NULL,
  content_version INTEGER NOT NULL  -- Version để detect khi nào cần sync
);

CREATE INDEX idx_pois_type ON pois(type);
```

**Field Validation Rules:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| id | string | Yes | UUID, unique |
| name | JSONB | Yes | Phải có ít nhất key `vi` |
| narration | JSONB | Yes | Phải có ít nhất key `vi` |
| latitude | number | Yes | Tọa độ hợp lệ |
| longitude | number | Yes | Tọa độ hợp lệ |
| polygon | GeoJSON | Yes | Valid Polygon, closed ring |
| type | POIType | Yes | Giá trị enum hợp lệ |
| triggerMetadata.debouncePoints | integer | Yes | 1–10 |
| triggerMetadata.cooldownSeconds | integer | Yes | 0–60 |

---

### 8.2 Tour Data Model (SQLite – Local Mirror)

```typescript
interface Tour {
  id: string;                          // UUID
  name: Record<string, string>;        // { "vi": "...", "en": "..." }
  description: Record<string, string>; // Mô tả tour, đa ngôn ngữ
  duration: number;                    // Phút ước tính
  poiIds: string[];                    // Thứ tự POI IDs
  image?: string;                      // URL ảnh bìa
  createdAt: string;                   // ISO 8601
}
```

**SQLite Schema:**

```sql
CREATE TABLE tours (
  id TEXT PRIMARY KEY,
  name_json TEXT NOT NULL,
  description_json TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 0,
  poi_ids_json TEXT NOT NULL,   -- JSON array of POI IDs in order
  image TEXT,
  created_at TEXT NOT NULL
);
```

---

### 8.3 Sync Manifest

```typescript
interface SyncManifest {
  contentVersion: number;    // Tăng mỗi khi admin cập nhật content
  totalPois: number;
  totalTours: number;
  lastUpdatedAt: string;     // ISO 8601
  checksum: string;          // SHA-256 của toàn bộ data (integrity check)
}
```

---

### 8.4 Authentication State (SecureStore)

```typescript
interface AuthState {
  token: string;          // JWT Bearer token
  username: string | null;
  expiresAt: string;      // ISO 8601 - thời điểm token hết hạn
  lastSyncVersion: number; // Content version đã sync gần nhất
  lastSyncDate: string;    // ISO 8601
}
```

**Storage:** `expo-secure-store` (encrypted on-device)

---

### 8.5 User Preferences (Zustand Store + AsyncStorage)

```typescript
interface UserPreferences {
  selectedLocale: string;   // e.g. "vi-VN", "en-US", "ko-KR"
  autoNarration: boolean;   // Bật/tắt auto GPS narration (default: true)
  volume: number;           // 0.0 – 1.0 (default: 1.0)
}
```

---

### 8.6 Analytics Telemetry (Local Buffer → Batch Upload)

```typescript
interface UserTelemetry {
  deviceId: string;      // Ẩn danh UUID (không liên kết cá nhân)
  sessionId: string;     // UUID cho phiên tham quan hiện tại
  sessionPath: {         // Sparse GPS path (mỗi 30 giây)
    lat: number;
    lng: number;
    timestamp: number;
  }[];
  interactions: {
    poiId: string;
    action: "ENTER" | "EXIT" | "LISTEN_COMPLETE" | "LISTEN_ABORT" | "QR_SCAN" | "MANUAL_TRIGGER";
    durationMs: number;
    language: string;
    timestamp: number;
  }[];
}
```

**SQLite Schema (Analytics Buffer):**

```sql
CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  poi_id TEXT,
  action TEXT NOT NULL,
  duration_ms INTEGER,
  language TEXT,
  timestamp INTEGER NOT NULL,
  uploaded INTEGER NOT NULL DEFAULT 0  -- 0 = pending, 1 = uploaded
);
```
