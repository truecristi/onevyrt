/**
 * The product-flow analytics event vocabulary (audit §27). One place that
 * names every activation-funnel milestone so the emit sites and the analytics
 * queries agree on the exact strings. These record how people move THROUGH the
 * OneVYRT app — never the customer's own business content — so "where users get
 * stuck" becomes answerable and Home's "next move" can be checked against real
 * completion behaviour.
 *
 * Emit with `track(PRODUCT_EVENT.x, { userId, workspaceId, metadata })` from
 * lib/analytics — it is fire-and-forget, so instrumenting a handler can never
 * break the feature it measures. "First X" milestones (first lead, first
 * booking, first decision) are derived analytically as the earliest occurrence
 * per workspace, so the emit sites stay simple and idempotent.
 */
export const PRODUCT_EVENT = {
  ACCOUNT_CREATED: "user_registered", // already emitted at registration
  GUIDED_SETUP_STARTED: "guided_setup_started",
  GUIDED_SETUP_COMPLETED: "guided_setup_completed",
  PROJECT_CREATED: "project_created",
  MESSAGE_COMPLETED: "message_completed",
  OFFER_COMPLETED: "offer_completed",
  NUMBERS_COMPLETED: "numbers_completed",
  FUNNEL_CREATED: "funnel_created",
  FUNNEL_PUBLISHED: "funnel_published",
  LEAD_CREATED: "lead_created",
  BOOKING_CREATED: "booking_created",
  ACTUALS_ENTERED: "actuals_entered",
  DECISION_RECORDED: "decision_recorded",
  STEP_ABANDONED: "step_abandoned",
  ERROR_ENCOUNTERED: "error_encountered",
} as const;

export type ProductEventName = (typeof PRODUCT_EVENT)[keyof typeof PRODUCT_EVENT];
