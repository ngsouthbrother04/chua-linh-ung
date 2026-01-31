# Chùa Linh Ứng - Location-Based Auto-Narration System

**Đồ án Môn học**
**Nhóm thực hiện**: 22

---

## 📖 Giới thiệu Dự án

Đây là mã nguồn và tài liệu thiết kế cho hệ thống **Thuyết minh tự động dựa trên vị trí (Location-Based Auto-Narration System)** triển khai tại khu du lịch Chùa Linh Ứng.

Hệ thống giải quyết vấn đề thiếu hướng dẫn viên và rào cản ngôn ngữ bằng cách cung cấp trải nghiệm du lịch tự túc thông minh. Ứng dụng di động sẽ tự động phát nội dung thuyết minh (TTS) khi du khách đi vào vùng địa lý (Geofence) của các điểm tham quan (POI).

## 🏗️ Tài liệu & Cấu trúc

Dự án tuân thủ quy trình phát triển phần mềm chặt chẽ với hệ thống tài liệu đầy đủ:

### 1. Tài liệu Cốt lõi
- **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**: Bản thiết kế kiến trúc kỹ thuật chi tiết (Master Blueprint). Mô tả Topology, Tech Stack (React Native/Node.js/PostgreSQL), và các thuật toán cốt lõi.
- **[`AI_GUIDELINES.md`](./AI_GUIDELINES.md)**: Các ràng buộc và nguyên tắc bất di bất dịch của hệ thống (Offline-first, Geofence priority).

### 2. Thiết kế & Yêu cầu
- **[`docs/prd.md`](./docs/prd.md)**: Product Requirements Document - Yêu cầu sản phẩm và luồng nghiệp vụ.
- **[`docs/backend_design.md`](./docs/backend_design.md)**: Thiết kế hệ thống Backend, Database Schema và Data Pipeline.
- **[`USE_CASES.md`](./USE_CASES.md)**: Chi tiết các Use Case (nghiệp vụ) của hệ thống.
- **[`USE_CASE_MAPPING.md`](./USE_CASE_MAPPING.md)**: Bảng ánh xạ (Traceability Matrix) giữa Use Case ↔ Test Scenario ↔ Architecture Component.

### 3. Kiểm thử
- **[`docs/test_scenarios.md`](./docs/test_scenarios.md)**: Các kịch bản kiểm thử (Test Scenarios) cho từng phân hệ.

## 🛠️ Technology Stack

Hệ thống được xây dựng trên các công nghệ hiện đại, tối ưu cho khả năng hoạt động Offline và mở rộng:

- **Mobile App**:
  - Framework: **React Native** (Expo Managed Workflow).
  - Offline Database: **SQLite**.
  - Audio Engine: **On-device TTS** (`expo-speech`).
  - Maps & Location: `expo-location`, `react-native-maps`.

- **Backend System**:
  - Runtime: **Node.js** + **Express** (TypeScript).
  - Database: **PostgreSQL** (với **PostGIS** extension cho xử lý không gian).
  - Caching: **Redis**.

- **Payment & Security**:
  - Payment Gateway: **VNPay** / **Momo**.
  - Authentication: Claim Code (Offline) & JWT.

---
*Submission by Group 22*
