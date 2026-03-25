# 09. Business Rules

[Back to Index](index.md)

---

## BR-01 User-triggered Narration Only

Narration is allowed only via explicit user interactions: map tap and QR scan.

## BR-02 Strict Single Voice

At most one narration can be active. New play requests must stop current narration immediately.

## BR-03 Foreground-only Location

Location is used in foreground only for map orientation and optional nearby highlight.

## BR-04 No Geofence/Autoplay

Any geofence-based, proximity-based, or startup autoplay behavior is forbidden.

## BR-05 Offline-first Read Path

Exploration path reads from local SQLite and local MP3 cache after initial sync.

## BR-06 Server-side TTS Only

Audio generation is backend responsibility. Mobile never performs TTS generation.

## BR-07 Language Fallback Policy

Localization fallback sequence is requested language, then English, then Vietnamese.

## BR-08 Analytics Is Mandatory

Core interactions must be logged and uploaded in batches when online.

## BR-09 API and Data Consistency

Sync, auth, and content contracts must remain consistent with backend and database design docs.

## BR-10 Testing Gate

No feature is considered complete without mapped tests in [test_scenarios.md](../test_scenarios.md).
