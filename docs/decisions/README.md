# Architecture decision records

Per §36's catalogue and the root README's "Architecture decisions should be
stored in `docs/decisions/`."

| ADR                                                          | Decision                                                      | Status                       |
| ------------------------------------------------------------ | ------------------------------------------------------------- | ---------------------------- |
| [0001](ADR-0001-monorepo-layout.md)                          | Monorepo layout and package boundaries                        | Accepted                     |
| [0002](ADR-0002-nextjs-api-boundary.md)                      | Next.js rendering, server-action and API boundary policy      | Accepted                     |
| [0003](ADR-0003-postgres-tenancy.md)                         | PostgreSQL tenancy and row-ownership strategy                 | Accepted                     |
| [0004](ADR-0004-auth-sessions-workspace-membership.md)       | Authentication, sessions and workspace membership             | Accepted                     |
| [0005](ADR-0005-domain-command-query-event-conventions.md)   | Domain command, query and event conventions                   | Proposed                     |
| [0006](ADR-0006-deterministic-calculation-engine.md)         | Deterministic calculation engine and formula versioning       | Proposed                     |
| [0007](ADR-0007-structured-canvas-document-model.md)         | Structured canvas document model                              | Proposed                     |
| [0008](ADR-0008-freeform-sketch-storage.md)                  | Freeform sketch storage and export                            | Proposed                     |
| [0009](ADR-0009-curriculum-content-schema.md)                | Curriculum content schema and publishing workflow             | Proposed                     |
| [0010](ADR-0010-ai-gateway-provider-adapters.md)             | AI gateway, provider adapters and model routing               | Accepted (Phase 6 scope)     |
| [0011](ADR-0011-ai-context-assembly.md)                      | AI context assembly, redaction and retention                  | Partially accepted           |
| [0012](ADR-0012-ai-proposed-action-approval.md)              | Proposed-action approval and safe mutation                    | Partially accepted           |
| [0013](ADR-0013-background-job-queue.md)                     | Background job queue, retries and idempotency                 | Proposed                     |
| [0014](ADR-0014-object-storage-upload-validation.md)         | Object storage, upload validation and malware scanning        | Proposed                     |
| [0015](ADR-0015-audit-log-integrity.md)                      | Audit log integrity and sensitive-data policy                 | Accepted (Phase 1 scope)     |
| [0016](ADR-0016-analytics-taxonomy-consent.md)               | Analytics taxonomy and consent controls                       | Proposed                     |
| [0017](ADR-0017-feature-flags-staged-rollout.md)             | Feature flags, staged rollout and emergency disablement       | Proposed                     |
| [0018](ADR-0018-legacy-extraction-migration-verification.md) | Legacy extraction, transformation and migration verification  | Proposed                     |
| [0019](ADR-0019-backup-restore-disaster-recovery.md)         | Backup, restore and disaster recovery                         | Partially accepted           |
| [0020](ADR-0020-internationalisation-locale-currency.md)     | Internationalisation, locale, currency and time-zone handling | Proposed                     |
| [0021](ADR-0021-deployment-and-environments.md)              | Deployment and environments                                   | Proposed - blocked on access |
| [0022](ADR-0022-launch-readiness-review.md)                  | Launch readiness review                                       | Accepted (status report)     |

"Proposed" means named and scoped per §36's requirement to catalogue these
before broad feature development, not decided - each becomes "Accepted"
when its phase actually makes the decision, per §34's authority order
(superseded ADRs stay in history rather than being deleted).
