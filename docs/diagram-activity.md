# Activity Diagram

Source: `apps/backend/src/routes/api/auth.ts`, `apps/backend/src/routes/api/pois.ts`, `apps/backend/src/routes/api/tours.ts`, `apps/backend/src/routes/api/sync.ts`, `apps/backend/src/routes/api/users.ts`, `apps/backend/src/routes/api/partner.ts`, `apps/backend/src/routes/api/admin.ts`, `apps/backend/src/routes/api/analytics.ts`

## USER (Khách hàng / Foodie)

Sơ đồ hoạt động của Người dùng với mô hình tương tác "Tap-to-play".

```mermaid
flowchart TD
    A([Bắt đầu]) --> B["Mở ứng dụng / Web"]
    B --> C{"Xác thực tài khoản?"}
    C -- "Yêu cầu Login" --> D["Đăng nhập / Đăng ký"]
    D --> C

    D -- "Quên mật khẩu" --> FP1["Nhập email"]
    FP1 --> FP2["Gửi OTP"]
    FP2 --> FP3["Nhận OTP"]
    FP3 --> FP4["Nhập OTP"]
    FP4 --> FP5{"OTP đúng?"}
    FP5 -- "No (Báo lỗi)" --> FP4
    FP5 -- "Yes" --> FP6["Nhập mật khẩu mới"]
    FP6 --> FP7["Thành công"]
    FP7 --> D

    C -- "Đã có Token" --> E["API Sync: Tải bản đồ & POIs xung quanh"]

    E --> F{"Bật GPS?"}
    F -- "Từ chối" --> G["Yêu cầu cấp quyền"]
    G --> F
    F -- "Có" --> H["Phát hiện vị trí (Blue Dot) & Sẵn sàng Camera"]

    H --> I{"Người dùng thao tác?"}

    I -- "Chạm POI trên map" --> J["Xem chi tiết POI (Bottom Sheet)"]
    I -- "Quét mã QR tại quán" --> K["Giải mã QR lấy POI ID"]
    I -- "Xem danh sách Tour" --> L["Chọn Food Tour & Xem POI thứ tự"]
    I -- "Đổi ngôn ngữ (Ngoại ngữ)" --> U{"Tài khoản Premium?"}

    U -- "Chưa" --> W["Hiển thị Yêu cầu Mua gói (Packages)"]
    W --> X["Thực hiện thanh toán (MoMo / VNPay)"]
    X --> Y["Webhook Server xác thực giao dịch thành công"]
    Y --> U
    U -- "Rồi" --> M["API: Tải dữ liệu nội dung mới"]

    K --> J
    L --> J
    M --> I

    J --> N{"Bấm 'Nghe thuyết minh'?"}
    N -- "Không" --> I
    N -- "Có" --> O{"Đang có Audio khác?"}

    O -- "Có phát" --> P["DỪNG Audio cũ (Single Voice Rule)"]
    O -- "Không phát" --> Q["Tải MP3 từ /api/v1/pois"]
    P --> Q

    Q --> R["Bắt đầu Phát & Mở Mini Player điều khiển"]
    R --> S["Gửi dữ liệu Analytics xuống DB"]
    S --> T([Kết thúc])

    %% Style adjustments for Purple Theme matching attached image
    classDef default fill:#EAE4FF,stroke:#B29AF8,stroke-width:1.5px,color:#333;
    classDef startend fill:#FFFFFF,stroke:#B29AF8,stroke-width:2px,color:#333;
    classDef decision fill:#EAE4FF,stroke:#B29AF8,stroke-width:1.5px,color:#333;

    class A,T startend;
    class C,F,I,N,O,U,FP5 decision;
```

## PARTNER (Đối tác / Chủ quán)

Sơ đồ hoạt động từ việc đăng nhập Dashboard để quản lý địa điểm POI và Tour tuyến độc quyền.

