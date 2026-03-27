# Use Cases – Phố Ẩm Thực

> **Project**: Phố Ẩm Thực – Location-Based Food Narration System  
> **Version**: 3.0  
> **Last Updated**: 2026-03-25  
> **Purpose**: Define all system use cases for academic submission per standard UC format

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-03-24 | 2.0 | Shifted to Food Street Tap-to-Play Model | Team |
| 2026-03-25 | 3.0 | Expanded with detailed flows, edge cases, preconditions | Architect |

---

## Table of Contents

1. **UC1** – Access & Authorization
2. **UC2** – Explore Map (POI Discovery)
3. **UC3** – Play POI Narration (Tap-to-Play)
4. **UC4** – Scan QR Code for Narration
5. **UC5** – Switch Language & Settings
6. **UC6** – Control Audio Playback (Pause/Resume/Stop)
7. **UC7** – View Food Tour & Exploration
8. **UC8** – Offline Content Access

---

## UC1 – Access Application & Authorization

**Actor**: Foodie / Visitor  
**Maturity**: Focused  
**Priority**: Critical  

### Summary
Visitor accesses the mobile application after providing authorization (either via payment or claim code), and system syncs offline content to mobile device.

---

### Preconditions
- Mobile app is installed on device
- Internet connection available (for initial sync)
- Device has sufficient storage (>100MB)

---

### Basic Flow

| Step | Actor | System | Technical Realization |
|------|-------|--------|----------------------|
| 1 | Opens Phố Ẩm Thực app | Displays login/auth screen | App starts in unauthenticated state |
| 2 | Selects authorization method | Shows: (a) Claim code, (b) Payment | UI branch logic |
| 3a | **Path A: Claim Code** | | |
| 3a1 | Enters claim code "PHOAMTHUC2026" | System validates code against DB | POST `/api/v1/auth/claim` |
| 3a2 | | Code is valid & active | Returns JWT token + user session |
| 3b | **Path B: Payment** | | |
| 3b1 | Selects payment method (VNPay/Momo) | Opens payment gateway | WebView integration |
| 3b2 | Completes payment | System receives callback from provider | POST `/api/v1/auth/payment/callback` |
| 3b3 | | Payment successful | Updates user status → authorized |
| 4 | | **CRITICAL**: Sync offline content | GET `/api/v1/sync/manifest` → GET `/api/v1/sync/full` |
| 5 | | Downloads POI data + audio files | Atomic write to SQLite + expo-file-system |
| 6 | | Displays map with all POI markers | Shows cached data ready for exploration |
| 7 | User sees map screen | System ready for exploration | Auth state: AUTHORIZED |

---

### Postconditions
- User is authenticated (JWT token stored in secure storage)
- All POI data synced locally to SQLite
- All audio MP3 files cached to device
- User can explore offline

---

### Alternative Paths

**A1: Claim Code Expired**
- Code is invalid or expires_at < now()
- System returns 400 error: "Mã xác thực đã hết hạn"
- User must retry with new code

**A2: Claim Code Max Uses Exceeded**
- Code has reached max_uses limit
- System returns 400 error: "Mã đã được sử dụng hết số lần quy định"

**A3: Payment Failed**
- Payment provider returns error (user decline, network issue)
- System shows error message
- User can retry payment

**A4: Network Issue During Sync**
- Sync fails mid-process
- System retries sync automatically on next launch
- User can manually trigger "Sync Now" button

---

### Edge Cases & Exception Handling

| Scenario | Behavior |
|----------|----------|
| User closes app during sync | Sync resume on next app launch (delta sync) |
| Storage full (no space for audio) | Show warning: "Lưu trữ thiết bị gần đầy" |
| Corrupted SQLite database | Wipe & re-sync from server |
| Token expired while offline | Re-authenticate when online |
| Server version newer, but no internet | Show last cached version, prompt to reconnect |

---

### Related Use Cases
- UC2 – Explore Map
- UC8 – Offline Content Access

---

## UC2 – Explore Map (POI Discovery)

**Actor**: Foodie  
**Maturity**: Focused  
**Priority**: Critical  

### Summary
After authorization, user explores the map view with POI markers representing food stalls, restaurants, and drink spots.

---

### Preconditions
- User is authenticated (UC1 completed)
- Offline data synced to SQLite
- Location permission granted
- Map is displayed

---

### Basic Flow

