# Section 5: Detailed Functional Requirements

← [Back to Index](index.md)

---

## 5. Detailed Functional Requirements

### 5.1 Module 1: Xác thực & Truy cập (UC1)

#### FR-AUTH-001: Màn hình Chào / Chọn Phương thức Truy cập

**Description:** Màn hình đầu tiên khi mở app, cho phép khách chọn cách thanh toán hoặc nhập mã

**UI Components:**

- Logo / banner ảnh khu di tích
- Nút "Thanh toán Online" (VNPay / Momo)
- Nút "Nhập mã vé" (Claim Code)
- Nút "Chọn ngôn ngữ" (có thể chọn trước khi vào)

**Behavior:**

- Nếu đã có token hợp lệ trong SecureStore → bỏ qua màn hình này, vào thẳng Map
- Nếu chưa xác thực → hiển thị màn hình này

---

#### FR-AUTH-002: Thanh toán Online (VNPay / Momo)

**Description:** Luồng thanh toán qua WebView

**Business Rule:** BR-001 (Xác thực trước khi truy cập nội dung)

**Flow:**

1. Khách chọn phương thức (VNPay hoặc Momo)
2. App gửi `OrderRequest` đến Backend
3. Backend trả về `paymentUrl`
4. App mở `expo-web-browser` với `paymentUrl`
5. Sau thanh toán thành công:
   - Backend nhận Webhook → cập nhật trạng thái ticket
   - App bắt deep link `chualinhung://payment-result?status=success`
   - App nhận `AuthToken` và chuyển sang FR-AUTH-004

**Error Handling:**

- Thanh toán thất bại → hiển thị thông báo lỗi, cho phép thử lại
- Timeout / mạng lỗi → thông báo "Kết nối thất bại. Vui lòng thử lại."

---

#### FR-AUTH-003: Nhập Mã Vé (Claim Code / OTP)

**Description:** Xác thực offline bằng mã 6 ký tự mua tại quầy

**Business Rule:** BR-001, BR-006 (Mã dùng một lần)

**UI Components:**

- Text input 6 ký tự (alphanumeric, tự động uppercase)
- Nút "Xác nhận"
- Thông báo lỗi khi mã sai hoặc đã dùng

**Behavior:**

- App gửi mã đến Backend API để xác thực
- Backend kiểm tra `Bcrypt(Code + Salt)` trong DB
- Thành công → nhận `AuthToken` + `ContentPack`, thực hiện FR-AUTH-004
- Thất bại → hiển thị "Mã vé không hợp lệ hoặc đã được sử dụng."
- Cho phép thử lại tối đa 5 lần trước khi khóa tạm thời (1 phút)

---

#### FR-AUTH-004: Đồng bộ Dữ liệu POI (One-Load Pattern)

**Description:** Tải toàn bộ dữ liệu POI về thiết bị sau xác thực thành công

**Business Rule:** BR-002 (Offline-first), BR-003 (Data Integrity)

**Flow:**

1. App gọi `GET /api/v1/sync/manifest` → nhận Content Version
2. So sánh với LocalVersion trong SQLite
3. Nếu `ServerVersion > LocalVersion`:
   - Gọi `GET /api/v1/sync/full`
   - Nhận toàn bộ POI data (JSON)
   - **Atomic Replace**: xóa và ghi lại bảng POI trong SQLite trong một transaction
4. Cập nhật `LocalVersion`
5. Hiển thị "Đã sẵn sàng tham quan!" và chuyển sang màn hình Map

**UI:**

- Màn hình loading với progress bar trong quá trình sync
- Thông báo lỗi nếu sync thất bại (có nút "Thử lại")

**Failure Handling:**

- Nếu không có mạng và đã có data cũ trong SQLite → dùng data cũ, hiển thị cảnh báo "Đang dùng nội dung cũ (ngày X)"
- Nếu không có mạng và không có data → "Cần kết nối mạng để tải nội dung lần đầu."

---

### 5.2 Module 2: Thuyết minh Tự động theo GPS (UC2)

#### FR-GPS-001: Theo dõi Vị trí GPS

**Description:** Liên tục đọc vị trí GPS của khách trong foreground và background

**Technical Details:**

- Sử dụng `expo-location` với độ chính xác cao (`Accuracy.BestForNavigation`)
- Đăng ký background task qua `expo-task-manager`
- Update interval: mỗi 3–5 giây (cân bằng accuracy vs battery)
- Cột dữ liệu nhận: `{ latitude, longitude, accuracy, speed, timestamp }`

**Behavior:**

- Yêu cầu permission `FOREGROUND_SERVICE` và `BACKGROUND_LOCATION` khi lần đầu
- Nếu user từ chối permission → hiển thị hướng dẫn cấp quyền, chỉ hỗ trợ QR Mode
- Lưu path thưa (sparse) vào `AnalyticsBuffer` để upload sau

---

#### FR-GPS-002: Phát hiện Enter/Exit Geofence

**Description:** Xác định khách đang trong hay ngoài geofence của một POI

**Algorithm:** Ray-Casting Algorithm trên Polygon từ SQLite

