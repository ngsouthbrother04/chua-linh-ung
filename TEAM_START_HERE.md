# Team Start Here

Tài liệu onboarding nhanh cho teammate làm FE web cần cài đặt và chạy Backend server local.

Mục tiêu: FE có thể tự khởi động API để phát triển và test luồng web mà không cần chờ BE hỗ trợ thủ công.

## 1) Yêu cầu môi trường

- Node.js 20+
- Docker Desktop (để chạy PostgreSQL + Redis)
- npm

Kiểm tra nhanh:

```bash
node -v
docker -v
```

## 2) Cài dependencies

Chạy tại thư mục root project:

```bash
npm install
cd apps/backend && npm install
```

Lý do: dự án chưa cấu hình workspace package manager tập trung, nên backend cần cài dependency riêng.

## 3) Chuẩn bị biến môi trường Backend

Trong `apps/backend`:

```bash
cp .env.example .env
```

Giữ mặc định là đủ để chạy local với Docker compose hiện tại:

- `DATABASE_URL=postgresql://admin:password123@localhost:5433/pho_am_thuc?schema=public`
- `REDIS_URL=""` (để fallback in-memory queue)

Nếu cần chạy queue bằng Redis thật, đặt:

```env
REDIS_URL="redis://localhost:6379"
```

## 4) Khởi động database services

Tại root project:

```bash
npm run db:up
```

Lệnh này sẽ chạy:

- PostgreSQL: `localhost:5433`
- Redis: `localhost:6379`

## 5) Migrate + generate client + seed data (lần đầu)

Trong `apps/backend`:

```bash
npm run db:setup
```

`db:setup` gồm:

1. `prisma migrate deploy`
2. `prisma generate`
3. `prisma seed`

## 5.1) Cài Piper TTS trên Windows cho API generate TTS (triệt để rủi ro)

Kết luận cho teammate Windows:

- Dễ nhất và ổn định nhất cho onboarding: cài bằng `pip`.
- Không dùng `cmake` cho luồng cài nhanh của team (cmake chỉ dành cho trường hợp cần build từ source).

Để loại bỏ triệt để lỗi PATH và lỗi link model, repo đã có script tự động:

- `apps/backend/scripts/setup-piper-windows.ps1`

Script này sẽ làm toàn bộ theo đúng `TTS_SUPPORTED_LANGUAGES` trong `apps/backend/.env`:

1. Cài `piper-tts` bằng pip.
2. Tự dò `piper.exe` thực tế trên máy.
3. Tải model cho từng ngôn ngữ đang cấu hình, ví dụ hiện tại: `vi,en,fr,de,es,pt,ru,zh,id,hi,ar,tr`.
4. Chạy smoke test sinh file WAV để xác nhận Piper dùng được.
5. Tự cập nhật `apps/backend/.env` với `PIPER_BIN`, `PIPER_MODEL_DIR`, `PIPER_MODEL_MAP`.

### Bước A - Kiểm tra Python launcher

Mở PowerShell:

```powershell
py --version
py -m pip --version
```

Nếu chưa có, cài Python 3.11 hoặc 3.12 từ python.org, nhớ bật `Add python.exe to PATH`.

### Bước B - Chạy script cài đặt tự động (khuyến nghị)

Chạy tại root project:

```powershell
powershell -ExecutionPolicy Bypass -File .\apps\backend\scripts\setup-piper-windows.ps1
```

Khi thành công, script in ra:

- đường dẫn `piper.exe` đã resolve
- danh sách ngôn ngữ đã tải
- xác nhận cập nhật `.env`

### Bước C - Verify backend config

Trong `apps/backend`:

```bash
npm run tts:validate
```

Kết quả mong đợi: cấu hình TTS hợp lệ (không có lỗi invalid config).

### Bước D - Verify API generate TTS

1. Chạy backend:

```bash
npm run dev:backend
```

2. Dùng API admin tạo/cập nhật nội dung POI có text để trigger hàng đợi TTS.
3. Kiểm tra audio được tạo trong thư mục local provider:

- `apps/backend/public/audio`

Nếu bạn thay đổi danh sách ngôn ngữ trong `TTS_SUPPORTED_LANGUAGES`, chỉ cần chạy lại script này để tải bộ model tương ứng.

Nếu có file audio mới được sinh ra, pipeline Piper TTS đã hoạt động.

## Sơ đồ DB (Mermaid)

Sơ đồ dưới đây mô tả các bảng chính và quan hệ quan trọng để team FE nắm được luồng dữ liệu nhanh.

