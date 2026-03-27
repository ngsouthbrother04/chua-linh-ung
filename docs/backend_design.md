# Backend Design

**Phiên bản**: 2.0  
**Cập nhật**: 2026-03-25  
**Tác giả**: Software Architect

---

## 1. Tổng Quan Kiến Trúc Hệ Thống

### 1.1 Mô hình Hệ Thống Tổng Thể

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHỐ ẨM THỰC SYSTEM ARCHITECTURE              │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐              ┌──────────────────────┐
│   ADMIN CMS/WEB      │              │   MOBILE APP         │
│  (React)             │              │  (Expo/React Native) │
│  - POI Management    │              │  - Tap-to-Play       │
│  - Content Edition   │              │  - Map Exploration   │
│  - Audio Generation  │              │  - Offline Sync      │
└──────────┬───────────┘              └──────────┬───────────┘
           │                                     │
           └──────────┬────────────────────────┬─┘
                      │ REST APIs              │
                      ▼                        │
           ┌──────────────────────┐            │
           │  BACKEND API         │            │
           │  (Node.js + Express) │            │
           │  TypeScript          │            │
           └──────────┬───────────┘            │
                      │                        │
        ┌─────────────┼─────────────┐          │
        ▼             ▼             ▼          ▼
    ┌────────┐  ┌────────┐  ┌──────────┐ ┌────────┐
    │Postgres│  │ Redis  │  │ Piper   │ │ Local │
    │ (Main) │  │(Cache) │  │API/Local │ │/Local │
    └────────┘  └────────┘  └──────────┘ └────────┘
        ▲                                     ▲
        │      ┌─────────────────────────────┘
        └──────────────┬─────────────────────┐
                       ▼
                ┌──────────────┐
                │ Mobile SQLite│
                │ (Offline)    │
                └──────────────┘
```

**Thành phần chính**:
- **Mobile App**: React Native (Expo) - Front-end khám phá POI
- **Backend API**: Node.js 20+ + Express + TypeScript
- **Database chính**: PostgreSQL (with PostGIS extension)
- **Cache**: Redis
- **Storage**: Audio local filesystem + Image Cloudinary
- **Text-to-Speech**: Piper (offline, free, no account)
- **Database Offline**: SQLite (trên Mobile)

---

## 2. Thiết Kế API Backend

### 2.1 Base URL & Versioning

```
Base URL: https://api.phoamthuc.local/api/v1
Headers:
  Content-Type: application/json
  Authorization: Bearer <jwt_token> (nếu cần)
  Accept-Language: vi | en | ko | ... (tùy chọn, backward compatibility)
Language selection (canonical): query param `?language=vi`
```

---

### 2.2 Core API Endpoints

#### **A. Authentication & Authorization**

| Endpoint | Method | Mục đích | Auth |
|----------|--------|---------|------|
| `/auth/claim` | POST | Xác thực mã claim/voucher | ❌ |
| `/auth/payment/initiate` | POST | Khởi tạo thanh toán | ❌ |
| `/auth/payment/callback` | POST | Xử lý callback/finalize thanh toán | ❌ |
| `/auth/token-refresh` | POST | Làm mới JWT Token | ✅ |
| `/auth/logout` | POST | Đăng xuất | ✅ |

**Request/Response ví dụ**:
```json
// POST /auth/claim
{
  "code": "PHOAMTHUC2026"
}

// Response 200
{
  "status": "success",
  "authToken": "eyJhbGc...",
  "expiresIn": 86400,
  "user": {
    "id": "user_123",
    "claimCode": "PHOAMTHUC2026",
    "createdAt": "2026-03-25T10:00:00Z"
  }
}
```

---

#### **B. Synchronization (Offline-First)**

| Endpoint | Method | Mục đích | Auth |
|----------|--------|---------|------|
| `/sync/manifest` | GET | Lấy thông tin version hiện tại | ✅ |
| `/sync/full` | GET | Tải toàn bộ POI & Tour data | ✅ |
| `/sync/incremental` | POST | Cập nhật theo version delta | ✅ |

**Request/Response ví dụ**:
```json
// GET /sync/manifest
// Response 200
{
  "status": "success",
  "data": {
    "serverVersion": 3,
    "dataChecksum": "abc123def456",
    "lastUpdated": "2026-03-24T15:30:00Z",
    "requiresFullSync": false,
    "mediaBasePath": "/audio/"
  }
}

