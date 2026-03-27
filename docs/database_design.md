# Database Design

**Phiên bản**: 2.0  
**Cập nhật**: 2026-03-25  
**Tác giả**: Software Architect

---

## 1. Tổng Quan Database Architecture

### 1.1 Data Store Strategy (Hybrid Approach)

| Layer | Technology | Mục đích | Scope |
|-------|-----------|---------|-------|
| **Primary DB** | PostgreSQL | Source of Truth | Server-side |
| **Cache Layer** | Redis | Query optimization | Temporary data |
| **Offline Client** | SQLite | Offline-first sync | Mobile device |
| **File Storage** | Audio Local FS + Image Cloudinary | Media (images, MP3) | `/audio/...` for MP3, Cloudinary URL for images |

```
┌─────────────────────────────────────┐
│    PostgreSQL (Primary Authority)   │
│  - POIs, Tours, Users, Analytics    │
│  - Auth & Claims                    │
│  - Admin updates                    │
└────────────┬────────────────────────┘
             │ (Sync)
       ┌─────┴─────┐
       │           │
       ▼           ▼
   ┌─────────┐  ┌─────────┐
   │ Redis   │  │ SQLite  │
   │(Cache)  │  │(Mobile) │
   └─────────┘  └─────────┘
                     │
                     ▼
             ┌──────────────┐
             │ File Storage │
             │ (MP3, JPEG)  │
             └──────────────┘
```

---

## 2. PostgreSQL Schema (Primary Database)

### 2.1 Tổng Quan Bảng

| Bảng | Mục đích | Dòng dữ liệu (phase 1) |
|------|---------|-----------|
| `points_of_interest` | POI quán ăn | 10-50 |
| `tours` | Lộ trình ẩm thực | 3-10 |
| `users` | Người dùng ứng dụng | 100-1000 |
| `claim_codes` | Mã claim/voucher | 100-500 |
| `analytics_events` | Sự kiện phát audio, tap, etc | 10K-100K/day |
| `payment_transactions` | Lịch sử thanh toán | 10-100/day |
| `payment_callback_events` | Webhook từ VNPay/Momo | 10-100/day |
| `app_settings` | Cấu hình toàn hệ thống | <10 |

---

### 2.2 Detailed Schema Definitions

#### **Table: points_of_interest**

**Mục đích**: Lưu thông tin quán ăn được đánh dấu trên bản đồ

```sql
CREATE TABLE points_of_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Multi-language content
  name JSONB NOT NULL,  -- { "vi": "Phở Thìn", "en": "Pho Thin", ... }
  description JSONB NOT NULL,  -- { "vi": "Phở bò nổi tiếng...", ... }
  
  -- Audio URLs per language
  audio_urls JSONB NOT NULL DEFAULT '{}',  
  -- { "vi": "/audio/poi_001_vi.mp3", "en": "...", ... }
  
  -- Location data
  latitude DECIMAL(9, 6) NOT NULL,  -- e.g., 21.028537
  longitude DECIMAL(9, 6) NOT NULL,  -- e.g., 105.854214
  
  -- POI metadata
  type PoiType NOT NULL DEFAULT 'FOOD',  -- FOOD, DRINK, SNACK, WC
  image VARCHAR(2048),  -- URL to main image (Cloudinary)
  
  -- Content versioning (for sync)
  content_version INT NOT NULL DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_coordinates CHECK (
    latitude >= -90 AND latitude <= 90 AND
    longitude >= -180 AND longitude <= 180
  )
);

-- Indexes for performance
CREATE INDEX idx_points_of_interest_type ON points_of_interest(type);
CREATE INDEX idx_points_of_interest_content_version ON points_of_interest(content_version);
CREATE INDEX idx_points_of_interest_geo ON points_of_interest USING GIST (
  ST_GeogFromText('SRID=4326;POINT(' || longitude || ' ' || latitude || ')')
);

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
```