```mermaid
erDiagram
    CLAIM_CODES ||--o{ USERS : "claim_code_id"
    USERS ||--o{ AUTH_SESSIONS : "user_id"
    USERS ||--o{ PAYMENT_TRANSACTIONS : "user_id"
    PAYMENT_TRANSACTIONS ||--o{ PAYMENT_CALLBACK_EVENTS : "transaction_id"
    POINTS_OF_INTEREST ||--o{ ANALYTICS_EVENTS : "poi_id"

    POINTS_OF_INTEREST {
        uuid id PK
        json name
        json description
        json audio_urls
        decimal latitude
        decimal longitude
        enum type
        bool is_published
        int content_version
    }

    TOURS {
        uuid id PK
        json name
        json description
        json poi_ids
        bool is_published
        int content_version
    }

    ANALYTICS_EVENTS {
        bigint id PK
        string device_id
        string session_id
        uuid poi_id FK
        enum action
        bigint timestamp
        bool uploaded
    }

    CLAIM_CODES {
        uuid id PK
        string code UK
        bool is_active
        bool is_used
        int current_uses
    }

    USERS {
        uuid id PK
        string email UK
        enum role
        uuid claim_code_id FK
        bool is_active
        datetime token_invalid_before
    }

    AUTH_SESSIONS {
        uuid id PK
        uuid user_id FK
        string device_id
        string refresh_token_hash UK
        string access_token_jti UK
        datetime expires_at
        datetime revoked_at
    }

    PAYMENT_TRANSACTIONS {
        uuid id PK
        uuid user_id FK
        string transaction_id UK
        enum provider
        enum status
        int amount
        string payment_url
        datetime expires_at
    }

    PAYMENT_CALLBACK_EVENTS {
        uuid id PK
        string idempotency_key UK
        string transaction_id FK
        enum provider
        enum status
        bool processed
    }

    APP_SETTINGS {
        int id PK
        int current_version
        string data_checksum
        string media_base_path
    }

    SYNC_CHANGE_LOGS {
        bigint id PK
        enum entity_type
        string entity_id
        enum action
        int content_version
    }

    ANALYTICS_PRESENCE {
        string device_id PK
        string session_id
        string language
        datetime last_heartbeat_at
    }
```

Ghi chú:

- `TOURS.poi_ids` là JSON list id của POI, không phải foreign key trực tiếp.
- `APP_SETTINGS`, `SYNC_CHANGE_LOGS`, `ANALYTICS_PRESENCE` là các bảng độc lập (không khai báo relation FK trong Prisma hiện tại).

## 6) Chạy Backend server

Chạy từ root (khuyến nghị):

```bash
npm run dev:backend
```

Hoặc chạy trực tiếp trong backend:

```bash
cd apps/backend
npm run dev
```

API mặc định tại: `http://localhost:3000`

## 7) Verify backend đã chạy đúng

Mở trình duyệt hoặc curl:

```bash
curl http://localhost:3000/
```

Kết quả mong đợi có:

- `message: "Backend is running!"`
- `db_status: "Connected"`

Xem API docs:

- `http://localhost:3000/api-docs`

## 8) Lỗi thường gặp

1. `P1001` / không connect được DB:
    - Kiểm tra Docker đã bật
    - Chạy lại `npm run db:up`
    - Xác nhận port `5433` chưa bị chiếm

2. Backend chạy nhưng lỗi env:
    - Kiểm tra đã có file `apps/backend/.env`
    - Nếu mới pull code: chạy lại `cp .env.example .env`

3. Lỗi Prisma client:
    - Chạy `cd apps/backend && npm run prisma:generate`

4. FE gọi API không được:
    - Kiểm tra base URL FE đang trỏ đúng `http://localhost:3000`
    - Nếu chạy trên device thật, không dùng `localhost`, dùng IP LAN máy dev

## 9) Tài liệu cần đọc thêm (khi cần)

1. README.md
2. SPEC_CANONICAL.md
3. AI_GUIDELINES.md
4. ARCHITECTURE.md
5. docs/backend_design.md
6. docs/database_design.md
7. USE_CASES.md
8. docs/test_scenarios.md

## Lưu ý sản phẩm quan trọng

- Không auto-play theo GPS/geofence
- Audio chỉ phát khi user Tap POI hoặc scan QR
- Không dùng on-device TTS generation

## 10 Hướng dẫn chạy Mobile App (Expo)

## Bước A - Cấu hình kết nối API
Để Mobile App kết nối được với Backend đang chạy trên máy tính:

Xác định địa chỉ IPv4 của máy tính (Gõ ipconfig trên Windows hoặc ifconfig trên Mac). Ví dụ: 192.168.1.15.

Mở file apps/mobile/api/api.js.

Cập nhật baseURL thành địa chỉ IP của máy dev:

JavaScript
baseURL: "http://192.168.1.15:3000"
(Lưu ý: Điện thoại và máy tính phải bắt chung một mạng WiFi).

## Bước B - Cài đặt thư viện bổ sung (Nếu cần)
Nếu project có thay đổi các module native, chạy lệnh:

Bash
cd apps/mobile
npx expo install expo-speech react-native-maps expo-camera @react-native-async-storage/async-storage
npm install axios translate-google-api i18next react-i18next
## Bước C - Khởi chạy Expo Server
Tại thư mục apps/mobile:

Bash
npx expo start -c
(Lệnh -c giúp xóa cache cũ để đảm bảo các tính năng QR Scanner và Map hoạt động đúng).

## Bước D - Mở App trên thiết bị
Mở ứng dụng Expo Go trên điện thoại.

Quét mã QR hiện trên Terminal máy tính.

Nếu dùng trình giả lập (Simulator/Emulator), nhấn i (iOS) hoặc a (Android) trên bàn phím máy tính.

## chú ý 
Đảm bảo mạng điện thoại và máy tính phải cùng dùng chung!
