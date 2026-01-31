## 3. Test Scenarios

### Scenario 1 – Explore Mode

#### 1. Thanh toán
- App mở đúng ngôn ngữ thiết bị (To do)
- User chọn thanh toán tiền mặt
- Nhập Claim code / OTP từ nhân viên
- App chuyển sang màn hình bản đồ

#### 2. Chọn ngôn ngữ
- Chuyển sang tiếng Hàn (To do)
- Chuyển lại tiếng Việt (To do)

#### 3. Chọn POI
- Chọn POI “Chánh điện”
- Hiển thị nội dung text
- Play / Pause TTS hoạt động đúng

---

### Scenario 2 – Tour Mode

#### 1. Thanh toán
- Như Scenario 1

#### 2. Bắt đầu tour
- Hiển thị marker tour
- Khi user đến gần POI:
  - Nội dung POI tự động hiển thị
  - TTS tự động phát

---

### Scenario 3 – Critical Logic (Geofence)

#### 1. Stop-on-exit
- User đi vào vùng POI -> TTS play
- User đi ra khỏi vùng POI -> TTS stop **ngay lập tức**

#### 2. Fast Movement Interrupt
- User đi nhanh từ POI A sang POI B (Out A -> In B)
- System detect event
- TTS POI A stop
- TTS POI B play ngay lập tức (không đợi A hết)

---

### Scenario 4 – System Capabilities

#### 1. Offline Mode
- Tắt kết nối Internet (Wifi / 4G)
- Di chuyển vào vùng POI
- Nội dung Text + TTS vẫn hoạt động bình thường (Load từ local)
