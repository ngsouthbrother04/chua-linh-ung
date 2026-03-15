# Chùa Linh Ứng - Location-Based Auto-Narration System

**Môn học Seminar chuyên đề**

**Nhóm thực hiện: 22**

---

## 📖 Giới thiệu Dự án

Đây là mã nguồn và tài liệu thiết kế cho hệ thống **Thuyết minh tự động dựa trên vị trí (Location-Based Auto-Narration System)** triển khai tại khu du lịch Chùa Linh Ứng.

## 🚀 Getting Started (Hướng dẫn Cài đặt)

### 1. Yêu cầu Hệ thống (Prerequisites)
Để chạy dự án này, bạn cần cài đặt:
- **Node.js**: Phiên bản 20+.
- **Docker Desktop**: Để chạy Database (PostgreSQL + Redis).
- **Expo Go**: Cài trên điện thoại (iOS/Android) để chạy thử Mobile App.

### 2. Cài đặt (Installation)

Clone repository và cài đặt thư viện cho toàn bộ dự án:

```bash
git clone https://github.com/ngsouthbrother04/chua-linh-ung.git
npm install
```

### 3. Chạy Ứng dụng

Dự án được cấu hình sẵn các lệnh tiện lợi tại thư mục gốc (`root`):

**Bước 1: Khởi động Database**
Chạy PostgreSQL (Cổng 5433) và Redis (Cổng 6379) qua Docker:
```bash
npm run db:up
```

**Bước 2: Chạy Backend API**
Backend sẽ chạy tại `http://localhost:3000`.
```bash
npm run dev:backend
```

**Bước 3: Chạy Mobile App**
Sử dụng Expo để chạy ứng dụng trên thiết bị thật hoặc máy ảo:
```bash
npm run dev:mobile
```
*Sau khi chạy lênh, quét mã QR hiển thị trên Terminal bằng ứng dụng Expo Go.*

---

## 🏗️ Tài liệu & Cấu trúc

Dự án tuân thủ quy trình phát triển phần mềm chặt chẽ với hệ thống tài liệu đầy đủ:

### 1. Tài liệu Cốt lõi
- **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**: Bản thiết kế kiến trúc kỹ thuật chi tiết.

- **[`AI_GUIDELINES.md`](./AI_GUIDELINES.md)**: Các ràng buộc và nguyên tắc bất di bất dịch của hệ thống (Offline-first, Geofence priority).

- **[`SPEC_CANONICAL.md`](./SPEC_CANONICAL.md)**: Nguồn chuẩn duy nhất cho invariant, state machine, timing defaults, và quy tắc xử lý mâu thuẫn tài liệu.

### 2. Thiết kế & Yêu cầu
- **[`docs/user/prd/index.md`](./docs/user/prd/index.md)**: Product Requirements Document - điểm vào chuẩn cho toàn bộ bộ PRD.

- **[`docs/backend_design.md`](./docs/backend_design.md)**: Thiết kế hệ thống Backend, Database Schema và Data Pipeline.

- **[`USE_CASES.md`](./USE_CASES.md)**: Chi tiết các Use Case của hệ thống.

- **[`USE_CASE_MAPPING.md`](./USE_CASE_MAPPING.md)**: Bảng ánh xạ giữa Use Case ↔ Test Scenario ↔ Architecture Component.

### 3. Kiểm thử
- **[`docs/test_scenarios.md`](./docs/test_scenarios.md)**: Các kịch bản kiểm thử cho từng phân hệ.

## 🤖 AI/Agent Start Here

Để các AI agents khác nhau (Copilot, Claude, Cursor, Gemini...) đọc cùng một ngữ cảnh, vui lòng theo thứ tự:

1. **[`TEAM_START_HERE.md`](./TEAM_START_HERE.md)**
2. **[`SPEC_CANONICAL.md`](./SPEC_CANONICAL.md)**
3. **[`docs/user/prd/index.md`](./docs/user/prd/index.md)**
4. **[`IMPLEMENTATION_TASK_BREAKDOWN.md`](./IMPLEMENTATION_TASK_BREAKDOWN.md)**
5. **[`EXECUTION_TODO_ISSUES.md`](./EXECUTION_TODO_ISSUES.md)**

Kiểm tra nhanh lệch tài liệu admin/user PRD:

```bash
npm run docs:check-prd-sync
```

## 🛠️ Tech Stack

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
