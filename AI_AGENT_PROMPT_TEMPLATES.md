# AI Docs Reading Map For Agent

Mục đích: AI chỉ cần đọc file này là biết toàn bộ tài liệu nằm ở đâu và phải đọc theo thứ tự nào.

## 1) Điểm vào chính

1. /README.md
2. /SPEC_CANONICAL.md
3. /AI_GUIDELINES.md
4. /ARCHITECTURE.md
5. /docs/backend_design.md
6. /docs/database_design.md
7. /USE_CASES.md
8. /docs/test_scenarios.md
9. /TEAM_START_HERE.md
10. /MASTER_INDEX.md

## 2) Khối tài liệu PRD

1. /docs/prd/index.md
2. Đọc toàn bộ section PRD theo đúng thứ tự được quy định trong /docs/prd/index.md.

## 3) Khối tài liệu vận hành và triển khai

1. /USE_CASE_MAPPING.md
2. /IMPLEMENTATION_TASK_BREAKDOWN.md
3. /TASK_ASSIGN.md
4. /EXECUTION_TODO_ISSUES.md

## 4) Tài liệu kỹ thuật chi tiết bổ sung

1. /docs/backend_design.md
2. /docs/database_design.md
3. /docs/test_scenarios.md

## 5) Thứ tự đọc bắt buộc cho AI

1. Đọc theo thứ tự: Mục 1 -> Mục 2 -> Mục 3 -> Mục 4.
2. Nếu có mâu thuẫn nội dung, ưu tiên theo thứ tự:
README.md -> SPEC_CANONICAL.md -> AI_GUIDELINES.md -> ARCHITECTURE.md -> docs/backend_design.md -> docs/database_design.md -> USE_CASES.md -> docs/test_scenarios.md -> docs/prd/*.

## 6) Prompt mẫu dùng chung cho cả team

```text
Hãy đọc toàn bộ tài liệu theo đúng thứ tự trong file AI_AGENT_PROMPT_TEMPLATES.md, sau đó thực hiện đúng 1 chức năng tôi giao; khi hoàn thành phải báo rõ: phạm vi đã làm, file đã sửa, đối chiếu AC pass/fail và rủi ro còn lại.
```
