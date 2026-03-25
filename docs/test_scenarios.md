# Test Scenarios

**Phiên bản**: 2.0  
**Cập nhật**: 2026-03-25  
**Mục đích**: Comprehensive testing checklist for functional, edge case, and integration scenarios

---

## 1. Test Scenario Overview

### 1.1 Test Categories

| Category | Count | Focus |
|----------|-------|-------|
| **Functional Tests** | 20+ | Happy path, core features |
| **Edge Cases** | 15+ | Boundary conditions, error handling |
| **Multi-Language** | 30+ | i18n behavior across 15 languages |
| **Location-Based** | 10+ | GPS, offline, accuracy |
| **Performance** | 8+ | Speed, memory, battery |
| **Integration** | 12+ | Backend sync, payment, analytics |

### 1.2 Canonical 1-1 Traceability Gates

Rule: mỗi UC có đúng 1 AC chính và đúng 1 test gate chính để pass/fail release.

| UC | AC (1-1) | Primary Gate Test Case (1-1) | Supporting Tests |
|----|----------|-------------------------------|------------------|
| UC1 | AC-UC1 | TC-1.1 | TC-1.2 -> TC-1.5, TC-15.1, TC-15.2 |
| UC2 | AC-UC2 | TC-2.2 | TC-2.1, TC-2.3, TC-2.4 |
| UC3 | AC-UC3 | TC-3.2 | TC-3.1, TC-3.3, TC-3.4, TC-3.5 |
| UC4 | AC-UC4 | TC-4.1 | TC-4.2, TC-4.3, TC-4.4 |
| UC5 | AC-UC5 | TC-5.1 | TC-5.2, TC-5.3, TC-5.4, TC-5.5, TC-11.x, TC-12.1 |
| UC6 | AC-UC6 | TC-6.3 | TC-6.1, TC-6.2, TC-6.4 |
| UC7 | AC-UC7 | TC-7.1 | TC-7.2, TC-7.3, TC-7.4 |
| UC8 | AC-UC8 | TC-8.1 | TC-8.2, TC-8.3, TC-9.x, TC-10.x, TC-15.4 |

---

## 2. Functional Test Scenarios

### Scenario 1 – Authorization (UC1)

#### TC-1.1: Valid Claim Code
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-1.1 |
| **Title** | User authorizes with valid claim code |
| **Precondition** | App installed, no prior auth |
| **Steps** | 1. Open app → 2. Select "Claim Code" → 3. Enter "PHOAMTHUC2026" |
| **Expected Result** | ✅ Auth successful, JWT token stored, sync begins |
| **Actual Result** | |
| **Status** | ⬜ Not Run |

#### TC-1.2: Invalid Claim Code
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-1.2 |
| **Title** | User enters invalid claim code |
| **Steps** | 1. Enter "INVALID_CODE" |
| **Expected Result** | ❌ Error message: "Mã xác thực không hợp lệ" |
| **Status** | ⬜ Not Run |

#### TC-1.3: Expired Claim Code
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-1.3 |
| **Title** | Claim code expired |
| **Precondition** | Claim code expires_at < now() |
| **Expected Result** | ❌ Error: "Mã đã hết hạn" |
| **Status** | ⬜ Not Run |

#### TC-1.4: Payment Gateway (VNPay)
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-1.4 |
| **Title** | User completes VNPay payment |
| **Steps** | 1. Select VNPay → 2. Enter payment info → 3. Confirm |
| **Expected Result** | ✅ Payment callback received, user authorized |
| **Status** | ⬜ Not Run |

#### TC-1.5: Payment Failure
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-1.5 |
| **Title** | Payment declined |
| **Steps** | 1. Select payment → 2. Enter invalid card → 3. Confirm |
| **Expected Result** | ❌ Error displayed, retry option |
| **Status** | ⬜ Not Run |

---

### Scenario 2 – Map Exploration & POI Discovery (UC2)