// GET /sync/full (supports language param)
// Response 200
{
  "status": "success",
  "data": {
    "pois": [ /* array of POI objects */ ],
    "tours": [ /* array of Tour objects */ ],
    "metadata": { "version": 3, "count": 45 }
  }
}
```

---

#### **C. POI Query & Discovery**

| Endpoint | Method | Mục đích | Auth |
|----------|--------|---------|------|
| `/pois` | GET | Lấy danh sách POI (paginated) | ✅ |
| `/pois/:id` | GET | Chi tiết POI cụ thể | ✅ |
| `/pois/search/radius` | POST | Tìm POI trong bán kính | ✅ |
| `/pois/:id/audio/:language` | GET | Tải file audio cụ thể | ✅ |

**Request/Response ví dụ**:
```json
// POST /pois/search/radius
{
  "latitude": 21.0285,
  "longitude": 105.8542,
  "radiusM": 500,
  "limit": 10
}

// Response 200
{
  "status": "success",
  "data": [
    {
      "id": "poi_001",
      "name": { "vi": "Phở Thìn", "en": "Pho Thin", "ko": "포 띠인" },
      "description": { "vi": "Phở bò nổi tiếng...", "en": "Famous beef pho...", "ko": "유명한 소고기 포..." },
      "latitude": 21.0287,
      "longitude": 105.8545,
      "distance": 45.5,
      "type": "FOOD",
      "image": "https://res.cloudinary.com/pho-am-thuc/image/upload/v1/pois/pho-thin.jpg",
      "audioUrls": {
        "vi": "/audio/poi_001_vi.mp3",
        "en": "/audio/poi_001_en.mp3",
        "ko": "/audio/poi_001_ko.mp3"
      }
    }
  ]
}
```

---

#### **D. Tours (Lộ trình Ẩm thực)**

| Endpoint | Method | Mục đích | Auth |
|----------|--------|---------|------|
| `/tours` | GET | Danh sách tour | ✅ |
| `/tours/:id` | GET | Chi tiết tour + POI list | ✅ |
| `/tours/:id/pois` | GET | POI trong tour (ordered) | ✅ |

**Response ví dụ**:
```json
// GET /tours/tour_001
{
  "status": "success",
  "data": {
    "id": "tour_001",
    "name": { "vi": "Ăn vặt Sinh viên", "en": "Student Street Food" },
    "description": { "vi": "Tour khám phá ăn vặt nổi tiếng...", ... },
    "estimatedDurationMins": 120,
    "poiCount": 8,
    "poiIds": ["poi_001", "poi_003", "poi_005", ...],
    "image": "https://res.cloudinary.com/pho-am-thuc/image/upload/v1/tours/tour-001.jpg"
  }
}
```

---

#### **E. Analytics & Usage Tracking**

| Endpoint | Method | Mục đích | Auth |
|----------|--------|---------|------|
| `/analytics/events` | POST | Upload batch sự kiện | ✅ |
| `/analytics/presence/heartbeat` | POST | Gửi heartbeat phục vụ dashboard online users | ✅ |
| `/analytics/stats` | GET | Thống kê sử dụng cá nhân | ✅ |

**Request ví dụ**:
```json
// POST /analytics/events
{
  "events": [
    {
      "deviceId": "device_xyz",
      "sessionId": "sess_123",
      "poiId": "poi_001",
      "action": "PLAY",
      "durationMs": 15000,
      "language": "vi",
      "timestamp": 1711353600000
    }
  ]
}

// Response 200
{
  "status": "success",
  "processedCount": 1
}

// POST /analytics/presence/heartbeat
{
  "deviceId": "device_xyz",
  "sessionId": "sess_123",
  "appState": "FOREGROUND",
  "audioState": "PLAYING",
  "timestamp": 1711353600000
}

// Response 200
{
  "status": "success",
  "onlineNowWindowSec": 90,
  "active5mWindowSec": 300
}
```

---

#### **F. Admin/CMS Endpoints (Protected)**

| Endpoint | Method | Mục đích | Auth | Role |
|----------|--------|---------|------|------|
| `/admin/pois` | POST | Tạo POI mới | ✅ | ADMIN |
| `/admin/pois/:id` | PUT | Cập nhật POI | ✅ | ADMIN |
| `/admin/pois/:id/publish` | POST | Publish POI → khách | ✅ | ADMIN |
| `/admin/pois/:id/audio/generate` | POST | Trigger TTS generation | ✅ | ADMIN |
| `/admin/sync/invalidate` | POST | Force client resync | ✅ | ADMIN |

---

### 2.3 Error Handling & Status Codes

```
200 OK - Request thành công
201 Created - Tài nguyên tạo thành công
204 No Content - Thành công, không có content trả lại
400 Bad Request - Input không hợp lệ
401 Unauthorized - Cần xác thực
403 Forbidden - Không có quyền truy cập
404 Not Found - Tài nguyên không tồn tại
409 Conflict - Xung đột dữ liệu (ví dụ: content version cũ)
429 Too Many Requests - Rate limit exceeded
500 Internal Server Error - Lỗi server
503 Service Unavailable - Service tạm thời không khả dụng
```

**Error Response Format**:
```json
{
  "status": "error",
  "error": {
    "code": "INVALID_AUTH_CODE",
    "message": "Mã xác thực không hợp lệ hoặc đã hết hạn",
    "timestamp": "2026-03-25T10:15:00Z"
  }
}
```

---

## 3. Text-to-Speech (TTS) Pipeline

### 3.1 Kiến trúc TTS

**Yêu cầu**: 
- Hỗ trợ 15 ngôn ngữ
- Backend: Server-side TTS generation (không trên mobile)
- Storage: MP3 files lưu trên local filesystem

**Flow**:
```
Admin Input (Text in 15 languages)
  ↓
