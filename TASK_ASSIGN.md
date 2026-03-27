# Phân Công Công Việc Cho 4 Nhánh GitHub

## 1. Căn cứ phân công
Phân công này được lập dựa trên các tài liệu chuẩn của dự án:
- `SPEC_CANONICAL.md` (invariant và timing mặc định)
- `IMPLEMENTATION_TASK_BREAKDOWN.md` (workstream và milestone)
- `EXECUTION_TODO_ISSUES.md` (issue, dependencies, story points)
- `docs/prd/04_acceptance_criteria.md` và `docs/test_scenarios.md` (tiêu chí nghiệm thu)

Nguyên tắc:
1. Ưu tiên chia đều khối lượng theo story points.
2. Tôn trọng dependencies giữa các issue để tránh block chéo.
3. Mỗi nhánh có owner chính, các nhánh khác review chéo theo mốc.

## 2. Mapping người phụ trách theo nhánh
- Người 1: nhánh `3122410411` (Backend)
- Người 2: nhánh `3122410452` (Mobile)
- Người 3: nhánh `3122410466` (Web FE)
- Người 4: nhánh `3122560001` (Backend)

## 2.1 Cập nhật trạng thái hoàn thành (2026-03-26)
- ISSUE-001: ĐÃ HOÀN THÀNH
- ISSUE-002: ĐÃ HOÀN THÀNH
- ISSUE-003: ĐÃ HOÀN THÀNH
- ISSUE-003B: ĐÃ HOÀN THÀNH

Ghi chú: trạng thái này đã được đồng bộ với tracker canonical tại `EXECUTION_TODO_ISSUES.md`.

## 3. Bảng phân công chính (cân bằng khối lượng)

| Nhánh | Người phụ trách | Issue được giao | Tổng SP | Ghi chú phụ thuộc chính |
|---|---|---|---:|---|
| `3122410411` | Người 1 (Backend) | ISSUE-003, ISSUE-003B, ISSUE-013 | 21 | Backend TTS + sync contract + integration gate (API/auth/sync/offline) |
| `3122410452` | Người 2 (Mobile) | ISSUE-004, ISSUE-005, ISSUE-006, ISSUE-008 | 21 | Mobile runtime: app shell, SQLite, sync bootstrap, State Machine |
| `3122410466` | Người 3 (Web FE) | ISSUE-007, ISSUE-009, ISSUE-010, ISSUE-011, ISSUE-012 | 20 | FE flows: map/QR/language-playback/tour + quality gate UI behavior |
| `3122560001` | Người 4 (Backend) | ISSUE-001, ISSUE-002 | 21 | Backend bootstrap + auth/payment API và hardening nền tảng |

Ghi chú điều phối an toàn (2026-03-26):
1. Nhánh `3122560001` được phép triển khai thêm ISSUE-003 theo mô hình hỗ trợ owner để giảm thời gian chờ tích hợp.
2. Trạng thái owner gốc của ISSUE-003 vẫn giữ ở `3122410411`; merge thực hiện sau khi review chéo 2 nhánh backend.
3. Mọi thay đổi ISSUE-003 trên `3122560001` phải cập nhật đồng bộ vào `EXECUTION_TODO_ISSUES.md` trước khi mở PR.

Phân bổ SP: `21 / 21 / 20 / 21` (độ lệch nhỏ, chấp nhận được).

## 4. Kế hoạch chạy theo Sprint để giảm block

### Sprint S1 (P0 Foundation)
- Nhánh `3122410411` (Backend): ISSUE-003, ISSUE-003B
- Nhánh `3122410452` (Mobile): ISSUE-004, ISSUE-005, ISSUE-006, ISSUE-008
- Nhánh `3122410466` (Web FE): ISSUE-007
- Nhánh `3122560001` (Backend): ISSUE-001, ISSUE-002

