## 1. Backend Design

### 1.1 Tổng quan hệ thống

- Ứng dụng: **Mobile App (React Native - Expo)**
- Backend: **Node.js + Express (TypeScript)**
- Database chính: **PostgreSQL** (with PostGIS)
- Cache: **Redis** (Caching query, geofence data)
- Database Offline (Mobile): **SQLite** (Content Layer sync)
- Triển khai: **Cloud Managed Services** (AWS RDS / Azure Database for PostgreSQL)

Hệ thống gồm 2 phân hệ chính:
1. Mobile Navigation App (Expo)
2. Admin/Content Management & Backend API

---

### 1.2 Data & Pipeline

#### POI Data
- Phục vụ **10 POI (phase hiện tại)**
- Dữ liệu gồm:
  - Text mô tả
  - Toạ độ GPS
  - Proximity range
  - Ảnh thumbnail

#### Pipeline xử lý dữ liệu

```
CMS / Admin Panel
  → Backend API (Node.js)
    → PostgreSQL (PostGIS)
      → Mobile App sync (Offline SQLite)
```

- Text POI được **dịch cho đúng 15 ngôn ngữ**
- Audio: **Sinh realtime bằng On-device TTS**. Backend chỉ lưu trữ text content.

---

### 1.3 Route & Navigation Logic

- Mỗi bản đồ tour được biểu diễn bằng **Adjacency Matrix**
- Các điểm POI custom được lưu trong database riêng
- Thuật toán:
  - **Shortest Path Algorithm** để tìm đường đi ngắn nhất giữa các POI

---

### 1.4 Monitoring & Observability

- Công cụ:
  - Grafana
  - Prometheus
  - Pushgateway
- Theo dõi:
  - Metric hệ thống mặc định
  - Trạng thái container
  - Hiệu năng backend
