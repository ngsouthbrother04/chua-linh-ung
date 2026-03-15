# AI Agent Prompt Templates

Bộ prompt mẫu giúp team làm việc nhất quán với AI agent, tránh lệch tài liệu và giảm vibe-coding.

> **Nguyên tắc vận hành:**
>
> - Mỗi task chỉ giao đúng 1 chức năng — không gộp nhiều module trong 1 prompt.
> - AI bắt buộc báo mapping AC trước khi kết thúc.

---

## Thứ tự đọc tài liệu chuẩn

Tất cả các template đều yêu cầu đọc theo thứ tự này:

1. `TEAM_START_HERE.md`
2. `SPEC_CANONICAL.md`
3. `docs/user/prd/index.md`
4. `docs/user/prd/03_functional_requirements.md`
5. `docs/user/prd/04_acceptance_criteria.md`
6. `EXECUTION_TODO_ISSUES.md`

Nếu có xung đột giữa tài liệu, áp dụng thứ tự ưu tiên trong `SPEC_CANONICAL.md`.

---

## Template 1 — Chức năng tổng quát

**Mục tiêu:** Implement đúng 1 chức năng `<TEN_CHUC_NANG>`.

**Thông tin task:**

- Issue: `<ISSUE_ID>`
- Files được sửa: `<DANH_SACH_FILE>`
- AC cần pass: `<DANH_SACH_AC>`
- Không được thay đổi: `<INVARIANTS_HOAC_DEFAULTS>`

**Trước khi code, trả lời ngắn:**

1. Scope chính xác là gì
2. File sẽ sửa / không sửa
3. Rủi ro chính

**Khi thực thi:**

1. Chỉ sửa trong phạm vi task
2. Không đổi behavior ngoài scope
3. Nếu cần đổi contract hoặc default behavior, dừng lại và hỏi xác nhận

**Báo cáo cuối (bắt buộc):**

1. Files changed
2. Tóm tắt thay đổi theo file
3. Mapping AC: pass / chưa pass
4. Rủi ro còn lại
5. Next step nhỏ nhất để merge

---

## Template 2 — Backend API

**Mục tiêu:** Implement endpoint `<TEN_ENDPOINT>` cho chức năng `<TEN_CHUC_NANG>`.

**Bối cảnh kỹ thuật:** Node.js 20+, Express, TypeScript.

**Yêu cầu thực thi:**

1. Đọc tài liệu theo thứ tự chuẩn, xác nhận contract request/response trước khi code
2. Implement route, validation, error handling và status code đúng chuẩn
3. Không hardcode dữ liệu nếu đã có nguồn từ DB/schema
4. Trả lỗi có cấu trúc ổn định để mobile xử lý được

**Báo cáo cuối (bắt buộc):**

1. Endpoint path
2. Request schema
3. Response success schema
4. Response error schema
5. Files changed
6. Cách test nhanh (lệnh hoặc ví dụ request)

---

## Template 3 — Mobile Geofence & Narration

**Mục tiêu:** Implement chức năng `<TEN_CHUC_NANG>` trong luồng geofence và narration.

**Invariants bắt buộc (không được vi phạm):**

1. Geofence là decision core cho luồng tự động theo GPS
2. Stop-on-exit là bắt buộc
3. Chỉ một narration tại một thời điểm
4. QR là fallback thủ công, vẫn đi qua state machine
5. Debounce, cooldown, replay window phải giữ đúng default chuẩn

**Yêu cầu thực thi:**

1. Tách rõ geofence event và audio action — không trigger TTS trực tiếp từ GPS callback
2. Update state machine đúng transition chuẩn
3. Không sửa default timing nếu chưa có yêu cầu thay đổi spec
4. Đối chiếu kết quả với test scenarios liên quan

**Báo cáo cuối (bắt buộc):**

1. Transition đã implement
2. Event được phát sinh
3. Điều kiện stop và interrupt
4. AC đã pass
5. Rủi ro còn lại

---

## Template 4 — UI Flow

**Mục tiêu:** Implement UI flow `<TEN_FLOW>` theo PRD.

**Yêu cầu thực thi:**

1. Đọc section UI/UX và functional requirements liên quan
2. Tách rõ state UI, data source và action handlers
3. Không thay đổi text/logic nghiệp vụ ngoài flow được giao
4. Ưu tiên khả năng dùng thật trên mobile trước tối ưu giao diện

**Báo cáo cuối (bắt buộc):**

1. Màn hình / component đã thêm hoặc sửa
2. Trigger hành động từ user
3. Kết quả mong đợi sau mỗi action
4. Mapping AC tương ứng
5. Gaps còn lại

---

## Template 5 — Code Review

**Vai trò:** Code reviewer — kiểm tra thay đổi vừa thực hiện.

**Trọng tâm review:**

1. Sai phạm invariant theo `SPEC_CANONICAL.md`
2. Regression behavior ngoài phạm vi chức năng
3. Thiếu xử lý lỗi hoặc thiếu điều kiện biên
4. Thiếu test hoặc test không chứng minh được AC

**Yêu cầu output:**

1. Findings theo mức độ nghiêm trọng (Critical / Major / Minor)
2. Mỗi finding phải có file và vị trí cụ thể
3. Nếu không có lỗi, ghi rõ residual risk