```mermaid
flowchart TD
    A([Bắt đầu]) --> B["Đăng nhập Portal"]
    B --> C{"Verify Role?"}
    C -- "Trượt" --> D["Báo lỗi Auth & Từ chối truy cập"]

    C -- "Hợp lệ (PARTNER)" --> E["Hiển thị Dashboard Quản lý"]

    E --> F{"Chọn hạng mục?"}
    F -- "Quản lý POI" --> G["Tạo mới / Sửa / Xóa Thông tin Quán"]
    F -- "Quản lý Food Tour" --> H["Tạo Lộ trình Tour Tùy chỉnh"]
    F -- "Quản lý Media" --> I["Upload Banner / Hình ảnh (Tải lên /api/v1/partner/..)"]

    G --> J["Hệ thống Validation Schema"]
    H --> J
    I --> J

    J --> K{"Dữ liệu hợp lệ?"}
    K -- "Không" --> L["Cảnh báo Lỗi Nhập liệu"]
    L --> F

    K -- "Có" --> M["Lưu vào Database & Đẩy Record vào Trạng Thái Chờ"]
    M --> N["Gửi Notification Request chờ Admin duyệt"]
    N --> P([Kết thúc])
    D --> P

    %% Style adjustments for Purple Theme
    classDef default fill:#EAE4FF,stroke:#B29AF8,stroke-width:1.5px,color:#333;
    classDef startend fill:#FFFFFF,stroke:#B29AF8,stroke-width:2px,color:#333;
    classDef decision fill:#EAE4FF,stroke:#B29AF8,stroke-width:1.5px,color:#333;

    class A,P startend;
    class C,F,K decision;
```

## ADMIN (Quản trị viên)

Sơ đồ vận hành toàn quyền của Quản trị viên, bao gồm việc duyệt yêu cầu Partner, đồng bộ hệ thống và phân quyền.

```mermaid
flowchart TD
    ADM_A([Bắt đầu]) --> ADM_B["Đăng nhập CMS Nền tảng"]
    ADM_B --> ADM_C{"Verify Role?"}
    ADM_C -- "Trượt" --> ADM_D["Báo lỗi Insufficient Permissions"]

    ADM_C -- "Hợp lệ (ADMIN)" --> ADM_E["Hiển thị Bảng điều khiển Tổng quan"]

    ADM_E --> ADM_F{"Chọn Nghiệp vụ?"}
    ADM_F -- "Kiểm duyệt Partner" --> ADM_G["Xem Danh sách Yêu cầu chờ duyệt"]
    ADM_F -- "Quản lý Data POI/Tour" --> ADM_H["Chỉnh sửa Master File / Publish Nội dung"]
    ADM_F -- "Phân quyền User" --> ADM_I["Gán Role (USER / PARTNER / ADMIN)"]
    ADM_F -- "Vận hành Hệ thống" --> ADM_J["Gửi Lệnh Sync / Invalidate Cache / Xem Logs"]
    ADM_F -- "Quản lý Gói Thanh Toán" --> ADM_V["Tạo / Sửa / Xóa cấu hình Payment Packages"]
    ADM_F -- "Xem báo cáo Analytics" --> ADM_R["Mở Dashboard Analytics"]

    ADM_G --> ADM_K{"Duyệt Yêu Cầu?"}
    ADM_K -- "Chấp thuận" --> ADM_L["Cập nhật Status Active cho Nội dung"]
    ADM_K -- "Từ chối" --> ADM_M["Gửi Lý do từ chối cho Partner"]

    ADM_H --> ADM_N{"Yêu cầu xuất bản?"}
    ADM_N -- "Ghi đè TTS" --> ADM_O["Kích hoạt Background Job Sinh Audio Tự động"]
    ADM_N -- "Chỉ đổi Text" --> ADM_P["Cập nhật JSONB Translations"]

    ADM_L --> ADM_Q([Kết thúc])
    ADM_M --> ADM_Q
    ADM_O --> ADM_Q
    ADM_P --> ADM_Q
    ADM_I --> ADM_Q
    ADM_J --> ADM_Q
    ADM_V --> ADM_Q
    ADM_R --> ADM_RA{"Nguồn dữ liệu Analytics?"}
    ADM_RA -- "Heartbeat từ client USER" --> ADM_RC["POST /api/v1/analytics/presence/heartbeat (requireRole USER) -> upsert analytics_presence"]
    ADM_RC --> ADM_S["Gọi API: GET /api/v1/analytics/stats"]
    ADM_S --> ADM_T["Backend kiểm tra quyền ADMIN"]
    ADM_T --> ADM_U["Tổng hợp chỉ số onlineSessions từ analytics_presence"]
    ADM_U --> ADM_Q
    ADM_D --> ADM_Q

    %% Style adjustments for Purple Theme
    classDef default fill:#EAE4FF,stroke:#B29AF8,stroke-width:1.5px,color:#333;
    classDef startend fill:#FFFFFF,stroke:#B29AF8,stroke-width:2px,color:#333;
    classDef decision fill:#EAE4FF,stroke:#B29AF8,stroke-width:1.5px,color:#333;

    class ADM_A,ADM_Q startend;
    class ADM_C,ADM_F,ADM_K,ADM_N,ADM_RA decision;
```
