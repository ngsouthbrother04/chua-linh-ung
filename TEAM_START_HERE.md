# Team Start Here

Team-wide onboarding entrypoint for consistent AI-assisted development.

This file is intentionally short. All AI agents should read the same documents in the same order.

## Read Order (Mandatory)

1. README.md
2. SPEC_CANONICAL.md
3. AI_GUIDELINES.md
4. ARCHITECTURE.md
5. docs/backend_design.md
6. docs/database_design.md
7. USE_CASES.md
8. docs/test_scenarios.md
9. MASTER_INDEX.md
10. IMPLEMENTATION_TASK_BREAKDOWN.md
11. EXECUTION_TODO_ISSUES.md
12. **Backend only**: SWAGGER_CONVENTION.md (API documentation standards)
13. **Backend only**: OPENAPI_SCHEMA_ENHANCEMENT.md (for complex schema definitions)

Terminology note:
- AL_GUIDELINES.md in requests is treated as AI_GUIDELINES.md in this repository.

## Working Rules

1. Do not change behavior defaults (single voice rule/state transitions) without updating README.md and SPEC_CANONICAL.md first.
2. Treat docs/prd as canonical PRD content.
3. Use IMPLEMENTATION_TASK_BREAKDOWN.md for workstream planning and EXECUTION_TODO_ISSUES.md for issue-by-issue status tracking.
4. **Unit and Integration Tests are Mandatory**: A feature is NOT done until mapped tests in docs/test_scenarios.md are implemented and passing.
5. Never introduce geofence/background-GPS auto-trigger or on-device TTS generation.
6. Enforce explicit trigger rule: narration starts only by user Tap or QR scan.
7. For overlap zones: highlight can be multi-POI, but audio remains tap/QR only; recommendation (if any) must be deterministic.
8. For TTS scaling: keep monolith + Redis queue with idempotent job keys and retry policy.
9. For dashboard online users: use TTL metrics (`online_now`=90s, `active_5m`=5m), and label windows clearly.
10. **Swagger/OpenAPI (Backend Only)**:
    - All new routes MUST have JSDoc @summary, @description, @param, @return comments
    - Before committing route changes, run: `npm run openapi:generate && npm run openapi:lint`
    - Separate commits: code change first, then spec generation (`git commit -m "docs(openapi): regenerate"`)
    - Follow SWAGGER_CONVENTION.md for JSDoc format and validation practices
    - Complex schemas: refer to OPENAPI_SCHEMA_ENHANCEMENT.md for strategies
    - Quick validation: `npm run openapi:diff-check` warns if spec appears out of date

## Setup
App strictly avoids geofencing and automatic GPS playback. Read the canonical docs before coding to keep Tap/QR trigger behavior, offline-first flow, and Single Voice Rule consistent.