#### TC-2.1: Map Loads with All POI Markers
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-2.1 |
| **Title** | Map displays all POI markers after auth |
| **Steps** | 1. Auth complete → 2. Map screen shows |
| **Expected Result** | ✅ All 45+ POI markers visible |
| **Actual Result** | |
| **Status** | ⬜ Not Run |

#### TC-2.2: Tap POI Marker Opens Bottom Sheet
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-2.2 |
| **Title** | Tap POI shows details |
| **Steps** | 1. Tap "Phở Thìn" marker |
| **Expected Result** | ✅ Bottom sheet appears with: name, description, image, "Listen" button |
| **Status** | ⬜ Not Run |

#### TC-2.3: Nearby POI Highlight (Visual Only)
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-2.3 |
| **Title** | POIs within 500m highlighted visually |
| **Precondition** | User location enabled, near cluster of POIs |
| **Steps** | 1. Move to location near POI cluster |
| **Expected Result** | ✅ Nearby POIs highlighted/animated (NOT auto-play audio) |
| **Status** | ⬜ Not Run |

#### TC-2.4: POI Description in Current Language
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-2.4 |
| **Title** | POI name & description in selected language |
| **Precondition** | Language set to Korean |
| **Steps** | 1. Tap POI → 2. View bottom sheet |
| **Expected Result** | ✅ All text in Korean (한국어) |
| **Status** | ⬜ Not Run |

---

### Scenario 3 – Audio Playback: Tap-to-Play (UC3)

#### TC-3.1: Play Audio from Tap
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-3.1 |
| **Title** | User taps "Nghe thuyết minh", audio plays |
| **Precondition** | POI bottom sheet open, audio file exists |
| **Steps** | 1. Tap "Nghe thuyết minh" button |
| **Expected Result** | ✅ Audio starts playing within 1-2s, mini player shows |
| **Status** | ⬜ Not Run |

#### TC-3.2: Single Voice Rule – Different POI
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-3.2 |
| **Title** | Playing audio for POI-2 stops audio for POI-1 |
| **Precondition** | Audio for POI-1 playing (30s in) |
| **Steps** | 1. Tap different POI → 2. Tap "Listen" |
| **Expected Result** | ✅ POI-1 audio stops immediately, POI-2 audio plays from start |
| **Status** | ⬜ Not Run |

#### TC-3.3: Audio Playback Duration
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-3.3 |
| **Title** | Audio duration matches recording (30-60s) |
| **Steps** | 1. Play audio → 2. Count duration |
| **Expected Result** | ✅ Duration within 30-60 seconds |
| **Status** | ⬜ Not Run |

#### TC-3.4: Audio Missing (Not Generated)
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-3.4 |
| **Title** | Audio file not available for POI/language |
| **Precondition** | POI has no audio for current language |
| **Steps** | 1. Tap "Listen" button |
| **Expected Result** | ⚠️ Show message: "Phiên bản âm thanh chưa có" OR fallback to Vietnamese |
| **Status** | ⬜ Not Run |

#### TC-3.5: Audio Playback Accross Languages
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-3.5 |
| **Title** | Same POI plays different audio per language |
| **Steps** | 1. Play in Vietnamese → 2. Switch to Korean → 3. Play same POI |
| **Expected Result** | ✅ Vietnamese narration ≠ Korean narration (different voice, language) |
| **Status** | ⬜ Not Run |

---

### Scenario 4 – QR Code Scanning (UC4)

#### TC-4.1: Valid QR Scan
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-4.1 |
| **Title** | Scan valid QR code triggers audio |
| **Precondition** | Physical QR sticker with POI-001 encoded |
| **Steps** | 1. Open app → 2. Tap "Scan QR" → 3. Scan physical QR |
| **Expected Result** | ✅ POI-001 details shown, audio plays immediately |
| **Status** | ⬜ Not Run |

#### TC-4.2: QR Single Voice Override
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-4.2 |
| **Title** | QR scan while audio playing stops current audio |
| **Precondition** | Audio for POI-A playing |
| **Steps** | 1. Scan QR for POI-B |
| **Expected Result** | ✅ POI-A audio stops, POI-B audio starts (Single Voice Rule) |
| **Status** | ⬜ Not Run |