| Step | Actor | System | Technical Details |
|------|-------|--------|-------------------|
| 1 | Views map screen | Renders all POI markers | `react-native-maps` + SQLite query |
| 2 | Moves/scrolls map | Map updates visible markers | Viewport change listener |
| 3 | User location updates | Shows blue dot on map | `expo-location` foreground tracking |
| 4 | Location near POI (visual highlight) | Nearby POIs highlighted/animated | UI enhancement (NOT auto-play) |
| 5 | Taps a POI marker | Bottom sheet opens | `onMarkerPress` event |
| 6 | | Displays POI details in bottom sheet: | |
| | | - POI name (current language) | Text from SQLite |
| | | - Description snippet | JSONB → current lang |
| | | - Main image | Image URL from cache |
| | | - "Nghe thuyết minh" (Listen) button | Audio playback button |
| 7 | (Next: Tap "Listen" button) | → UC3: Play Narration | |

---

### Postconditions
- POI details displayed in bottom sheet
- Ready for user to tap "Listen" button
- Analytics event logged: { action: "TAP", poiId, timestamp }

---

### Alternative Paths

**A1: Tap Same POI Again**
- Bottom sheet already open for same POI
- System updates/refreshes display (or keeps existing)

**A2: Tap Different POI While First open**
- Bottom sheet for new POI replaces previous one
- Analytics event logged for new POI

**A3: Tap on Empty Map Area**
- Bottom sheet closes (if open)
- Map remains displayed

---

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| POI has no audio file | Show message: "Phiên bản âm thanh chưa có" |
| POI description missing in current language | Fallback to Vietnamese or English |
| User denies location permission | Show map, but no blue dot |
| Map tiles (streets) not loaded | Markers still visible (cached data) |

---

### Related Use Cases
- UC3 – Play Narration
- UC4 – Scan QR Code
- UC7 – View Food Tour

---

## UC3 – Play POI Narration (Tap-to-Play)

**Actor**: Foodie  
**Maturity**: Focused  
**Priority**: Critical  
**Constraint**: **Single Voice Rule** – Only one audio plays at a time  

### Summary
User taps "Nghe thuyết minh" (Listen) button in POI details to play pre-recorded audio narration in the selected language. If another audio is playing, it stops immediately.

---

### Preconditions
- POI details bottom sheet is open (UC2)
- Audio file exists for current language
- State Machine is in IDLE or PLAYING state

---

### Basic Flow

| Step | Actor | System | State Machine & Code |
|------|-------|--------|------|
| 1 | Views POI details in bottom sheet | System in IDLE state | audioState = IDLE |
| 2 | Taps "Nghe thuyết minh" button | Dispatch PLAY_EVENT | audioDispatch({ type: 'PLAY_EVENT', poiId }) |
| 3 | | Check if audio already playing | if (currentAudio.poiId !== newPoiId) { stop() } |
| 4 | | Load audio file from local cache | `expo-file-system.readAsStringAsync(audioPath)` |
| 5 | | Start playback | `expo-av.Sound.createAsync()` + `.playAsync()` |
| 6 | | **Transition State → PLAYING** | audioState = PLAYING |
| 7 | | Display mini player (pause/stop controls) | Mini player UI appears |
| 8 | | Audio plays (narration) | TTS audio plays for 30-60 seconds |
| 9 | Audio finishes | State → IDLE | Playback complete listener |
| 10 | | Close mini player (optional) | UI update |
| 11 | User hears complete narration | | |

---

### Postconditions
- Audio narration has been played
- User heard complete description of POI
- Mini player closed, state = IDLE
- Analytics event logged: { action: "PLAY", poiId, durationMs, language }

---

### Alternative Paths

**A1: User Taps Different POI While Audio Playing**  
(Implements **Single Voice Rule**)

| Step | Actor | System | Code |
|------|-------|--------|------|
| 1 | Audio of POI-1 is playing (45s in) | State = PLAYING, poiId="poi_001" | |
| 2 | User scrolls & taps POI-2 on map | New bottom sheet appears for POI-2 | |
| 3 | User taps "Nghe thuyết minh" | Dispatch PLAY_EVENT(poi_002) | Dispatch new event |
| 4 | | **CRITICAL**: Stop previous audio immediately | `currentSound.stopAsync()` |
| 5 | | Clear playback UI for POI-1 | Mini player disappears |
| 6 | | **Transition → IDLE, then → PLAYING** | State machine atomic transition |
| 7 | | Load & play audio of POI-2 | Play new audio file |
| 8 | | Analytics logged for both: | { poiId: "poi_001", durationMs: 45000 }, then { poiId: "poi_002", action: "PLAY" } |

