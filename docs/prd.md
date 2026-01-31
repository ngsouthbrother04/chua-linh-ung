## 2. Product Requirements Document (PRD)

### 2.1 Problem Alignment

- Thiếu hướng dẫn đa ngôn ngữ cho khách tham quan
- Không có hỗ trợ tức thời khi khách có câu hỏi

---

### 2.2 Solution Overview

- **Mobile App Native (React Native - Expo)**
- Hỗ trợ GPS background & Geofencing tốt hơn Web App
- GPS hiển thị vị trí realtime
- POI có text + audio đa ngôn ngữ
- (đã loại bỏ) AI hỗ trợ Q&A

---

### 2.3 Payment Logic

- Online: **VNPay (Default) hoặc Momo** (qua WebView redirect)
- Offline: **Claim code / OTP** (mua vé tại quầy, nhập mã unlock)

Flow:
1. User quét QR
2. Chọn hình thức thanh toán
3. Xác thực thành công → mở app

---

### 2.4 Core System Logic (CRITICAL)

> **Toàn bộ database POI được load xuống frontend duy nhất 1 lần sau khi user xác thực.**

- Sau bước này:
  - App **KHÔNG gửi request fetch data nữa** (trừ khi user update content)
  - Mọi hiển thị POI / text đều đọc từ **Offline SQLite DB**
  - Audio được sinh bởi **On-device TTS** (Offline)

Ảnh hưởng:
- Performance rất cao
- Phù hợp môi trường mạng yếu
- Không hỗ trợ realtime update POI

---

### 2.5 Multilingual Logic

- Nội dung hỗ trợ **15+ ngôn ngữ**
- User chọn ngôn ngữ qua icon góc phải
- Thay đổi ngôn ngữ:
  - Text
  - Giọng đọc TTS
  - UI labels
