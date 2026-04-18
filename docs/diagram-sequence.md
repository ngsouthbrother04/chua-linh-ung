# Sequence Diagram

Source: `auth.ts`, `pois.ts`, `tours.ts`, `sync.ts`, `partner.ts`, `admin.ts`, `poiAdminService.ts`, `ttsService.ts`, `analytics.ts`, `users.ts`, `paymentVerifier.ts`, `paymentPackageService.ts`

## USER (Khách hàng / Foodie)

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant App as Mobile/Web App
    participant API as Backend API
    participant Pay as Payment Gateway
    participant DB as Database
    participant EmailService as Email Service

    Note over U,DB: 1. Khởi tạo & Cấu hình Cá nhân
    U->>App: Mở ứng dụng / Đăng nhập
    App->>API: POST /api/v1/auth/login
    API->>DB: Đối chiếu thông tin User
    DB-->>API: Trả về Dữ liệu Hợp lệ
    API-->>App: 200 OK (access_token)

    Note over U,DB: 1.5. Sequence 1: Gửi OTP
    U->>App: User chọn Quên mật khẩu & nhập Email
    App->>API: Yêu cầu Backend gửi OTP
    API->>DB: Backend -> Database (lưu OTP)
    API->>EmailService: Backend -> Email Service (gửi mail)
    EmailService-->>U: Email -> User (nhận OTP)

    Note over U,DB: 1.6. Sequence 2: Reset Password (OTP Verification)
    U->>App: User -> App (Nhập OTP & Mật khẩu mới)
    App->>API: App -> Backend
    API->>DB: Backend -> Database (check OTP)
    API->>DB: Backend -> Database (update password)
    API-->>App: Backend -> App (Thành công)

    Note over U,DB: 2. Tải Bản đồ & Khám phá (Tap-to-play)
    App->>API: GET /api/v1/pois (Sync Cache)
    API->>DB: Truy vấn toạ độ & Meta Data
    DB-->>API: Danh sách POIs
    API-->>App: 200 OK (Trả về List Điểm đến)
    U->>App: Chạm POI trên Bản đồ / Quét QR
    App-->>U: Hiển thị Bottom Sheet thông tin quán

    Note over U,DB: 3. Yêu cầu Cấp phép & Thanh toán (Payment Domain)
    U->>App: Bấm Nghe Thuyết minh Ngoại ngữ (Premium)
    App->>API: GET /api/v1/pois/:id?language=en
    API->>DB: Kiểm tra quyền (Payment Entitlement)
    DB-->>API: Freemium User (Chưa có gói)
    API-->>App: 403 Forbidden (Yêu cầu Nâng cấp)

    U->>App: Bấm Mua Phí / Gia hạn (MoMo/VNPay)
    App->>API: POST /api/v1/auth/payment/initiate
    API->>DB: Tạo Payment Log Pending
    API-->>App: 200 OK (Trả về URL thanh toán)
    App->>Pay: Điều hướng (Redirect) tới App Thanh toán

    Pay-->>U: Người dùng thao tác trả tiền trên MoMo
    Pay->>API: POST Webhook IPN Callback
    API->>API: Xác thực Chữ ký (Verify Signature)
    API->>DB: Nâng cấp Quyền Premium, Đổi Trạng thái = SUCCESS
    API-->>Pay: 200 OK (Ghi nhận Webhook)

    Note over U,DB: 4. Lựa chọn & Phát Nội dung (Media Engine)
    U->>App: Bấm lại nút Nghe Thuyết minh
    App->>API: GET /api/v1/pois/:id?language=en
    API-->>App: 200 OK (URL Audio Ngoại ngữ)
    App->>App: Trình phát Audio phát qua loa/tai nghe
    App->>API: POST /api/v1/analytics (Ghi lại sự kiện Play)
