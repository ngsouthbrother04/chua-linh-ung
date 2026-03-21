# Sections 14–15: Risks & Open Questions

← [Back to Index](index.md)

---

## 14. Risks & Mitigations

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
| R-001 | GPS accuracy quá thấp → false positive geofence triggers | Medium | High | Sử dụng hysteresis (enter + exit threshold khác nhau); minimum accuracy filter 30m; debounce 2s trước khi xử lý |
| R-002 | Thiết bị không có TTS engine cho ngôn ngữ đã chọn | Medium | High | Fallback to English; hiển thị cảnh báo "Thiết bị không hỗ trợ ngôn ngữ này, đang dùng tiếng Anh" |
| R-003 | Background location bị OS kill do battery optimization | High | High | Sử dụng persistent foreground service notification trên Android; test kỹ trên iOS với designated entitlement |
| R-004 | Dataset POI quá lớn → sync timeout tại lần đầu | Medium | Medium | Chunk download; progress UI; cho phép resume sync; minimal viable set download trước |
| R-005 | VNPay/Momo deep link không được app catch → stuck trong WebView | Medium | High | Timeout fallback 5 phút; nút "Kiểm tra trạng thái thanh toán" thủ công; webhook server-side để confirm |
| R-006 | iOS background tracking restrictions thay đổi theo region | Low | Medium | Theo dõi Apple Developer documentation; functional testing trên nhiều iOS versions |
| R-007 | Nhiều POI polygon gần nhau → user vào/ra liên tục nhiều POI | Medium | Medium | Cooldown mặc định 10s per POI (configurable theo trigger metadata); chỉ play POI mới nếu đã kết thúc POI cũ |
| R-008 | Claim Code hết hạn hoặc đã dùng → user bị chặn khỏi nội dung | Medium | High | Rõ ràng trong UI: "Mã không hợp lệ hoặc đã được sử dụng"; hướng dẫn liên hệ ban quản lý |
| R-009 | expo-speech trả lời không đồng nhất giữa iOS và Android | High | Medium | Wrap trong abstraction layer; unit test TTS layer riêng; UI fallback "Đọc bài thuyết minh" |
| R-010 | App bị kill hoàn toàn trong lúc narration đang chạy | Medium | Low | Trạng thái PLAYING reset về IDLE khi re-launch; cooldown timer không persist qua app restart |

---

## 15. Open Questions

| ID | Câu hỏi | Priority | Owner | Deadline |
|----|---------|---------|-------|---------|
| Q1 | Nếu user re-enter cùng POI trong thời gian cooldown mặc định 10s, có bật lại narration không? | High | Product | Sprint 1 |
| Q2 | Khi polygon GeoJSON bị lỗi/corrupt, hành vi mong đợi là gì? Error silently hay cảnh báo user? | High | Engineering | Sprint 1 |
| Q3 | Có nên có nút "Phát thủ công" trên POI info sheet khi GPS đang active không? | Medium | Product | Sprint 2 |
| Q4 | Analytics upload nên chạy ở background hay foreground only để tiết kiệm battery? | Medium | Engineering | Sprint 2 |
| Q5 | Content version check chạy mỗi khi mở app hay theo lịch? (app launch only vs every 1h) | Medium | Product | Sprint 2 |
| Q6 | Nên lưu lịch sử các POI đã nghe trong session hiện tại để tránh replay không? | Medium | Product | Sprint 2 |
| Q7 | Khi speed detection thấy user đang di chuyển nhanh (>30km/h), có skip geofence hoàn toàn không hay chỉ debounce? | High | Engineering | Sprint 1 |
| Q8 | Khi user có subscription, thời hạn token là bao lâu? Auto-renew khi nào? | High | Product | Sprint 1 |
| Q9 | App có hỗ trợ mode "không có GPS" (ví dụ bảo tàng trong nhà) và chỉ dùng QR không? | Low | Product | Sprint 3 |
| Q10 | Có cần accessibility mode cho người khiếm thị (VoiceOver/TalkBack + large text) không? | Medium | Product | Sprint 3 |
