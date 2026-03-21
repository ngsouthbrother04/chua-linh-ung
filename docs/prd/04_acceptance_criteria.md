# Section 6: Acceptance Criteria (Given-When-Then)

← [Back to Index](index.md)

---

## 6. Acceptance Criteria (Given-When-Then)

### AC-001: Thanh toán Online (US-001)

```gherkin
GIVEN I open the app for the first time
AND I have not authenticated yet
WHEN I select "Thanh toán Online" and choose VNPay
THEN the app opens a WebView with the VNPay payment page
WHEN I complete payment successfully
THEN the app receives a deep link "chualinhung://payment-result?status=success"
AND I am redirected to the content sync screen
AND my AuthToken is stored securely
```

### AC-002: Nhập Mã Vé (US-002)

```gherkin
GIVEN I am on the authentication screen
WHEN I tap "Nhập mã vé"
AND I enter a valid 6-character claim code "ABC123"
AND I tap "Xác nhận"
THEN the app validates the code with the backend
AND on success, I proceed to the content sync screen
AND the claim code is marked as used (cannot be reused)

GIVEN I enter an invalid code "XXXXXX"
WHEN I tap "Xác nhận"
THEN I see the error "Mã vé không hợp lệ hoặc đã được sử dụng."
AND I can try again
```

### AC-003: Đồng bộ Dữ liệu Offline (US-003)

```gherkin
GIVEN I have just authenticated successfully
WHEN the app begins content sync
THEN I see a loading screen with a progress bar
WHEN sync is complete
THEN all POI data (text, coordinates, polygons, narrations) is stored in SQLite
AND I reach the main Map screen
AND subsequent sessions do NOT require re-downloading if content version is unchanged

GIVEN I have no internet connection but have previously synced data
WHEN I open the app with a valid token
THEN I bypass the sync step and go directly to the Map screen
AND I see a banner "Đang dùng nội dung cũ (ngày [last_sync_date])"
```

### AC-004: Tự động Phát Thuyết minh khi Vào POI (US-004)

```gherkin
GIVEN I am on the Map screen with GPS tracking active
AND I am outside all POI geofences
WHEN I walk into the geofence of POI "Tượng Phật Bà"
AND my GPS position is confirmed inside the polygon for 3 consecutive readings
THEN the narration for "Tượng Phật Bà" starts playing automatically in my selected language
AND I see a notification banner "Đang phát: Tượng Phật Bà"
AND no manual action is required
```

### AC-005: Dừng Thuyết minh khi Rời POI (US-005)

```gherkin
GIVEN narration for "Tượng Phật Bà" is currently playing
WHEN I walk outside the geofence boundary of "Tượng Phật Bà"
THEN the narration stops IMMEDIATELY (no delay)
AND I see a brief toast "Đã rời khỏi Tượng Phật Bà"
AND the player bar disappears or shows idle state
```

### AC-006: Chuyển Tự động sang POI Mới (US-006)

```gherkin
GIVEN narration for POI_A is playing
WHEN I walk quickly and enter the geofence of POI_B
THEN narration for POI_A stops immediately
AND narration for POI_B starts after debounce confirmation
AND there is no overlap between the two narrations
```

### AC-007: Xử lý GPS Không ổn định (US-007)

```gherkin
GIVEN I am standing near the boundary of a POI geofence
AND my GPS signal fluctuates between inside and outside
WHEN rapid enter/exit events are detected within 3 seconds
THEN the debounce mechanism prevents false narration starts
AND the system waits for 3 stable consecutive readings before triggering

GIVEN my GPS accuracy drops to > 20 meters
WHEN a geofence event would normally trigger
THEN the system logs the uncertainty
AND does NOT trigger narration until accuracy improves
```

### AC-008: Quét QR Code (US-008)

```gherkin
GIVEN I am on any screen with the QR button available
WHEN I tap the QR scan button
THEN the camera opens with a scan overlay
WHEN I point the camera at a valid POI QR code
THEN the app reads the QR, looks up the POI in SQLite
AND narration for that POI starts playing in my selected language
AND a POI info card appears with the POI name and image

GIVEN I scan a QR code for an unknown POI
THEN I see "Không tìm thấy thông tin điểm tham quan này."
```