#### TC-4.3: Invalid QR Code
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-4.3 |
| **Title** | Scan invalid/corrupted QR |
| **Steps** | 1. Scan QR with invalid data |
| **Expected Result** | ❌ Error: "Mã QR không hợp lệ" |
| **Status** | ⬜ Not Run |

#### TC-4.4: POI Not in Database
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-4.4 |
| **Title** | QR contains POI ID not in local database |
| **Precondition** | Mobile database doesn't have this POI (stale sync) |
| **Steps** | 1. Scan valid QR |
| **Expected Result** | ❌ Error: "Địa điểm không tồn tại" OR prompt to sync |
| **Status** | ⬜ Not Run |

---

### Scenario 5 – Language Selection & i18n (UC5)

#### TC-5.1: Change Language to Korean
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-5.1 |
| **Title** | User switches language to Korean |
| **Steps** | 1. Open Settings → 2. Select "한국어" |
| **Expected Result** | ✅ All text switches to Korean (UI + POI names) |
| **Status** | ⬜ Not Run |

#### TC-5.2: Language Persistence
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-5.2 |
| **Title** | Language preference saved after app restart |
| **Steps** | 1. Change language → 2. Close app → 3. Reopen |
| **Expected Result** | ✅ App opens in same language (retrieved from storage) |
| **Status** | ⬜ Not Run |

#### TC-5.3: Audio URL Changes with Language
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-5.3 |
| **Title** | Audio URL reflects selected language |
| **Precondition** | Language = Korean |
| **Steps** | 1. Tap POI → 2. Audio URL in Korean |
| **Expected Result** | ✅ Audio URL contains "_ko.mp3" (or language code) |
| **Status** | ⬜ Not Run |

#### TC-5.4: Missing Translation Fallback
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-5.4 |
| **Title** | POI translation missing in selected language |
| **Precondition** | Language = German, but POI only has VI/EN |
| **Steps** | 1. Select German → 2. Tap POI |
| **Expected Result** | ⚠️ Fallback to English OR Vietnamese |
| **Status** | ⬜ Not Run |

#### TC-5.5: All 15 Languages Supported
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-5.5 |
| **Title** | All 15 languages listed & functional |
| **Steps** | 1. Open language selector → 2. Verify all 15 present |
| **Expected Result** | ✅ VI, EN, KO, JA, FR, DE, ES, PT, RU, ZH, TH, ID, HI, AR, TR |
| **Status** | ⬜ Not Run |

---

### Scenario 6 – Audio Playback Controls (UC6)

#### TC-6.1: Pause Audio
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-6.1 |
| **Title** | User pauses audio mid-playback |
| **Precondition** | Audio playing, 25s elapsed |
| **Steps** | 1. Tap Pause button |
| **Expected Result** | ✅ Audio pauses at 25s mark |
| **Status** | ⬜ Not Run |

#### TC-6.2: Resume from Pause
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-6.2 |
| **Title** | User resumes paused audio |
| **Precondition** | Audio paused |
| **Steps** | 1. Tap Resume button |
| **Expected Result** | ✅ Audio resumes from pause point |
| **Status** | ⬜ Not Run |

#### TC-6.3: Stop Audio
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-6.3 |
| **Title** | User stops audio completely |
| **Precondition** | Audio playing or paused |
| **Steps** | 1. Tap Stop button |
| **Expected Result** | ✅ Audio stops, mini player closes, state = IDLE |
| **Status** | ⬜ Not Run |

#### TC-6.4: Close Bottom Sheet While Playing
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-6.4 |
| **Title** | Dismiss bottom sheet during playback |
| **Precondition** | Audio playing, bottom sheet visible |
| **Steps** | 1. Swipe down bottom sheet |
| **Expected Result** | ✅ Bottom sheet closes, audio continues (optional: mini player in notification) |
| **Status** | ⬜ Not Run |

---

### Scenario 7 – Food Tour Exploration (UC7)