---

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Audio file corrupted / missing | Show error: "Không thể phát âm thanh" |
| Network disconnected (offline) | Play from file cache (already synced) |
| Device volume = 0 | Audio plays silently (expected) |
| User locks screen during playback | Audio continues in background / stops if policy set |
| Low battery mode | Audio plays normally (no optimization needed) |
| Multiple taps while loading | Ignore, don't queue multiple plays |

---

### Related Use Cases
- UC6 – Control Audio (Pause/Resume/Stop)
- UC4 – QR Code Scanning (alternative trigger)

---

## UC4 – Scan QR Code for Narration

**Actor**: Foodie  
**Maturity**: Focused  
**Priority**: High  

### Summary
User scans a QR code (physical sticker at food stall) to directly trigger audio narration for that POI without tapping the map. QR also uses the Single Voice Rule.

---

### Preconditions
- QR code exists at physical location (physical sticker with POI ID)
- Camera permission granted
- Current app state = foreground (or resumed)

---

### Basic Flow

| Step | Actor | System | Technical Details |
|------|-------|--------|-------------------|
| 1 | Taps "Scan QR" button in app | Opens camera view | Navigation to QR scanner screen |
| 2 | Points camera at QR sticker | Camera stream active | `expo-camera` or `expo-barcode-scanner` |
| 3 | QR code scanned | System decodes QR data | Read POI ID from QR: "poi_001" |
| 4 | | Lookup POI in SQLite | `select * from pois where id = "poi_001"` |
| 5 | | **Dispatch PLAY_EVENT** (same as UC3) | Same State Machine logic |
| 6 | | **Apply Single Voice Rule** | Stop any playing audio first |
| 7 | | Navigate to POI narration + play | Show bottom sheet + start audio |
| 8 | | User hears narration | |

---

### Postconditions
- Audio narration playing for scanned POI
- Bottom sheet displayed with POI details
- Analytics event logged: { action: "QR_SCAN", poiId, language }

---

### Alternative Paths

**A1: Invalid QR Code**
- QR data is not format "poi_XXX"
- Show error: "Mã QR không hợp lệ"

**A2: POI Not Found in Local Database**
- POI ID doesn't exist in SQLite
- Show error: "Địa điểm không tồn tại"
- Suggest manual sync

---

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| QR code torn/unreadable | Scanner fails, show retry prompt |
| Multiple QR codes visible | Scanner reads first one in focus |
| User cancel QR scanner | Close camera, return to map |
| Audio still playing from previous POI | Stop immediately (Single Voice Rule) |

---

### Related Use Cases
- UC3 – Play Narration
- UC2 – Explore Map

---

## UC5 – Switch Language & Settings

**Actor**: Foodie  
**Maturity**: Focused  
**Priority**: High  

### Summary
User accesses Settings screen to change preferred language. When language is changed, all POI content (text + audio URLs) update accordingly on the map and narration.

---

### Preconditions
- User is authenticated & in main app
- At least 2 languages loaded in database

---

### Basic Flow

| Step | Actor | System | Technical Details |
|------|-------|--------|-------------------|
| 1 | Opens Settings screen | Shows language selector dropdown | UI navigation |
| 2 | Current language highlighted (e.g., "Tiếng Việt") | Displays all available languages | List: VI, EN, KO, JA, FR, DE, ES, PT, RU, ZH, TH, ID, HI, AR, TR |
| 3 | Selects new language (e.g., "한국어") | System updates preference state | `zustand` store update + `SecureStore` save |
| 4 | | Re-queries SQLite with new language | Fetch all POIs filtered by new language |
| 5 | | Updates map display (names, descriptions) | Re-render POI popup text |
| 6 | | Downloads new audio URLs if not cached | Check backend local static path for new language MP3s |
| 7 | User sees all content in Korean | New language active | UI refreshed |
| 8 | Closes Settings | Returns to map | Map shows Korean text |

---

### Postconditions
- Language preference saved persistently
- All POI text displayed in selected language
- Audio narrations available in selected language
- Analytics event logged: { action: "LANGUAGE_CHANGE", oldLang: "vi", newLang: "ko" }

---

### Alternative Paths

