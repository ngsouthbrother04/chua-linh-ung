# 04. Acceptance Criteria

[Back to Index](index.md)

---

## AC-UC1 Authorization

Traceability 1-1: UC1 -> AC-UC1 -> Gate TC-1.1

```gherkin
GIVEN user is unauthenticated
WHEN user submits a valid claim code or successful payment callback is received
THEN system issues a valid auth token and starts initial sync
AND user can proceed to main map screen after sync bootstrap
```

## AC-UC2 Explore Map

Traceability 1-1: UC2 -> AC-UC2 -> Gate TC-2.2

```gherkin
GIVEN user has synced data
WHEN map screen opens
THEN POI markers are rendered from SQLite
AND user location is shown as blue dot in foreground mode only
AND no audio starts automatically on location updates
```

## AC-UC3 Tap to Play

Traceability 1-1: UC3 -> AC-UC3 -> Gate TC-3.2

```gherkin
GIVEN POI detail sheet is visible
WHEN user taps Listen
THEN narration starts from cached MP3 in selected language
AND mini player is visible
AND if POI-A is already playing and user triggers POI-B, POI-A stops immediately and only POI-B continues
```

## AC-UC4 QR Scan

Traceability 1-1: UC4 -> AC-UC4 -> Gate TC-4.1

```gherkin
GIVEN user opens QR scanner and scans valid POI payload
WHEN POI exists in SQLite
THEN system dispatches the same play path as tap-to-play
AND single voice rule is applied
```

## AC-UC5 Language and Fallback

Traceability 1-1: UC5 -> AC-UC5 -> Gate TC-5.1

```gherkin
GIVEN user selects a supported language
WHEN a POI is opened
THEN text and audio use selected language when available
AND fallback follows requested then English then Vietnamese
```

## AC-UC6 Playback Controls

Traceability 1-1: UC6 -> AC-UC6 -> Gate TC-6.3

```gherkin
GIVEN narration is playing
WHEN user presses pause or resume or stop
THEN state transitions match PLAYING, PAUSED, IDLE contracts
AND UI reflects current playback state
```

## AC-UC7 Tours

Traceability 1-1: UC7 -> AC-UC7 -> Gate TC-7.1

```gherkin
GIVEN user opens tours
WHEN a tour is selected
THEN map filters to ordered tour POIs
AND narration still requires explicit user trigger
```

## AC-UC8 Offline

Traceability 1-1: UC8 -> AC-UC8 -> Gate TC-8.1

```gherkin
GIVEN initial sync completed successfully
WHEN network is unavailable
THEN user can still browse POIs and play cached narration
AND app does not require live API calls for exploration
```

## AC-ADMIN Publish Flow

```gherkin
GIVEN admin updates POI content
WHEN admin publishes
THEN backend regenerates server-side audio assets
AND sync manifest version increments for clients
```