Backend receives content update
  ↓
Trigger Background Job (BullMQ / Node-schedule)
  ↓
For each language:
  - Call Piper offline TTS engine
  - Generate MP3 file
  - Save to local filesystem (`/audio/...`)
  ↓
Database: Save audio URLs to audioUrls JSON field
  ↓
Sync manifest updates (version++)
  ↓
Mobile clients auto-sync and download MP3 files
  ↓
Mobile plays from local cache (offline-first)
```

### 3.2 Công nghệ TTS Đề xuất

| Công nghệ | Miễn phí | Chất lượng | Dễ sử dụng | Ghi chú |
|-----------|---------|---------|-----------|---------|
| **Piper** (Open-source) | Hoàn toàn miễn phí | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Offline, self-host, không cần account |

**Đề xuất cho đồ án**: Piper (offline, free, no account) cho toàn bộ môi trường dev/prod.

### 3.3 Queue Contract cho Scale Nhiều User/POI

Để tránh nghẽn khi nhiều nội dung cập nhật cùng lúc:

- **Idempotency key**: `{poiId}:{language}:{contentVersion}` (tránh generate trùng).
- **Concurrency mặc định**: 5 workers (điều chỉnh qua CPU/RAM máy chủ).
- **Retry policy**: exponential backoff (2s, 8s, 30s), tối đa 3 lần.
- **Failed jobs**: lưu vào failed set/DLQ để admin có thể retry thủ công.
- **Observability**: có endpoint/admin panel hiển thị `queued`, `processing`, `failed`, `completed`.

Lưu ý: vẫn giữ monolith + Redis queue, không chuyển Kafka/RabbitMQ cho MVP.

---

## 4. Xử lý Đa Ngôn Ngữ (i18n)

### 4.1 Cấu trúc Dữ liệu

Tất cả text content (name, description) được lưu dạng JSON:

```json
{
  "id": "poi_001",
  "name": {
    "vi": "Phở Thìn",
    "en": "Pho Thin",
    "ko": "포 띠인",
    "ja": "フォー·ティン",
    ...
  },
  "description": {
    "vi": "Phở bò nổi tiếng Hà Nội...",
    "en": "Famous Hanoi beef pho...",
    "ko": "유명한 하노이 소고기 포...",
    ...
  },
  "audioUrls": {
    "vi": "/audio/poi_001_vi.mp3",
    "en": "/audio/poi_001_en.mp3",
    "ko": "/audio/poi_001_ko.mp3",
    ...
  }
}
```

### 4.2 Backend Language Handling

```typescript
// app.ts - Language Middleware
app.use((req, res, next) => {
  const lang = req.headers['accept-language'] || 'vi';
  req.userLanguage = lang;
  next();
});

// Service layer
const getPOI = (poiId: string, language: string) => {
  const poi = db.poi.findUnique(poiId);
  return {
    ...poi,
    name: poi.name[language] || poi.name['vi'],
    description: poi.description[language] || poi.description['vi'],
    audioUrl: poi.audioUrls[language] || poi.audioUrls['vi']
  };
};
```

### 4.3 Mobile-side Language Switching

Mobile app sẽ:
1. Lưu user's language preference trong `zustand` store
2. Khi lấy POI từ SQLite, lọc theo language
3. Khi submit analytics, ghi lại language được dùng

---

## 5. Geo-Fencing & Location Detection

### 5.1 Điểm Quan Trọng

Theo SPEC_CANONICAL.md:
- ❌ **Không** auto-play audio khi user vào gần POI
- ✅ **Chỉ** phát audio khi user **Tap** vào marker hoặc scan **QR Code**
- ✅ GPS tracking là **foreground only** (không background)

### 5.2 Implementation

```typescript
// Mobile-side: Location tracking
const trackLocation = async () => {
  const location = await Location.getCurrentPositionAsync({});
  
  // Update map blue dot
  setUserLocation(location.coords);
  
  // Query nearby POIs (for UI enhancement - NOT auto-play)
  const nearbyPois = await getNearbyPOIs(
    location.coords.latitude,
    location.coords.longitude,
    500 // 500m radius
  );
  
  // Optional: highlight nearby POIs visually
  highlightNearbyMarkers(nearbyPois);
};