**Business Rule:** BR-004 (Geofence Engine là Decision Core)

**Behavior:**

- Load tất cả POI Polygons từ SQLite vào memory khi khởi động
- Với mỗi GPS point mới: kiểm tra điểm nằm trong polygon nào
- **Debounce (ENTER):** Cần N điểm liên tiếp (mặc định N=3) bên trong polygon mới kích hoạt `ENTER_EVENT`
- **Hysteresis (EXIT):** Bán kính thoát lớn hơn bán kính vào 10–15% để tránh flickering tại biên
- Output: `GeofenceEvent { type: "ENTER" | "EXIT", poiId: string, timestamp: number }`

---

#### FR-GPS-003: Máy trạng thái Thuyết minh (Narration State Machine)

**Description:** Điều phối trạng thái thuyết minh theo các sự kiện Geofence

**Business Rule:** BR-005 (Stop-on-Exit Mandatory), BR-007 (Single Voice Rule)

**States:**

| State | Mô tả |
|-------|-------|
| `IDLE` | Không có POI đang active |
| `DETECTED` | Khách vào geofence, đang chờ debounce/cooldown |
| `PLAYING` | TTS đang phát thuyết minh |
| `INTERRUPTED` | Chuyển POI nhanh, chuẩn bị switch |
| `COOLDOWN` | Khách vừa rời POI, chặn re-trigger trong X giây |

**Transitions:**

```
IDLE → (ENTER_EVENT) → DETECTED
DETECTED → (debounce_passed + no_cooldown) → PLAYING [expo-speech.speak()]
DETECTED → (EXIT_EVENT before debounce) → IDLE
PLAYING → (EXIT_EVENT) → COOLDOWN [expo-speech.stop()]
PLAYING → (ENTER_NEW_POI) → INTERRUPTED → PLAYING(new POI) [switch audio]
COOLDOWN → (timer_expired) → IDLE
```

**Cooldown Duration:** 10 giây mặc định (cấu hình từ `trigger_metadata` trong POI)

---

#### FR-GPS-004: Phát Thuyết minh TTS

**Description:** Phát văn bản thuyết minh qua Text-to-Speech

**Business Rule:** BR-007 (Single Voice Rule)

**Behavior:**

- Gọi `expo-speech.speak(text, { language: selectedLocale })`
- Nếu đang có audio khác → dừng trước (`expo-speech.stop()`) rồi mới phát mới
- Không được phát song song 2 POI cùng lúc
- Nếu device không hỗ trợ locale được chọn → fallback về tiếng Anh (`en-US`)
- Ngăn duplicate: không phát lại cùng POI đã phát trong 30 giây

---

#### FR-GPS-005: Dừng Thuyết minh khi Rời POI

**Description:** Bắt buộc dừng audio khi khách ra ngoài geofence

**Business Rule:** BR-005 (Stop-on-Exit Mandatory)

**Behavior:**

- Khi nhận `EXIT_EVENT`: gọi ngay `expo-speech.stop()` — không delay
- Khi nhận `EXIT_EVENT`: chuyển state sang `COOLDOWN`
- Hiển thị thông báo nhỏ "Đã rời khỏi [Tên POI]" (toast, 2 giây)

---

#### FR-GPS-006: Xử lý Chuyển điểm Nhanh (Fast-Movement)

**Description:** Xử lý khi khách di chuyển nhanh qua nhiều POI liên tiếp

**Business Rule:** BR-008 (Fast-Movement Handling)

**Behavior:**

- Khi `EXIT_POI_A` và `ENTER_POI_B` cách nhau < 3 giây:
  - Stop audio POI_A ngay lập tức
  - Nếu POI_B qua debounce → start audio POI_B
- Không để audio cũ tiếp tục khi đã sang POI mới

---

### 5.3 Module 3: Kích hoạt Thủ công qua QR (UC3)

#### FR-QR-001: Giao diện Quét QR

**Description:** Màn hình camera để quét mã QR tại biển bảng điểm tham quan

**UI Components:**

- Camera viewfinder toàn màn hình
- Overlay khung quét hình vuông
- Nút "X" để đóng camera
- Bật đèn flash (tùy chọn)

**Behavior:**

- Yêu cầu permission Camera khi lần đầu
- Scan liên tục, nhận diện QR code tự động
- Khi nhận diện được mã → xử lý FR-QR-002

---

#### FR-QR-002: Xử lý QR Code → Phát Thuyết minh

**Description:** Tra cứu POI từ mã QR và kích hoạt thuyết minh

**Business Rule:** BR-009 (QR là fallback, không thay thế Geofence), BR-010 (QR chỉ cho fixed POI)

**Behavior:**

- Parse QR content → lấy `poiId`
- Tra cứu `SELECT * FROM pois WHERE id = ?` trong SQLite
- Nếu tìm thấy:
  - Áp dụng Single Voice Rule (dừng audio hiện tại nếu có)
  - Gọi `expo-speech.speak(poi.narration[selectedLanguage])`
  - Hiển thị thông tin POI (tên, mô tả ngắn)
- Nếu không tìm thấy → thông báo "Không tìm thấy thông tin điểm tham quan này."

