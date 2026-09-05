# Parity ledger — API handlers

This inventory records source handlers; it does not endorse the current route granularity. In the rebuild, thin handlers may be consolidated around domain resources while preserving behaviour.

> **Source note:** the legacy ONEVYRT application this table was audited
> from no longer exists in this repository (both branches were reset to
> empty before this specification was committed - see ADR-0018). This table
> is preserved as-is from the specification's own appendix as an
> **inventory-level parity baseline** - it records what existed and its
> intended greenfield treatment, not a line-by-line behavioral diff against
> code that can currently be inspected. `classification: pending` on every
> row means the actual preserve/consolidate/redesign/postpone/retire
> decision (per the README's `PRESERVE/REBUILD/IMPROVE/MERGE/DEFER/REMOVE`
> classification) has not yet been made - that is real product work for the
> phase that touches each capability, not something Phase 0/1 can responsibly
> guess at from an inventory table alone.

| Parity ID   | Current route                                   | Methods found            | Domain           | Capability                                   | Classification |
| ----------- | ----------------------------------------------- | ------------------------ | ---------------- | -------------------------------------------- | -------------- |
| PAR-API-001 | /api/account/data-management/backups            | GET, POST                | Account          | Backups Account / Data Management            | pending        |
| PAR-API-002 | /api/account/data-management/exports            | GET, POST                | Account          | Exports Account / Data Management            | pending        |
| PAR-API-003 | /api/account/data-management/imports            | GET, POST                | Account          | Imports Account / Data Management            | pending        |
| PAR-API-004 | /api/account/data-management/retention-policies | GET, POST                | Account          | Retention Policies Account / Data Management | pending        |
| PAR-API-005 | /api/account/data-management/scheduled-exports  | GET, POST                | Account          | Scheduled Exports Account / Data Management  | pending        |
| PAR-API-006 | /api/account/export                             | GET                      | Account          | Export Account                               | pending        |
| PAR-API-007 | /api/account/transformation-report/email        | POST                     | Account          | Email Account / Transformation Report        | pending        |
| PAR-API-008 | /api/account/transformation-report              | GET                      | Account          | Transformation Report Account                | pending        |
| PAR-API-009 | /api/account/transformation-report/share        | GET, POST, DELETE        | Account          | Share Account / Transformation Report        | pending        |
| PAR-API-010 | /api/admin/audit                                | GET                      | Admin            | Audit Admin                                  | pending        |
| PAR-API-011 | /api/admin/bulk/email                           | POST                     | Admin            | Email Admin / Bulk                           | pending        |
| PAR-API-012 | /api/admin/bulk/export                          | POST                     | Admin            | Export Admin / Bulk                          | pending        |
| PAR-API-013 | /api/admin/bulk/invite                          | POST                     | Admin            | Invite Admin / Bulk                          | pending        |
| PAR-API-014 | /api/admin/bulk/reset-progress                  | POST                     | Admin            | Reset Progress Admin / Bulk                  | pending        |
| PAR-API-015 | /api/admin/client-errors                        | GET                      | Admin            | Client Errors Admin                          | pending        |
| PAR-API-016 | /api/admin/community                            | DELETE                   | Admin            | Community Admin                              | pending        |
| PAR-API-017 | /api/admin/curriculum                           | GET, POST                | Admin            | Curriculum Admin                             | pending        |
| PAR-API-018 | /api/admin/enable-free-access                   | POST                     | Admin            | Enable Free Access Admin                     | pending        |
| PAR-API-019 | /api/admin/feature-flags                        | GET, POST, DELETE        | Admin            | Feature Flags Admin                          | pending        |
| PAR-API-020 | /api/admin/free-access/disable                  | POST                     | Admin            | Disable Admin / Free Access                  | pending        |
| PAR-API-021 | /api/admin/free-access/enable                   | POST                     | Admin            | Enable Admin / Free Access                   | pending        |
| PAR-API-022 | /api/admin/free-access/enable-improved          | POST, OPTIONS            | Admin            | Enable Improved Admin / Free Access          | pending        |
| PAR-API-023 | /api/admin/free-access/status                   | GET                      | Admin            | Status Admin / Free Access                   | pending        |
| PAR-API-024 | /api/admin/health                               | GET                      | Admin            | Health Admin                                 | pending        |
| PAR-API-025 | /api/admin/impersonate/[id]                     | POST                     | Admin            | {id} Admin / Impersonate                     | pending        |
| PAR-API-026 | /api/admin/learners                             | GET                      | Admin            | Learners Admin                               | pending        |
| PAR-API-027 | /api/admin/lockouts                             | GET, POST                | Admin            | Lockouts Admin                               | pending        |
| PAR-API-028 | /api/admin/overview                             | GET                      | Admin            | Overview Admin                               | pending        |
| PAR-API-029 | /api/admin/programme-offers                     | GET, POST                | Admin            | Programme Offers Admin                       | pending        |
| PAR-API-030 | /api/admin/projects/[wsId]/[id]                 | GET                      | Admin            | {id} Admin / Projects / {wsid}               | pending        |
| PAR-API-031 | /api/admin/settings                             | GET, POST                | Admin            | Settings Admin                               | pending        |
| PAR-API-032 | /api/admin/users/[id]                           | DELETE                   | Admin            | {id} Admin / Users                           | pending        |
| PAR-API-033 | /api/admin/users/[id]/status                    | POST                     | Admin            | Status Admin / Users / {id}                  | pending        |
| PAR-API-034 | /api/admin/webhook-status                       | GET, POST                | Admin            | Webhook Status Admin                         | pending        |
| PAR-API-035 | /api/admin/workspaces/[id]/entitlements         | GET, POST                | Admin            | Entitlements Admin / Workspaces / {id}       | pending        |
| PAR-API-036 | /api/admin/workspaces/[id]/free-access          | POST                     | Admin            | Free Access Admin / Workspaces / {id}        | pending        |
| PAR-API-037 | /api/admin/workspaces/[id]/members/[userId]     | DELETE                   | Admin            | {userid} Admin / Workspaces / {id} / Members | pending        |
| PAR-API-038 | /api/admin/workspaces/[id]/members              | GET                      | Admin            | Members Admin / Workspaces / {id}            | pending        |
| PAR-API-039 | /api/admin/workspaces/[id]/owner                | POST                     | Admin            | Owner Admin / Workspaces / {id}              | pending        |
| PAR-API-040 | /api/admin/workspaces/[id]/plan                 | POST                     | Admin            | Plan Admin / Workspaces / {id}               | pending        |
| PAR-API-041 | /api/admin/workspaces/[id]                      | DELETE                   | Admin            | {id} Admin / Workspaces                      | pending        |
| PAR-API-042 | /api/ai/generate                                | POST, GET                | Ai               | Generate Ai                                  | pending        |
| PAR-API-043 | /api/analytics/dashboard                        | GET                      | Analytics        | Dashboard Analytics                          | pending        |
| PAR-API-044 | /api/analytics/feature-attempt                  | POST                     | Analytics        | Feature Attempt Analytics                    | pending        |
| PAR-API-045 | /api/analytics/feature-attempts-batch           | POST                     | Analytics        | Feature Attempts Batch Analytics             | pending        |
| PAR-API-046 | /api/analytics/privacy                          | GET, PUT, DELETE         | Analytics        | Privacy Analytics                            | pending        |
| PAR-API-047 | /api/auth/2fa/confirm                           | POST                     | Auth             | Confirm Auth / 2fa                           | pending        |
| PAR-API-048 | /api/auth/2fa/disable                           | POST                     | Auth             | Disable Auth / 2fa                           | pending        |
| PAR-API-049 | /api/auth/2fa/login-verify                      | POST                     | Auth             | Login Verify Auth / 2fa                      | pending        |
| PAR-API-050 | /api/auth/2fa                                   | GET                      | Auth             | 2fa Auth                                     | pending        |
| PAR-API-051 | /api/auth/2fa/setup                             | POST                     | Auth             | Setup Auth / 2fa                             | pending        |
| PAR-API-052 | /api/auth/avatar                                | POST, DELETE             | Auth             | Avatar Auth                                  | pending        |
| PAR-API-053 | /api/auth/change-email                          | POST                     | Auth             | Change Email Auth                            | pending        |
| PAR-API-054 | /api/auth/change-password                       | POST                     | Auth             | Change Password Auth                         | pending        |
| PAR-API-055 | /api/auth/confirm-email-change                  | GET                      | Auth             | Confirm Email Change Auth                    | pending        |
| PAR-API-056 | /api/auth/delete-account                        | POST                     | Auth             | Delete Account Auth                          | pending        |
| PAR-API-057 | /api/auth/forgot-password                       | POST                     | Auth             | Forgot Password Auth                         | pending        |
| PAR-API-058 | /api/auth/login                                 | POST                     | Auth             | Login Auth                                   | pending        |
| PAR-API-059 | /api/auth/logout                                | POST                     | Auth             | Logout Auth                                  | pending        |
| PAR-API-060 | /api/auth/me                                    | GET                      | Auth             | Me Auth                                      | pending        |
| PAR-API-061 | /api/auth/register                              | POST                     | Auth             | Register Auth                                | pending        |
| PAR-API-062 | /api/auth/reset-password                        | POST                     | Auth             | Reset Password Auth                          | pending        |
| PAR-API-063 | /api/auth/sessions/[id]                         | DELETE                   | Auth             | {id} Auth / Sessions                         | pending        |
| PAR-API-064 | /api/auth/sessions                              | GET, DELETE              | Auth             | Sessions Auth                                | pending        |
| PAR-API-065 | /api/auth/stop-impersonating                    | POST                     | Auth             | Stop Impersonating Auth                      | pending        |
| PAR-API-066 | /api/batch-operations/[id]                      | GET, PATCH               | Batch Operations | {id} Batch Operations                        | pending        |
| PAR-API-067 | /api/batch-operations                           | GET, POST                | Batch Operations | Batch Operations operation                   | pending        |
| PAR-API-068 | /api/billing/cancel                             | POST                     | Billing          | Cancel Billing                               | pending        |
| PAR-API-069 | /api/billing/checkout                           | POST                     | Billing          | Checkout Billing                             | pending        |
| PAR-API-070 | /api/billing/connect/start                      | POST                     | Billing          | Start Billing / Connect                      | pending        |
| PAR-API-071 | /api/billing/connect/status                     | GET                      | Billing          | Status Billing / Connect                     | pending        |
| PAR-API-072 | /api/billing/oto                                | GET, POST                | Billing          | Oto Billing                                  | pending        |
| PAR-API-073 | /api/billing/resume                             | POST                     | Billing          | Resume Billing                               | pending        |
| PAR-API-074 | /api/billing/set-default-payment-method         | POST                     | Billing          | Set Default Payment Method Billing           | pending        |
| PAR-API-075 | /api/billing/setup-intent                       | POST                     | Billing          | Setup Intent Billing                         | pending        |
| PAR-API-076 | /api/billing/status                             | POST                     | Billing          | Status Billing                               | pending        |
| PAR-API-077 | /api/billing/subscribe                          | POST                     | Billing          | Subscribe Billing                            | pending        |
| PAR-API-078 | /api/broadcasts/[id]                            | GET, DELETE              | Broadcasts       | {id} Broadcasts                              | pending        |
| PAR-API-079 | /api/broadcasts                                 | GET, POST                | Broadcasts       | Broadcasts operation                         | pending        |
| PAR-API-080 | /api/business/ai-connection                     | GET, PUT                 | Business         | Ai Connection Business                       | pending        |
| PAR-API-081 | /api/business/brief                             | GET                      | Business         | Brief Business                               | pending        |
| PAR-API-082 | /api/business/constraint                        | GET, PUT                 | Business         | Constraint Business                          | pending        |
| PAR-API-083 | /api/business/diagnostic                        | GET, PATCH               | Business         | Diagnostic Business                          | pending        |
| PAR-API-084 | /api/business/drivers                           | GET, PUT                 | Business         | Drivers Business                             | pending        |
| PAR-API-085 | /api/business/economics                         | GET, PUT                 | Business         | Economics Business                           | pending        |
| PAR-API-086 | /api/business/execution                         | GET, PUT                 | Business         | Execution Business                           | pending        |
| PAR-API-087 | /api/business/funnels/analytics                 | GET, POST                | Business         | Analytics Business / Funnels                 | pending        |
| PAR-API-088 | /api/business/funnels                           | GET, POST, DELETE        | Business         | Funnels Business                             | pending        |
| PAR-API-089 | /api/business/golden-example                    | GET, PUT                 | Business         | Golden Example Business                      | pending        |
| PAR-API-090 | /api/business/journey                           | GET, PUT                 | Business         | Journey Business                             | pending        |
| PAR-API-091 | /api/business/launches                          | GET, PUT                 | Business         | Launches Business                            | pending        |
| PAR-API-092 | /api/business/leads/[id]                        | GET, PATCH               | Business         | {id} Business / Leads                        | pending        |
| PAR-API-093 | /api/business/leads/export                      | GET                      | Business         | Export Business / Leads                      | pending        |
| PAR-API-094 | /api/business/leads                             | GET, POST                | Business         | Leads Business                               | pending        |
| PAR-API-095 | /api/business/message                           | GET, PUT                 | Business         | Message Business                             | pending        |
| PAR-API-096 | /api/business/offer                             | GET, PUT                 | Business         | Offer Business                               | pending        |
| PAR-API-097 | /api/business/presentation                      | GET, PUT                 | Business         | Presentation Business                        | pending        |
| PAR-API-098 | /api/business/reality                           | GET, PATCH               | Business         | Reality Business                             | pending        |
| PAR-API-099 | /api/business/review                            | GET, PUT                 | Business         | Review Business                              | pending        |
| PAR-API-100 | /api/business/streak                            | GET, PUT                 | Business         | Streak Business                              | pending        |
| PAR-API-101 | /api/campaign/creatives                         | GET, POST, PATCH, DELETE | Campaign         | Creatives Campaign                           | pending        |
| PAR-API-102 | /api/campaign-studio/brand                      | GET, PATCH               | Campaign Studio  | Brand Campaign Studio                        | pending        |
| PAR-API-103 | /api/campaign-studio/campaigns/deleted          | GET, POST                | Campaign Studio  | Deleted Campaign Studio / Campaigns          | pending        |
| PAR-API-104 | /api/campaign-studio/campaigns                  | GET, POST, PATCH, DELETE | Campaign Studio  | Campaigns Campaign Studio                    | pending        |
| PAR-API-105 | /api/campaign-studio/connections                | GET, POST                | Campaign Studio  | Connections Campaign Studio                  | pending        |
| PAR-API-106 | /api/campaign-studio/entitlements               | GET                      | Campaign Studio  | Entitlements Campaign Studio                 | pending        |
| PAR-API-107 | /api/campaign-studio/scan-site                  | POST                     | Campaign Studio  | Scan Site Campaign Studio                    | pending        |
| PAR-API-108 | /api/changelog                                  | GET                      | Changelog        | Changelog operation                          | pending        |
| PAR-API-109 | /api/client-error                               | POST                     | Client Error     | Client Error operation                       | pending        |
| PAR-API-110 | /api/coach/learner                              | GET                      | Coach            | Learner Coach                                | pending        |
| PAR-API-111 | /api/coach/reach-out                            | POST                     | Coach            | Reach Out Coach                              | pending        |
| PAR-API-112 | /api/coaching/chapter/4/review                  | GET, POST                | Coaching         | Review Coaching / Chapter / 4                | pending        |
| PAR-API-113 | /api/coaching/submissions/list                  | GET                      | Coaching         | List Coaching / Submissions                  | pending        |
| PAR-API-114 | /api/cohorts/[cohortId]/access-limit            | POST                     | Cohorts          | Access Limit Cohorts / {cohortid}            | pending        |
| PAR-API-115 | /api/cohorts/[cohortId]/announcements           | POST                     | Cohorts          | Announcements Cohorts / {cohortid}           | pending        |
| PAR-API-116 | /api/cohorts/[cohortId]/members                 | POST, DELETE             | Cohorts          | Members Cohorts / {cohortid}                 | pending        |
| PAR-API-117 | /api/cohorts/[cohortId]                         | GET                      | Cohorts          | {cohortid} Cohorts                           | pending        |
| PAR-API-118 | /api/cohorts/[cohortId]/sessions                | POST                     | Cohorts          | Sessions Cohorts / {cohortid}                | pending        |
| PAR-API-119 | /api/cohorts                                    | GET, POST                | Cohorts          | Cohorts operation                            | pending        |
| PAR-API-120 | /api/command-center                             | GET                      | Command Center   | Command Center operation                     | pending        |
| PAR-API-121 | /api/command-center/why-creed                   | GET, POST                | Command Center   | Why Creed Command Center                     | pending        |
| PAR-API-122 | /api/community/authors/[wsId]                   | GET                      | Community        | {wsid} Community / Authors                   | pending        |
| PAR-API-123 | /api/community/comments                         | GET, POST, DELETE        | Community        | Comments Community                           | pending        |
| PAR-API-124 | /api/community/creatives                        | GET, POST, PATCH, DELETE | Community        | Creatives Community                          | pending        |
| PAR-API-125 | /api/community/profile                          | GET, PUT                 | Community        | Profile Community                            | pending        |
| PAR-API-126 | /api/community/reactions                        | GET, POST                | Community        | Reactions Community                          | pending        |
| PAR-API-127 | /api/cron/digest                                | POST                     | Cron             | Digest Cron                                  | pending        |
| PAR-API-128 | /api/cron/tick                                  | POST                     | Cron             | Tick Cron                                    | pending        |
| PAR-API-129 | /api/dashboard/motivation                       | GET                      | Dashboard        | Motivation Dashboard                         | pending        |
| PAR-API-130 | /api/dashboard/trigger-decision-moment          | POST                     | Dashboard        | Trigger Decision Moment Dashboard            | pending        |
| PAR-API-131 | /api/growth-plan/share                          | POST                     | Growth Plan      | Share Growth Plan                            | pending        |
| PAR-API-132 | /api/health                                     | GET                      | Health           | Health operation                             | pending        |
| PAR-API-133 | /api/insights                                   | GET                      | Insights         | Insights operation                           | pending        |
| PAR-API-134 | /api/my-business/summary                        | GET                      | My Business      | Summary My Business                          | pending        |
| PAR-API-135 | /api/notifications                              | GET, PATCH               | Notifications    | Notifications operation                      | pending        |
| PAR-API-136 | /api/programme/access                           | POST                     | Programme        | Access Programme                             | pending        |
| PAR-API-137 | /api/programme/chapter/4/get                    | GET                      | Programme        | Retrieve Programme / Chapter / 4             | pending        |
| PAR-API-138 | /api/programme/chapter/4/pdf                    | GET                      | Programme        | Pdf Programme / Chapter / 4                  | pending        |
| PAR-API-139 | /api/programme/chapter/4/submit                 | POST                     | Programme        | Submit Programme / Chapter / 4               | pending        |
| PAR-API-140 | /api/programme/chapters/[stageId]/review        | POST                     | Programme        | Review Programme / Chapters / {stageid}      | pending        |
| PAR-API-141 | /api/programme/chapters/[stageId]/submit        | POST                     | Programme        | Submit Programme / Chapters / {stageid}      | pending        |
| PAR-API-142 | /api/programme/chapters                         | GET                      | Programme        | Chapters Programme                           | pending        |
| PAR-API-143 | /api/programme/coach-notes                      | POST                     | Programme        | Coach Notes Programme                        | pending        |
| PAR-API-144 | /api/programme/coach-workspaces                 | GET                      | Programme        | Coach Workspaces Programme                   | pending        |
| PAR-API-145 | /api/programme/enrollment                       | GET                      | Programme        | Enrollment Programme                         | pending        |
| PAR-API-146 | /api/programme/lessons/[lessonId]/review        | POST                     | Programme        | Review Programme / Lessons / {lessonid}      | pending        |
| PAR-API-147 | /api/programme/lessons/[lessonId]/start         | POST                     | Programme        | Start Programme / Lessons / {lessonid}       | pending        |
| PAR-API-148 | /api/programme/lessons/[lessonId]/submit        | POST                     | Programme        | Submit Programme / Lessons / {lessonid}      | pending        |
| PAR-API-149 | /api/programme/messages                         | GET, POST                | Programme        | Messages Programme                           | pending        |
| PAR-API-150 | /api/programme/offers                           | GET                      | Programme        | Offers Programme                             | pending        |
| PAR-API-151 | /api/programme/review                           | GET                      | Programme        | Review Programme                             | pending        |
| PAR-API-152 | /api/programme                                  | GET                      | Programme        | Programme operation                          | pending        |
| PAR-API-153 | /api/projects/[id]/comments                     | GET, POST, DELETE        | Projects         | Comments Projects / {id}                     | pending        |
| PAR-API-154 | /api/projects/[id]/restore                      | POST                     | Projects         | Restore Projects / {id}                      | pending        |
| PAR-API-155 | /api/projects/[id]/revisions                    | GET, POST                | Projects         | Revisions Projects / {id}                    | pending        |
| PAR-API-156 | /api/projects/[id]                              | GET, DELETE              | Projects         | {id} Projects                                | pending        |
| PAR-API-157 | /api/projects/[id]/share                        | GET, POST, DELETE        | Projects         | Share Projects / {id}                        | pending        |
| PAR-API-158 | /api/projects/[id]/tracking                     | GET, DELETE              | Projects         | Tracking Projects / {id}                     | pending        |
| PAR-API-159 | /api/projects/deleted                           | GET                      | Projects         | Deleted Projects                             | pending        |
| PAR-API-160 | /api/projects/primary                           | GET                      | Projects         | Primary Projects                             | pending        |
| PAR-API-161 | /api/projects/primary-experiments               | GET                      | Projects         | Primary Experiments Projects                 | pending        |
| PAR-API-162 | /api/projects                                   | GET, POST                | Projects         | Projects operation                           | pending        |
| PAR-API-163 | /api/q/[slug]/availability                      | GET                      | Q                | Availability Q / {slug}                      | pending        |
| PAR-API-164 | /api/q/[slug]/book                              | POST                     | Q                | Create booking for Q / {slug}                | pending        |
| PAR-API-165 | /api/q/[slug]/event                             | POST                     | Q                | Event Q / {slug}                             | pending        |
| PAR-API-166 | /api/q/[slug]/pay                               | POST                     | Q                | Process payment for Q / {slug}               | pending        |
| PAR-API-167 | /api/q/[slug]/verify/check                      | POST                     | Q                | Check Q / {slug} / Verify                    | pending        |
| PAR-API-168 | /api/q/[slug]/verify/start                      | POST                     | Q                | Start Q / {slug} / Verify                    | pending        |
| PAR-API-169 | /api/q/qualified                                | POST                     | Q                | Qualified Q                                  | pending        |
| PAR-API-170 | /api/referrals                                  | GET                      | Referrals        | Referrals operation                          | pending        |
| PAR-API-171 | /api/reports/email                              | POST                     | Reports          | Email Reports                                | pending        |
| PAR-API-172 | /api/segments/[id]/contacts                     | GET                      | Segments         | Contacts Segments / {id}                     | pending        |
| PAR-API-173 | /api/segments/[id]/restore                      | POST                     | Segments         | Restore Segments / {id}                      | pending        |
| PAR-API-174 | /api/segments/[id]                              | GET, PUT, DELETE         | Segments         | {id} Segments                                | pending        |
| PAR-API-175 | /api/segments/contacts                          | POST                     | Segments         | Contacts Segments                            | pending        |
| PAR-API-176 | /api/segments/deleted                           | GET                      | Segments         | Deleted Segments                             | pending        |
| PAR-API-177 | /api/segments/preview                           | POST                     | Segments         | Preview Segments                             | pending        |
| PAR-API-178 | /api/segments                                   | GET, POST                | Segments         | Segments operation                           | pending        |
| PAR-API-179 | /api/settings/api-keys/[id]                     | DELETE                   | Settings         | {id} Settings / Api Keys                     | pending        |
| PAR-API-180 | /api/settings/api-keys                          | GET, POST                | Settings         | Api Keys Settings                            | pending        |
| PAR-API-181 | /api/settings                                   | GET, PUT                 | Settings         | Settings operation                           | pending        |
| PAR-API-182 | /api/settings/webhooks/[id]/deliveries          | GET                      | Settings         | Deliveries Settings / Webhooks / {id}        | pending        |
| PAR-API-183 | /api/settings/webhooks/[id]                     | DELETE                   | Settings         | {id} Settings / Webhooks                     | pending        |
| PAR-API-184 | /api/settings/webhooks                          | GET, POST                | Settings         | Webhooks Settings                            | pending        |
| PAR-API-185 | /api/share/growth-plan/[token]                  | GET                      | Share            | {token} Share / Growth Plan                  | pending        |
| PAR-API-186 | /api/templates/[id]                             | GET                      | Templates        | {id} Templates                               | pending        |
| PAR-API-187 | /api/templates                                  | GET, POST, DELETE        | Templates        | Templates operation                          | pending        |
| PAR-API-188 | /api/track                                      | OPTIONS, POST            | Track            | Record tracking for operation                | pending        |
| PAR-API-189 | /api/unsubscribe                                | GET, POST                | Unsubscribe      | Unsubscribe operation                        | pending        |
| PAR-API-190 | /api/v1/openapi.json                            | GET                      | V1               | Openapi.json V1                              | pending        |
| PAR-API-191 | /api/v1/projects/[id]                           | GET                      | V1               | {id} V1 / Projects                           | pending        |
| PAR-API-192 | /api/v1/projects                                | GET                      | V1               | Projects V1                                  | pending        |
| PAR-API-193 | /api/webhooks/stripe                            | POST, GET                | Webhooks         | Stripe Webhooks                              | pending        |
| PAR-API-194 | /api/webhooks/stripe-billing                    | POST                     | Webhooks         | Stripe Billing Webhooks                      | pending        |
| PAR-API-195 | /api/webhooks/stripe-oto                        | POST                     | Webhooks         | Stripe Oto Webhooks                          | pending        |
| PAR-API-196 | /api/webhooks/why-creed-events                  | POST, GET                | Webhooks         | Why Creed Events Webhooks                    | pending        |
| PAR-API-197 | /api/workflows/[id]/execute                     | POST                     | Workflows        | Execute Workflows / {id}                     | pending        |
| PAR-API-198 | /api/workflows/[id]/executions                  | GET                      | Workflows        | Executions Workflows / {id}                  | pending        |
| PAR-API-199 | /api/workflows/[id]                             | GET, PATCH, DELETE       | Workflows        | {id} Workflows                               | pending        |
| PAR-API-200 | /api/workflows                                  | GET, POST                | Workflows        | Workflows operation                          | pending        |
| PAR-API-201 | /api/workspace/[id]/email-preferences           | GET, POST                | Workspace        | Email Preferences Workspace / {id}           | pending        |
| PAR-API-202 | /api/workspace/[id]/reflection-checkpoint       | POST, GET                | Workspace        | Reflection Checkpoint Workspace / {id}       | pending        |
| PAR-API-203 | /api/workspace/[id]/why-creed                   | GET, POST                | Workspace        | Why Creed Workspace / {id}                   | pending        |
| PAR-API-204 | /api/workspaces/[id]/activity                   | GET                      | Workspaces       | Activity Workspaces / {id}                   | pending        |
| PAR-API-205 | /api/workspaces/[id]/members                    | POST, DELETE             | Workspaces       | Members Workspaces / {id}                    | pending        |
| PAR-API-206 | /api/workspaces/[id]                            | GET, PATCH               | Workspaces       | {id} Workspaces                              | pending        |
| PAR-API-207 | /api/workspaces                                 | GET, POST                | Workspaces       | Workspaces operation                         | pending        |