**Ví dụ dữ liệu**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": {
    "vi": "Phở Thìn",
    "en": "Pho Thin",
    "ko": "포 띠인",
    "ja": "フォー・ティン",
    "fr": "Pho Thin",
    "de": "Pho Thin",
    "es": "Pho Thin",
    "pt": "Pho Thin",
    "ru": "Фо Тхин",
    "zh": "越南粉店",
    "th": "โฟะ ธิน",
    "id": "Pho Thin",
    "hi": "फो थिन",
    "ar": "فو ثين"
  },
  "description": {
    "vi": "Phở bò Thìn nổi tiếng Hà Nội từ những năm 1920. Nước dùng được nấu từ xương bò và gia vị tự nhiên...",
    "en": "Famous Hanoi beef pho since 1920s. Broth made from beef bone and natural spices...",
    "ko": "1920년대부터 유명한 하노이 소고기 포 라면...",
    ...
  },
  "audio_urls": {
    "vi": "/audio/pois/poi_001_vi.mp3",
    "en": "/audio/pois/poi_001_en.mp3",
    "ko": "/audio/pois/poi_001_ko.mp3",
    ...
  },
  "latitude": 21.028537,
  "longitude": 105.854214,
  "type": "FOOD",
  "image": "https://res.cloudinary.com/pho-am-thuc/image/upload/v1/pois/pho_thin.jpg",
  "content_version": 2,
  "created_at": "2026-03-20T10:00:00Z",
  "updated_at": "2026-03-24T15:30:00Z"
}
```

---

#### **Table: tours**

**Mục đích**: Lộ trình ẩm thực có thứ tự (một tour chứa nhiều POI)

```sql
CREATE TABLE tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Multi-language content
  name JSONB NOT NULL,  -- { "vi": "Ăn vặt Sinh viên", ... }
  description JSONB NOT NULL,
  
  -- Tour structure
  poi_ids JSONB NOT NULL,  -- Ordered array: ["poi_001", "poi_003", "poi_005"]
  estimated_time INT DEFAULT 0,  -- Duration in minutes
  
  -- Media
  image VARCHAR(2048),  -- Tour banner image
  
  -- Versioning
  content_version INT NOT NULL DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tours_content_version ON tours(content_version);
```

**Ví dụ dữ liệu**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": {
    "vi": "Ăn vặt Sinh viên",
    "en": "Student Street Food",
    "ko": "학생 길거리 음식"
  },
  "description": {
    "vi": "Tour khám phá những quán ăn vặt nổi tiếng giữa sinh viên Hà Nội...",
    "en": "Explore famous street food stalls popular among Hanoi students..."
  },
  "poi_ids": ["poi_001", "poi_003", "poi_005", "poi_008"],
  "estimated_time": 120,
  "image": "https://res.cloudinary.com/pho-am-thuc/image/upload/v1/tours/tour-student-food.jpg",
  "content_version": 1,
  "created_at": "2026-03-15T10:00:00Z",
  "updated_at": "2026-03-15T10:00:00Z"
}
```

---

#### **Table: users**

**Mục đích**: Quản lý người dùng, session, và claim history

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Device & session info
  device_id VARCHAR(255) NOT NULL UNIQUE,  -- Device identifier
  session_id VARCHAR(255),  -- Current session
  
  -- Authorization
  claim_code VARCHAR(50),  -- Mã claim hoặc voucher
  auth_token VARCHAR(500),  -- Current JWT token
  token_expires_at TIMESTAMP,
  
  -- Preferences
  preferred_language VARCHAR(10) DEFAULT 'vi',  -- Last selected language
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_sync_at TIMESTAMP
);

