# Parity ledger — React components

The inventory is for capability discovery, not structural copying. Oversized and duplicate components must be decomposed.

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

| Parity ID         | Current component                                   | Area             | Bytes  | Classification |
| ----------------- | --------------------------------------------------- | ---------------- | ------ | -------------- |
| PAR-COMPONENT-001 | AIStatus.tsx                                        | Shared / Legacy  | 5042   | pending        |
| PAR-COMPONENT-002 | AccountSettingsModal.tsx                            | Shared / Legacy  | 46696  | pending        |
| PAR-COMPONENT-003 | AiConnectFields.tsx                                 | Shared / Legacy  | 5131   | pending        |
| PAR-COMPONENT-004 | AiConnectionSync.tsx                                | Shared / Legacy  | 666    | pending        |
| PAR-COMPONENT-005 | AppNav.tsx                                          | Shared / Legacy  | 19404  | pending        |
| PAR-COMPONENT-006 | BatchOperationsPanel.tsx                            | Shared / Legacy  | 9241   | pending        |
| PAR-COMPONENT-007 | BrandLogo.tsx                                       | Shared / Legacy  | 2788   | pending        |
| PAR-COMPONENT-008 | Chapter4Intro.tsx                                   | Shared / Legacy  | 16693  | pending        |
| PAR-COMPONENT-009 | ConnectPayments.tsx                                 | Shared / Legacy  | 5300   | pending        |
| PAR-COMPONENT-010 | Explain.tsx                                         | Shared / Legacy  | 4429   | pending        |
| PAR-COMPONENT-011 | ExportPanel.tsx                                     | Shared / Legacy  | 6814   | pending        |
| PAR-COMPONENT-012 | FunnelBuilderTabs.tsx                               | Shared / Legacy  | 13378  | pending        |
| PAR-COMPONENT-013 | FunnelBuilderTabs.usage.tsx                         | Shared / Legacy  | 9773   | pending        |
| PAR-COMPONENT-014 | GlobalCommandPalette.tsx                            | Shared / Legacy  | 3277   | pending        |
| PAR-COMPONENT-015 | GuidedTour.tsx                                      | Shared / Legacy  | 6921   | pending        |
| PAR-COMPONENT-016 | JourneyCelebration.tsx                              | Shared / Legacy  | 2522   | pending        |
| PAR-COMPONENT-017 | LessonGuide.tsx                                     | Shared / Legacy  | 35349  | pending        |
| PAR-COMPONENT-018 | LessonVisualsRenderer.tsx                           | Shared / Legacy  | 4891   | pending        |
| PAR-COMPONENT-019 | LibraryProjectCard.tsx                              | Shared / Legacy  | 6494   | pending        |
| PAR-COMPONENT-020 | MarketingIcons.tsx                                  | Shared / Legacy  | 7499   | pending        |
| PAR-COMPONENT-021 | Modal.tsx                                           | Shared / Legacy  | 10507  | pending        |
| PAR-COMPONENT-022 | ModelCentre.tsx                                     | Shared / Legacy  | 2764   | pending        |
| PAR-COMPONENT-023 | NotificationBell.tsx                                | Shared / Legacy  | 5056   | pending        |
| PAR-COMPONENT-024 | OtoCard.tsx                                         | Shared / Legacy  | 3507   | pending        |
| PAR-COMPONENT-025 | PillarFlow.tsx                                      | Shared / Legacy  | 6508   | pending        |
| PAR-COMPONENT-026 | PillarHub.tsx                                       | Shared / Legacy  | 5439   | pending        |
| PAR-COMPONENT-027 | PrivacySettings.tsx                                 | Shared / Legacy  | 9712   | pending        |
| PAR-COMPONENT-028 | ProgramCentre.tsx                                   | Shared / Legacy  | 141392 | pending        |
| PAR-COMPONENT-029 | ProgrammeCentre.tsx                                 | Shared / Legacy  | 60752  | pending        |
| PAR-COMPONENT-030 | ProgrammeJourney.tsx                                | Shared / Legacy  | 37148  | pending        |
| PAR-COMPONENT-031 | SecurityInitializer.tsx                             | Shared / Legacy  | 5938   | pending        |
| PAR-COMPONENT-032 | SellBetter.tsx                                      | Shared / Legacy  | 11055  | pending        |
| PAR-COMPONENT-033 | Skeleton.tsx                                        | Shared / Legacy  | 4460   | pending        |
| PAR-COMPONENT-034 | SkipLink.tsx                                        | Shared / Legacy  | 1672   | pending        |
| PAR-COMPONENT-035 | StrategyCard.tsx                                    | Shared / Legacy  | 2814   | pending        |
| PAR-COMPONENT-036 | StudioPlanNudge.tsx                                 | Shared / Legacy  | 3410   | pending        |
| PAR-COMPONENT-037 | SubscriptionModal.tsx                               | Shared / Legacy  | 23641  | pending        |
| PAR-COMPONENT-038 | Toast.tsx                                           | Shared / Legacy  | 3042   | pending        |
| PAR-COMPONENT-039 | WorkedExample.tsx                                   | Shared / Legacy  | 4787   | pending        |
| PAR-COMPONENT-040 | WorkflowBuilder.tsx                                 | Shared / Legacy  | 15686  | pending        |
| PAR-COMPONENT-041 | WorkflowManager.tsx                                 | Shared / Legacy  | 8248   | pending        |
| PAR-COMPONENT-042 | account/TransformationTracker.tsx                   | Account          | 17906  | pending        |
| PAR-COMPONENT-043 | admin/MemberProgressDashboard.tsx                   | Admin            | 12909  | pending        |
| PAR-COMPONENT-044 | admin/WhyAndCreedCampaignManager.tsx                | Admin            | 44810  | pending        |
| PAR-COMPONENT-045 | business/ResourceUtilization.tsx                    | Business         | 18695  | pending        |
| PAR-COMPONENT-046 | campaign/GroundingChips.tsx                         | Campaign         | 3060   | pending        |
| PAR-COMPONENT-047 | coach/LearnerDetailDrawer.tsx                       | Coach            | 26952  | pending        |
| PAR-COMPONENT-048 | coach/LearnerPurposeCard.tsx                        | Coach            | 4912   | pending        |
| PAR-COMPONENT-049 | coach/ReachOutModal.tsx                             | Coach            | 7752   | pending        |
| PAR-COMPONENT-050 | coaching/ApprovalWorkflowDiagram.tsx                | Coaching         | 14103  | pending        |
| PAR-COMPONENT-051 | coaching/ChapterSubmissionReview.tsx                | Coaching         | 9916   | pending        |
| PAR-COMPONENT-052 | coaching/ClientProgressCard.tsx                     | Coaching         | 4448   | pending        |
| PAR-COMPONENT-053 | coaching/CohortProgressVisualization.tsx            | Coaching         | 17451  | pending        |
| PAR-COMPONENT-054 | coaching/FeedbackQualityScore.tsx                   | Coaching         | 18295  | pending        |
| PAR-COMPONENT-055 | coaching/LearnerProgressFunnel.tsx                  | Coaching         | 16776  | pending        |
| PAR-COMPONENT-056 | coaching/PerformanceScorecard.tsx                   | Coaching         | 14572  | pending        |
| PAR-COMPONENT-057 | coaching/SubmissionReviewFlow.tsx                   | Coaching         | 18562  | pending        |
| PAR-COMPONENT-058 | coaching/WeeklyActivitySummary.tsx                  | Coaching         | 14938  | pending        |
| PAR-COMPONENT-059 | dashboard/90DayReflectionCheckpoint.tsx             | Dashboard        | 20414  | pending        |
| PAR-COMPONENT-060 | dashboard/DecisionMomentModal.tsx                   | Dashboard        | 5977   | pending        |
| PAR-COMPONENT-061 | dashboard/MotivationWidget.tsx                      | Dashboard        | 12482  | pending        |
| PAR-COMPONENT-062 | dashboard/WhyAndCreedErrorDisplay.examples.tsx      | Dashboard        | 16126  | pending        |
| PAR-COMPONENT-063 | dashboard/WhyAndCreedErrorDisplay.tsx               | Dashboard        | 11473  | pending        |
| PAR-COMPONENT-064 | dashboard/WhyAndCreedMetrics.tsx                    | Dashboard        | 11197  | pending        |
| PAR-COMPONENT-065 | dashboard/WhyAndCreedNotification.tsx               | Dashboard        | 7642   | pending        |
| PAR-COMPONENT-066 | dashboard/WhyAndCreedReflection.tsx                 | Dashboard        | 13620  | pending        |
| PAR-COMPONENT-067 | dashboard/WhyAndCreedSection.tsx                    | Dashboard        | 9106   | pending        |
| PAR-COMPONENT-068 | dialogs/MajorDecisionReminder.tsx                   | Dialogs          | 4148   | pending        |
| PAR-COMPONENT-069 | email/EmailComponents.tsx                           | Email            | 7228   | pending        |
| PAR-COMPONENT-070 | email/EmailWrapper.tsx                              | Email            | 4491   | pending        |
| PAR-COMPONENT-071 | examples/VisualExportExample.tsx                    | Examples         | 13953  | pending        |
| PAR-COMPONENT-072 | features/FeaturePreview.tsx                         | Features         | 8912   | pending        |
| PAR-COMPONENT-073 | features/LockedFeatureTeaser.tsx                    | Features         | 13696  | pending        |
| PAR-COMPONENT-074 | features/ProgressiveDisclosure.tsx                  | Features         | 7488   | pending        |
| PAR-COMPONENT-075 | features/TierComparisonOverlay.tsx                  | Features         | 15774  | pending        |
| PAR-COMPONENT-076 | features/UpgradePrompt.tsx                          | Features         | 9024   | pending        |
| PAR-COMPONENT-077 | free-access/ErrorDisplay.tsx                        | Free Access      | 10869  | pending        |
| PAR-COMPONENT-078 | funnel-builder/FunnelAnalytics.tsx                  | Funnel Builder   | 16411  | pending        |
| PAR-COMPONENT-079 | funnel-builder/FunnelBuilderShared.tsx              | Funnel Builder   | 34733  | pending        |
| PAR-COMPONENT-080 | funnel-builder/FunnelCanvasBuilder.tsx              | Funnel Builder   | 21663  | pending        |
| PAR-COMPONENT-081 | funnel-builder/FunnelSketches.tsx                   | Funnel Builder   | 25226  | pending        |
| PAR-COMPONENT-082 | funnel-builder/FunnelTemplateGallery.tsx            | Funnel Builder   | 18871  | pending        |
| PAR-COMPONENT-083 | funnel-education/BestPractices.tsx                  | Funnel Education | 9835   | pending        |
| PAR-COMPONENT-084 | funnel-education/DropoffAnalysis.tsx                | Funnel Education | 22128  | pending        |
| PAR-COMPONENT-085 | funnel-education/FunnelCalculator.tsx               | Funnel Education | 21187  | pending        |
| PAR-COMPONENT-086 | funnel-education/FunnelVisualizer.tsx               | Funnel Education | 10215  | pending        |
| PAR-COMPONENT-087 | funnel-education/FunnelsExplainedContent.tsx        | Funnel Education | 20148  | pending        |
| PAR-COMPONENT-088 | funnel-education/TrafficFlow.tsx                    | Funnel Education | 16425  | pending        |
| PAR-COMPONENT-089 | icons/ActionIcon.tsx                                | Icons            | 3957   | pending        |
| PAR-COMPONENT-090 | icons/ChapterIcon.tsx                               | Icons            | 3457   | pending        |
| PAR-COMPONENT-091 | icons/IconButton.tsx                                | Icons            | 2500   | pending        |
| PAR-COMPONENT-092 | icons/IconSizer.tsx                                 | Icons            | 1812   | pending        |
| PAR-COMPONENT-093 | icons/IconSystemShowcase.tsx                        | Icons            | 10651  | pending        |
| PAR-COMPONENT-094 | icons/StatusIcon.tsx                                | Icons            | 3546   | pending        |
| PAR-COMPONENT-095 | illustrations/Illustration.tsx                      | Illustrations    | 6264   | pending        |
| PAR-COMPONENT-096 | lazy-components.tsx                                 | Shared / Legacy  | 7237   | pending        |
| PAR-COMPONENT-097 | lazy-studio.tsx                                     | Shared / Legacy  | 3115   | pending        |
| PAR-COMPONENT-098 | learn/FunnelMechanicsGuide.tsx                      | Learn            | 15114  | pending        |
| PAR-COMPONENT-099 | lessons/MarketingSystemVisuals.tsx                  | Lessons          | 12712  | pending        |
| PAR-COMPONENT-100 | lessons/VisualReferencesLibrary.tsx                 | Lessons          | 14519  | pending        |
| PAR-COMPONENT-101 | my-business/ConversionRateDisplay.tsx               | My Business      | 14938  | pending        |
| PAR-COMPONENT-102 | my-business/FinancialHealthScore.tsx                | My Business      | 15749  | pending        |
| PAR-COMPONENT-103 | my-business/FunnelFlowCanvas.tsx                    | My Business      | 14236  | pending        |
| PAR-COMPONENT-104 | my-business/FunnelHealthPanel.tsx                   | My Business      | 9876   | pending        |
| PAR-COMPONENT-105 | my-business/GoalProgressTracker.tsx                 | My Business      | 17412  | pending        |
| PAR-COMPONENT-106 | my-business/MetricsDashboard.tsx                    | My Business      | 10475  | pending        |
| PAR-COMPONENT-107 | my-business/MyBusinessDashboard.tsx                 | My Business      | 12593  | pending        |
| PAR-COMPONENT-108 | my-business/RevenueBreakdown.tsx                    | My Business      | 12819  | pending        |
| PAR-COMPONENT-109 | navigation/ProgressIndicator.tsx                    | Navigation       | 7708   | pending        |
| PAR-COMPONENT-110 | navigation/UnifiedNav.tsx                           | Navigation       | 14023  | pending        |
| PAR-COMPONENT-111 | programme/BusinessDefinitionVisuals.demo.tsx        | Programme        | 8375   | pending        |
| PAR-COMPONENT-112 | programme/BusinessDefinitionVisuals.integration.tsx | Programme        | 13859  | pending        |
| PAR-COMPONENT-113 | programme/BusinessDefinitionVisuals.tsx             | Programme        | 19311  | pending        |
| PAR-COMPONENT-114 | programme/CoachMessages.tsx                         | Programme        | 5042   | pending        |
| PAR-COMPONENT-115 | programme/FunnelFlowDiagram.tsx                     | Programme        | 9498   | pending        |
| PAR-COMPONENT-116 | programme/GrowthImprovementPlan.tsx                 | Programme        | 15174  | pending        |
| PAR-COMPONENT-117 | programme/Phase2LessonVisuals.demo.tsx              | Programme        | 10011  | pending        |
| PAR-COMPONENT-118 | programme/Phase2LessonVisuals.integration.tsx       | Programme        | 18604  | pending        |
| PAR-COMPONENT-119 | programme/Phase2LessonVisuals.tsx                   | Programme        | 22553  | pending        |
| PAR-COMPONENT-120 | qualify/QualificationWizard.tsx                     | Qualify          | 39691  | pending        |
| PAR-COMPONENT-121 | reports/TransformationReportPDF.tsx                 | Reports          | 12474  | pending        |
| PAR-COMPONENT-122 | shared/AccessibleTabs.tsx                           | Shared           | 9590   | pending        |
| PAR-COMPONENT-123 | shared/Button.tsx                                   | Shared           | 2378   | pending        |
| PAR-COMPONENT-124 | shared/Card.tsx                                     | Shared           | 2103   | pending        |
| PAR-COMPONENT-125 | shared/StatusBadge.tsx                              | Shared           | 1690   | pending        |
| PAR-COMPONENT-126 | shared/Tabs.tsx                                     | Shared           | 3649   | pending        |
| PAR-COMPONENT-127 | studio/AiFieldButton.tsx                            | Studio           | 2193   | pending        |
| PAR-COMPONENT-128 | studio/AiFunnelBuilder.tsx                          | Studio           | 5320   | pending        |
| PAR-COMPONENT-129 | studio/BreakEvenCard.tsx                            | Studio           | 23323  | pending        |
| PAR-COMPONENT-130 | studio/ChecklistPanel.tsx                           | Studio           | 6657   | pending        |
| PAR-COMPONENT-131 | studio/CollabPanels.tsx                             | Studio           | 5608   | pending        |
| PAR-COMPONENT-132 | studio/CommandPalette.tsx                           | Studio           | 6647   | pending        |
| PAR-COMPONENT-133 | studio/ConstraintsPanel.tsx                         | Studio           | 7198   | pending        |
| PAR-COMPONENT-134 | studio/FixFirst.tsx                                 | Studio           | 3215   | pending        |
| PAR-COMPONENT-135 | studio/FunnelAudit.tsx                              | Studio           | 5268   | pending        |
| PAR-COMPONENT-136 | studio/FunnelCanvas.tsx                             | Studio           | 23190  | pending        |
| PAR-COMPONENT-137 | studio/GlassDrawer.tsx                              | Studio           | 1273   | pending        |
| PAR-COMPONENT-138 | studio/GlossaryLayer.tsx                            | Studio           | 6760   | pending        |
| PAR-COMPONENT-139 | studio/HomeWidgets.tsx                              | Studio           | 6022   | pending        |
| PAR-COMPONENT-140 | studio/InsightPanels.tsx                            | Studio           | 20004  | pending        |
| PAR-COMPONENT-141 | studio/InspectorPanels.tsx                          | Studio           | 47483  | pending        |
| PAR-COMPONENT-142 | studio/InteractiveFunnelBuilder.tsx                 | Studio           | 14114  | pending        |
| PAR-COMPONENT-143 | studio/LandingAudit.tsx                             | Studio           | 6474   | pending        |
| PAR-COMPONENT-144 | studio/LandingPage.tsx                              | Studio           | 14777  | pending        |
| PAR-COMPONENT-145 | studio/LoginForm.tsx                                | Studio           | 12330  | pending        |
| PAR-COMPONENT-146 | studio/Modal.tsx                                    | Studio           | 2232   | pending        |
| PAR-COMPONENT-147 | studio/NotesAiDraft.tsx                             | Studio           | 3925   | pending        |
| PAR-COMPONENT-148 | studio/RecentExperiments.tsx                        | Studio           | 3290   | pending        |
| PAR-COMPONENT-149 | studio/ReportPanels.tsx                             | Studio           | 29497  | pending        |
| PAR-COMPONENT-150 | studio/ResultCards.tsx                              | Studio           | 8571   | pending        |
| PAR-COMPONENT-151 | studio/RiskPanel.tsx                                | Studio           | 10075  | pending        |
| PAR-COMPONENT-152 | studio/SetupModals.tsx                              | Studio           | 19462  | pending        |
| PAR-COMPONENT-153 | studio/ShortcutsOverlay.tsx                         | Studio           | 3559   | pending        |
| PAR-COMPONENT-154 | studio/SimulatePanels.tsx                           | Studio           | 27223  | pending        |
| PAR-COMPONENT-155 | studio/SplitViewLayout.tsx                          | Studio           | 7018   | pending        |
| PAR-COMPONENT-156 | studio/SplitViewLayoutDemo.tsx                      | Studio           | 6068   | pending        |
| PAR-COMPONENT-157 | studio/SplitViewLayoutResponsive.tsx                | Studio           | 13990  | pending        |
| PAR-COMPONENT-158 | studio/SplitViewResponsiveDemo.tsx                  | Studio           | 11568  | pending        |
| PAR-COMPONENT-159 | studio/StudioTopBar.tsx                             | Studio           | 5827   | pending        |
| PAR-COMPONENT-160 | studio/ToolsHub.tsx                                 | Studio           | 8103   | pending        |
| PAR-COMPONENT-161 | studio/WhatsNew.tsx                                 | Studio           | 4102   | pending        |
| PAR-COMPONENT-162 | studio/blocks-catalog.tsx                           | Studio           | 43858  | pending        |
| PAR-COMPONENT-163 | studio/header-menu.tsx                              | Studio           | 2940   | pending        |
| PAR-COMPONENT-164 | studio/inspector/FormFields.tsx                     | Studio           | 4131   | pending        |
| PAR-COMPONENT-165 | ui/AnimatedFormFields.tsx                           | Ui               | 11834  | pending        |
| PAR-COMPONENT-166 | ui/AnimatedMetricCard.tsx                           | Ui               | 6506   | pending        |
| PAR-COMPONENT-167 | ui/AnimatedProgressBar.tsx                          | Ui               | 11937  | pending        |
| PAR-COMPONENT-168 | ui/AnimatedSelectableCard.tsx                       | Ui               | 9142   | pending        |
| PAR-COMPONENT-169 | ui/Badge.tsx                                        | Ui               | 5800   | pending        |
| PAR-COMPONENT-170 | ui/Badge.usage.tsx                                  | Ui               | 13779  | pending        |
| PAR-COMPONENT-171 | ui/Button.tsx                                       | Ui               | 963    | pending        |
| PAR-COMPONENT-172 | ui/Card.tsx                                         | Ui               | 1627   | pending        |
| PAR-COMPONENT-173 | ui/DataTable.tsx                                    | Ui               | 5109   | pending        |
| PAR-COMPONENT-174 | ui/EmptyState.tsx                                   | Ui               | 2125   | pending        |
| PAR-COMPONENT-175 | ui/InfoPanel.tsx                                    | Ui               | 10061  | pending        |
| PAR-COMPONENT-176 | ui/InteractiveStatusBadge.tsx                       | Ui               | 8290   | pending        |
| PAR-COMPONENT-177 | ui/InteractiveTimeline.tsx                          | Ui               | 10131  | pending        |
| PAR-COMPONENT-178 | ui/Label.tsx                                        | Ui               | 6461   | pending        |
| PAR-COMPONENT-179 | ui/Notice.tsx                                       | Ui               | 1930   | pending        |
| PAR-COMPONENT-180 | ui/PageShell.tsx                                    | Ui               | 2306   | pending        |
| PAR-COMPONENT-181 | ui/ProgressiveDisclosure.tsx                        | Ui               | 9423   | pending        |
| PAR-COMPONENT-182 | ui/SkeletonStates.tsx                               | Ui               | 9040   | pending        |