Gate cuối S1:
1. API auth/sync chạy được, schema ổn.
2. SQLite local hoạt động và sync offline-first pass.
3. Narration State Machine chạy đúng các state chính; chỉ Tap/QR trigger audio, không geofence/auto-play.

### Sprint S2 (P0 Completion + P1 Core UX)
- Nhánh `3122410411` (Backend): ISSUE-013 + hỗ trợ hardening API/sync theo kết quả integration
- Nhánh `3122410466` (Web FE): ISSUE-009, ISSUE-010, ISSUE-011
- Nhánh `3122410452` (Mobile): ổn định integration với State Machine/SQLite theo API đã chốt
- Nhánh `3122560001` (Backend): hỗ trợ review chéo và xử lý hardening backend phát sinh từ S1/S2

Gate cuối S2:
1. QR fallback đi qua cùng State Machine.
2. Single Voice Rule giữ đúng: POI-B play phải dừng POI-A ngay trước khi phát mới.
3. Language/playback/tour chạy ổn trên dữ liệu SQLite.
4. Analytics local + batch API thông suốt.

### Sprint S3 (Quality + Hardening)
- Nhánh `3122410411` (Backend): đóng backend test debt và regression integration
- Nhánh `3122410452` (Mobile): xử lý bugfix sync/offline/state machine sau QA
- Nhánh `3122560001` (Backend): hardening backend theo residual risks và test bổ sung
- Nhánh `3122410466` (Web FE): đóng ISSUE-012 và fix bug FE flows (map/QR/language/tour)

Gate cuối S3:
1. Unit + integration + scenario test pass.
2. Checklist hiệu năng và release được xác nhận.

## 5. Quy ước phối hợp để code không lệch docs
1. Không đổi behavior default nếu chưa cập nhật `SPEC_CANONICAL.md` trước.
2. Mọi PR phải ghi rõ mapping AC đã pass/chưa pass.
3. Khi sửa PRD trong `docs/prd/*` thì cập nhật `docs/prd/index.md` nếu cần và chạy `npm run docs:check-prd-sync`.
4. Các issue có dependency chỉ được merge khi issue tiền đề đã merge vào `main` (hoặc branch tích hợp được team thống nhất).
5. Chỉ dùng issue canonical trong `EXECUTION_TODO_ISSUES.md` (ISSUE-001..013 + ISSUE-003B); không tự phát sinh mã issue ngoài tracker khi chưa cập nhật tracker.

## 6. Danh sách AC/test ưu tiên review chéo
- Review chéo bắt buộc giữa 2 nhánh Backend (`3122410411` và `3122560001`) cho các luồng: auth/payment, sync manifest/full, TTS queue và hardening callback.
- Review chéo giữa Mobile (`3122410452`) và Web FE (`3122410466`) cho các luồng: foreground location visual-only, single voice, QR fallback, language/playback/tour.
- Dùng `docs/test_scenarios.md` làm checklist smoke test trước khi mở PR.

## 7. Gợi ý nhịp merge thực tế
1. Merge cụm nền tảng S1 trước theo thứ tự backend: 001 -> 002 -> 003 -> 003B, rồi mobile core: 004 -> 005 -> 006 -> 007 -> 008.
2. Merge cụm tính năng S2 theo thứ tự: 009 -> 010 -> 011.
3. Cuối cùng merge cụm quality S3: 012 -> 013, sau đó hardening theo bug/risk backlog đã được tracker hóa.

## 8. Chốt xử lý rủi ro
1. Rủi ro lệch tracker issue: ĐÃ xử lý bằng việc chuẩn hóa toàn bộ phân công theo tập issue canonical.
2. Rủi ro hiểu sai geofence: ĐÃ xử lý bằng cách thay ngôn ngữ sang foreground visual-only + explicit trigger Tap/QR.
3. Rủi ro thiếu ISSUE-003B trong P0: ĐÃ xử lý bằng cách thêm ISSUE-003B vào owner backend và gate S1.

---
