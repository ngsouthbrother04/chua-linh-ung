# 03. Functional Requirements

[Back to Index](index.md)

---

## FR-UC1 Access and Authorization

1. App supports claim flow and payment flow to authorize access.
2. JWT/session is persisted securely on device.
3. Initial content sync starts after successful authorization.

## FR-UC2 Explore Map

1. Map renders POI markers from local SQLite cache.
2. Foreground location is used only to show blue dot and optional visual highlighting.
3. Tapping marker opens POI bottom sheet (no autoplay).

## FR-UC3 Play Narration from Tap

1. User taps Listen button to dispatch PLAY_EVENT.
2. Playback uses pre-generated MP3 from local cache via expo-av.
3. Single Voice Rule is enforced for every PLAY_EVENT.

## FR-UC4 Scan QR for Narration

1. QR payload contains POI identifier.
2. App resolves POI in SQLite, then dispatches same PLAY_EVENT path as map tap.
3. Invalid QR or unknown POI returns user-safe error state.

## FR-UC5 Language and Settings

1. App supports 15 languages.
2. Fallback chain: requested language, then English, then Vietnamese.
3. Language preference is persisted and reused across sessions.

## FR-UC6 Playback Controls

1. Mini player exposes pause, resume, stop.
2. State machine transitions: IDLE, PLAYING, PAUSED.
3. Stop always returns state to IDLE and clears active playback resource.

## FR-UC7 Tour Exploration

1. Tour list/detail is loaded from local SQLite.
2. Tour mode filters map by ordered POI sequence.
3. Tour selection must not auto-trigger narration.

## FR-UC8 Offline Access

1. Sync contract uses manifest compare then full sync when needed.
2. SQLite update must be atomic all-or-nothing.
3. Exploration and playback continue offline after initial successful sync.

## Cross-Cutting Functional Rules

1. Analytics events are logged for auth, map interactions, playback events, QR scans, language changes, and offline/online transitions.
2. No geofence, no background location tracking, no startup autoplay.
3. No on-device TTS generation.
