# Section 7: Non-Functional Requirements (NFRs)

← [Back to Index](index.md)

---

## 7. Non-Functional Requirements (NFRs)

### 7.1 Performance

- **NFR-PERF-001:** App phải khởi động (cold start) trong vòng 3 giây trên thiết bị tầm trung
- **NFR-PERF-002:** Geofence engine phải xử lý mỗi GPS event trong vòng 200ms
- **NFR-PERF-003:** TTS phải bắt đầu phát trong vòng 500ms sau khi nhận `ENTER_EVENT`
- **NFR-PERF-004:** Màn hình bản đồ với 100 POI markers phải render trong vòng 1 giây
- **NFR-PERF-005:** Toàn bộ quá trình sync dữ liệu lần đầu phải hoàn tất trong vòng 30 giây (với kết nối 4G)
- **NFR-PERF-006:** Truy vấn SQLite cho một POI phải hoàn tất trong vòng 50ms

### 7.2 Offline Capability

- **NFR-OFF-001:** Sau khi sync lần đầu, app phải hoạt động hoàn toàn offline (GPS, Geofence, TTS, Map, Tour)
- **NFR-OFF-002:** Không có bất kỳ request API nào trong suốt phiên tham quan (trừ analytics upload khi có mạng)
- **NFR-OFF-003:** SQLite phải lưu trữ đủ dữ liệu để hoạt động: POI coords, polygons, narrations, tour routes
- **NFR-OFF-004:** App phải thông báo rõ ràng khi dùng data cũ và ngày sync gần nhất

### 7.3 Battery & Resource

- **NFR-BAT-001:** GPS tracking background không được tiêu thụ hơn 10% pin mỗi giờ trên thiết bị tầm trung
- **NFR-BAT-002:** Sử dụng sampling interval GPS ≥ 3 giây để cân bằng accuracy vs battery
- **NFR-BAT-003:** Khi app ở background và không có GPS event → giảm frequency geofence check

### 7.4 Location Accuracy

- **NFR-LOC-001:** Geofence engine phải hoạt động chính xác với GPS accuracy ≤ 15 meters
- **NFR-LOC-002:** Debounce phải cần ít nhất 3 điểm GPS liên tiếp trước khi trigger ENTER
- **NFR-LOC-003:** Hysteresis exit radius phải lớn hơn entry radius ít nhất 10%
- **NFR-LOC-004:** Khi accuracy > 20m, phải log cảnh báo và tùy chọn không trigger

### 7.5 Security

- **NFR-SEC-001:** AuthToken phải được lưu trong `expo-secure-store` (encrypted storage)
- **NFR-SEC-002:** Claim Code phải được validate phía server (không client-side mock)
- **NFR-SEC-003:** Claim Code chỉ được dùng một lần (server đánh dấu đã sử dụng)
- **NFR-SEC-004:** API calls phải dùng HTTPS
- **NFR-SEC-005:** deviceId cho analytics phải là UUID ẩn danh, không liên kết với thông tin cá nhân

### 7.6 Usability

- **NFR-USE-001:** UI phải hỗ trợ 11+ ngôn ngữ hiển thị đầy đủ
- **NFR-USE-002:** Font phải hỗ trợ ký tự CJK (Korean, Japanese, Chinese) và Thai
- **NFR-USE-003:** Tất cả hành động quan trọng phải có visual feedback trong vòng 100ms
- **NFR-USE-004:** Khi GPS không sẵn sàng → hiển thị hướng dẫn cấp quyền rõ ràng
- **NFR-USE-005:** Player bar phải luôn hiển thị khi có audio đang phát (kể cả khi navigate screen)

### 7.7 Reliability

- **NFR-REL-001:** Narration PHẢI dừng ngay khi EXIT_EVENT — không được trễ hơn 500ms
- **NFR-REL-002:** System KHÔNG ĐƯỢC phát 2 narration cùng lúc (Single Voice Rule)
- **NFR-REL-003:** Crash rate phải < 0.5% sessions trên production
- **NFR-REL-004:** Atomic SQLite write khi sync — không bao giờ để database ở trạng thái partial
- **NFR-REL-005:** Analytics buffer phải được flush định kỳ, không mất dù app crash

### 7.8 Compatibility

- **NFR-COMP-001:** Hỗ trợ iOS 14+ và Android 10+ (API level 29+)
- **NFR-COMP-002:** Hỗ trợ thiết bị có RAM ≥ 2GB
- **NFR-COMP-003:** TTS phải kiểm tra và fallback gracefully nếu locale không được hỗ trợ
- **NFR-COMP-004:** Background location phải hoạt động trên cả iOS (Background Modes) và Android (Foreground Service)
