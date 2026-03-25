# MASTER INDEX – Dự án Phố Ẩm Thực

**Single point of navigation** cho toàn bộ tài liệu dự án.

**Read Order Bắt Buộc (cho mọi AI agent & developer):**
1. `README.md` ← **Source of Truth Định Hướng Sản Phẩm**
2. `SPEC_CANONICAL.md` ← **Single Source of Truth Kỹ Thuật**
3. `AI_GUIDELINES.md` ← **AI Guardrails & Invariants**
4. `ARCHITECTURE.md` ← **Technical Blueprint**
5. `docs/backend_design.md`
6. `docs/database_design.md`
7. `USE_CASES.md`
8. `docs/test_scenarios.md`
9. `TEAM_START_HERE.md`
10. `MASTER_INDEX.md` (file này)
11. `docs/prd/index.md`
12. `IMPLEMENTATION_TASK_BREAKDOWN.md`
13. `EXECUTION_TODO_ISSUES.md`

**Terminology note:**
- `AL_GUIDELINES.md` trong yêu cầu được hiểu là `AI_GUIDELINES.md` (tên file canonical trong repository).

---

## 1. Core Canonical Documents (Không được bỏ qua)

| File | Mục đích | Audience | Độ quan trọng |
|------|----------|----------|---------------|
| `README.md` | Định hướng sản phẩm Phố Ẩm Thực và tương tác Tap-to-Play | AI + Dev | ★★★★★ |
| `SPEC_CANONICAL.md` | Single Source of Truth kỹ thuật (invariants, state machine, single voice rule) | AI + Dev | ★★★★★ |
| `AI_GUIDELINES.md` | Invariants bắt buộc cho AI codegen (Cấm Geofence/Auto-play) | AI Agents | ★★★★★ |
| `ARCHITECTURE.md` | Technical blueprint & stack | Dev + Architect | ★★★★ |
| `docs/backend_design.md` | API contract, sync contract, TTS pipeline, i18n backend | Dev + Architect | ★★★★ |
| `docs/database_design.md` | PostgreSQL schema + SQLite mirror + indexing | Dev + Architect | ★★★★ |
| `USE_CASES.md` | Luồng nghiệp vụ chi tiết UC1-UC8 | AI + Dev + QA | ★★★★ |
| `docs/test_scenarios.md` | Bộ test cases chuẩn hóa theo UC và quality gates | Dev + QA | ★★★★ |
| `TEAM_START_HERE.md` | Onboarding entrypoint | Toàn team | ★★★★★ |

## 2. Academic / Submission Documents

- `USE_CASES.md` → Use Case Report
- `USE_CASE_MAPPING.md` → Traceability UC ↔ Architecture

## 3. Product Requirements (PRD)

Toàn bộ PRD nằm trong thư mục `docs/prd/`:
- `index.md`
- `01_executive_summary.md` … `15_admin_requirements.md`

## 4. Execution & Task Documents

- `IMPLEMENTATION_TASK_BREAKDOWN.md` (v1.1, cập nhật 2026-03-25, đã map Workstream ↔ ISSUE-001..013 + UC/TC)
- `EXECUTION_TODO_ISSUES.md` (tracker issue-style chuẩn theo SPEC/AI_GUIDELINES/ARCHITECTURE/docs)
- `TASK_ASSIGN.md` (phân công nhánh)

## 5. Test & Quality

- `docs/test_scenarios.md` (nguồn chuẩn cho mapping test coverage khi đánh dấu DONE)

## Conflict Resolution

1. `README.md`
2. `SPEC_CANONICAL.md`
3. `AI_GUIDELINES.md`
4. `ARCHITECTURE.md`
5. `docs/backend_design.md`
6. `docs/database_design.md`
7. `USE_CASES.md`
8. `docs/test_scenarios.md`
9. PRD (`docs/prd/*`)

**Lưu ý khi sửa:** Sau khi sửa bất kỳ invariants/defaults nào, phải cập nhật `README.md` và `SPEC_CANONICAL.md` trước.

**Execution governance note:** Không đánh dấu DONE cho task trong `EXECUTION_TODO_ISSUES.md` nếu chưa có test tương ứng từ `docs/test_scenarios.md` và chưa phản ánh vào `IMPLEMENTATION_TASK_BREAKDOWN.md`.
