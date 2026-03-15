# TEAM_START_HERE

Team-wide onboarding entrypoint for consistent AI-assisted development.

This file is intentionally short. All AI agents should read the same documents in the same order.

## Read Order (Mandatory)

1. SPEC_CANONICAL.md
2. docs/user/prd/index.md
3. IMPLEMENTATION_TASK_BREAKDOWN.md
4. EXECUTION_TODO_ISSUES.md
5. docs/test_scenarios.md

## Working Rules

1. Do not change behavior defaults (debounce/cooldown/state transitions) without updating SPEC_CANONICAL.md first.
2. Treat docs/user/prd as canonical PRD content.
3. Keep docs/admin/prd synchronized 1:1 with docs/user/prd.
4. Use EXECUTION_TODO_ISSUES.md as implementation tracker.

## Consistency Check

Run this before raising PRs that touch PRD docs:

```bash
npm run docs:check-prd-sync
```

## If Conflicts Are Found

Use conflict resolution order from SPEC_CANONICAL.md.