**A1: Language Audio Not Yet Downloaded**
- Selected language audio files not cached locally
- Show progress: "Tải dữ liệu tiếng..."
- Auto-download MP3s in background from backend local static path
- Once complete, language ready to use

**A2: Network Offline, Language Audio Missing**
- Fallback to Vietnamese or English (cached version)
- Show note: "Âm thanh tiếng này chưa sẵn sàng offline"

---

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| POI description missing in selected language | Fallback to English, then Vietnamese |
| Audio not available for language | Still show text, disable Listen button |
| Language change while audio playing | Stop current audio, ready new language |

---

### Related Use Cases
- UC3 – Play Narration (language affects audio)

---

## UC6 – Control Audio Playback (Pause/Resume/Stop)

**Actor**: Foodie  
**Maturity**: Focused  
**Priority**: Medium  

### Summary
User controls audio playback via mini player controls: Pause, Resume, Stop.

---

### Preconditions
- Audio is playing (State = PLAYING)
- Mini player controls visible

---

### Basic Flow

| Step | Actor | Action | System Response | State |
|------|-------|--------|-----------------|-------|
| 1 | Audio playing | (Initial) | | PLAYING |
| 2 | Taps **Pause** button | Pause pressed | Call `expo-av.pause()` | **→ PAUSED** |
| 3 | | Playback halted at current position | Mini player shows Resume button | PAUSED |
| 4 | Taps **Resume** button | Resume pressed | Call `expo-av.playAsync()` | **→ PLAYING** |
| 5 | | Playback continues from paused position | Mini player shows Pause button | PLAYING |
| 6 | Taps **Stop** button | Stop pressed | Call `expo-av.stopAsync()` | **→ IDLE** |
| 7 | | Playback stops, mini player closes | Map/bottom sheet still visible | IDLE |

---

### Postconditions (per control)

**After Pause**:
- Audio stream paused
- Current playback position saved
- Ready to resume

**After Resume**:
- Audio continues from pause point
- Mini player updates (back to Pause button)

**After Stop**:
- Audio playback completely stopped
- Mini player closed
- State = IDLE
- Analytics logged: { action: "STOP", poiId, durationMs }

---

### Alternative Paths

**A1: User Closes Bottom Sheet While Audio Playing**
- Bottom sheet dismissed (swipe down or back button)
- Audio continues playing (optional: show mini player in notification)
- State remains PLAYING

**A2: User Navigates Away (e.g., opens Settings)**
- Audio may pause depending on app pause handler
- App can resume audio on return (optional)

