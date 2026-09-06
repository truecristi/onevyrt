"use client";
/**
 * Public share view of a Growth & Improvement Plan. Accessed via a 24-hour,
 * expiring share link — no authentication required. Displays the same
 * GrowthImprovementPlan component as the authenticated view, but in a
 * minimal, shareable context (no edit buttons, no programme nav).
 *
 * Fetches the plan via /api/share/growth-plan/[token] on mount; that route
 * verifies the token signature and expiry, then fetches the plan from the
 * database.
 */
import { use, useEffect, useState } from "react";
import { GrowthImprovementPlan } from "../../../../components/programme/GrowthImprovementPlan";
import { formatPlan, type GrowthPlan } from "../../../../lib/growth-plan-utils";
import type { Chapter4Submission } from "../../../../lib/chapter4-submissions";

type LoadState = "loading" | "ok" | "error" | "expired";

export default function SharedGrowthPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, setLoadState] = useState<LoadState>("loading");
  const [plan, setPlan] = useState<GrowthPlan | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`/api/share/growth-plan/${encodeURIComponent(token)}`);
        const data = (await r.json()) as {
          submission?: Chapter4Submission;
          workspaceName?: string;
          error?: string;
        };

        if (!r.ok) {
          if (r.status === 404 || data.error === "This share link is invalid or has expired.") {
            setLoadState("expired");
            setError("This share link is no longer available. It may have expired (share links last 24 hours) or been revoked by its owner.");
          } else {
            setLoadState("error");
            setError(data.error || "Could not load the plan.");
          }
          return;
        }

        if (!data.submission) {
          setLoadState("error");
          setError("No plan data found.");
          return;
        }

        setPlan(formatPlan(data.submission));
        setWorkspaceName(data.workspaceName || "");
        setLoadState("ok");
      } catch {
        setLoadState("error");
        setError("Connection error. Please try again.");
      }
    };

    void load();
  }, [token]);

  return (
    <div style={SHELL_STYLE}>
      <style>{CSS}</style>

      {state === "loading" && (
        <div style={PANEL_STYLE}>
          <div style={SPINNER_STYLE} />
          <p style={BODY_STYLE}>Loading the Growth & Improvement Plan…</p>
        </div>
      )}

      {state === "expired" && (
        <div style={PANEL_STYLE}>
          <h1 style={TITLE_STYLE}>This link is no longer available</h1>
          <p style={{ color: "var(--ds-text-secondary)", fontSize: 14, margin: "0 0 16px" }}>{error}</p>
          <a href="/" style={LINK_STYLE}>
            Back to ONEVYRT
          </a>
        </div>
      )}

      {state === "error" && (
        <div style={PANEL_STYLE}>
          <h1 style={TITLE_STYLE}>Something went wrong</h1>
          <p style={{ color: "var(--ds-text-secondary)", fontSize: 14, margin: "0 0 16px" }}>{error}</p>
          <a href="/" style={LINK_STYLE}>
            Back to ONEVYRT
          </a>
        </div>
      )}

      {state === "ok" && plan && (
        <>
          <div style={HEADER_STYLE}>
            <div>
              <div style={EYEBROW_STYLE}>Growth & Improvement Plan</div>
              <h1 style={TITLE_STYLE}>{workspaceName}'s next 90 days</h1>
              <p style={HINT_STYLE}>Shared {new Date().toLocaleDateString()}</p>
            </div>
            <a href="/" style={LINK_STYLE}>
              Back to ONEVYRT
            </a>
          </div>
          <GrowthImprovementPlan plan={plan} workspaceName={workspaceName} />
        </>
      )}
    </div>
  );
}

const SHELL_STYLE = {
  maxWidth: 880,
  margin: "0 auto",
  padding: "26px 18px 100px",
  background: "var(--ds-bg-app)",
  color: "var(--ds-text-primary)",
  fontFamily: "var(--ds-font, system-ui, -apple-system, Segoe UI, Roboto, sans-serif)",
} as const;

const PANEL_STYLE = {
  background: "var(--ds-surface)",
  border: "1px solid var(--ds-border-subtle)",
  borderRadius: "var(--ds-radius-lg)",
  padding: "40px 22px",
  display: "flex" as const,
  flexDirection: "column" as const,
  alignItems: "center",
  gap: 10,
  textAlign: "center" as const,
  marginTop: 20,
};

const SPINNER_STYLE = {
  width: 28,
  height: 28,
  border: "3px solid var(--ds-border-default)",
  borderTopColor: "var(--ds-brand)",
  borderRadius: "50%",
  animation: "spin .8s linear infinite",
};

const BODY_STYLE = {
  color: "var(--ds-text-secondary)",
  fontSize: 14,
  margin: 0,
};

const HEADER_STYLE = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 18,
} as const;

const TITLE_STYLE = {
  fontSize: 27,
  fontWeight: 700,
  margin: "2px 0 4px",
  letterSpacing: "-0.4px",
};

const EYEBROW_STYLE = {
  fontSize: 11,
  letterSpacing: "0.7px",
  fontWeight: 700,
  color: "var(--ds-brand-active)",
  textTransform: "uppercase" as const,
};

const HINT_STYLE = {
  color: "var(--ds-text-tertiary)",
  fontSize: 12,
  margin: "2px 0 0",
  lineHeight: 1.6,
};

const LINK_STYLE = {
  display: "inline-block",
  background: "var(--ds-surface)",
  border: "1px solid var(--ds-border-default)",
  color: "var(--ds-text-primary)",
  borderRadius: "var(--ds-radius-md)",
  padding: "9px 15px",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  textDecoration: "none",
  transition: "border-color .15s, background .15s",
};

const CSS = `
@keyframes spin {
  to { transform: rotate(360deg); }
}
`;