```

## PARTNER (Đối tác / Chủ quán)

```mermaid
sequenceDiagram
    autonumber
    actor P as Partner
    participant Portal as Dashboard UI
    participant API as Partner API
    participant Img as Cloudinary (CDN)
    participant DB as Database

    Note over P,DB: 1. Xác thực Phân quyền Cơ sở
    P->>Portal: Đăng nhập Cổng Partner
    Portal->>API: POST /api/v1/auth/login
    API->>DB: Kiểm tra Role = PARTNER
    DB-->>API: Dữ liệu Cấp quyền Hợp lệ
    API-->>Portal: Trao Token Quyền Partner

    Note over P,DB: 2. Tải Media (Hình ảnh, Banner)
    P->>Portal: Tải lên Hình ảnh Quán / Món ăn
    Portal->>API: POST /api/v1/partner/pois/:id/image
    API->>Img: Upload Binary qua Cloudinary Cloud
    Img-->>API: Trả về Image URL an toàn
    API->>DB: Cập nhật URL vào Bản nháp
    API-->>Portal: 200 OK (Hoàn tất lưu file)

    Note over P,DB: 3. Khai báo Hồ sơ Sự kiện (Draft)
    P->>Portal: Điền Text, Cập nhật thông tin Quán
    Portal->>API: PUT /api/v1/partner/pois/:id
    API->>DB: Validate Dữ liệu & Lưu Bản nháp (Draft Status)
    DB-->>API: Bản ghi Updated
    API-->>Portal: 200 OK

    Note over P,DB: 4. Giao tiếp Nền tảng (Chờ Xét duyệt)
    P->>Portal: Bấm "Gửi Yêu cầu Xuất bản"
    Portal->>API: POST /api/v1/partner/pois/:id/request-publish
    API->>DB: Khởi tạo Request Tickets (Trạng thái WAITING)
    DB-->>API: Tạo Ticket thành công
    API-->>Portal: Hiển thị trạng thái "Đang chờ duyệt"
```

## ADMIN (Quản trị viên)

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    participant Client as User Client App
    participant CMS as Admin CMS
    participant Core as Master API
    participant TTS as Queue Worker (TTS)
    participant DB as Database

    Note over A,DB: 1. Cấu hình Doanh thu (Payment Domain)
    A->>CMS: Cấu hình Gói Premium / Bảng giá
    CMS->>Core: POST /api/v1/admin/payment-packages
    Core->>DB: Lưu Rule cấp quyền mới
    DB-->>Core: Hoàn tất chèn dữ liệu
    Core-->>CMS: 200 OK (Gói cước đã phát hành)

    Note over A,DB: 2. Kiểm duyệt Hệ thống Đối tác
    A->>CMS: Nhận Thông báo có Đối tác gửi Request
    CMS->>Core: GET /api/v1/admin/requests
    Core->>DB: Truy vấn Log Chờ xử lý
    A->>CMS: Nhấn "Chấp thuận & Cấp quyền"
    CMS->>Core: POST /api/v1/admin/requests/:id/approve
    Core->>DB: Gán Role PARTNER, Kích hoạt Hồ sơ Profile
    Core-->>CMS: Thông báo Suyệt thành công

    Note over A,DB: 3. Phát hành Nội dung (Publishing)
    A->>CMS: Sửa lại Master File & Bấm Xuất Bản Nội dung (Publish)
    CMS->>Core: POST /api/v1/admin/pois/:id/publish
    Core->>DB: Gắn cờ is_published = TRUE

    Note over A,DB: 4. Kích hoạt Worker Sinh Âm thanh (Trí tuệ Nhân tạo)
    Core->>DB: Thêm Background Job Event (Sinh Audio Mới) vào Queue
    Core-->>CMS: Yêu cầu Xuất bản đã lên lịch!

    alt Xử lý Không Đồng bộ (Asynchronous Background Job)
        DB-->>TTS: Consume Job Message
        TTS->>TTS: Dịch Text -> Xử lý Giọng đọc Inference -> File .mp3
        TTS->>DB: Cập nhật audio_urls vào trực tiếp POI Record
    end

    Note over A,DB: 5. Vận hành Nền tảng
    A->>CMS: Chọn Xóa Bộ đệm (Invalidate Cache)
    CMS->>Core: POST /api/v1/admin/sync/invalidate
    Core->>DB: Cập nhật Global Version Index
    Core-->>CMS: Gửi thông báo ép App Tải lại dữ liệu ở lần tiếp

    Note over A,DB: 6. Thu thập Presence từ Client USER
    Client->>Core: POST /api/v1/analytics/presence/heartbeat
    Core->>Core: requireAuth + requireRole(["USER"])
    Core->>DB: Upsert analytics_presence (deviceId, sessionId, lastHeartbeatAt, language)
    Core-->>Client: 200 OK (onlineNowWindowSec, active5mWindowSec)

    Note over A,DB: 7. Theo dõi Analytics Hệ thống (ADMIN)
    A->>CMS: Mở Dashboard Analytics
    CMS->>Core: GET /api/v1/analytics/stats
    Core->>Core: requireAuth + requireRole(["ADMIN"])
    Core->>DB: COUNT DISTINCT session_id từ analytics_presence trong cửa sổ 90s
    DB-->>Core: onlineSessions
    Core-->>CMS: 200 OK (data analytics stats)
    CMS-->>A: Hiển thị KPI vận hành
```
