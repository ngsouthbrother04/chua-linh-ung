# 05. Non-Functional Requirements

[Back to Index](index.md)

---

## 1. Performance and SLA

1. Tap response to POI detail sheet: under 500ms.
2. Audio start after Listen tap: typically 1 to 2 seconds.
3. API p95 response target: under 200ms.
4. Initial full sync target: under 5 seconds on stable network.
5. Offline startup target: under 2 seconds.

## 2. Reliability

1. Single Voice Rule must be invariant under rapid interactions.
2. Sync write to SQLite must be atomic and recoverable.
3. No corrupted partial cache state is allowed after failed sync.

## 3. Offline-first

1. After initial sync, exploration works without internet.
2. POI data source during exploration is local SQLite.
3. Audio source during exploration is cached MP3 files.

## 4. Privacy and Security

1. Foreground location only; no background tracking.
2. No location history storage.
3. Auth tokens stored in secure device storage.
4. API traffic uses HTTPS and authenticated routes where required.

## 5. Scalability and Operations

1. Backend remains monolith architecture for MVP scope.
2. No Kafka/RabbitMQ or GraphQL in MVP architecture.
3. Analytics is buffered and batch-uploaded when online.

## 6. Compatibility

1. Mobile target stack: React Native 0.81+ with Expo SDK 54.
2. Core runtime libraries: expo-location, expo-av, expo-sqlite, expo-file-system.