**Constraint:** QR code không được gán cho điểm di động. QR bypass GPS sensing (manual fallback), nhưng vẫn dùng chung Audio State Machine.

---

### 5.4 Module 4: Chọn Ngôn ngữ & Điều khiển Phát (UC4)

#### FR-LANG-001: Chọn Ngôn ngữ

**Description:** Cho phép khách chọn ngôn ngữ thuyết minh và giao diện

**UI Components:**

- Icon ngôn ngữ (góc trên phải màn hình chính)
- Modal / bottom sheet danh sách 15+ ngôn ngữ với quốc kỳ
- Ngôn ngữ mặc định: Tiếng Việt (`vi-VN`)

**Supported Languages (MVP):**

| Code | Ngôn ngữ |
|------|----------|
| `vi-VN` | Tiếng Việt |
| `en-US` | English |
| `zh-CN` | 中文 (Giản thể) |
| `zh-TW` | 中文 (Phồn thể) |
| `ko-KR` | 한국어 |
| `ja-JP` | 日本語 |
| `fr-FR` | Français |
| `de-DE` | Deutsch |
| `es-ES` | Español |
| `th-TH` | ภาษาไทย |
| `ru-RU` | Русский |

**Behavior:**

- Khi đổi ngôn ngữ: cập nhật `Zustand` store → `selectedLocale`
- Text thuyết minh load từ `poi.narration[selectedLocale]`
- UI labels thay đổi tương ứng (i18n)
- Nếu audio đang phát → dừng và phát lại bằng ngôn ngữ mới
- Nếu device không có TTS engine cho locale đó → fallback `en-US`, hiển thị cảnh báo

---

#### FR-LANG-002: Điều khiển Play / Pause Thuyết minh

**Description:** Cho phép khách tạm dừng và tiếp tục thuyết minh

**UI Components:**

- Thanh Player cố định ở cuối màn hình (hiện khi đang phát)
- Nút Play / Pause
- Tên POI đang phát
- Progress bar (nếu biết độ dài text)

**Behavior:**

- Pause: `expo-speech.pause()` — dừng giọng đọc, giữ position (nếu hỗ trợ)
- Resume: `expo-speech.resume()` hoặc speak lại từ đầu (tùy platform)
- Nếu khách rời geofence khi đang Pause → dừng hẳn (EXIT override Pause)
- Nút "Bỏ qua" (Skip): dừng thuyết minh hiện tại, vào state `COOLDOWN`

---

### 5.5 Module 5: Xem Tour & Khám phá có Hướng dẫn (UC5)

#### FR-TOUR-001: Danh sách Tour

**Description:** Hiển thị các tour được admin biên tập sẵn

**UI Components:**

- Danh sách card tournament (ảnh bìa, tên, mô tả, số điểm, thời gian)
- Trạng thái "Đang khám phá" nếu tour đang active

**Behavior:**

- Dữ liệu tour đọc từ SQLite (đã sync offline)
- Tap vào tour → xem chi tiết FR-TOUR-002

---

#### FR-TOUR-002: Chi tiết Tour & Lộ trình Bản đồ

**Description:** Hiển thị lộ trình tour và danh sách POI trên bản đồ

**UI Components:**

- Bản đồ với polyline vẽ lộ trình tour
- Markers đánh dấu từng POI trong tour (có số thứ tự)
- Danh sách POI theo thứ tự (tên, khoảng cách ước tính)
- Nút "Bắt đầu Tour"

**Behavior:**

- Polyline vẽ đường nối các POI theo thứ tự `poiIds`
- Tap marker → xem tên và mô tả ngắn của POI
- Tap "Bắt đầu Tour" → kích hoạt chế độ tour (FR-TOUR-003)

---

#### FR-TOUR-003: Chế độ Tour Active (Auto-Narration theo lộ trình)

**Description:** Tour mode tích hợp UC2 — tự động phát khi vào mỗi POI trong tour

**Behavior:**

- Khi tour active: Geofence Engine chỉ react với các POI thuộc tour đang chọn
- Khi vào geofence của POI trong tour → phát thuyết minh (dùng cùng logic FR-GPS-003)
- Đánh dấu POI là "Đã ghé" sau khi phát xong hoặc rời geofence
- Khi đã ghé tất cả POI → thông báo "Bạn đã hoàn thành tour [Tên Tour]!"
- Nút "Thoát Tour" luôn hiển thị để kết thúc chế độ tour

---

#### FR-MAP-001: Bản đồ Tổng quan POI

**Description:** Hiển thị tất cả POI trên bản đồ (không phải tour mode)

**UI Components:**

- Bản đồ (react-native-maps hoặc MapView)
- Markers màu-coded theo loại POI (MAIN = xanh, Minor = cam)
- Vị trí khách (blue dot)
- Nút "Vị trí của tôi" (center map về vị trí khách)

**Behavior:**

- Markers load từ SQLite
- Tap marker → hiển thị bottom sheet với tên, ảnh, mô tả ngắn
- Bottom sheet có nút "Nghe thuyết minh" → kích hoạt thủ công (QR bypass logic)
