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

## 4. Admin Acceptance Criteria

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

## 5. Operational Guardrails

1. Admin actions must not alter client invariants around explicit-trigger playback.
2. Publish flow must keep sync contract compatible with existing mobile clients.
3. Auditability is required for high-impact content operations.