#### TC-7.1: Select Tour
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-7.1 |
| **Title** | User selects "Ăn vặt Sinh viên" tour |
| **Steps** | 1. Open Tours tab → 2. Tap "Ăn vặt Sinh viên" |
| **Expected Result** | ✅ Map filters to show 8 POI markers in order (1, 2, 3, ...) |
| **Status** | ⬜ Not Run |

#### TC-7.2: Tour POI Sequence
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-7.2 |
| **Title** | POI markers numbered in tour order |
| **Precondition** | Tour selected |
| **Steps** | 1. View map |
| **Expected Result** | ✅ Markers labeled 1-8 in sequence (per poi_ids array) |
| **Status** | ⬜ Not Run |

#### TC-7.3: Tour Description Displayed
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-7.3 |
| **Title** | Tour info shown (name, duration, POI count) |
| **Precondition** | Tour selected |
| **Steps** | 1. View tour banner |
| **Expected Result** | ✅ Shows: "Ăn vặt Sinh viên", "120 phút", "8 địa điểm" |
| **Status** | ⬜ Not Run |

#### TC-7.4: Exit Tour Returns to All POIs
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-7.4 |
| **Title** | Exit tour, map shows all POIs again |
| **Precondition** | In tour mode |
| **Steps** | 1. Tap "Exit Tour" |
| **Expected Result** | ✅ All POI markers visible again, no filter |
| **Status** | ⬜ Not Run |

---

## 3. Edge Case & Error Handling Test Scenarios

### Scenario 8 – Offline Mode (UC8)

#### TC-8.1: Full Offline Exploration
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-8.1 |
| **Title** | App fully functional without internet |
| **Precondition** | WiFi/4G off, app previously synced |
| **Steps** | 1. Open app offline → 2. View map → 3. Tap POI → 4. Play audio |
| **Expected Result** | ✅ Map loads, POIs visible, audio plays (all from local cache) |
| **Status** | ⬜ Not Run |

#### TC-8.2: Offline Sync Deferred
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-8.2 |
| **Title** | Sync request queued while offline |
| **Steps** | 1. Offline → 2. Tap "Sync" button |
| **Expected Result** | ⚠️ Queue sync, show "Sẽ đồng bộ khi có internet" |
| **Status** | ⬜ Not Run |

#### TC-8.3: Analytics Buffered Offline
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-8.3 |
| **Title** | Analytics events logged locally, uploaded when online |
| **Precondition** | Offline, complete POI explorations |
| **Steps** | 1. Tap/Play POIs (accumulate events) → 2. Go online → 3. App syncs |
| **Expected Result** | ✅ Events buffered, uploaded on next sync |
| **Status** | ⬜ Not Run |

---

### Scenario 9 – Data Corruption & Recovery

#### TC-9.1: Corrupted SQLite Database
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-9.1 |
| **Title** | SQLite corruption detected and recovered |
| **Precondition** | SQLite file corrupted (manually corrupt file) |
| **Steps** | 1. Open app |
| **Expected Result** | ✅ App detects, wipes, re-downloads from server |
| **Status** | ⬜ Not Run |

#### TC-9.2: Missing Audio File
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-9.2 |
| **Title** | POI audio file deleted from device |
| **Precondition** | MP3 file manually deleted from file system |
| **Steps** | 1. Tap "Listen" for missing audio |
| **Expected Result** | ❌ Error: "Không thể phát âm thanh" OR re-download from server |
| **Status** | ⬜ Not Run |

---

### Scenario 10 – Network & Connectivity

#### TC-10.1: Network Timeout During Sync
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-10.1 |
| **Title** | Sync fails due to network timeout |
| **Precondition** | Poor network connection |
| **Steps** | 1. Sync initiated |
| **Expected Result** | ⚠️ Timeout error, queue for retry |
| **Status** | ⬜ Not Run |

#### TC-10.2: Partial Sync Completion
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-10.2 |
| **Title** | User closes app mid-sync |
| **Precondition** | Sync in progress |
| **Steps** | 1. Close app during sync |
| **Expected Result** | ✅ Sync resumes/completes on next launch (delta sync) |
| **Status** | ⬜ Not Run |

