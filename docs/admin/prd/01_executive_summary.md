# Sections 1–2: Executive Summary & Scope

← [Back to Index](index.md)

---

## 1. Executive Summary

### 1.1 Overview

Chùa Linh Ứng Visitor App là ứng dụng di động (React Native / Expo) cung cấp trải nghiệm tham quan tự hướng dẫn tại khu di tích Chùa Linh Ứng. Hệ thống tự động phát thuyết minh theo vị trí GPS của khách, hỗ trợ đa ngôn ngữ và hoạt động hoàn toàn offline sau khi xác thực.

### 1.2 Goals

**Primary Goal:** Cung cấp trải nghiệm thuyết minh tự động, chính xác theo vị trí địa lý, giúp khách tham quan khám phá khu di tích mà không cần hướng dẫn viên.

**Secondary Goals:**

- Hỗ trợ đa ngôn ngữ (15+ ngôn ngữ) để phục vụ khách quốc tế
- Hoạt động offline hoàn toàn sau khi đồng bộ dữ liệu ban đầu
- Đảm bảo tính chính xác không gian: thuyết minh đúng vị trí, đúng điểm tham quan
- Cho phép kích hoạt thủ công qua QR code như phương thức dự phòng
- Cung cấp chế độ Tour có hướng dẫn lộ trình trực quan

### 1.3 Core Principle

> **Correct narration at the correct physical location is more important than narration completeness.**
>
> *(AI_GUIDELINES.md – System Identity)*

---

## 2. Scope Definition

### 2.1 In-Scope (MVP v1.0)

#### Module 1: Xác thực & Truy cập (UC1)

- Thanh toán qua VNPay hoặc Momo (WebView redirect)
- Nhập mã claim code / OTP offline (mua vé tại quầy)
- Đồng bộ toàn bộ dữ liệu POI xuống thiết bị sau xác thực (One-Load Pattern)
- Lưu trữ nội dung offline vào SQLite

#### Module 2: Thuyết minh Tự động theo GPS (UC2)

- Theo dõi vị trí GPS foreground & background
- Phát hiện enter/exit POI geofence bằng Ray-Casting Algorithm
- Tự động phát thuyết minh bằng TTS (expo-speech) khi vào geofence
- Dừng thuyết minh ngay lập tức khi rời geofence
- Xử lý chuyển điểm nhanh (interrupt + switch)
- Debounce để tránh kích hoạt sai vùng biên

#### Module 3: Kích hoạt Thủ công qua QR (UC3)

- Quét mã QR trên biển bảng tại điểm tham quan
- Tra cứu nội dung từ SQLite theo POI ID
- Phát thuyết minh thủ công cho điểm được chọn
- Áp dụng quy tắc "một giọng đọc tại một thời điểm"

#### Module 4: Chọn Ngôn ngữ & Điều khiển Phát (UC4)

- Chọn ngôn ngữ thuyết minh (15+ ngôn ngữ)
- Thay đổi ngôn ngữ ảnh hưởng text, giọng TTS và UI labels
- Play / Pause thuyết minh
- Hiển thị trạng thái phát hiện tại

#### Module 5: Xem Tour & Khám phá có Hướng dẫn (UC5)

- Xem danh sách các Tour được biên tập sẵn
- Hiển thị lộ trình tour trên bản đồ (polyline)
- Tự động phát thuyết minh khi di chuyển theo lộ trình (tích hợp UC2)
- Xem thứ tự POI trong tour và trạng thái đã/chưa ghé thăm

### 2.2 Out-of-Scope (Future Enhancements)

Các tính năng sau **không được bao gồm** trong MVP v1.0:

- AI Q&A / Chatbot hỗ trợ khách hỏi đáp (đã loại bỏ)
- Upload ảnh / review của khách tham quan
- Social sharing (chia sẻ mạng xã hội)
- Đặt trước vé online (chỉ thanh toán tại chỗ)
- Thông báo push (push notifications)
- Chức năng lưu lịch sử tham quan giữa các phiên
- Bản đồ 3D hoặc AR navigation
- Tải âm thanh MP3 có sẵn (chỉ dùng on-device TTS)
- Admin features (xem admin PRD riêng)
- Realtime cập nhật POI trong phiên tham quan
- Routing / chỉ đường tự động giữa các POI
