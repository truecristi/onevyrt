import type { CSSProperties } from "react";

const TITLE = "Privacy Policy — OneVYRT";
const DESCRIPTION = "How OneVYRT collects, uses, and protects your data.";
export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/privacy" },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "article" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const wrap: CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "48px 20px 80px", fontFamily: "Arial, \"Helvetica Neue\", Helvetica, sans-serif", color: "#202124", lineHeight: 1.6 };
const h2: CSSProperties = { fontSize: 18, fontWeight: 700, marginTop: 32, marginBottom: 8 };
const p: CSSProperties = { fontSize: 14, color: "#3c4043", marginBottom: 12 };
const note: CSSProperties = { fontSize: 13, color: "#5f6368", background: "#f8fafd", border: "1px solid #dadce0", borderRadius: 8, padding: "12px 14px", marginBottom: 24 };

export default function PrivacyPage() {
  return (
    <div style={wrap}>
      <div style={{ fontSize: 12, letterSpacing: 0.6, color: "var(--ds-brand)", fontWeight: 700 }}>ONEVYRT</div>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>Privacy Policy</h1>
      <div style={{ fontSize: 13, color: "#5f6368", marginBottom: 20 }}>Last updated: 13 August 2026</div>

      <div style={note}>
        This describes what OneVYRT actually collects and does with it, in plain language. It is not a substitute
        for legal advice — if you need a policy tailored to a specific jurisdiction or regulatory requirement,
        have a solicitor review it.
      </div>

      <p style={p}>OneVYRT ("we", "us") operates onevyrt.masteryresearch.com. This policy covers what happens
        when you use it.</p>

      <h2 style={h2}>Information we collect</h2>
      <p style={p}><b>Account information:</b> your email address and a password (stored as a salted hash — we
        never store or see your plain-text password). If you enable two-factor authentication, we store the
        authenticator secret needed to verify your codes.</p>
      <p style={p}><b>The content you create:</b> business plans, funnel diagrams, financial models, notes, and any
        other data you enter into your own projects. This belongs to you — see "Your data, your ownership" below.</p>
      <p style={p}><b>Tracking data you choose to collect:</b> if you install a OneVYRT tracking snippet on your own
        site, we record the visits and conversions it reports, tied to the tracking key you control. This is data
        about visitors to your funnels, not about people using the OneVYRT app itself.</p>
      <p style={p}><b>Billing information:</b> if you upgrade to a paid plan, payment is handled entirely by
        Stripe. We never see or store your card number — we only keep a Stripe customer/subscription reference
        so we know which plan your workspace is on.</p>
      <p style={p}><b>Optional AI features:</b> if you choose to use the AI Copilot or AI generation features,
        you supply your own AI provider API key (e.g. OpenRouter). Your key is saved with your workspace,
        encrypted at rest, so it persists across your devices and survives restarts; you can remove it at any
        time. Each AI request goes directly from your browser to the provider&rsquo;s API (which routes it to
        whichever model you select) &mdash; we do not proxy, see, log, or store the AI requests or their responses.</p>
      <p style={p}><b>Avatar images:</b> if you upload a profile photo, we store it on our own server.</p>

      <h2 style={h2}>How we use it</h2>
      <p style={p}>To run the service: authenticate you, save your work, process billing, send transactional
        email (password resets, account notices), and enforce plan limits. If you're on the Growth Program or in
        a coaching cohort, we also send you occasional in-app and email notifications — a heads-up before a
        cohort session, or a nudge if you haven't touched the program in a while. These stop the moment the
        underlying reason does (a session passes, you're active again) — there's no separate marketing list. We
        do not sell your data, and we do not use it for advertising.</p>

      <h2 style={h2}>Who we share it with</h2>
      <p style={p}><b>Our database provider (Supabase, managed PostgreSQL)</b> — hosts the application database
        described below; they don't use your data for anything beyond providing that hosting. <b>Stripe</b> —
        payment processing for paid plans. <b>Our email provider (SMTP)</b> — delivering transactional and
        notification emails. <b>OpenRouter</b> — only if you personally choose to use the optional AI feature with
        your own API key, and only the specific request you trigger; OpenRouter in turn routes that request to
        whichever underlying model you selected. We don't share data with anyone else, and we don't sell it.</p>

      <h2 style={h2}>Where it's stored</h2>
      <p style={p}>Application data (accounts, workspaces, projects, and everything described above) lives in a
        managed PostgreSQL database hosted by Supabase, encrypted in transit between our server and the database.
        Passwords, 2FA secrets, and session tokens are stored using standard cryptographic practices (hashing,
        HMAC signing) — never in plain text, regardless of where the database itself is hosted.</p>

      <h2 style={h2}>Cookies</h2>
      <p style={p}>We use one functional cookie to keep you signed in. We don't use advertising or third-party
        tracking cookies on this site.</p>

      <h2 style={h2}>Your data, your rights</h2>
      <p style={p}>You can export or delete your own project data at any time from within the app. You can delete
        your entire account and all associated data from Account Settings → Security, or by emailing us — this
        permanently removes your account, and any workspace you solely own, unless that workspace still has other
        members (in which case you'll be asked to reassign ownership first so their data isn't lost).</p>

      <h2 style={h2}>Children</h2>
      <p style={p}>OneVYRT is a business-planning tool intended for business owners and professionals, not
        children. We don't knowingly collect data from anyone under 16.</p>

      <h2 style={h2}>Changes to this policy</h2>
      <p style={p}>If this changes materially, we'll update the date at the top of this page.</p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>Questions about this policy or your data: <a href="https://masteryresearch.com/contact">masteryresearch.com/contact</a>.</p>
    </div>
  );
}