#### TC-10.3: Token Expiration
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-10.3 |
| **Title** | JWT token expires, app re-authenticates |
| **Precondition** | Token expiration triggered (fast-forward time) |
| **Steps** | 1. Make API call with expired token |
| **Expected Result** | ✅ App refreshes token automatically OR prompts re-auth |
| **Status** | ⬜ Not Run |

---

## 4. Multi-Language Test Scenarios

### Scenario 11 – Comprehensive i18n Testing

#### TC-11.1 through TC-11.15: Each Language

| Suite | Test | Example |
|-------|------|---------|
| **TC-11.1** | Vietnamese (Vi) | Text renders in Vietnamese font, audio plays Vietnamese voice |
| **TC-11.2** | English (En) | English text, English voice |
| **TC-11.3** | Korean (Ko) | 한국어 text, Korean voice |
| **TC-11.4** | Japanese (Ja) | 日本語 text, Japanese voice |
| **TC-11.5** | French (Fr) | Français text, French voice |
| **TC-11.6** | German (De) | Deutsch text, German voice |
| **TC-11.7** | Spanish (Es) | Español text, Spanish voice |
| **TC-11.8** | Portuguese (Pt) | Português text, Portuguese voice |
| **TC-11.9** | Russian (Ru) | Русский text, Russian voice |
| **TC-11.10** | Chinese (Zh) | 中文 text, Chinese voice |
| **TC-11.11** | Thai (Th) | ไทย text, Thai voice |
| **TC-11.12** | Indonesian (Id) | Bahasa Indonesia text, Indonesian voice |
| **TC-11.13** | Hindi (Hi) | हिन्दी text, Hindi voice |
| **TC-11.14** | Arabic (Ar) | العربية text, Arabic voice |
| **TC-11.15** | Turkish (Tr) | Türkçe text, Turkish voice |

**For each**: ✅ Text renders correctly, audio file loads, playback quality OK

---

### Scenario 12 – RTL Language Support (Arabic)

#### TC-12.1: Arabic Text Rendering
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-12.1 |
| **Title** | Arabic text renders right-to-left |
| **Steps** | 1. Select Arabic → 2. View POI details |
| **Expected Result** | ✅ Text flows right-to-left, diacritics correct |
| **Status** | ⬜ Not Run |

---

## 5. Performance & Reliability Test Scenarios

### Scenario 13 – Response Times

#### TC-13.1: API Response Time
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-13.1 |
| **Title** | API responses time < 200ms (p95) |
| **Measurement** | 100 requests to `/sync/manifest` |
| **Expected Result** | ✅ p95 < 200ms |
| **Status** | ⬜ Not Run |

#### TC-13.2: Audio Playback Start Latency
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-13.2 |
| **Title** | Audio starts playing < 1-2s after "Listen" tap |
| **Measurement** | 20 audio play attempts |
| **Expected Result** | ✅ Average < 2s, max < 2s |
| **Status** | ⬜ Not Run |

#### TC-13.3: Sync Time (Full Load)
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-13.3 |
| **Title** | First sync completes < 5 seconds |
| **Measurement** | Network: 4G, 50 POIs |
| **Expected Result** | ✅ Full sync < 5s |
| **Status** | ⬜ Not Run |

#### TC-13.4: Map Load Time
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-13.4 |
| **Title** | Map renders with all markers < 2s |
| **Measurement** | From auth complete to all markers visible |
| **Expected Result** | ✅ < 2s |
| **Status** | ⬜ Not Run |

---

### Scenario 14 – Memory & Battery

#### TC-14.1: Memory Usage Steady
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-14.1 |
| **Title** | Memory usage stable during 30-min exploration |
| **Steps** | 1. Monitor memory → 2. Explore, tap POIs, play audio → 3. Monitor |
| **Expected Result** | ✅ No memory leaks, steady < 150MB |
| **Status** | ⬜ Not Run |

