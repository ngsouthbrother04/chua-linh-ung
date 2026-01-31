# USE CASE ↔ TEST SCENARIO ↔ ARCHITECTURE MAPPING

> **Purpose**: Demonstrate traceability between academic use cases, test scenarios, and system architecture.
>
> **Value**: Strong alignment artifact for project defense and grading.

---

## Mapping Table

| Use Case | Test Scenario (Kịch bản test) | Architecture Component (Specific Libs) |
|---------|------------------------------|----------------------------------------|
| UC1 – Access Application | Scenario 1 – Thanh toán | **AuthModule** (`SecureStore`, `WebView`), **DataSync** (`Axios`, `SQLite`) |
| UC2 – Automatic POI Narration | Scenario 2 – Bắt đầu tour | **LocationService** (`expo-location`), **GeofenceEngine** (Ray-Casting), **TTSEngine** (`expo-speech`) |
| UC3 – Manual POI Activation | Scenario 1 – Chọn POI | **QRHandler** (`expo-camera`), **TTSEngine** (`expo-speech`) |
| UC4 – Language & Playback | Scenario 1 – Chọn ngôn ngữ, Play/Pause | **TTSEngine** (`expo-speech`), **PreferencesStore** (`Zustand`) |
| UC5 – Tour Exploration | Scenario 2 – Chế độ tour | **MapModule** (`react-native-maps`), **RouteLogic** (Dijkstra/Graph) |

---

## Architectural Trace Examples

### UC2 – Automatic POI Narration

- **Trigger**: `ENTER_POI` event from Geofence Engine.
- **Decision**: Geofence Engine (Ray-casting on SQLite Polygons).
- **Execution**: Narration Engine (State Machine: `IDLE` -> `DETECTED` -> `PLAYING`).
- **Output**: `expo-speech.speak()` (Text from SQLite).
- **Logging**: Analytics Module (`SQLite` buffer -> Batch Upload).

---

### UC3 – QR Code Activation

- **Trigger**: QR scan via `expo-camera`.
- **Bypass**: GPS verification (Geofence Engine is ignored).
- **Execution**: Narration Engine (Forces State: `PLAYING`).
- **Constraint**: Fixed-location POI only.

---

## Defense Notes (For Presentation)

- **Technical Integrity**: All use cases map to specific Expo libraries (Location, Speech, SQLite).
- **Offline-First**: UC1 ensures all data is available locally, enabling UC2-UC5 to function without network.
- **Traceability**: Every user action results in a measurable Architectural Event.

---

**End of USE CASE MAPPING**
