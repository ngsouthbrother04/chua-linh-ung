# 11. Risks and Open Questions

[Back to Index](index.md)

---

## 1. Risks and Mitigations

| ID | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R-001 | Sync payload grows and slows first-run experience | Medium | High | Maintain manifest/hash strategy, compression, and payload tuning |
| R-002 | Payment callback verification gaps across providers | Medium | High | Implement provider-specific signature verification hardening |
| R-003 | Audio cache corruption on interrupted updates | Low | High | Atomic sync + integrity checks + forced resync path |
| R-004 | High marker density reduces map usability | Medium | Medium | Cluster strategy and viewport-based rendering |
| R-005 | Regression accidentally introduces autoplay behavior | Low | Critical | Test gates for explicit-trigger-only invariant |

## 2. Open Questions

| ID | Question | Priority | Owner |
|---|---|---|---|
| Q-001 | Final production token expiration and refresh policy? | High | Product + Security |
| Q-002 | Cloudinary folder/transform policy and retention strategy for production images? | High | Platform |
| Q-003 | Admin publish model: always full sync or selective scope by entity? | Medium | Product + Backend |
| Q-004 | Post-MVP social/review roadmap sequencing? | Medium | Product |
