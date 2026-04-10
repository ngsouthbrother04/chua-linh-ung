# Sequence Diagram

Source: `auth.ts`, `pois.ts`, `tours.ts`, `sync.ts`, `partner.ts`, `admin.ts`, `poiAdminService.ts`, `ttsService.ts`, `analytics.ts`, `users.ts`

## USER

```mermaid
sequenceDiagram
    autonumber
    participant U as USER
    participant API as Backend API
    participant Auth as authService
    participant Sync as syncService
    participant DB as PostgreSQL
    participant FS as public/audio

    U->>API: POST /api/v1/auth/login
    alt Thành công
        API->>Auth: loginUser(email, password)
        Auth->>DB: kiểm tra user + password
        DB-->>Auth: hợp lệ
        Auth-->>API: accessToken + refreshToken
        API-->>U: 200 OK
    else Thất bại
        API-->>U: 401 INVALID_CREDENTIALS
    end

    U->>API: GET /api/v1/sync/manifest
    alt Thành công
        API->>Sync: getSyncManifest()
        Sync->>DB: đọc version + dữ liệu public
        DB-->>Sync: manifest
        Sync-->>API: manifest
        API-->>U: 200 OK
    else Thất bại
        API-->>U: 401 hoặc 403
    end

    U->>API: GET /api/v1/pois/:id
    alt Thành công
        API->>DB: query POI public
        DB-->>API: POI + audioUrls
        API-->>U: 200 OK
        U->>FS: GET /audio/<file>.mp3
        FS-->>U: audio stream
    else Thất bại
        API-->>U: 404 POI not found hoặc 401
    end

    U->>API: POST /api/v1/analytics/events
    alt Thành công
        API->>DB: lưu batch events
        DB-->>API: processedCount
        API-->>U: 200 OK
    else Thất bại
        API-->>U: 400/401
    end
```

## PARTNER

```mermaid
sequenceDiagram
    autonumber
    participant P as PARTNER
    participant API as Backend API
    participant AdminSvc as poiAdminService
    participant Img as imageService
    participant DB as PostgreSQL

    P->>API: POST /api/v1/partner/pois
    alt Thành công
        API->>AdminSvc: createAdminPoi(payload)
        AdminSvc->>DB: insert points_of_interest
        DB-->>AdminSvc: created
        AdminSvc-->>API: poi created
        API-->>P: 201 Created
    else Thất bại
        API-->>P: 400 invalid payload hoặc 403 forbidden
    end

    P->>API: POST /api/v1/partner/pois/:id/image/upload
    alt Thành công
        API->>Img: uploadPoiImage(file)
        Img-->>API: cloudinary url
        API-->>P: 200 OK
    else Thất bại
        API-->>P: 400 file lỗi hoặc 403 forbidden
    end

    P->>API: PUT /api/v1/partner/tours/:id
    alt Thành công
        API->>AdminSvc: updateAdminTour(payload)
        AdminSvc->>DB: update tour draft
        DB-->>AdminSvc: updated
        API-->>P: 200 OK
    else Thất bại
        API-->>P: 404 not found hoặc 403 forbidden
    end

    P->>API: GET /api/v1/users/me/partner-registration-requests
    alt Thành công
        API->>DB: đọc các yêu cầu của partner
        DB-->>API: items
        API-->>P: 200 OK
    else Thất bại
        API-->>P: 401 unauthorized
    end
```

## ADMIN

```mermaid
sequenceDiagram
    autonumber
    participant A as ADMIN
    participant API as Backend API
    participant AdminSvc as poiAdminService
    participant TTS as ttsService
    participant Queue as BullMQ/InMemory
    participant DB as PostgreSQL

    A->>API: POST /api/v1/admin/pois/:id/publish
    alt Thành công
        API->>AdminSvc: publishAdminPoi(id)
        AdminSvc->>DB: update isPublished=true, contentVersion++
        DB-->>AdminSvc: published
        API->>TTS: enqueuePoiTtsGeneration(id)
        TTS->>Queue: enqueue jobs per language
        Queue-->>TTS: queued
        TTS->>DB: update audio_urls
        API-->>A: 200 Published
    else Thất bại
        API-->>A: 400/403/404
    end

    A->>API: GET /api/v1/admin/users?role=USER
    alt Thành công
        API->>DB: query users by role
        DB-->>API: items
        API-->>A: 200 OK
    else Thất bại
        API-->>A: 401 hoặc 403
    end

    A->>API: POST /api/v1/admin/partner-registration-requests/:id/approve
    alt Thành công
        API->>DB: cấp role PARTNER + cập nhật trạng thái
        DB-->>API: approved
        API-->>A: 200 OK
    else Thất bại
        API-->>A: 409 request đã xử lý hoặc 403
    end

    A->>API: GET /api/v1/admin/tts/queue/status
    alt Thành công
        API->>TTS: getTtsQueueStatus()
        TTS-->>API: queue metrics
        API-->>A: 200 OK
    else Thất bại
        API-->>A: 403 forbidden
    end
```
