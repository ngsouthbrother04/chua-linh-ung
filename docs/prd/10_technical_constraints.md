# 10. Technical Constraints

[Back to Index](index.md)

---

## 1. Required Mobile Stack

1. React Native 0.81+ with Expo SDK 54 (managed workflow).
2. TypeScript 5+.
3. expo-location for foreground location only.
4. expo-av for MP3 playback.
5. expo-sqlite for offline mirror.
6. expo-file-system for audio cache.
7. react-native-maps for map rendering.
8. zustand for app and audio state.

## 2. Required Backend Stack

1. Node.js 20+ with Express.
2. PostgreSQL with PostGIS.
3. Prisma ORM.
4. Redis cache.
5. Background job worker for TTS generation.

## 3. Hard Constraints

1. No geofence and no background location monitoring.
2. No on-device TTS generation.
3. No microservices/Kafka/RabbitMQ for MVP.
4. No GraphQL for MVP APIs.

## 4. Integration Dependencies

1. Payment providers: VNPay and Momo.
2. TTS provider: Piper (offline, free, no account).
3. Storage: audio on local filesystem; images on Cloudinary.

## 5. Known Limitations

1. Cached MP3 assets increase local storage footprint.
2. Base map tiles may still depend on network provider cache policy.
3. Data updates are sync-based, not real-time streaming.
