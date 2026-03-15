# Section 9: API Assumptions

← [Back to Index](index.md)

---

## 9. API Assumptions

### 9.1 Overview

Mobile App giao tiếp với Backend qua REST API. Mọi data được pull về SQLite khi sync, sau đó app hoạt động offline hoàn toàn. Chỉ có 3 loại request trong thời gian thực: xác thực, sync data, và analytics upload.

**Base URL:** `https://api.chualinhung.vn/v1`

**Authentication:** JWT Bearer Token trong header `Authorization: Bearer <token>`

---

### 9.2 Authentication Endpoints

#### POST /api/v1/auth/payment/initiate

**Purpose:** Khởi tạo đơn hàng thanh toán online

**Request:**

```json
{
  "paymentMethod": "vnpay",
  "deviceId": "anon-uuid-xxxx",
  "amount": 30000,
  "currency": "VND"
}
```

**Success Response (200):**

```json
{
  "orderId": "order-uuid",
  "paymentUrl": "https://vnpay.vn/pay?token=...",
  "expiresIn": 900
}
```

**Error Response (400):**

```json
{ "error": "Invalid payment method" }
```

---

#### POST /api/v1/auth/payment/callback

**Purpose:** Webhook từ VNPay/Momo sau thanh toán thành công

**Request (từ payment gateway):**

```json
{
  "orderId": "order-uuid",
  "status": "SUCCESS",
  "transactionId": "vnpay-txn-123"
}
```

**Response (200):**

```json
{
  "token": "jwt-token-string",
  "expiresIn": 86400,
  "deviceId": "anon-uuid-xxxx"
}
```

---

#### POST /api/v1/auth/claim

**Purpose:** Xác thực bằng mã vé claim code

**Request:**

```json
{
  "code": "ABC123",
  "deviceId": "anon-uuid-xxxx"
}
```

**Success Response (200):**

```json
{
  "token": "jwt-token-string",
  "expiresIn": 86400
}
```

**Error Response (401):**

```json
{
  "error": "Invalid or already used claim code"
}
```

---

### 9.3 Content Sync Endpoints

#### GET /api/v1/sync/manifest

**Purpose:** Kiểm tra version nội dung hiện tại

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "contentVersion": 42,
  "totalPois": 24,
  "totalTours": 5,
  "lastUpdatedAt": "2026-03-10T08:00:00Z",
  "checksum": "sha256-abc123..."
}
```

---

#### GET /api/v1/sync/full

**Purpose:** Tải toàn bộ nội dung POI và Tour

**Headers:** `Authorization: Bearer <token>`

**Query Params:** `?version=42` (để server biết không cần nén nếu version đã mới nhất)

**Response (200):**

```json
{
  "contentVersion": 42,
  "pois": [
    {
      "id": "poi-uuid-1",
      "name": { "vi": "Tượng Phật Bà", "en": "Lady Buddha Statue", "ko": "불상" },
      "description": { "vi": "Tượng cao 67m...", "en": "67m tall statue..." },
      "narration": { "vi": "Đây là tượng Phật Bà...", "en": "This is the Lady Buddha..." },
      "latitude": 16.0031,
      "longitude": 108.2672,
      "polygon": {
        "type": "Polygon",
        "coordinates": [[[108.266, 16.002], [108.268, 16.002], [108.268, 16.004], [108.266, 16.004], [108.266, 16.002]]]
      },
      "radius": 50,
      "type": "Điểm chính",
      "image": "https://cdn.chualinhung.vn/poi/tuong-phat-ba.jpg",
      "triggerMetadata": {
        "debouncePoints": 3,
        "cooldownSeconds": 10,
        "exitRadiusMultiplier": 1.15
      }
    }
  ],
  "tours": [
    {
      "id": "tour-uuid-1",
      "name": { "vi": "Lộ trình Chính", "en": "Main Route" },
      "description": { "vi": "Khám phá các điểm nổi bật...", "en": "Explore highlights..." },
      "duration": 90,
      "poiIds": ["poi-uuid-1", "poi-uuid-2", "poi-uuid-3"],
      "image": "https://cdn.chualinhung.vn/tours/main-route.jpg",
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ]
}
```

**Notes:**

- Response được compress bằng gzip
- Client phải thực hiện Atomic Replace khi ghi vào SQLite

---

### 9.4 Analytics Endpoint

#### POST /api/v1/analytics/batch

**Purpose:** Upload analytics events được buffer trong SQLite

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "deviceId": "anon-uuid-xxxx",
  "sessionId": "session-uuid",
  "events": [
    {
      "poiId": "poi-uuid-1",
      "action": "ENTER",
      "durationMs": 0,
      "language": "vi-VN",
      "timestamp": 1741852800000
    },
    {
      "poiId": "poi-uuid-1",
      "action": "LISTEN_COMPLETE",
      "durationMs": 45300,
      "language": "vi-VN",
      "timestamp": 1741852845300
    }
  ],
  "sessionPath": [
    { "lat": 16.003, "lng": 108.267, "timestamp": 1741852800000 },
    { "lat": 16.004, "lng": 108.268, "timestamp": 1741852830000 }
  ]
}
```

**Response (200):**

```json
{ "accepted": 2, "failed": 0 }
```

**Notes:**

- Upload chỉ thực hiện khi có internet (không blocking)
- Client đánh dấu events đã upload (`uploaded = 1`) để tránh duplicate
- Batch size tối đa: 100 events mỗi request

---

### 9.5 API Conventions

- **Authentication:** JWT Bearer token trong header `Authorization`
- **Request Headers:**

  ```
  Content-Type: application/json
  Authorization: Bearer <jwt-token>
  Accept-Encoding: gzip
  ```

- **Response Format:**
  - Success: HTTP 2xx với JSON body
  - Error: HTTP 4xx/5xx với `{ "error": "message" }`
- **Rate Limiting:** Sync endpoint: tối đa 10 requests/phút per device
- **Token Refresh:** Token hết hạn → redirect về màn hình Auth, không silent refresh trong MVP
