"use client";

/**
 * ONEVYRT Design System v1 — living reference (spec §91). A visual catalogue
 * of the token-driven primitives so redesigned screens have one source of
 * truth to match. Harmless to ship (read-only showcase), and the anchor for
 * visual-regression checks as the product-wide redesign proceeds.
 */
import { Button } from "../../../components/ui/Button";
import { Card, Panel, Badge, Field } from "../../../components/ui/Card";

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "var(--ds-space-8)" }}>
      <div className="ds-section" style={{ marginBottom: "var(--ds-space-4)" }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--ds-space-3)", alignItems: "center" }}>{children}</div>
    </section>
  );
}

const SWATCHES = ["--ds-bg-app", "--ds-surface", "--ds-brand", "--ds-brand-soft", "--ds-success", "--ds-warning", "--ds-danger", "--ds-info", "--ds-text-primary", "--ds-text-secondary", "--ds-border-default"];

export default function Showcase() {
  return (
    <div className="ds-scope" style={{ background: "var(--ds-bg-app)", minHeight: "100vh", padding: "var(--ds-space-10) var(--ds-space-6)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div className="ds-eyebrow">ONEVYRT DESIGN SYSTEM</div>
        <h1 className="ds-display" style={{ margin: "4px 0 6px" }}>Components v1</h1>
        <p className="ds-body" style={{ marginBottom: "var(--ds-space-8)" }}>The token-driven primitives every redesigned screen builds from. Toggle your OS light/dark to check both themes.</p>

        <Row title="Buttons">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="lg">Large</Button>
          <Button variant="secondary" disabled>Disabled</Button>
        </Row>

        <Row title="Badges & status">
          <Badge>Draft</Badge>
          <Badge tone="info" dot>Ready</Badge>
          <Badge tone="success" dot>Active</Badge>
          <Badge tone="warning" dot>Needs review</Badge>
          <Badge tone="danger" dot>Error</Badge>
          <Badge tone="brand">AI</Badge>
        </Row>

        <Row title="Inputs">
          <div style={{ display: "grid", gap: "var(--ds-space-4)", width: "100%", maxWidth: 420 }}>
            <Field label="Brand name" help="Shown across generated campaigns.">
              <input className="ds-input" placeholder="ONEVYRT" />
            </Field>
            <Field label="Description">
              <textarea className="ds-textarea" placeholder="What the business does…" />
            </Field>
          </div>
        </Row>

        <Row title="Cards">
          <Card style={{ width: 260 }}>
            <div className="ds-eyebrow">Metric</div>
            <div className="ds-title" style={{ margin: "2px 0" }}>4.07×</div>
            <div className="ds-body">ROAS · +18% vs last period</div>
          </Card>
          <Card raised style={{ width: 260 }}>
            <div className="ds-section" style={{ marginBottom: 4 }}>Raised card</div>
            <div className="ds-body">Elevation only where it means something.</div>
            <div style={{ marginTop: "var(--ds-space-4)" }}><Button variant="primary" size="sm">Action</Button></div>
          </Card>
        </Row>

        <Row title="Panel">
          <Panel style={{ padding: "var(--ds-space-6)", width: "100%" }}>
            <div className="ds-section">Panel surface</div>
            <p className="ds-body" style={{ margin: "6px 0 0" }}>For grouped, higher-level content regions.</p>
          </Panel>
        </Row>

        <Row title="Colour tokens">
          {SWATCHES.map((t) => (
            <div key={t} style={{ textAlign: "center", fontSize: 11, color: "var(--ds-text-tertiary)" }}>
              <div style={{ width: 64, height: 44, borderRadius: 10, background: `var(${t})`, border: "1px solid var(--ds-border-default)", marginBottom: 4 }} />
              {t.replace("--ds-", "")}
            </div>
          ))}
        </Row>
      </div>
    </div>
  );
}
