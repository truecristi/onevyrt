# Parity ledger — database migrations

The legacy migrations reveal data that must be assessed during mapping. Duplicate numeric prefixes and tables created outside migrations must be corrected in the greenfield migration chain.

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

| Parity ID         | Legacy migration                                        | Tables visibly created or operation                                                                            | Classification |
| ----------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------- |
| PAR-MIGRATION-001 | 1786520829386_create-sessions.js                        | sessions                                                                                                       | pending        |
| PAR-MIGRATION-002 | 1786528429683_create-users.js                           | users                                                                                                          | pending        |
| PAR-MIGRATION-003 | 1786536425849_create-workspaces.js                      | workspaces                                                                                                     | pending        |
| PAR-MIGRATION-004 | 1786536927190_create-projects.js                        | projects                                                                                                       | pending        |
| PAR-MIGRATION-005 | 1786537357897_create-activity.js                        | activity                                                                                                       | pending        |
| PAR-MIGRATION-006 | 1786537749650_create-tracking.js                        | tracking_keys, tracking_counts, tracking_journeys                                                              | pending        |
| PAR-MIGRATION-007 | 1786539880916_create-auth-security-stores.js            | login_guard, reset_tokens, pending_2fa                                                                         | pending        |
| PAR-MIGRATION-008 | 1786540198608_create-referrals.js                       | referral_codes, referrals                                                                                      | pending        |
| PAR-MIGRATION-009 | 1786540471858_create-comments.js                        | comments                                                                                                       | pending        |
| PAR-MIGRATION-010 | 1786540688810_create-revisions.js                       | revisions                                                                                                      | pending        |
| PAR-MIGRATION-011 | 1786540886567_create-report-shares.js                   | report_shares                                                                                                  | pending        |
| PAR-MIGRATION-012 | 1786541104748_create-cohorts.js                         | cohorts                                                                                                        | pending        |
| PAR-MIGRATION-013 | 1786541348897_create-curriculum.js                      | curriculum, curriculum_deletions                                                                               | pending        |
| PAR-MIGRATION-014 | 1786541639222_create-programme-offers.js                | programme_offers                                                                                               | pending        |
| PAR-MIGRATION-015 | 1786541862535_create-enrollments.js                     | enrollments                                                                                                    | pending        |
| PAR-MIGRATION-016 | 1786542301782_create-final-small-stores.js              | audit_log, instance_settings, stripe_events                                                                    | pending        |
| PAR-MIGRATION-017 | 1786543068855_create-stripe-billing-processed-events.js | stripe_billing_processed_events                                                                                | pending        |
| PAR-MIGRATION-018 | 1786607502579_create-notifications-and-jobs.js          | notifications, job_runs                                                                                        | pending        |
| PAR-MIGRATION-019 | 1786621070988_create-app-events.js                      | app_events                                                                                                     | pending        |
| PAR-MIGRATION-020 | 1786628568230_create-api-keys.js                        | api_keys                                                                                                       | pending        |
| PAR-MIGRATION-021 | 1786629800000_create-outbound-webhooks.js               | outbound_webhooks                                                                                              | pending        |
| PAR-MIGRATION-022 | 1786630000000_create-workspace-entitlements.js          | workspace_entitlements                                                                                         | pending        |
| PAR-MIGRATION-023 | 1786630100000_create-brand-profiles.js                  | brand_profiles                                                                                                 | pending        |
| PAR-MIGRATION-024 | 1786630200000_brand-colour-names.js                     | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-025 | 1786630300000_platform-connections.js                   | platform_connections                                                                                           | pending        |
| PAR-MIGRATION-026 | 1786630400000_brand-message.js                          | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-027 | 1786630600000_workspace-business.js                     | workspace_business                                                                                             | pending        |
| PAR-MIGRATION-028 | 1786630700000_campaigns.js                              | campaigns                                                                                                      | pending        |
| PAR-MIGRATION-029 | 1786630900000_workspaces-members-gin.js                 | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-030 | 1786631000000_rate-limits.js                            | rate_limits                                                                                                    | pending        |
| PAR-MIGRATION-031 | 1786631100000_client-errors.js                          | client_errors                                                                                                  | pending        |
| PAR-MIGRATION-032 | 1786631200000_pending-email-changes.js                  | pending_email_changes                                                                                          | pending        |
| PAR-MIGRATION-033 | 1786631300000_bookings.js                               | bookings                                                                                                       | pending        |
| PAR-MIGRATION-034 | 1786631400000_leads.js                                  | qual_funnel_owners, leads                                                                                      | pending        |
| PAR-MIGRATION-035 | 1786631500000_qual-funnels.js                           | qual_funnels                                                                                                   | pending        |
| PAR-MIGRATION-036 | 1786631600000_otp-verifications.js                      | otp_verifications                                                                                              | pending        |
| PAR-MIGRATION-037 | 1786631700000_funnel-events.js                          | funnel_events, funnel_spend                                                                                    | pending        |
| PAR-MIGRATION-038 | 1786631800000_creatives.js                              | creatives                                                                                                      | pending        |
| PAR-MIGRATION-039 | 1786631900000_creative-spend.js                         | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-040 | 1786632000000_shared-templates.js                       | shared_templates                                                                                               | pending        |
| PAR-MIGRATION-041 | 1786633000000_shared-creatives.js                       | shared_creatives                                                                                               | pending        |
| PAR-MIGRATION-042 | 1786634000000_community-identity.js                     | community_profiles                                                                                             | pending        |
| PAR-MIGRATION-043 | 1786635000000_community-comments.js                     | community_comments                                                                                             | pending        |
| PAR-MIGRATION-044 | 1786636000000_community-reactions.js                    | community_reactions                                                                                            | pending        |
| PAR-MIGRATION-045 | 1786640000000_segments.js                               | segments                                                                                                       | pending        |
| PAR-MIGRATION-046 | 1786641000000_broadcasts.js                             | broadcasts, broadcast_sends, contact_optouts                                                                   | pending        |
| PAR-MIGRATION-047 | 1786642000000_stripe-connect.js                         | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-048 | 1786643000000_webhook-deliveries.js                     | webhook_deliveries                                                                                             | pending        |
| PAR-MIGRATION-049 | 1786644000000_broadcast-schedule.js                     | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-050 | 1786645000000_soft-delete-projects.js                   | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-051 | 1786646000000_soft-delete-segments-campaigns.js         | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-052 | 1786647000000_lead-lifecycle.js                         | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-053 | 1786648000000_lead-assignment.js                        | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-054 | 1786649000000_lead-events.js                            | lead_events                                                                                                    | pending        |
| PAR-MIGRATION-055 | 1786650000000_stripe-events-workspace-scope.js          | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-056 | 1786651000000_login-guard-per-ip.js                     | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-057 | 1786652000000_workspace-revenue-ledger.js               | workspace_revenue                                                                                              | pending        |
| PAR-MIGRATION-058 | 1786653000000_broadcast-sending-heartbeat.js            | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-059 | 1786654000000_funnel-event-daily-rollup.js              | funnel_event_daily                                                                                             | pending        |
| PAR-MIGRATION-060 | 1786655000000_funnel-events-created-at-index.js         | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-061 | 1786700000000_curriculum-three-chapter-arc.js           | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-062 | 1786800000000_curriculum-master-course-map-v3.js        | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-063 | 1786900000000_chapter-submissions.js                    | chapter_submissions                                                                                            | pending        |
| PAR-MIGRATION-064 | 1787000000000_create-learner-messages.js                | learner_messages                                                                                               | pending        |
| PAR-MIGRATION-065 | 1787100000000_bookings-workspace-email-index.js         | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-066 | 1787200000000_workspace-last-billing-event.js           | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-067 | 1787300100000_community-artifact-uses.js                | community_artifact_uses                                                                                        | pending        |
| PAR-MIGRATION-068 | 1787300200000_soft-delete-leads-bookings-events.js      | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-069 | 1787400000000_chapter-4-submissions.js                  | chapter_4_submissions                                                                                          | pending        |
| PAR-MIGRATION-070 | 1787400000000_transformation-report-shares.js           | transformation_report_shares                                                                                   | pending        |
| PAR-MIGRATION-071 | 1788371790908_webhook-delivery-queue.js                 | webhook_delivery_queue                                                                                         | pending        |
| PAR-MIGRATION-072 | 1788372280259_chapter-4-enrollment-fields.js            | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-073 | 1788372500000_curriculum-chapter-4-arc.js               | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-074 | 1788378476000_add-free-access-mode.js                   | Schema/data alteration                                                                                         | pending        |
| PAR-MIGRATION-075 | 1788379000000_analytics-extended-schema.js              | page_views, user_actions, conversion_events, analytics_errors, performance_metrics, privacy_settings           | pending        |
| PAR-MIGRATION-076 | 1788400000000_admin-feature-flags.js                    | admin_feature_flags                                                                                            | pending        |
| PAR-MIGRATION-077 | 1788400000000_workflow-automation.js                    | workflows, workflow_executions, workflow_runs, batch_operations                                                | pending        |
| PAR-MIGRATION-078 | 1788419200000_add-why-creed-table.js                    | workspace_why_creed                                                                                            | pending        |
| PAR-MIGRATION-079 | 1788456900000_why-creed-reminders-tables.js             | email_history, user_email_preferences, email_bounces                                                           | pending        |
| PAR-MIGRATION-080 | 1788500000000_why-creed-phase-3-tables.js               | reflection_history, notification_preferences, motivation_analytics                                             | pending        |
| PAR-MIGRATION-081 | 1788550800000_add-90day-reflections-table.js            | workspace_90day_reflections                                                                                    | pending        |
| PAR-MIGRATION-082 | 1788555200000_create-email-queue.js                     | email_queue                                                                                                    | pending        |
| PAR-MIGRATION-083 | 1790000000000_data-management-system.js                 | export_history, scheduled_exports, import_history, backup_records, data_retention_policies, compliance_reports | pending        |
| PAR-MIGRATION-084 | 1791000000000_motivation-engagement-metrics.js          | motivation_engagement_events, engagement_metrics, cohort_engagement_summary                                    | pending        |
| PAR-MIGRATION-085 | 1800000000000_business-events-and-job-queue.js          | business_events, job_queue                                                                                     | pending        |
| PAR-MIGRATION-086 | 1802000000000_email-preferences.js                      | email_preferences                                                                                              | pending        |
| PAR-MIGRATION-087 | 1803000000000_workspace-plan-metadata.js                | Schema/data alteration                                                                                         | pending        |