CREATE INDEX idx_users_device_id ON users(device_id);
CREATE INDEX idx_users_claim_code ON users(claim_code);
CREATE INDEX idx_users_active ON users(is_active);
```

---

#### **Table: claim_codes**

**Mục đích**: Quản lý mã claim/voucher để truy cập ứng dụng

```sql
CREATE TABLE claim_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Code info
  code VARCHAR(50) NOT NULL UNIQUE,  -- e.g., "PHOAMTHUC2026"
  code_type VARCHAR(50) DEFAULT 'STANDARD',  -- STANDARD, PROMO, TEST
  
  -- Validity
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP,
  
  -- Usage limits
  max_uses INT,
  current_uses INT DEFAULT 0,
  
  -- Additional metadata
  metadata JSONB,  -- { "event": "foodfest2026", "region": "hanoi" }
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),  -- Admin who created
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_claim_codes_active ON claim_codes(is_active);
CREATE INDEX idx_claim_codes_expires ON claim_codes(expires_at);
```

---

#### **Table: analytics_events**

**Mục đích**: Ghi lại sự kiện từ mobile app (tap, play, pause, stop, QR scan)

```sql
CREATE TABLE analytics_events (
  id BIGSERIAL PRIMARY KEY,
  
  -- Identifiers
  device_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  poi_id UUID REFERENCES points_of_interest(id) ON DELETE SET NULL,
  
  -- Event data
  action VARCHAR(50) NOT NULL,  -- PLAY, PAUSE, STOP, QR_SCAN, TAP
  duration_ms INT,  -- Playback duration if applicable
  language VARCHAR(10),  -- Language selected when event occurred
  
  -- Timing
  timestamp BIGINT NOT NULL,  -- Unix milliseconds
  
  -- Sync status
  uploaded BOOLEAN DEFAULT false,
  uploaded_at TIMESTAMP,
  
  -- Metadata
  device_info JSONB,  -- { "os": "android", "appVersion": "1.0.0" }
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for analytics queries
CREATE INDEX idx_analytics_uploaded ON analytics_events(uploaded);
CREATE INDEX idx_analytics_timestamp ON analytics_events(timestamp);
CREATE INDEX idx_analytics_device_session ON analytics_events(device_id, session_id);
CREATE INDEX idx_analytics_poi ON analytics_events(poi_id);
CREATE INDEX idx_analytics_action ON analytics_events(action);
```

**Ví dụ dữ liệu**:
```json
[
  {
    "id": 1001,
    "device_id": "device_abc123xyz",
    "session_id": "sess_2026032510000",
    "poi_id": "550e8400-e29b-41d4-a716-446655440000",
    "action": "PLAY",
    "duration_ms": 45000,
    "language": "vi",
    "timestamp": 1711353600000,
    "uploaded": false,
    "device_info": {"os": "android", "appVersion": "1.0.0"},
    "created_at": "2026-03-25T10:00:00Z"
  },
  {
    "id": 1002,
    "device_id": "device_abc123xyz",
    "session_id": "sess_2026032510000",
    "poi_id": "550e8400-e29b-41d4-a716-446655440001",
    "action": "PLAY",
    "duration_ms": 37000,
    "language": "vi",
    "timestamp": 1711353700000,
    "uploaded": false,
    "created_at": "2026-03-25T10:01:40Z"
  }
]
```

---

#### **Table: payment_transactions**

**Mục đích**: Lịch sử giao dịch thanh toán (VNPay, Momo)

```sql
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Payment info
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount INT NOT NULL,  -- In VND or smallest unit
  currency VARCHAR(3) DEFAULT 'VND',
  
  -- Payment provider
  provider VARCHAR(50) NOT NULL,  -- VNPAY, MOMO
  provider_transaction_id VARCHAR(255),
  
  -- Status
  status VARCHAR(50) NOT NULL,  -- PENDING, SUCCEEDED, FAILED, CANCELLED, EXPIRED
  
  -- Metadata
  metadata JSONB,  -- { "description": "Tour access", "item_id": "tour_001" }
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_user ON payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_provider_id ON payment_transactions(provider_transaction_id);
```

---

#### **Table: payment_callback_events**

**Mục đích**: Ghi lại webhook callback từ payment provider (VNPay, Momo)

```sql
CREATE TABLE payment_callback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Callback info
  transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
  provider VARCHAR(50) NOT NULL,
  
  -- Callback content
  callback_data JSONB NOT NULL,  -- Raw callback from provider
  
  -- Processing status
  processed BOOLEAN DEFAULT true,
  error_message VARCHAR(500),
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);

