/**
 * Friendly not-found state for the public funnel. When /q/[slug] resolves to no
 * published funnel, page.tsx calls notFound() and Next renders this boundary
 * (the nearest not-found up the tree) instead of the app's dashboard-flavoured
 * 404 — a public visitor who mistyped a link should see the funnel's own look
 * and a plain "this link isn't valid" message, not "Go to Dashboard".
 *
 * Self-contained light styling that mirrors the QualificationWizard shell; the
 * funnel is light-only, so there's no theme handling here.
 */
export default function FunnelNotFound() {
  return (
    <div style={{ minHeight: "100dvh", background: "#f5f7fa", color: "#13201b", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "6vh 20px 40px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ width: "min(560px, 100%)" }}>
        <div style={{ background: "#fff", border: "1px solid #e0eae4", borderRadius: 18, padding: "30px 28px", boxShadow: "0 20px 50px rgba(20,50,35,.06)" }}>
          <div aria-hidden="true" style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(10,158,110,.12)", color: "#0a9e6e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 16 }}>?</div>
          <h1 style={{ fontSize: 26, letterSpacing: "-.02em", margin: "0 0 10px" }}>This link isn&rsquo;t valid</h1>
          <p style={{ fontSize: 16, color: "#556158", lineHeight: 1.55, margin: 0 }}>
            The page you&rsquo;re looking for doesn&rsquo;t exist or may have been moved. Double-check the link and try again.
          </p>
        </div>
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "#626e66" }}>Powered by OneVYRT</div>
      </div>
    </div>
  );
}
