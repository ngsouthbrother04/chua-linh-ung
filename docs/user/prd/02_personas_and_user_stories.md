# Sections 3–4: User Personas & User Stories

← [Back to Index](index.md)

---

## 3. User Personas & Roles

### 3.1 Primary Persona: Khách tham quan nội địa

| Field | Value |
|-------|-------|
| Tên đại diện | Lan Anh |
| Vai trò | Du khách trong nước |
| Độ tuổi | 20–50 |
| Trình độ kỹ thuật | Trung bình (dùng smartphone hàng ngày) |
| Ngôn ngữ | Tiếng Việt |

**Goals:**

- Tìm hiểu về lịch sử và văn hóa Chùa Linh Ứng
- Không muốn phụ thuộc vào hướng dẫn viên
- Trải nghiệm tham quan linh hoạt theo nhịp cá nhân

**Pain Points:**

- Biển thông tin tại di tích thường thiếu hoặc khó đọc
- Hướng dẫn viên không phải lúc nào cũng có sẵn
- Kết nối mạng tại khu vực chùa không ổn định

**Usage Patterns:**

- Tham quan 1–2 giờ mỗi lần
- Sử dụng lần đầu tại cổng (thanh toán / quét QR)
- Cầm điện thoại di chuyển vòng quanh khu di tích

---

### 3.2 Secondary Persona: Khách quốc tế

| Field | Value |
|-------|-------|
| Tên đại diện | Marco Rossi |
| Vai trò | Du khách nước ngoài |
| Độ tuổi | 25–65 |
| Trình độ kỹ thuật | Trung bình–cao |
| Ngôn ngữ | Tiếng Anh, Hàn, Nhật, Trung... |

**Goals:**

- Hiểu nội dung thuyết minh bằng ngôn ngữ mẹ đẻ
- Không có rào cản ngôn ngữ khi khám phá
- Trải nghiệm văn hóa địa phương đích thực

**Pain Points:**

- Biển bảng chỉ có tiếng Việt hoặc tiếng Anh sơ sài
- Hướng dẫn viên đa ngôn ngữ rất hiếm
- Lo ngại về kết nối mạng khi ở nước ngoài

**Usage Patterns:**

- Tham quan theo nhóm hoặc gia đình
- Cần chọn ngôn ngữ ngay khi mở app
- Hay dừng lại lâu tại các điểm chính

---

## 4. User Stories

### 4.1 User Stories Table

| ID | Module | User Story | Priority | Acceptance Criteria ID | Use Case |
|----|--------|------------|----------|------------------------|----------|
| US-001 | Auth | As a Visitor, I want to pay via VNPay/Momo so that I can unlock access to the app | P0 (Must) | AC-001 | UC1 |
| US-002 | Auth | As a Visitor, I want to enter a claim code so that I can access the app when buying ticket at the counter | P0 (Must) | AC-002 | UC1 |
| US-003 | Auth | As a Visitor, I want all POI content to be downloaded once so that the app works offline | P0 (Must) | AC-003 | UC1 |
| US-004 | GPS | As a Visitor, I want narration to start automatically when I enter a POI area so that I don't have to do anything manually | P0 (Must) | AC-004 | UC2 |
| US-005 | GPS | As a Visitor, I want narration to stop when I leave a POI area so that I don't hear wrong content | P0 (Must) | AC-005 | UC2 |
| US-006 | GPS | As a Visitor, I want the app to switch narration automatically when I move to another POI so that transitions are seamless | P0 (Must) | AC-006 | UC2 |
| US-007 | GPS | As a Visitor, I want the app to handle GPS instability gracefully so that false triggers don't interrupt my experience | P1 (Should) | AC-007 | UC2 |
| US-008 | QR | As a Visitor, I want to scan a QR code to trigger narration manually so that I can activate it even without GPS | P0 (Must) | AC-008 | UC3 |
| US-009 | Language | As a Visitor, I want to select my preferred language so that I hear narration in my native language | P0 (Must) | AC-009 | UC4 |
| US-010 | Language | As a Visitor, I want the UI labels to also change when I switch language so that everything is consistent | P1 (Should) | AC-010 | UC4 |
| US-011 | Playback | As a Visitor, I want to pause and resume narration so that I can take photos or make phone calls | P0 (Must) | AC-011 | UC4 |
| US-012 | Playback | As a Visitor, I want to see what POI is currently being narrated so that I know where I am | P1 (Should) | AC-012 | UC4 |
| US-013 | Tour | As a Visitor, I want to view available Tour routes so that I can choose a guided itinerary | P0 (Must) | AC-013 | UC5 |
| US-014 | Tour | As a Visitor, I want to see the Tour route on a map so that I can follow it visually | P0 (Must) | AC-014 | UC5 |
| US-015 | Tour | As a Visitor, I want the tour to automatically narrate each POI as I walk so that I don't need to manually trigger anything | P0 (Must) | AC-015 | UC5 |
| US-016 | Tour | As a Visitor, I want to see my progress in the Tour so that I know which POIs I have visited | P1 (Should) | AC-016 | UC5 |
| US-017 | Map | As a Visitor, I want to see all POIs on the map so that I can plan my visit | P0 (Must) | AC-017 | UC5 |
| US-018 | Map | As a Visitor, I want to tap a POI on the map to see its name and description so that I can decide whether to visit | P1 (Should) | AC-018 | UC5 |

**Priority Legend:**

- **P0 (Must):** Critical for MVP launch; blocks release if missing
- **P1 (Should):** Important for usability; should be included if time permits
- **P2 (Could):** Nice-to-have; can be deferred to post-MVP
