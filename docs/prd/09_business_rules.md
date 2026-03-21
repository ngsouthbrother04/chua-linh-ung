# Section 11: Business Rules

← [Back to Index](index.md)

---

## 11. Business Rules

| ID | Rule Name | Description | Impact |
|----|-----------|-------------|--------|
| BR-001 | Authentication Gate | Khách phải xác thực (thanh toán hoặc claim code) trước khi truy cập nội dung POI và tính năng GPS. Read-only map có thể xem trước mà không cần auth. | Bảo vệ nội dung premium; đảm bảo doanh thu |
| BR-002 | Offline-first | Sau khi sync lần đầu, toàn bộ tính năng (GPS, narration, tour, map) phải hoạt động không cần internet. Không được gửi request API trong phiên tham quan. | Performance cao; phù hợp môi trường mạng yếu tại chùa |
| BR-003 | Data Integrity | Quá trình sync dữ liệu phải là atomic — hoặc thành công hoàn toàn hoặc rollback. Không cho phép partial data trong SQLite. | Đảm bảo tính nhất quán; tránh crash do thiếu field |
| BR-004 | Geofence Engine là Decision Core | Mọi quyết định khi nào bắt đầu/dừng narration phải đến từ Geofence Engine. GPS tracking KHÔNG ĐƯỢC trực tiếp trigger audio. | Tách biệt responsibility; dễ test và debug |
| BR-005 | Stop-on-Exit Bắt buộc | Khi khách rời geofence POI, narration PHẢI dừng ngay lập tức. Không cho phép tiếp tục phát khi đã ra ngoài POI boundary. | Đảm bảo tính chính xác không gian — principle cốt lõi của hệ thống |
| BR-006 | Claim Code Dùng Một Lần | Mỗi claim code chỉ được validate thành công một lần. Sau khi dùng, code bị đánh dấu vô hiệu trong DB server. | Ngăn chia sẻ mã vé; bảo vệ doanh thu |
| BR-007 | Single Voice Rule | Tại mọi thời điểm, chỉ có tối đa một narration đang phát. Narration mới phải dừng narration cũ trước khi bắt đầu. | Tránh overlap âm thanh gây mất tập trung |
| BR-008 | Fast-Movement Handling | Khi EXIT_POI_A và ENTER_POI_B xảy ra trong vòng 3 giây: audio POI_A phải dừng ngay, audio POI_B được ưu tiên. | Xử lý đúng khi khách di chuyển nhanh qua nhiều điểm |
| BR-009 | QR là Fallback | QR code chỉ là phương thức dự phòng khi GPS không sẵn sàng hoặc khách muốn kích hoạt thủ công. QR không thay thế Geofence Engine. | Đảm bảo ưu tiên trải nghiệm tự động |
| BR-010 | QR chỉ cho Fixed POI | QR codes chỉ được gán cho các điểm cố định, không thay đổi vị trí. Không được gắn QR cho điểm di động. | Tránh thuyết minh sai vị trí |
| BR-011 | Analytics Ẩn danh | Tất cả analytics data phải dùng deviceId ẩn danh (UUID ngẫu nhiên), không liên kết với thông tin cá nhân của khách. | Tuân thủ GDPR và quy định bảo vệ dữ liệu cá nhân |
| BR-012 | Narration Không Duplicate | Cùng một POI không được phát lại trong vòng 30 giây sau khi vừa phát xong (replay window). Geofence cooldown mặc định là 10 giây theo trigger metadata. | Tránh khó chịu cho khách khi GPS jitter |
| BR-013 | Content Version Check | Khi mở app, system phải kiểm tra content version. Nếu server version mới hơn → yêu cầu sync khi có mạng. Nếu không có mạng → dùng data cũ với cảnh báo. | Đảm bảo nội dung được cập nhật kịp thời |
