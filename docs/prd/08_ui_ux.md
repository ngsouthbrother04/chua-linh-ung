# Section 10: UI/UX Specifications

← [Back to Index](index.md)

---

## 10. UI/UX Specifications

### 10.1 Design System

**Color Palette:**

- Primary: Deep Saffron (`#F59E0B` / amber-500) — màu liên tưởng đến văn hóa Phật giáo
- Secondary: Forest Green (`#059669` / emerald-600) — màu tự nhiên
- Neutral: Slate (`#64748B` / slate-500)
- Error: Red (`#EF4444` / red-500)
- Success: Green (`#10B981`)
- Background: Warm White (`#FAFAF8`)

**Typography:**

- Font: System font (iOS: SF Pro, Android: Roboto)
- CJK hỗ trợ: Fallback tự nhiên từ system font
- Headings: Bold, 700 weight
- Body: Regular, 400 weight
- Caption: 12px, slate-500

**Spacing:**

- Dùng RN StyleSheet scale: 4, 8, 12, 16, 20, 24, 32
- Safe area insets phải được tôn trọng (top notch, bottom home indicator)

---

### 10.2 Navigation Structure

```
App Navigator
├── Auth Stack (chưa đăng nhập)
│   ├── WelcomeScreen      — Chọn VNPay/Momo/ClaimCode
│   ├── PaymentWebView     — WebView thanh toán
│   ├── ClaimCodeScreen    — Nhập mã vé
│   └── SyncScreen         — Màn hình loading sync data
│
└── Main Tab Navigator (đã đăng nhập)
    ├── Map Tab            — Bản đồ tổng quan POI + vị trí khách
    ├── Tour Tab           — Danh sách tour
    └── Settings Tab       — Ngôn ngữ, âm lượng, thông tin app
```

---

### 10.3 Screen Specifications

#### WelcomeScreen

- Background: ảnh Chùa Linh Ứng (full-screen với overlay gradient)
- Logo và tên chùa ở giữa
- 2 nút lớn: "Mua vé online" và "Nhập mã vé"
- Nút nhỏ "Chọn ngôn ngữ" góc trên phải
- Nút "Xem trước bản đồ" (không cần đăng nhập, read-only map)

#### MapScreen (Tab chính)

- **Full-screen map** (MapView của react-native-maps hoặc tương đương offline)
- **Floating Player Bar** (bottom, fixed): hiển thị khi đang phát narration
  - Tên POI + progress indicator
  - Play/Pause, Skip
- **Floating Action Buttons** (bottom-right):
  - 📷 QR Scan button
  - 📍 My Location button
- **Language icon** (top-right)
- **POI Markers:** circle markers với màu theo loại
- **Bottom Sheet** khi tap POI marker: ảnh + tên + mô tả ngắn + "Nghe thuyết minh"

#### TourListScreen

- Card grid (1 cột trên phone)
- Mỗi card: ảnh bìa 16:9, tên tour, số điểm, thời gian ước tính
- Tap card → TourDetailScreen

#### TourDetailScreen

- Full-screen map với polyline lộ trình
- POI markers số thứ tự
- Bottom panel (scrollable): danh sách POI theo thứ tự
  - Mỗi item: số thứ tự, tên, trạng thái đã/chưa ghé
- Nút "Bắt đầu Tour" (phát sáng khi chưa active)
- Nút "Thoát Tour" khi đang active

#### SettingsScreen

- Chọn ngôn ngữ (danh sách với quốc kỳ)
- Âm lượng TTS slider
- Bật/tắt Auto-Narration
- Thông tin app (version, sync date)
- Nút "Đồng bộ lại nội dung" (manual re-sync)
- Nút "Đăng xuất"

---

### 10.4 Component Patterns

**Primary Button:**

```
backgroundColor: amber-500
color: white
borderRadius: 12
paddingVertical: 16
paddingHorizontal: 24
fontSize: 16, fontWeight: '700'
```

**Secondary Button:**

```
backgroundColor: transparent
borderWidth: 1.5
borderColor: amber-500
color: amber-500
```

**POI Bottom Sheet:**

```
height: 40% of screen
borderTopLeftRadius: 20
borderTopRightRadius: 20
backgroundColor: white
shadow: elevation 8 (Android) / shadow (iOS)
```

**Player Bar:**

```
position: absolute, bottom: 0
height: 72px + safeAreaInsets.bottom
backgroundColor: white
borderTopWidth: 1, borderColor: slate-100
```

**Toast Notification:**

```
position: absolute, top: safeAreaInsets.top + 8
duration: 2000ms
backgroundColor: rgba(0,0,0,0.75)
color: white
borderRadius: 8
```

---

### 10.5 Loading States

**Sync Screen:**

```
[Logo]
"Đang tải nội dung tham quan..."
[ProgressBar: X / totalPois POI]
"Lần đầu tiên cần khoảng 30 giây"
```

**Map Loading:**

- Map tiles: hiển thị skeleton / placeholder khi chưa có
- POI markers: fade in sau khi load xong SQLite

---

### 10.6 Empty & Error States

**No GPS Permission:**

```
[Icon: MapPinOff]
"Ứng dụng cần quyền truy cập vị trí để tự động phát thuyết minh."
[Button: "Cấp quyền"] [Button: "Dùng QR thủ công"]
```

**No Internet (first sync):**

```
[Icon: WifiOff]
"Cần kết nối mạng để tải nội dung lần đầu."
[Button: "Thử lại"]
```

**Claim Code Invalid:**

```
[Inline error below input field]
"Mã vé không hợp lệ hoặc đã được sử dụng."
```

**QR Not Found:**

```
[Toast]
"Không tìm thấy thông tin điểm tham quan này."
```

**TTS Language Not Available:**

```
[Banner below language selector]
"Giọng đọc tiếng [X] không khả dụng trên thiết bị này. Đang dùng tiếng Anh."
```

---

### 10.7 Accessibility

- **NFR-ACC-001:** Tất cả buttons phải có `accessibilityLabel`
- **NFR-ACC-002:** Font size tối thiểu 14px (body), 12px (caption)
- **NFR-ACC-003:** Contrast ratio ≥ 4.5:1 cho text trên nền
- **NFR-ACC-004:** Player controls phải có hit area ≥ 44×44 pts (Apple HIG)