#### TC-14.2: Battery Impact
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-14.2 |
| **Title** | 30-min exploration consumes < 10% battery |
| **Precondition** | Device at 100% battery |
| **Steps** | 1. Explore offline (GPS on, WiFi off) for 30 min |
| **Expected Result** | ✅ < 10% battery drain |
| **Status** | ⬜ Not Run |

---

## 6. Integration Test Scenarios

### Scenario 15 – Backend Integration

#### TC-15.1: Auth Flow Integration
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-15.1 |
| **Title** | Full auth flow: code validation → sync → usage |
| **Steps** | 1. Enter claim code → 2. Sync → 3. Explore |
| **Expected Result** | ✅ End-to-end flow works without errors |
| **Status** | ⬜ Not Run |

#### TC-15.2: Payment Callback Webhook
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-15.2 |
| **Title** | Payment provider webhook processed correctly |
| **Steps** | 1. Pay via VNPay → 2. Provider sends callback |
| **Expected Result** | ✅ Backend processes, user authorized, sync works |
| **Status** | ⬜ Not Run |

#### TC-15.3: Analytics Batch Upload
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-15.3 |
| **Title** | Analytics events collected & uploaded |
| **Steps** | 1. Explore offline (10 POIs tapped) → 2. Go online |
| **Expected Result** | ✅ Events batch uploaded to server, backend logs them |
| **Status** | ⬜ Not Run |

#### TC-15.4: Sync Manifest Version Check
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-15.4 |
| **Title** | Mobile checks manifest version, triggers sync if newer |
| **Precondition** | Admin updates POI on server |
| **Steps** | 1. Mobile calls `/sync/manifest` |
| **Expected Result** | ✅ Mobile detects version change, fetches full sync |
| **Status** | ⬜ Not Run |

---

### Scenario 16 – Content Update Cycle

#### TC-16.1: Admin Creates POI
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-16.1 |
| **Title** | Admin creates new POI, audio generated, mobile syncs |
| **Steps** | 1. Admin adds new POI via CMS → 2. Backend triggers TTS → 3. Audio saved → 4. Mobile syncs |
| **Expected Result** | ✅ New POI appears on mobile map with audio playable |
| **Status** | ⬜ Not Run |

#### TC-16.2: Admin Edits POI Description
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-16.2 |
| **Title** | Admin edits POI text, new audio generated |
| **Steps** | 1. Admin edits description → 2. TTS regenerated → 3. Mobile syncs |
| **Expected Result** | ✅ Mobile gets new audio, old version replaced |
| **Status** | ⬜ Not Run |

---

### Scenario 17 – Overlap Zones, Queue Scale, Online Presence

#### TC-17.1: Overlap Zone Highlight is Visual Only
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-17.1 |
| **Title** | User enters area with multiple nearby POIs |
| **Precondition** | >= 2 POIs within 500m radius |
| **Steps** | 1. Move to overlap area → 2. Observe map |
| **Expected Result** | ✅ Multiple POIs highlighted, no audio auto-play |
| **Status** | ⬜ Not Run |

#### TC-17.2: Deterministic POI Recommendation in Overlap
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-17.2 |
| **Title** | Same overlap input returns same recommended POI |
| **Precondition** | Fixed set of nearby POIs with known distances/priorities |
| **Steps** | 1. Call recommendation logic 10 times with same input |
| **Expected Result** | ✅ Output stable (distance -> priority -> poi_id tie-break) |
| **Status** | ⬜ Not Run |

#### TC-17.3: TTS Queue Idempotency
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-17.3 |
| **Title** | Duplicate TTS job is not processed twice |
| **Precondition** | Existing job key `{poiId}:{language}:{contentVersion}` already queued |
| **Steps** | 1. Submit same job key again |
| **Expected Result** | ✅ Queue keeps single effective job, no duplicate MP3 generation |
| **Status** | ⬜ Not Run |

#### TC-17.4: TTS Queue Retry and Failed Set
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-17.4 |
| **Title** | Failed TTS provider call retries then moves to failed set |
| **Precondition** | Mock provider returns 5xx consistently |
| **Steps** | 1. Trigger TTS job |
| **Expected Result** | ✅ Retries follow backoff, after max attempts job marked failed |
| **Status** | ⬜ Not Run |

