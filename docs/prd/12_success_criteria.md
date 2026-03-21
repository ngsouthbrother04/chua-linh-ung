# Section 16: Success Criteria & Acceptance

← [Back to Index](index.md)

---

## 16. Success Criteria

### 16.1 MVP Launch Checklist

Tất cả các mục dưới đây phải đạt ✅ trước khi Go Live:

**Authentication & Authorization:**
- [ ] User hoàn thành thanh toán VNPay/Momo và nhận được JWT token trong vòng 30 giây
- [ ] User nhập claim code hợp lệ → vào được nội dung ngay lập tức
- [ ] JWT token được lưu encrypted trong expo-secure-store
- [ ] Token hết hạn → user bị đưa về màn hình Auth với thông báo rõ ràng
- [ ] Claim Code đã dùng → báo lỗi rõ ràng, không crash

**GPS & Geofence Engine:**
- [ ] Bật Location Permission → GPS bắt đầu tracking trong vòng 5 giây
- [ ] Bước vào polygon POI → narration tự động bắt đầu trong vòng 3 giây
- [ ] Bước ra khỏi polygon POI → narration dừng trong vòng 3 giây
- [ ] Geofence cooldown mặc định 10 giây hoạt động đúng: không re-trigger POI vừa rời
- [ ] Fast-movement (>30km/h) → không trigger narration
- [ ] App ở background → GPS tracking vẫn hoạt động (chạy test 10 phút)

**QR Code:**
- [ ] Quét QR code của POI → mở narration đúng nội dung
- [ ] QR code không hợp lệ → thông báo lỗi user-friendly, không crash
- [ ] QR Mode hoạt động khi offline (POI data đã sync)

**Language & Playback:**
- [ ] Chuyển ngôn ngữ → narration tiếp theo dùng ngôn ngữ mới
- [ ] Nút Play/Pause/Stop hoạt động đúng
- [ ] Narration kết thúc tự nhiên → state chuyển sang COOLDOWN
- [ ] Thiết bị không có TTS voice cho ngôn ngữ chọn → fallback tiếng Anh

**Offline Functionality:**
- [ ] Sau sync lần đầu, tắt internet → app vẫn hiển thị POI, map, nội dung đầy đủ
- [ ] Offline → không crash, hiển thị banner "Đang dùng dữ liệu offline"
- [ ] Reconnect internet → tự động kiểm tra version update

**Tour:**
- [ ] Danh sách tour load từ SQLite khi offline
- [ ] Tour detail hiển thị route và các POI theo thứ tự
- [ ] "Bắt đầu tham quan" → GPS mode active, highlight POI tiếp theo

### 16.2 Testing Requirements

**Manual Testing Scenarios:**

| Scenario | Test Method | Expected Result |
|----------|------------|----------------|
| GPS Walk-through | Thực địa / GPS Simulation | Narration trigger/stop đúng polygon |
| GPS Accuracy | Simulate 30m accuracy thấp | Debounce hoạt động, no false positive |
| Background GPS | Lock screen 10 phút | Tracking vẫn active |
| TTS Language Switch | Chuyển VI → EN → ZH | Voice đổi ngay narration tiếp theo |
| Offline Mode | Airplane mode sau sync | Full functionality retained |
| QR Scan | Dùng mã QR thật | Narration đúng POI |
| Payment Flow | Test VNPay sandbox | Token nhận được, redirect đúng |
| Claim Code | Valid và invalid codes | Correct success/error states |
| Large Movement | Speed > 30km/h | No narration trigger |
| Re-enter POI | Vào lại trong 10s cooldown | Không re-trigger |
| Re-enter POI | Vào lại sau 30s replay window | Replay bình thường |
| App Kill + Reopen | Force kill app, relaunch | State reset sạch, không crash |

**Automated Testing Targets:**

- Unit test Geofence Engine (Ray-Casting với polygon test datasets)
- Unit test Narration State Machine (all state transitions)
- Unit test Claim Code validation logic
- Integration test Sync flow (manifest → full download → SQLite write)
- E2E test (Detox): Auth flow, Language selection, QR scan mock

### 16.3 Performance Benchmarks

| Metric | Minimum | Target |
|--------|---------|--------|
| App cold start time | < 5s | < 3s |
| Geofence detection latency | < 5s | < 3s |
| Initial sync duration (standard dataset) | < 60s | < 30s |
| SQLite query for POI list | < 500ms | < 200ms |
| TTS speech start latency | < 2s | < 1s |
| Battery drain per hour (active use) | < 15% | < 10% |

### 16.4 Go-Live Criteria

1. **Zero P0 bugs** tại thời điểm launch
2. **Core flow** (Pay/Claim → Sync → GPS → Narration) pass 100% manual test
3. **Performance benchmarks** đạt Target trên thiết bị mục tiêu (mid-range 2022)
4. **Privacy & Security review** pass: không có PII trong analytics, token encrypted at rest
5. **Beta test** với 10 khách thật tại thực địa chùa Linh Ứng: satisfaction ≥ 4/5
