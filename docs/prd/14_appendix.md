# Section 18: Appendix

← [Back to Index](index.md)

---

## 18. Appendix

### 18.1 Glossary

| Term | Definition |
|------|-----------|
| **POI** (Point of Interest) | Điểm tham quan cụ thể trong khu chùa (ví dụ: Đại tượng Phật, Chánh điện, Hồ thiên nga). Mỗi POI có polygon địa lý, id, tên, và nội dung narration theo từng ngôn ngữ. |
| **Geofence** | Vành đai địa lý ảo xung quanh một POI. Khi người dùng bước vào/ra geofence, hệ thống phát sinh sự kiện trigger narration. |
| **Polygon** | Hình đa giác 2D được định nghĩa bởi danh sách tọa độ GPS. Dùng để biểu diễn ranh giới một POI. Lưu dưới dạng GeoJSON. |
| **Ray-Casting Algorithm** | Thuật toán xác định điểm có nằm trong polygon không, bằng cách bắn tia ngang và đếm số lần tia cắt cạnh polygon. |
| **TTS** (Text-to-Speech) | Công nghệ đọc văn bản thành giọng nói. MVP dùng `expo-speech` (on-device). |
| **One-Load Pattern** | Chiến lược đồng bộ dữ liệu: tải toàn bộ dataset một lần duy nhất, lưu vào SQLite, và chỉ update khi `contentVersion` thay đổi. |
| **Offline-first** | Nguyên tắc thiết kế: app phải hoạt động đầy đủ mà không cần internet sau lần sync đầu tiên. |
| **Narration State Machine** | Máy trạng thái điều phối narration. Các state: IDLE → DETECTED → PLAYING → COOLDOWN → IDLE. |
| **Cooldown** | Thời gian chờ sau khi rời POI để ngăn re-trigger cùng POI. Mặc định: 10 giây (theo trigger metadata). |
| **Debounce** | Cơ chế lọc nhiễu GPS trước khi ENTER. Mặc định cần 3 điểm GPS liên tiếp bên trong polygon. |
| **Hysteresis** | Dùng ngưỡng enter và exit khác nhau để tránh oscillation khi user đứng gần ranh giới polygon. |
| **Claim Code** | Mã thay thế thanh toán online. Bcrypt-hashed, 6 ký tự alphanumeric, single-use (dùng 1 lần duy nhất). |
| **SQLite Mirror** | Bản sao toàn bộ POI/Tour dataset của server, lưu dưới dạng SQLite trên thiết bị user. |
| **JWT** (JSON Web Token) | Token xác thực dạng signed JSON, encode thông tin user (subscription status, expiry). Lưu encrypted trong `expo-secure-store`. |
| **Sync Manifest** | Response từ `/sync/manifest` chứa hash/version của dataset hiện tại trên server. App so sánh với local version để quyết định có sync không. |
| **Ray-Casting Fast Exit** | Optimisation: kiểm tra bounding box trước khi Ray-Casting chính xác, để bỏ qua ngay những POI rõ ràng không liên quan. |
| **Foreground Service** | Android service chạy liên tục với notification bar, cho phép background GPS hoạt động. |
| **Deep Link** | URL scheme `chualinhung://...` cho phép hệ thống điều hướng user về app sau khi thanh toán tại WebView. |
| **WebView** | Component hiển thị trang web trong app. Dùng để hiển thị VNPay/Momo payment pages. |
| **CDN** (Content Delivery Network) | Hệ thống phân tán files tĩnh (ảnh, audio) để tải nhanh từ server gần user nhất. |
| **PRD** | Product Requirements Document — tài liệu định nghĩa yêu cầu sản phẩm. |
| **UC** | Use Case — kịch bản sử dụng cụ thể. |
| **FR** | Functional Requirement — yêu cầu chức năng. |
| **NFR** | Non-Functional Requirement — yêu cầu phi chức năng. |
| **AC** | Acceptance Criteria — tiêu chí chấp nhận. |
| **BR** | Business Rule — quy tắc nghiệp vụ. |
| **MVP** | Minimum Viable Product — sản phẩm tối thiểu khả dụng. |

---

### 18.2 Related Documents

| Document | Path | Description |
|----------|------|-------------|
| System Architecture | [ARCHITECTURE.md](../../ARCHITECTURE.md) | Mô tả chi tiết kiến trúc hệ thống |
| AI Guidelines | [AI_GUIDELINES.md](../../AI_GUIDELINES.md) | Invariants, business rules cho AI assistant |
| Use Cases | [USE_CASES.md](../../USE_CASES.md) | UC1–UC5 chi tiết |
| Use Case Mapping | [USE_CASE_MAPPING.md](../../USE_CASE_MAPPING.md) | Ma trận mapping UC ↔ Features |
| Backend Design | [docs/backend_design.md](../backend_design.md) | Chi tiết API, database schema |
| Test Scenarios | [docs/test_scenarios.md](../test_scenarios.md) | Kịch bản kiểm thử đầy đủ |

---

### 18.3 Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2024-01 | Initial | Tạo PRD tóm tắt đầu tiên (~100 lines) |
| 1.0 | 2026-03 | AI-assisted | Viết lại toàn bộ theo cấu trúc 14 files, hợp nhất admin & user PRD thành unified PRD |
