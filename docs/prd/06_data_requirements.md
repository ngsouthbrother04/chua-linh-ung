# 06. Data Requirements

[Back to Index](index.md)

---

## 1. Server Source of Truth (PostgreSQL)

Primary tables are aligned with [database_design.md](../database_design.md):

1. points_of_interest
2. tours
3. users
4. claim_codes
5. analytics_events
6. payment_transactions
7. payment_callback_events
8. app_settings

### Core POI fields

1. id, name JSONB, description JSONB.
2. audio_urls JSONB keyed by language code.
3. latitude, longitude.
4. type enum: FOOD, DRINK, SNACK, WC.
5. content_version and timestamps.

## 2. Mobile SQLite Mirror

Mobile mirror must contain:

1. pois
2. tours
3. sync_metadata

### Sync metadata contract

sync_metadata stores server version/hash/time markers used by manifest comparison.

## 3. Multi-language Data Model

1. Server stores localized text in JSONB.
2. Mobile reads selected language projection from mirrored content.
3. Fallback chain: requested, English, Vietnamese.

## 4. Audio Data Model

1. Audio assets are pre-generated server-side MP3 files.
2. Mobile caches files locally and plays with expo-av.
3. No runtime generation on device.

## 5. Analytics Data Model

Event payload fields include:

1. deviceId, sessionId, poiId optional.
2. action enum: TAP, PLAY, PAUSE, STOP, QR_SCAN, language-change and connectivity events.
3. durationMs optional and timestamp.
4. uploaded flag for batch transfer lifecycle.
