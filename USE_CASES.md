# USE_CASES

> **Project**: Chùa Linh Ứng – Location-Based Auto-Narration System
>
> **Template Source**: Focused Use Cases (School of Computing)
>
> **Purpose**: Define system use cases for academic submission, following the standard Use Case Report format.
>
> **Technical Context**: All use cases assume **React Native (Expo)** implementation with **Offline-First** architecture.

---

## Revision History

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-30 | 1.1 | Updated with Technical Realization (TTS/SQLite) | Antigravity |

---

## Table of Contents

- UC1 – Access Application & Authorization
- UC2 – Automatic POI Narration (Location-Based)
- UC3 – Manual POI Activation (QR Code)
- UC4 – Select Language & Playback Control
- UC5 – View Tour & Auto-Guided Exploration

---

## UC1 – Access Application & Authorization

**Actor(s)**: Visitor

**Maturity**: Focused

**Summary**: Visitor accesses the application after authorization (payment/claim code) and downloads offline content.

### Basic Course of Events

| Actor Action | System Response | Technical Realization |
|-------------|----------------|-----------------------|
| 1. Visitor opens the application | 2. System checks Auth State (Token validity) | `SecureStore` check |
| 3. Visitor selects payment method (Momo/VNPay) or Claim Code | 4. System validates authorization | `Axios` call to Node.js Backend or `WebView` flow |
| 5. Authorization successful | 6. **CRITICAL**: System syncs all POI data to local DB | Atomic Write to `SQLite` (Content Layer) |

### Alternative Paths
- A1: Invalid claim code → system requests re-entry (Validation via API)
- A2: Offline mode active & Valid Token → Skip Payment, Go to Map (Load from `SQLite`)

### Preconditions
- Visitor has network access (for initial Sync only)

### Postconditions
- **Data Persistence**: All POI Vectors and Text Scripts are stored in `SQLite`.
- **System State**: App enters `OfflineReady` state.

---

## UC2 – Automatic POI Narration (Location-Based)

**Actor(s)**: Visitor

**Maturity**: Focused

**Summary**: System automatically generates speech when visitor enters a POI geofence.

### Basic Course of Events

| Actor Action | System Response | Technical Realization |
|-------------|----------------|-----------------------|
| 1. Visitor moves within the site | 2. System tracks GPS location | `expo-location` (High Accuracy) |
| 3. Visitor enters POI geofence | 4. Geofence Engine matches coordinates | Ray-Casting Algorithm on `SQLite` Polygons |
|  | 5. System generates Audio | `expo-speech.speak(text)` |

### Alternative Paths
- A1: Visitor exits POI early → narration stops immediately (`expo-speech.stop()`)

### Exception Paths
- E1: GPS unstable → Debounce logic prevents false triggers (requires N stable points)

### Preconditions
- App has Location Permissions (Foreground & Background)

### Postconditions
- Events logged to `AnalyticsBuffer` (in-memory -> SQLite -> Batch Upload)

---

## UC3 – Manual POI Activation (QR Code)

**Actor(s)**: Visitor

**Maturity**: Focused

**Summary**: Visitor scans QR code to trigger TTS for a specific POI.

### Basic Course of Events

| Actor Action | System Response | Technical Realization |
|-------------|----------------|-----------------------|
| 1. Visitor scans QR code | 2. System detects POI ID | `expo-camera` / `expo-barcode-scanner` |
|  | 3. System looks up Text Content | Query `SQLite` by `poi_id` |
|  | 4. System triggers TTS | `expo-speech.speak(text)` |

### Constraints
- QR codes bypass Geofence checks but share the same Audio Engine state (Single Voice Rule).

---

## UC4 – Select Language & Playback Control

**Actor(s)**: Visitor

**Maturity**: Focused

**Summary**: Visitor selects language and controls audio playback.

### Basic Course of Events

| Actor Action | System Response | Technical Realization |
|-------------|----------------|-----------------------|
| 1. Visitor selects language (e.g., KR) | 2. System updates Preference State | `Zustand` store update |
|  | 3. TTS Engine switches Voice ID | `expo-speech` config (Use standard implementation for Locale) |
| 3. Visitor presses Play/Pause | 4. TTS pauses/resumes | `expo-speech.pause()` / `resume()` |

### Preconditions
- Device supports requested TTS Locale (Fallback to English if missing)

---

## UC5 – View Tour & Auto-Guided Exploration

**Actor(s)**: Visitor

**Maturity**: Focused

**Summary**: Visitor follows a predefined tour with automatic narration.

### Basic Course of Events

| Actor Action | System Response | Technical Realization |
|-------------|----------------|-----------------------|
| 1. Visitor selects Tour mode | 2. System renders Tour Polyline | `react-native-maps` Polyline |
| 3. Visitor moves along route | 4. Auto-Narration active | Inherits **UC2** logic |

---

**End of USE_CASES**
