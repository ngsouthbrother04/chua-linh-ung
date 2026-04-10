# ERD (từ Prisma schema)

Source: `apps/backend/prisma/schema.prisma`

```mermaid
erDiagram
    USERS {
        string id PK
        string email
        string password_hash
        string role
        string claim_code_id FK
        datetime token_invalid_before
        datetime created_at
        datetime updated_at
    }

    CLAIM_CODES {
        string id PK
        string code UK
        string code_type
        bool is_active
        int current_uses
        datetime created_at
        datetime updated_at
    }

    AUTH_SESSIONS {
        string id PK
        string user_id FK
        string device_id
        string refresh_token_hash UK
        string access_token_jti UK
        datetime expires_at
        datetime revoked_at
    }

    POINTS_OF_INTEREST {
        string id PK
        json name
        json description
        json audio_urls
        decimal latitude
        decimal longitude
        string type
        int radius
        string creator_id FK
        bool is_published
        int content_version
        datetime created_at
        datetime updated_at
    }

    TOURS {
        string id PK
        json name
        json description
        json poi_ids
        int estimated_time
        string creator_id FK
        bool is_published
        int content_version
        datetime created_at
        datetime updated_at
    }

    ANALYTICS_EVENTS {
        bigint id PK
        string device_id
        string session_id
        string poi_id FK
        string action
        int duration_ms
        string language
        bigint timestamp
        bool uploaded
        datetime created_at
    }

    ANALYTICS_PRESENCE {
        string device_id PK
        string session_id
        string language
        datetime last_heartbeat_at
        datetime updated_at
    }

    PAYMENT_TRANSACTIONS {
        string id PK
        string user_id FK
        string transaction_id UK
        string provider
        string status
        int amount
        string payment_url
        datetime expires_at
        datetime created_at
    }

    PAYMENT_CALLBACK_EVENTS {
        string id PK
        string idempotency_key UK
        string transaction_id FK
        string provider
        string status
        bool processed
        datetime created_at
    }

    PARTNER_REGISTRATION_REQUESTS {
        string id PK
        string requested_by FK
        string reviewed_by FK
        string status
        string shop_name
        string shop_address
        datetime reviewed_at
        datetime created_at
    }

    APP_SETTINGS {
        int id PK
        int current_version
        string data_checksum
        int delta_window_versions
        datetime updated_at
    }

    SYNC_CHANGE_LOGS {
        bigint id PK
        string entity_type
        string entity_id
        string action
        int content_version
        datetime changed_at
    }

    CLAIM_CODES ||--o{ USERS : "claim_code_id"
    USERS ||--o{ AUTH_SESSIONS : "user_id"
    USERS ||--o{ PAYMENT_TRANSACTIONS : "user_id"
    USERS ||--o{ POINTS_OF_INTEREST : "creator_id"
    USERS ||--o{ TOURS : "creator_id"
    USERS ||--o{ PARTNER_REGISTRATION_REQUESTS : "requested_by"
    USERS ||--o{ PARTNER_REGISTRATION_REQUESTS : "reviewed_by"

    POINTS_OF_INTEREST ||--o{ ANALYTICS_EVENTS : "poi_id"
    PAYMENT_TRANSACTIONS ||--o{ PAYMENT_CALLBACK_EVENTS : "transaction_id"
```
