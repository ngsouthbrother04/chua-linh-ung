# 15. Admin Requirements

[Back to Index](index.md)

---

## 1. Admin Scope

Admin operates CMS workflows for POI, tours, localization, media, and publish lifecycle.

## 2. Functional Requirements

1. Admin authentication and role-based authorization.
2. CRUD for POI with multilingual name and description fields.
3. CRUD for tours with ordered POI lists.
4. Trigger and monitor server-side TTS generation jobs.
5. Manage media assets and content publish state.
6. Increment sync version and invalidate manifests on publish.
7. View and filter analytics dashboards.

## 3. Data and Integration Requirements

1. POI content updates persist in PostgreSQL and update audio_urls mapping.
2. TTS pipeline runs asynchronously and is observable.
3. Analytics views derive from analytics_events and related aggregates.

## 4. Admin API Contract (Mandatory)

1. CRUD POI: POST /api/v1/admin/pois, GET /api/v1/admin/pois/:id, PUT /api/v1/admin/pois/:id, DELETE /api/v1/admin/pois/:id.
2. CRUD Tour: POST /api/v1/admin/tours, GET /api/v1/admin/tours/:id, PUT /api/v1/admin/tours/:id, DELETE /api/v1/admin/tours/:id.
3. Publish flow endpoint: POST /api/v1/admin/pois/:id/publish.
4. Manifest invalidation endpoint: POST /api/v1/admin/sync/invalidate.
5. Optional manual audio regeneration endpoint: POST /api/v1/admin/pois/:id/audio/generate.

## 5. Admin Acceptance Criteria

```gherkin
GIVEN admin creates or edits POI content
WHEN admin publishes changes
THEN server-side audio generation is completed or queued per language
AND sync manifest version is updated for mobile clients
```

```gherkin
GIVEN admin creates a tour with ordered POIs
WHEN mobile client performs sync
THEN tour appears with preserved order in local SQLite
```

## 6. Operational Guardrails

1. Admin actions must not alter client invariants around explicit-trigger playback.
2. Publish flow must keep sync contract compatible with existing mobile clients.
3. Auditability is required for high-impact content operations.
4. Soft delete means hide from mobile immediately, retain DB row for audit for a defined retention window, then cleanup physical media by policy.
5. Cleanup retention window and delete-owner responsibility must be documented and owned by backend/admin team before release.
