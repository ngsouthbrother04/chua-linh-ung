# Activity Diagram

Source: `apps/backend/src/routes/api/auth.ts`, `apps/backend/src/routes/api/pois.ts`, `apps/backend/src/routes/api/tours.ts`, `apps/backend/src/routes/api/sync.ts`, `apps/backend/src/routes/api/users.ts`, `apps/backend/src/routes/api/partner.ts`, `apps/backend/src/routes/api/admin.ts`, `apps/backend/src/routes/api/analytics.ts`

## USER

```mermaid
flowchart TD
    U1[Người dùng mở ứng dụng] --> U2[POST /api/v1/auth/register hoặc /login]
    U2 --> U3{Đăng nhập hợp lệ?}
    U3 -- Không --> U4[Trả lỗi xác thực]
    U3 -- Có --> U5[Nhận access token + refresh token]

    U5 --> U6[GET /api/v1/sync/manifest]
    U6 --> U7{Cần full sync?}
    U7 -- Có --> U8[GET /api/v1/sync/full]
    U7 -- Không --> U9[POST /api/v1/sync/incremental]

    U8 --> U10[Hiển thị POI/Tour trên bản đồ]
    U9 --> U10

    U10 --> U11[GET /api/v1/pois?page&limit]
    U11 --> U12[GET /api/v1/pois/:id]
    U12 --> U13[Người dùng nghe audio từ audioUrls]

    U13 --> U14{Đổi POI khi đang phát?}
    U14 -- Có --> U15[Dừng audio hiện tại rồi phát audio mới]
    U14 -- Không --> U16[Kết thúc phát]

    U16 --> U17[POST /api/v1/analytics/events]
    U16 --> U18[POST /api/v1/analytics/presence/heartbeat]
    U16 --> U19[GET /api/v1/users/me]
    U16 --> U20[PATCH /api/v1/users/me]
    U16 --> U21[POST /api/v1/users/tts-preview]
    U16 --> U22[GET /api/v1/tours?page&limit]
    U16 --> U23[GET /api/v1/tours/:id]
    U16 --> U24[POST /api/v1/pois/search/radius]
    U16 --> U25[GET /api/v1/search?q=...]
```

## PARTNER

```mermaid
flowchart TD
    P1[Partner đăng nhập] --> P2[Nhận access token + role PARTNER]
    P2 --> P3[POST /api/v1/partner/pois]
    P2 --> P4[PUT /api/v1/partner/pois/:id]
    P2 --> P5[DELETE /api/v1/partner/pois/:id]
    P2 --> P6[POST /api/v1/partner/tours]
    P2 --> P7[PUT /api/v1/partner/tours/:id]
    P2 --> P8[DELETE /api/v1/partner/tours/:id]
    P2 --> P9[POST /api/v1/partner/pois/:id/image/upload]
    P2 --> P10[POST /api/v1/partner/tours/:id/image/upload]

    P3 --> P11{Hồ sơ hợp lệ?}
    P4 --> P11
    P5 --> P11
    P6 --> P11
    P7 --> P11
    P8 --> P11
    P9 --> P11
    P10 --> P11

    P11 -- Có --> P12[Đẩy dữ liệu chờ admin review]
    P11 -- Không --> P13[Trả lỗi validation / quyền truy cập]

    P12 --> P16[POST /api/v1/users/me/partner-registration-requests]
    P12 --> P17[GET /api/v1/users/me/partner-registration-requests]
    P12 --> P18[GET /api/v1/users/me/partner-registration-requests/latest]
```

## ADMIN

```mermaid
flowchart TD
    A1[Admin đăng nhập] --> A2[Nhận token ADMIN]
    A2 --> A3[Quản lý POI]
    A2 --> A4[Quản lý Tour]
    A2 --> A5[Quản lý hệ thống]
    A2 --> A6[Quản lý người dùng]
    A2 --> A7[Duyệt yêu cầu partner]

    A3 --> A3a[GET/POST/PUT/DELETE /api/v1/admin/pois]
    A3 --> A3b[POST publish + audio/generate]

    A4 --> A4a[GET/POST/PUT/DELETE /api/v1/admin/tours]

    A5 --> A5a[GET /tts/config/validate]
    A5 --> A5b[GET /tts/queue/status]
    A5 --> A5c[POST /sync/invalidate]
    A5 --> A5d[POST /maintenance/pois/soft-delete-cleanup]

    A6 --> A6a[GET /users?role=USER]
    A6 --> A6b[POST /users/:id/role]
    A6 --> A6c[POST /users/:id/role/revoke]

    A7 --> A7a[GET /partner-registration-requests]
    A7 --> A7b[GET /partner-registration-requests/:id]
    A7 --> A7c[POST /partner-registration-requests/:id/approve]
    A7 --> A7d[POST /partner-registration-requests/:id/reject]
```