// Backend: PostGIS Radius Search
const getNearbyPOIs = (lat: number, lon: number, radiusM: number) => {
  return prisma.pointOfInterest.findMany({
    where: {
      // PostGIS distance query
      ST_DWithin: {
        ST_GeogFromText: `POINT(${lon} ${lat})`,
        distance: radiusM,
        true
      }
    }
  });
};

// Optional recommendation in overlapping zones (deterministic)
const pickRecommendedPOI = (pois: Poi[]) => {
  return pois
    .sort((a, b) => {
      if (a.distanceM !== b.distanceM) return a.distanceM - b.distanceM;
      if ((a.tourPriority ?? 0) !== (b.tourPriority ?? 0)) {
        return (b.tourPriority ?? 0) - (a.tourPriority ?? 0);
      }
      return a.id.localeCompare(b.id);
    })[0] ?? null;
};
```

**Rule quan trọng**: recommendation chỉ phục vụ hiển thị UI, không được tự động phát audio.

---

## 6. Caching Strategy

### 6.1 Redis Cache

```
Key: pois:v3:vi        → All POIs + content (Vietnamese)
Key: poi:001:meta      → Single POI metadata
Key: audio:001:vi      → Audio URL cache
Key: sync:manifest     → Current version info
TTL: 24 hours (content), 1 hour (dynamic data)
```

### 6.2 Client-side Caching

- SQLite: Full content mirror (offline-first)
- File system: MP3 downloads via `expo-file-system`
- In-memory: zustand state (current tour, active POI)

---

## 7. Deployment & Scaling

### 7.1 Technology Stack (Recommended)

| Layer | Tech | Reason |
|-------|------|--------|
| **Hosting** | Heroku / Railway.app / Azure App Service | Simple deploy, auto-scaling |
| **Database** | PostgreSQL (AWS RDS / Azure Database) | Managed, backup, PostGIS support |
| **Cache** | Redis Cloud / Azure Cache for Redis | Managed redis |
| **File Storage** | Audio local filesystem + Image Cloudinary | Cost-effective, easy CDN delivery for images |
| **TTS Compute** | In-process worker (default) or optional serverless worker | Keep one monolith codebase; scale background jobs without splitting into microservices |
| **Monitoring** | Datadog / New Relic | Real-time performance tracking |

**Monolith note**: Dù dùng worker in-process hay worker serverless tùy chọn, kiến trúc vẫn là **monolith backend duy nhất** (không tách domain thành microservices độc lập).

### 7.2 Example: GitHub Actions CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy Backend
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Heroku
        run: |
          git push https://heroku.com/pho-am-thuc.git main
```

---

## 8. Security Best Practices

### 8.1 Authentication & Authorization

- ✅ JWT tokens cho API access
- ✅ Rate limiting (prevent brute-force auth attempts)
- ✅ HTTPS/TLS cho all API calls
- ✅ Secure storage của token trên Mobile (`SecureStore`)

### 8.2 Data Protection

- ✅ Database encryption at-rest
- ✅ CORS policy để chỉ allow mobile app domain
- ✅ Input validation trên tất cả endpoints
- ✅ SQL injection prevention (Prisma auto-escape)

### 8.3 Audit & Compliance

- ✅ Log tất cả admin actions
- ✅ Analytics data anonymization (remove PII)
- ✅ Regular security audit

---

## 9. Performance Metrics & SLAs

### 9.1 Target Metrics

| Metric | Target | Monitoring |
|--------|--------|-----------|
| API Response Time | < 200ms (p95) | Datadog |
| Sync Time (first load) | < 5s | APM |
| POI Load (map) | < 100ms | Client-side |
| Audio Download | < 30s (5MB over 4G) | Analytics |
| Uptime | 99.9% | Status page |

### 9.2 Monitoring

```
Metrics to track:
- Request latency distribution
- Error rates by endpoint
- Cache hit/miss ratios
- Database query performance
- File storage bandwidth
- User session analytics
- Presence freshness (`online_now` 90s window)
- Queue health (`tts_queue_depth`, retry rate, failed jobs)
```

### 9.3 Online Users Dashboard Semantics (Canonical)

- `online_now`: số user/device unique có heartbeat trong 90 giây gần nhất.
- `active_5m`: số user/device unique có heartbeat hoặc interaction trong 5 phút gần nhất.
- `currently_playing`: user/device đang ở trạng thái PLAYING tại lần heartbeat gần nhất.

Mọi widget dashboard phải ghi rõ time window để tránh hiểu nhầm là "realtime tuyệt đối".

---

## Tham Khảo

- SPEC_CANONICAL.md - Single source of truth
- ARCHITECTURE.md - System topology
- AI_GUIDELINES.md - Guardrails cho AI codegen