CREATE INDEX idx_payment_callback_processed ON payment_callback_events(processed);
CREATE INDEX idx_payment_callback_transaction ON payment_callback_events(transaction_id);
```

---

#### **Table: app_settings**

**Mục đích**: Cấu hình toàn hệ thống (version, features, etc.)

```sql
CREATE TABLE app_settings (
  id INT PRIMARY KEY DEFAULT 1,
  
  -- Sync manifest
  current_version INT NOT NULL DEFAULT 1,
  data_checksum VARCHAR(64),  -- SHA256 hash of all POI data
  
  -- Feature flags
  features JSONB DEFAULT '{}',  -- { "enableQRScan": true, "maintenanceMode": false }
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Prisma Schema (TypeScript ORM)

Xem file [apps/backend/prisma/schema.prisma](../../apps/backend/prisma/schema.prisma) để chi tiết.

**Enums**:
```typescript
enum PoiType {
  FOOD
  DRINK
  SNACK
  WC
}

enum AnalyticsAction {
  PLAY
  PAUSE
  STOP
  QR_SCAN
}

enum PaymentProvider {
  VNPAY
  MOMO
}

enum PaymentStatus {
  PENDING
  SUCCEEDED
  FAILED
  CANCELLED
  EXPIRED
}
```

---

## 4. Relationship Diagram

```
┌──────────────────────────────┐
│   PointOfInterest            │
├──────────────────────────────┤
│ id (PK)                      │
│ name (JSONB)                 │
│ description (JSONB)          │
│ audio_urls (JSONB)           │
│ latitude, longitude          │
│ type (enum)                  │
│ image (URL)                  │
│ content_version (INT)        │
└──────────────┬───────────────┘
               │ 1
               │
               │ N
               ▼
┌──────────────────────────────┐
│   AnalyticsEvent             │
├──────────────────────────────┤
│ id (PK)                      │
│ device_id                    │
│ session_id                   │
│ poi_id (FK)                  │
│ action (enum)                │
│ duration_ms                  │
│ language                     │
│ timestamp                    │
└──────────────────────────────┘

┌──────────────────────────────┐
│   Tour                       │
├──────────────────────────────┤
│ id (PK)                      │
│ name (JSONB)                 │
│ description (JSONB)          │
│ poi_ids (JSONB - array)      │
│ estimated_time               │
│ image                        │
│ content_version              │
└──────────────────────────────┘

┌──────────────────────────────┐
│   User                       │
├──────────────────────────────┤
│ id (PK)                      │
│ device_id (UNIQUE)           │
│ session_id                   │
│ claim_code                   │
│ preferred_language           │
└──────────┬────────────────────┘
           │ 1
           │
           │ N
           ▼
┌──────────────────────────────┐
│   PaymentTransaction         │
├──────────────────────────────┤
│ id (PK)                      │
│ user_id (FK)                 │
│ amount                       │
│ provider (enum)              │
│ status (enum)                │
└──────────┬────────────────────┘
           │ 1
           │
           │ N
           ▼
┌──────────────────────────────┐
│   PaymentCallbackEvent       │
├──────────────────────────────┤
│ id (PK)                      │
│ transaction_id (FK)          │
│ callback_data (JSONB)        │
│ processed (BOOLEAN)          │
└──────────────────────────────┘

┌──────────────────────────────┐
│   ClaimCode                  │
├──────────────────────────────┤
│ id (PK)                      │
│ code (UNIQUE)                │
│ is_active                    │
│ expires_at                   │
│ max_uses, current_uses       │
└──────────────────────────────┘
```

---

## 5. Multi-Language Data Handling

### 5.1 JSONB Columns Strategy

Tất cả nội dung text được lưu dạng JSONB để hỗ trợ 15 ngôn ngữ:

```javascript
// Database view
{
  "vi": "Tiếng Việt",
  "en": "English",
  "ko": "한국어",
  "ja": "日本語",
  "fr": "Français",
  "de": "Deutsch",
  "es": "Español",
  "pt": "Português",
  "ru": "Русский",
  "zh": "中文",
  "th": "ไทย",
  "id": "Bahasa Indonesia",
  "hi": "हिन्दी",
  "ar": "العربية",
  "tr": "Türkçe"
}
```

### 5.2 Query by Language (Prisma)

```typescript
// Get POI with specific language
const getPOI = async (poiId: string, language: string) => {
  const poi = await prisma.pointOfInterest.findUnique({
    where: { id: poiId }
  });
  
  return {
    ...poi,
    // Extract single language from JSONB
    name: poi.name[language] || poi.name['vi'],
    description: poi.description[language] || poi.description['vi'],
    audioUrl: poi.audioUrls[language] || poi.audioUrls['vi']
  };
};
```

### 5.3 Update Multi-Language (Admin)

```typescript
// Admin updates POI in multiple languages
const updatePOI = async (poiId: string, updates: {
  name: Record<string, string>;
  description: Record<string, string>;
}) => {
  // Trigger TTS generation for all languages
  await generateTTSForAllLanguages(poiId, updates.description);
  
  // Update database
  return prisma.pointOfInterest.update({
    where: { id: poiId },
    data: {
      name: updates.name,
      description: updates.description,
      contentVersion: { increment: 1 }
    }
  });
};
```

---

## 6. Audio File Storage Strategy

### 6.1 File Naming Convention

```
Audio local root: /public/audio/

Structure:
/pois/
  /poi_001_vi.mp3
  /poi_001_en.mp3
  /poi_001_ko.mp3
  ...
/tours/
  /tour_001_vi.mp3
  /tour_001_en.mp3
  ...

Cloudinary image folders:
- pois/*
- tours/*
```

### 6.2 Audio Generation Trigger (Admin)

```typescript
// When Admin publishes POI:
const publishPOI = async (poiId: string) => {
  const poi = await prisma.pointOfInterest.findUnique({ where: { id: poiId } });
  
  // Trigger background job for each language
  const languages = Object.keys(poi.description);
  const audioUrls = {};
  
  for (const lang of languages) {
    const jobId = await queue.add('generate-tts', {
      poiId,
      language: lang,
      text: poi.description[lang]
    });
    
    // After job completes, local URL is saved
    const localUrl = `/audio/pois/${poiId}_${lang}.mp3`;
    audioUrls[lang] = localUrl;
  }
  
  // Update DB with audio URLs
  await prisma.pointOfInterest.update({
    where: { id: poiId },
    data: {
      audioUrls,
      contentVersion: { increment: 1 }
    }
  });
};
```

---

## 7. SQLite Mobile Mirror Tables

Mobile app tạo bảng mirror offline (không cần đầy đủ ngôn ngữ, chỉ current language):

```sql
-- Mobile SQLite (simplified offline structure)
CREATE TABLE pois (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  latitude REAL,
  longitude REAL,
  type TEXT,
  image_url TEXT,
  audio_url TEXT,  -- Current language only
  content_version INTEGER,
  synced_at INTEGER
);

CREATE TABLE tours (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  poi_ids TEXT,  -- JSON array as string
  estimated_time INTEGER,
  image_url TEXT
);

CREATE TABLE sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER
);
```

**Sync Flow**:
```
Backend: `GET /api/v1/sync/full?language=vi`
  ↓
Returns: All POIs + Tours with Vietnamese strings (not JSONB)
  ↓
Mobile SQLite: Atomic replace into pois, tours tables
  ↓
Audio files: Downloaded to file system cache (expo-file-system)
  ↓
App ready: Offline exploration using local SQLite + cached MP3s
```

---

## 8. Performance Considerations

### 8.1 Indexes Strategy

```sql
-- Query patterns to optimize:
1. Find POI by ID → id (primary key ✓)
2. Filter by type → idx_points_of_interest_type
3. Geo-radius search → GiST index on geography
4. Analytics upload query → idx_analytics_uploaded
5. Sync by version → idx_*_content_version
```

### 8.2 Partitioning (Optional for scale)

Nếu analytics_events grows lớn (>100M rows):
```sql
-- Time-based partitioning
CREATE TABLE analytics_events_2026_03 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
```

### 8.3 Query Performance Tips

```typescript
// ❌ Slow: Full table scan
select * from points_of_interest;

// ✅ Fast: Indexed column
select * from points_of_interest where type = 'FOOD';

// ✅ Fast: Geospatial query
select * from points_of_interest 
where ST_DWithin(
  ST_GeogFromText('POINT(105.8542 21.0285)'),
  ST_GeogFromText('POINT(' || longitude || ' ' || latitude || ')'),
  500  -- 500 meters
);
```

---

## 9. Backup & Disaster Recovery

### 9.1 PostgreSQL Backup Strategy

```bash
# Daily automated backup
pg_dump -U postgres pho_am_thuc > backup_$(date +%Y%m%d).sql

# Restore from backup
psql -U postgres pho_am_thuc < backup_20260325.sql
```

### 9.2 Redis Persistence

```
# redis.conf
save 900 1        # Save every 15 min if at least 1 key changed
save 300 10       # Save every 5 min if at least 10 keys changed
```

### 9.3 Local Media Versioning

- Use content_version in audio filename for immutable local media path
- Keep old files until retention cleanup job runs

---

## 10. Data Privacy & Compliance

### 10.1 Analytics Data

- ✅ Device ID hash (anonymize)
- ✅ Remove PII (location data aggregated)
- ✅ Retention policy: 90 days raw, 1 year aggregated

### 10.2 User Data

- ✅ Claim code attached to device_id (not personal info)
- ✅ No email/phone stored
- ✅ Soft delete (is_active flag, not hard delete)

---

## Tham Khảo

- SPEC_CANONICAL.md - Canonical specifications
- ARCHITECTURE.md - System topology
- backend_design.md - API & service layer