#### TC-17.5: Online Now Window (90s)
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-17.5 |
| **Title** | Dashboard counts user as online when heartbeat < 90s |
| **Precondition** | Heartbeat interval 30s |
| **Steps** | 1. Send heartbeat → 2. Query dashboard |
| **Expected Result** | ✅ User appears in `online_now`; drops out after > 90s without heartbeat |
| **Status** | ⬜ Not Run |

#### TC-17.6: Active 5m Metric
| Field | Value |
|-------|-------|
| **Test Case ID** | TC-17.6 |
| **Title** | User counted in `active_5m` when activity within last 5 minutes |
| **Steps** | 1. Send interaction event or heartbeat → 2. Query dashboard |
| **Expected Result** | ✅ User included in `active_5m`, excluded after > 5m inactivity |
| **Status** | ⬜ Not Run |

---

## 7. Test Execution Summary Template

### Template for Test Run

```
Test Suite: Phố Ẩm Thực v1.0
Date: 2026-04-15
Tester: [Name]
Environment: Android 12, Device: Samsung Galaxy S21

┌──────────────────────────────────────────────────────────────┐
│ FUNCTIONAL TESTS                                             │
├──────────────────┬──────────┬──────────┬──────────┬──────────┤
│ Test Case ID     │ Status   │ Duration │ Notes    │ Blocker  │
├──────────────────┼──────────┼──────────┼──────────┼──────────┤
│ TC-1.1           │ ✅ PASS  │ 45s      │          │ No       │
│ TC-1.2           │ ✅ PASS  │ 30s      │          │ No       │
│ TC-1.3           │ ✅ PASS  │ 35s      │          │ No       │
│ TC-2.1           │ ✅ PASS  │ 50s      │          │ No       │
│ TC-3.1           │ ✅ PASS  │ 60s      │ Audio ok │ No       │
│ TC-4.1           │ ❌ FAIL  │ 25s      │ QR slow  │ YES      │
│ ...              │          │          │          │          │
└──────────────────┴──────────┴──────────┴──────────┴──────────┘

SUMMARY:
- Total Passed: 42/50
- Total Failed: 5/50
- Total Skipped: 3/50
- Pass Rate: 84%
- Critical Blockers: 1 (TC-4.1)

BLOCKERS:
1. QR scanning slow (> 3s)
   Action: Investigate camera permission, optimize scanner

RECOMMENDATIONS:
1. Increase QR scanner timeout
2. Add pre-loading for audio files
```

---

## 8. Regression Test Checklist

**Before each release**, verify:

- [ ] Auth flow (TC-1.1 through TC-1.5)
- [ ] Map & POI tap (TC-2.1, TC-2.2)
- [ ] Audio playback (TC-3.1 through TC-3.5)
- [ ] Single Voice Rule (TC-3.2, TC-4.2)
- [ ] Overlap visual-only and deterministic recommendation (TC-17.1, TC-17.2)
- [ ] Language switching (TC-5.1, TC-5.2, TC-5.3)
- [ ] Offline mode (TC-8.1, TC-8.2, TC-8.3)
- [ ] Performance (TC-13.1, TC-13.2, TC-13.3)
- [ ] Backend integration (TC-15.1, TC-15.2)
- [ ] Queue resilience and online dashboard semantics (TC-17.3 through TC-17.6)

### 8.1 Release Gate (1-1 UC -> AC -> TC)

- [ ] UC1 gate pass: TC-1.1
- [ ] UC2 gate pass: TC-2.2
- [ ] UC3 gate pass: TC-3.2
- [ ] UC4 gate pass: TC-4.1
- [ ] UC5 gate pass: TC-5.1
- [ ] UC6 gate pass: TC-6.3
- [ ] UC7 gate pass: TC-7.1
- [ ] UC8 gate pass: TC-8.1

---

## References

- USE_CASES.md – Detailed use cases
- SPEC_CANONICAL.md – Rules & constraints
- backend_design.md – API endpoints & behavior
