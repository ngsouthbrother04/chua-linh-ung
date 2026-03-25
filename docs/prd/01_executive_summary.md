# 01. Executive Summary

[Back to Index](index.md)

---

## 1. Product Overview

Pho Am Thuc is an offline-first mobile experience for food discovery. Users explore POIs on map and trigger narration only through explicit actions: map tap and QR scan. The system supports 15 languages and enforces strict single-voice playback.

## 2. Product Goals

### 2.1 Primary Goal

Deliver a user-controlled food narration journey where visitors choose what to hear, when to hear, and in which language.

### 2.2 Secondary Goals

1. Ensure offline usability after initial sync via SQLite and MP3 cache.
2. Maintain consistent narration quality with server-side TTS generation.
3. Provide fast, reliable map exploration and playback controls.
4. Enable admin-operated content operations and safe publish flow.

## 3. Non-Negotiable Principles

1. Narration is user-triggered only (tap or QR).
2. No geofence, no background GPS, no autoplay.
3. Single Voice Rule is strict: never two narrations at the same time.
4. Mobile app plays cached MP3 files; no on-device TTS generation.

## 4. MVP Scope (Aligned with UC1-UC8)

1. UC1 Access and Authorization (claim/payment).
2. UC2 Explore Map and POI details.
3. UC3 Play narration from map interaction.
4. UC4 Scan QR for narration.
5. UC5 Switch language and settings.
6. UC6 Playback controls (pause/resume/stop).
7. UC7 Tour exploration.
8. UC8 Offline content access.

## 5. Out of Scope for MVP

1. Geofence-triggered playback or any automatic playback.
2. Background location tracking and location history.
3. On-device text-to-speech generation.
4. Real-time collaborative or social features.
5. Microservices/Kafka/RabbitMQ architecture changes.
