# Section 17: Future Enhancements

← [Back to Index](index.md)

---

## 17. Future Enhancements

### Phase 2 — v1.1–v1.2 (3–6 tháng sau launch)

**17.1 High-Quality Pre-recorded Audio**

- Thay thế expo-speech (on-device TTS) bằng audio files MP3 được thu âm chuyên nghiệp
- Mỗi POI × mỗi ngôn ngữ = 1 file audio
- CDN streaming + local cache (không tải toàn bộ ngay)
- Playback: react-native-track-player (seek, progress bar, real duration)

**17.2 Tour Progress & History**

- Lưu lại các POI đã thăm trong session
- "Bản đồ hành trình" hiển thị lộ trình đã đi
- Badge/milestone khi hoàn thành 50%, 100% tour
- Share lộ trình dưới dạng ảnh lên mạng xã hội

**17.3 Push Notifications**

- Nhắc user khi có nội dung mới
- "Hôm nay là ngày lễ X — hãy thăm điện Y để nghe thuyết minh đặc biệt"
- Sử dụng expo-notifications + backend scheduling

**17.4 Rating & Feedback**

- Sau khi nghe narration xong → prompt 1 câu hỏi ngắn: "Bạn thấy nội dung này thế nào?"
- Star rating per POI / per Tour
- Free-text feedback (optional)
- Admin dashboard hiển thị average rating

---

### Phase 3 — v2.0 (6–12 tháng)

**17.5 AI-Powered Q&A Chatbot**

- User hỏi câu hỏi liên quan trong khoảng cách một POI
- RAG (Retrieval-Augmented Generation) từ POI knowledge base
- Multilingual: tự detect ngôn ngữ user gõ
- Voice input (speech-to-text) + voice output (TTS)

**17.6 AR Navigation (Augmented Reality)**

- Dùng camera phone hiển thị arrow/label overlay chỉ hướng đến POI tiếp theo
- Dùng ARKit (iOS) / ARCore (Android) qua expo-modules
- POI labels float trong không gian 3D
- Ngưỡng kích hoạt: khi user còn cách POI <50m

**17.7 Offline Map Tiles**

- Download tile package cho khu vực chùa Linh Ứng trước khi đến
- Dùng Mapbox SDK offline maps
- Map hiển thị đầy đủ không cần internet

**17.8 Multi-day Visit Support**

- Token (vé) có hiệu lực 3 ngày thay vì 1 ngày
- Resume tour từ lần dừng cuối (persistent progress)
- Lịch khai giảng, lịch lễ, sự kiện tích hợp trong app

---

### Phase 4 — v3.0 (12–24 tháng)

**17.9 Multi-venue Support**

- Mở rộng ngoài chùa Linh Ứng → Ngũ Hành Sơn, chùa Cầu Hội An, v.v.
- Venue selection screen khi mở app
- Admin multi-venue management
- Revenue sharing model per venue

**17.10 Wearable Companion App**

- Apple Watch / Wear OS companion
- Vibration alert khi approach POI
- Mini player controls (Play/Pause) trên wrist
- Map glance với current location

**17.11 Accessibility Mode**

- VoiceOver (iOS) / TalkBack (Android) full compatibility
- Large text mode tự động detect từ OS settings
- High contrast mode
- Narration speed control (0.5x — 2.0x)
- Screen color filter cho người color-blind

**17.12 Social & Gamification**

- "Tour Challenge": hoàn thành X POI trong Y giờ
- Leaderboard per venue
- NFT certificates / digital souvenirs khi complete full tour
- Friend tracking: thấy bạn bè đang ở đâu trong map