---

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| User presses Pause twice | Second press ignored (already paused) |
| Resume without Pause (shouldn't happen) | Resume button inactive in PLAYING state |
| Stop clears mini UI | Mini player closes immediately |
| Device memory pressure | Audio unloads if app backgrounded |

---

### Related Use Cases
- UC3 – Play Narration

---

## UC7 – View Food Tour & Exploration

**Actor**: Foodie  
**Maturity**: Focused  
**Priority**: Medium  

### Summary
User selects a predefined food tour (e.g., "Ăn vặt Sinh viên") to explore multiple POIs in a structured sequence. Tour shows ordered POI markers on map.

---

### Preconditions
- User authenticated & at map screen
- Tours loaded in SQLite
- At least 1 tour exists

---

### Basic Flow

| Step | Actor | System | Technical Details |
|------|-------|--------|-------------------|
| 1 | Taps "Tours" tab / menu | Shows list of available tours | UI list of all tours |
| 2 | | Displays: Tour name, image, POI count, duration | From SQLite tours table |
| 3 | Taps a tour (e.g., "Ăn vặt Sinh viên") | System filters map | tour.poi_ids = ["poi_001", "poi_003", "poi_005"] |
| 4 | | Shows only tour POIs on map with numbers | Markers labeled 1, 2, 3, ... in order |
| 5 | | Highlights tour info (duration, description) | Bottom banner shows tour details |
| 6 | User explores tour | Can tap any POI marker in sequence | POI → bottom sheet → Listen |
| 7 | Taps POI on tour | Same as UC2/UC3 (map + narration) | Normal exploration flow |
| 8 | Completes tour | All POIs visited | Tour completion (optional analytics) |
| 9 | Exits tour | Taps "Exit Tour" or back navigation | Map returns to all POIs |

---

### Postconditions
- User has explored tour POIs
- Analytics events logged for each POI tapped/played
- Tour marked as "visited" (optional tracking)

---

### Alternative Paths

**A1: Tour Changed During Exploration**
- User selects different tour mid-exploration
- Previous tour markers disappear
- New tour POIs displayed

**A2: POI Not Available (Deleted)**
- POI in tour.poi_ids no longer exists
- Skip that POI, show warning
- Continue with remaining tour POIs

---

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Tour has only 1 POI | Still displayed as tour |
| Empty tour (no POIs) | Don't show in tour list |
| Tour duration wrong | Show as estimated (TBD) |

---

### Related Use Cases
- UC2 – Explore Map
- UC3 – Play Narration

---

## UC8 – Offline Content Access

**Actor**: Foodie  
**Maturity**: Focused  
**Priority**: Medium  

### Summary
User can explore map, view POI details, and listen to narrations even without internet connectivity. All content is sourced from local SQLite and cached MP3 files (synced earlier).

---

### Preconditions
- Initial sync completed (UC1)
- SQLite + audio MP3s cached locally
- Internet now disconnected (WiFi/4G off)

---

### Basic Flow

| Step | Actor | System | Source |
|------|-------|--------|--------|
| 1 | User closes app (with internet) | Content synced to SQLite | Server → SQLite |
| 2 | Turns off WiFi/4G | Internet unavailable | |
| 3 | Opens app again | App starts in offline mode | |
| 4 | Views map | Map loads (may show basic map tiles if cached) | SQLite query |
| 5 | Sees all POI markers | Markers rendered from SQLite | pois table (local) |
| 6 | Taps POI | Bottom sheet shows details | SQLite: name, description, image_url |
| 7 | Taps "Listen" | Audio plays from local file | expo-file-system MP3 + expo-av |
| 8 | | No API call, data entirely local | Offline-first architecture |
| 9 | User completes exploration | Full functionality without internet | |

---

### Postconditions
- User successfully explored offline
- Analytics events buffered locally (will sync when online)
- When internet returns, app syncs analytics & checks for updates

---

### Alternative Paths

**A1: User Tries to Sync While Offline**
- Sync request queued / deferred
- Does not fail hard (graceful degradation)
- Syncs automatically when connection restored

**A2: Storage Full (SQLite or MP3 cache)**
- Show warning about storage
- User can delete old cache & re-sync

---

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| POI edited on server, but not re-synced | User sees old cached content (eventually syncs) |
| New tour added, but no offline sync | Old tours still available offline |
| App update while offline | Uses current offline data, updates on next sync |

---

### Related Use Cases
- UC1 – Authorization & Initial Sync (prerequisite)
- UC2 – Map Exploration
- UC3 – Narration Playback

---

## Use Case Summary Table

| UC | Title | Actor | Trigger | Outcome |
|:--|:------|:------|:--------|:---------|
| UC1 | Authorization & Sync | Foodie | App launch | Authorized, content synced |
| UC2 | Explore Map | Foodie | View map | POI marker tapped |
| UC3 | Play Narration | Foodie | Tap "Listen" | Audio plays (Single Voice Rule) |
| UC4 | Scan QR | Foodie | Scan physical QR | Audio triggered for POI |
| UC5 | Switch Language | Foodie | Open Settings | Language changed, text/audio updated |
| UC6 | Control Audio | Foodie | Tap Pause/Resume/Stop | Audio paused/resumed/stopped |
| UC7 | View Tour | Foodie | Select tour | Ordered POI exploration |
| UC8 | Offline Access | Foodie | Disconnect internet | Content accessible locally |

---

## Actor Definition

**Foodie (Primary Actor)**
- Person using mobile app
- May or may not have internet
- Speaks multiple languages
- Wants to discover food culture via narration
- Uses map interface intuitively

---

## System Boundary

The system includes:
- ✅ Mobile app (React Native)
- ✅ Backend API (Node.js)
- ✅ PostgreSQL database
- ✅ Local file storage
- ❌ Admin dashboard (separate system)
- ❌ Payment gateway (external service)

---

## Cross-Cutting Concerns

### Analytics
All major actions logged:
- PLAY, PAUSE, STOP, QR_SCAN
- Logged to SQLite, then batch uploaded

### Offline-First
SQLite + file cache ensures functionality without internet

### Single Voice Rule
Only valid for UC3 & UC4 (audio playback)

### Localization
All text/audio dynamic per selected language

---

## References

- SPEC_CANONICAL.md – Canonical rules
- ARCHITECTURE.md – System design
- backend_design.md – API endpoints
- database_design.md – Data schema
