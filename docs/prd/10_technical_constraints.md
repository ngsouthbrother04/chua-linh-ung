# Sections 12–13: Technical Constraints & Dependencies

← [Back to Index](index.md)

---

## 12. Technical Constraints

### 12.1 Technology Stack

**Mobile Application:**

| Layer | Technology | Reason |
|-------|------------|--------|
| Framework | React Native 0.81.x (Expo SDK 54 Managed Workflow) | Cross-platform iOS/Android, Expo ecosystem |
| Language | TypeScript 5.0+ | Type safety, shared với backend |
| Location | `expo-location` | Foreground & Background GPS |
| Background Tasks | `expo-task-manager` | Geofence processing in background |
| TTS | `expo-speech` | **Exclusive** audio output mechanism |
| Local DB | `expo-sqlite` | Offline POI data mirror |
| State (Global) | `zustand` | Session state, preferences |
| State (Server) | `tanstack/react-query` | Sync logic |
| Map | `react-native-maps` | POI markers, polylines |
| Payment WebView | `expo-web-browser` | VNPay/Momo payment flow |
| QR Scanner | `expo-camera` / `expo-barcode-scanner` | QR code reading |
| Secure Storage | `expo-secure-store` | AuthToken storage (encrypted) |
| Deep Linking | Expo Linking | `chualinhung://payment-result` callback |

**Backend API** *(xem ARCHITECTURE.md cho admin dashboard details)*:

- Runtime: Node.js 20+ / Express.js (TypeScript)
- Database: PostgreSQL + PostGIS
- Cache: Redis

### 12.2 Platform Constraints

**iOS Specific:**

- Cần khai báo `NSLocationAlwaysAndWhenInUseUsageDescription` trong `Info.plist`
- Background location cần được bật trong Xcode Capabilities (`Background Modes → Location updates`)
- `expo-speech.pause()` / `resume()` có thể không hỗ trợ đầy đủ trên iOS → fallback replay từ đầu

**Android Specific:**

- Background location cần `FOREGROUND_SERVICE` permission
- Android 10+ yêu cầu `ACCESS_BACKGROUND_LOCATION` permission riêng
- Cần xử lý Doze Mode → dùng `expo-task-manager` với wake lock thích hợp
- `expo-speech` trên Android không hỗ trợ pause/resume → phải stop và replay

### 12.3 Known Limitations

1. **TTS Quality:** On-device TTS (expo-speech) chất lượng thấp hơn pre-recorded audio. Future: tích hợp Google Cloud TTS hoặc AWS Polly.
2. **Map Tiles Offline:** react-native-maps yêu cầu internet để tải tiles. MVP: dùng tiles từ cache trình duyệt hoặc xem xét offline tile solutions.
3. **expo-speech Limitations:** Không hỗ trợ speed control đầy đủ trên mọi platform. Thời gian nói không thể biết chính xác trước.
4. **Background Location iOS:** iOS giới hạn background update frequency (400m displacement trigger). Cần test kỹ trong khu vực nhỏ như sân chùa.
5. **No Real-Time Update:** Admin thay đổi nội dung POI → user phải re-sync mới thấy.
6. **Single Language TTS:** Một số locale CJK có thể không có TTS engine sẵn có trên mọi thiết bị.

---

## 13. Dependencies & Integrations

### 13.1 External Libraries (Mobile)

| Library | Purpose | Version | Status |
|---------|---------|---------|--------|
| expo-location | GPS foreground/background | ~16.x | Required |
| expo-task-manager | Background tasks | ~11.x | Required |
| expo-speech | TTS narration output | ~11.x | Required |
| expo-sqlite | Local POI database | ~13.x | Required |
| expo-secure-store | Encrypted auth storage | ~13.x | Required |
| expo-camera | QR code scanning | ~14.x | Required |
| expo-web-browser | Payment WebView | ~13.x | Required |
| react-native-maps | Map display | ~1.14.x | Required |
| zustand | Global state | ^4.x | Required |
| @tanstack/react-query | Server state/sync | ^5.x | Required |

### 13.2 External Services

| Service | Purpose | Priority | Notes |
|---------|---------|----------|-------|
| VNPay | Payment gateway (default) | High | Webhook integration required |
| Momo | Payment gateway (alternative) | High | Deep link callback |
| AWS CloudFront / CDN | Static assets (images) | Medium | POI/Tour images |
| Google Cloud TTS | High-quality TTS (future) | Low | Replace expo-speech |
| Mapbox Offline | Offline map tiles (future) | Medium | Replace online map tiles |

### 13.3 Backend Integration Points

| Endpoint | Timing | Frequency |
|----------|--------|-----------|
| `/auth/payment/initiate` | Khi mua vé | Once per session setup |
| `/auth/claim` | Khi nhập mã vé | Once per session setup |
| `/sync/manifest` | Khi mở app (có mạng) | Once per app launch |
| `/sync/full` | Khi content version cũ | Khi có update mới |
| `/analytics/batch` | Background upload | Khi có mạng, mỗi 5 phút |
