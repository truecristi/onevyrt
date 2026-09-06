import type { CSSProperties } from "react";

const TITLE = "Terms of Service — OneVYRT";
const DESCRIPTION = "The terms that govern your use of OneVYRT.";
export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/terms" },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "article" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const wrap: CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "48px 20px 80px", fontFamily: "Arial, \"Helvetica Neue\", Helvetica, sans-serif", color: "#202124", lineHeight: 1.6 };
const h2: CSSProperties = { fontSize: 18, fontWeight: 700, marginTop: 32, marginBottom: 8 };
const p: CSSProperties = { fontSize: 14, color: "#3c4043", marginBottom: 12 };
const note: CSSProperties = { fontSize: 13, color: "#5f6368", background: "#f8fafd", border: "1px solid #dadce0", borderRadius: 8, padding: "12px 14px", marginBottom: 24 };

export default function TermsPage() {
  return (
    <div style={wrap}>
      <div style={{ fontSize: 12, letterSpacing: 0.6, color: "var(--ds-brand)", fontWeight: 700 }}>ONEVYRT</div>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>Terms of Service</h1>
      <div style={{ fontSize: 13, color: "#5f6368", marginBottom: 20 }}>Last updated: 9 August 2026</div>

      <div style={note}>
        Plain-language terms describing how OneVYRT actually operates. Not a substitute for legal advice — have a
        solicitor review this if you need terms tailored to a specific jurisdiction.
      </div>

      <h2 style={h2}>1. Agreement</h2>
      <p style={p}>By creating an account or using OneVYRT ("the service"), you agree to these terms. If you don't
        agree, don't use the service.</p>

      <h2 style={h2}>2. The service</h2>
      <p style={p}>OneVYRT is a business-planning and funnel-modelling tool: a guided program for defining a
        business, a canvas for mapping a funnel, and simulation/reporting tools built on the numbers you enter.</p>

      <h2 style={h2}>3. Accounts</h2>
      <p style={p}>You're responsible for the accuracy of the information you provide and for keeping your
        password (and 2FA device, if enabled) secure. You're responsible for activity that happens under your
        account.</p>

      <h2 style={h2}>4. Plans and billing</h2>
      <p style={p}>The Free plan gives you a read-only demo and no projects of your own. Pro and Business are paid
        subscriptions billed monthly via Stripe; Pro is limited to a single profile, Business supports inviting
        teammates. Performance is a custom, contact-sales plan. You can cancel a subscription at any time from
        "Manage billing" inside the app, which opens Stripe's own billing portal — cancellation takes effect at
        the end of the current billing period unless stated otherwise at checkout.</p>

      <h2 style={h2}>5. Acceptable use</h2>
      <p style={p}>Don't use the service to break the law, to attack or abuse the infrastructure (including the
        public tracking endpoint), or to access another user's account or workspace without permission.</p>

      <h2 style={h2}>6. Your data, your ownership</h2>
      <p style={p}>You own the business plans, funnels, and other content you create in OneVYRT. We don't claim
        any ownership over it, and we don't use it for anything beyond operating the service for you. See the
        <a href="/privacy"> Privacy Policy</a> for what we collect and why.</p>

      <h2 style={h2}>7. Termination</h2>
      <p style={p}>You can delete your own account at any time from Account Settings → Security. We may suspend
        or terminate an account that violates section 5, with notice where practical.</p>

      <h2 style={h2}>8. No warranty</h2>
      <p style={p}>The service is provided "as is." We work to keep it reliable and your data safe (including
        nightly backups), but we don't guarantee the service will be uninterrupted or error-free, and the
        financial projections it produces are estimates based on the numbers you enter — not financial advice.</p>

      <h2 style={h2}>9. Limitation of liability</h2>
      <p style={p}>To the extent permitted by law, OneVYRT isn't liable for indirect, incidental, or consequential
        damages arising from use of the service. Nothing here limits liability that can't legally be limited.</p>

      <h2 style={h2}>10. Governing law</h2>
      <p style={p}>These terms are governed by the laws of England and Wales.</p>

      <h2 style={h2}>11. Changes</h2>
      <p style={p}>If these terms change materially, we'll update the date at the top of this page.</p>

      <h2 style={h2}>12. Contact</h2>
      <p style={p}>Questions: <a href="https://masteryresearch.com/contact">masteryresearch.com/contact</a>.</p>
    </div>
  );
}