### AC-009: Chọn Ngôn ngữ (US-009)

```gherkin
GIVEN I am on any screen
WHEN I tap the language icon in the top-right corner
THEN a language selection modal appears with 11+ options
WHEN I select "한국어 (Korean)"
THEN the UI labels switch to Korean
AND the TTS voice switches to ko-KR
AND the next triggered narration plays in Korean

GIVEN the device does not have a Korean TTS engine installed
WHEN I select Korean
THEN I see a warning "Giọng đọc tiếng Hàn không khả dụng. Sử dụng tiếng Anh."
AND narration falls back to en-US
```

### AC-010: Giao diện Đổi theo Ngôn ngữ (US-010)

```gherkin
GIVEN I have selected "Français" as my language
WHEN I view the Tour list screen
THEN all UI labels, button texts, and screen titles are displayed in French
AND POI names and descriptions reflect the French narration content
```

### AC-011: Play / Pause Thuyết minh (US-011)

```gherkin
GIVEN narration is playing for a POI
WHEN I tap the Pause button in the player bar
THEN narration pauses immediately
AND the Pause button changes to a Play button

WHEN I tap the Play button
THEN narration resumes (or restarts from beginning if resume is not supported)

GIVEN narration is paused
WHEN I walk outside the POI geofence
THEN narration stops completely (exit overrides pause state)
AND the session is marked as "exited early"
```

### AC-012: Hiển thị POI Đang Phát (US-012)

```gherkin
GIVEN narration is playing for "Chánh Điện"
WHEN I look at the bottom of the screen
THEN I see a persistent player bar showing:
  - POI name: "Chánh Điện"
  - Current language
  - Play/Pause and Skip buttons
AND the Map marker for "Chánh Điện" is highlighted
```

### AC-013: Xem Danh sách Tour (US-013)

```gherkin
GIVEN I am logged in and content is synced
WHEN I navigate to the "Tour" tab
THEN I see a list of available tours with cover image, name, POI count, and estimated duration
AND the list loads from SQLite (no network required)
```

### AC-014: Xem Lộ trình Tour trên Bản đồ (US-014)

```gherkin
GIVEN I am viewing a Tour named "Lộ trình Chính"
WHEN I tap "Xem bản đồ"
THEN I see a map with a polyline connecting all POIs in order
AND each POI is marked with a numbered pin (1, 2, 3...)
AND I can tap each pin to see the POI name and description
```

### AC-015: Thuyết minh Tự động khi Theo Tour (US-015)

```gherkin
GIVEN I have started Tour mode for "Lộ trình Chính"
WHEN I walk into the geofence of POI #1 "Cổng Chính"
THEN narration for "Cổng Chính" plays automatically
WHEN I walk to POI #2 "Chánh Điện"
THEN narration for "Chánh Điện" plays automatically
AND narration for POIs NOT in this tour does NOT trigger
```

### AC-016: Xem Tiến độ Tour (US-016)

```gherkin
GIVEN I am in Tour mode and have visited 2 of 5 POIs
WHEN I view the Tour progress panel
THEN I see 2 POIs marked as "Đã ghé" (checked)
AND 3 POIs marked as "Chưa ghé" (unchecked)
AND the progress shows "2/5 điểm"
```

### AC-017: Xem tất cả POI trên Bản đồ (US-017)

```gherkin
GIVEN I am on the Map screen
WHEN the map loads
THEN I see all POIs displayed as colored markers
AND MAIN POIs are shown in blue
AND minor POIs (WC, parking, etc.) are shown in orange
AND my current location is shown as a blue dot
```

### AC-018: Tap POI để Xem Chi tiết (US-018)

```gherkin
GIVEN I see a POI marker on the map
WHEN I tap the marker for "Giếng Cổ"
THEN a bottom sheet slides up showing:
  - POI name: "Giếng Cổ"
  - Thumbnail image
  - Short description (2 lines)
  - Button "Nghe thuyết minh"
WHEN I tap "Nghe thuyết minh"
THEN narration for "Giếng Cổ" plays in my selected language
```
