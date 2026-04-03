# 07. API Design

[Back to Index](index.md)

---

## 1. API Style

1. REST API only.
2. Base path: /api/v1.
3. JWT Bearer authentication for protected routes.
4. Language projection by query/header as defined in [backend_design.md](../backend_design.md).

## 2. Authentication and Access

1. POST /api/v1/auth/claim.
2. POST /api/v1/auth/payment/initiate.
3. POST /api/v1/auth/payment/callback.
4. POST /api/v1/auth/token-refresh for token lifecycle management (input body: refreshToken).
5. POST /api/v1/auth/logout to invalidate current access token on server runtime and clear client session.
6. Error contracts use structured error object with stable code and message.

## 3. Sync Contract

1. GET /api/v1/sync/manifest returns latest version, hash/checksum, and metadata for sync decisions.
2. GET /api/v1/sync/full returns POIs, tours, and language-aware content payload.
3. POST /api/v1/sync/incremental supports delta sync by version window to reduce payload risk (R-001).
4. Full sync supports short-circuit response when client version is current.
5. Client applies atomic SQLite replace transaction.

## 4. Content and Discovery APIs

1. GET /api/v1/pois and GET /api/v1/pois/:id.
2. POST /api/v1/pois/search/radius for manual location search.
3. GET /api/v1/tours and GET /api/v1/tours/:id.

## 5. Analytics APIs

1. POST /api/v1/analytics/events for batch upload.
2. POST /api/v1/analytics/presence/heartbeat for online_now and active_5m windows.
3. GET /api/v1/analytics/stats for aggregated views.

## 6. Admin APIs

1. CRUD POI: POST /api/v1/admin/pois, GET /api/v1/admin/pois/:id, PUT /api/v1/admin/pois/:id, DELETE /api/v1/admin/pois/:id.
2. CRUD Tour: POST /api/v1/admin/tours, GET /api/v1/admin/tours/:id, PUT /api/v1/admin/tours/:id, DELETE /api/v1/admin/tours/:id.
3. POST /api/v1/admin/pois/:id/publish for official publish flow.
4. POST /api/v1/admin/sync/invalidate for forcing client manifest invalidation.
5. POST /api/v1/admin/pois/:id/audio/generate remains available for manual regeneration.

## 7. API Guardrails

1. No API endpoint may imply geofence autoplay behavior.
2. No on-device TTS generation contract in mobile APIs.
3. Sync and auth APIs are release-critical and covered by tests mapped in [test_scenarios.md](../test_scenarios.md).
