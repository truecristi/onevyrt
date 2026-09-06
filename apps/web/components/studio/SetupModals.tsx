"use client";
/**
 * The three project-creation modals from the studio home/library view, lifted
 * out of funnel-studio.tsx as pure presentational components:
 *   - SetupWizard    — the 3-step guided "what's the business?" setup
 *   - ConfigureSteps — rename/URL the steps of a chosen template or playbook
 *   - TemplateGallery— browse funnel templates / business playbooks
 *
 * These are leaves in the render tree: they own no state and read only shared
 * constants (imported directly) plus the props the component passes in. The
 * heavy lifting (finishWizard/finishConfigure — which seed the canvas,
 * definition and checklist) stays in the component and arrives here as
 * callbacks, so behaviour is identical to the inline version.
 */
import { useRef, type CSSProperties, type ReactNode } from "react";
import { ACCENT, barGhost, barPrimary, KIND_COLOR, KIND_ICON, money } from "../../lib/studio-ui";
import { useDialogA11y } from "../../lib/use-dialog-a11y";
import { TEMPLATES, TEMPLATE_CATEGORIES, PLAYBOOKS, type Template, type TemplateCategory, type Playbook } from "../../lib/studio/templates";

export type ConfigureQueue = { kind: "template"; item: Template } | { kind: "playbook"; item: Playbook };
export type ConfigureStep = { id: string; label: string; url: string };

const overlay = { position: "fixed", inset: 0, background: "rgba(2,6,23,.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 } as const;

/** Shared shell for the three creation modals: backdrop + centred panel with a
 *  focus trap, Escape-to-close, focus-return, and dialog semantics. Each modal
 *  is its own component that mounts on open, so the hook engages correctly. */
function ModalShell({ label, onClose, panelStyle, children }: { label: string; onClose: () => void; panelStyle: CSSProperties; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogA11y(ref, onClose);
  return (
    <div onClick={onClose} style={overlay}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()} style={panelStyle}>
        {children}
      </div>
    </div>
  );
}

export function SetupWizard({
  step, name, who, offer, playbookKey,
  setStep, setName, setWho, setOffer, setPlaybookKey,
  onClose, onFinish,
}: {
  step: number; name: string; who: string; offer: string; playbookKey: string | null;
  setStep: (fn: (s: number) => number) => void;
  setName: (v: string) => void; setWho: (v: string) => void; setOffer: (v: string) => void;
  setPlaybookKey: (v: string | null) => void;
  onClose: () => void; onFinish: () => void;
}) {
  return (
    <ModalShell label={`Guided setup, step ${step + 1} of 3`} onClose={onClose}
      panelStyle={{ width: "min(640px, 100%)", maxHeight: "86vh", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 18, boxShadow: "var(--shadow-panel)" }}>
        <div style={{ padding: "18px 22px 12px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>GUIDED SETUP · STEP {step + 1} OF 3</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {step === 0 ? "What's the business?" : step === 1 ? "Pick a starting playbook" : "Ready to build your plan"}
            </div>
          </div>
          <button onClick={onClose} style={barGhost}>Close</button>
        </div>
        <div style={{ padding: 22 }}>
          {step === 0 && (
            <>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>
                No business plan yet? Answer three questions and this builds the business definition, a starter canvas, and a 7 Systems starter kit together.
              </div>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Business name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What's this business called?"
                  style={{ width: "100%", boxSizing: "border-box", marginTop: 3, background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "7px 9px", fontSize: 13 }} />
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Who do you serve?</span>
                <textarea value={who} onChange={(e) => setWho(e.target.value)} placeholder="Who is the customer?"
                  style={{ width: "100%", boxSizing: "border-box", marginTop: 3, minHeight: 56, resize: "vertical", background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "7px 9px", fontSize: 13, fontFamily: "inherit" }} />
              </label>
              <label style={{ display: "block" }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>What do they buy?</span>
                <textarea value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="What's the main offer?"
                  style={{ width: "100%", boxSizing: "border-box", marginTop: 3, minHeight: 56, resize: "vertical", background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "7px 9px", fontSize: 13, fontFamily: "inherit" }} />
              </label>
            </>
          )}
          {step === 1 && (
            <>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>
                Pick whichever shape is closest — you can still edit every number and block afterward. Or skip and start from the plain golden funnel.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 10 }}>
                {PLAYBOOKS.map((pb) => (
                  <button key={pb.key} onClick={() => setPlaybookKey(pb.key)}
                    style={{ textAlign: "left", cursor: "pointer", padding: 12, borderRadius: 12,
                      background: playbookKey === pb.key ? "var(--accent-soft)" : "var(--surface2)",
                      border: `1px solid ${playbookKey === pb.key ? ACCENT : "var(--border2)"}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{pb.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>{pb.blurb}</div>
                  </button>
                ))}
              </div>
              <button onClick={() => setPlaybookKey(null)}
                style={{ ...barGhost, width: "100%", justifyContent: "center", display: "flex", background: playbookKey === null ? "var(--accent-soft)" : "transparent", color: playbookKey === null ? ACCENT : "var(--muted)", borderColor: playbookKey === null ? ACCENT : "var(--border2)" }}>
                Skip — start from the golden funnel
              </button>
            </>
          )}
          {step === 2 && (
            <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7 }}>
              <div style={{ marginBottom: 10 }}><strong>{name.trim() || "New business"}</strong></div>
              {who.trim() && <div style={{ marginBottom: 6 }}><span style={{ color: "var(--muted)" }}>Serves: </span>{who.trim()}</div>}
              {offer.trim() && <div style={{ marginBottom: 6 }}><span style={{ color: "var(--muted)" }}>Offers: </span>{offer.trim()}</div>}
              <div style={{ marginBottom: 6 }}><span style={{ color: "var(--muted)" }}>Starting map: </span>{playbookKey ? PLAYBOOKS.find((p) => p.key === playbookKey)?.name : "Golden funnel (generic 3-step)"}</div>
              <div style={{ marginBottom: 16 }}><span style={{ color: "var(--muted)" }}>7 Systems: </span>14 starter action items, ready to edit</div>
              <div style={{ fontSize: 12, color: "var(--dim)" }}>Freedom Plan keeps its default 10% Freedom Fund / 50-30-20 split — adjust it anytime from that tab.</div>
            </div>
          )}
        </div>
        <div style={{ padding: "12px 22px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} style={{ ...barGhost, opacity: step === 0 ? 0.4 : 1 }}>← Back</button>
          {step < 2
            ? <button onClick={() => setStep((s) => s + 1)} style={barPrimary}>Next →</button>
            : <button onClick={onFinish} style={barPrimary}>✦ Create my plan</button>}
        </div>
    </ModalShell>
  );
}

export function ConfigureSteps({
  queue, steps, setSteps, onClose, onFinish,
}: {
  queue: ConfigureQueue; steps: ConfigureStep[];
  setSteps: (fn: (cs: ConfigureStep[]) => ConfigureStep[]) => void;
  onClose: () => void; onFinish: () => void;
}) {
  return (
    <ModalShell label={`Configure blocks — ${queue.item.name}`} onClose={onClose}
      panelStyle={{ width: "min(560px, 100%)", maxHeight: "86vh", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 18, boxShadow: "var(--shadow-panel)" }}>
        <div style={{ padding: "18px 22px 12px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>CONFIGURE YOUR STEPS</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{queue.item.name}</div>
          </div>
          <button onClick={onClose} style={barGhost}>Close</button>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>
            Rename each block to match your real pages, and add a URL where you have one. Leave anything blank to keep the default — nothing here is required.
          </div>
          {steps.map((s, i) => (
            <div key={s.id} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--dim)", width: 18, flexShrink: 0 }}>{i + 1}</span>
              <input value={s.label} onChange={(e) => setSteps((cs) => cs.map((c) => (c.id === s.id ? { ...c, label: e.target.value } : c)))}
                placeholder="Block name"
                style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 8px", fontSize: 13 }} />
              <input value={s.url} onChange={(e) => setSteps((cs) => cs.map((c) => (c.id === s.id ? { ...c, url: e.target.value } : c)))}
                placeholder="https:// (optional)"
                style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: "6px 8px", fontSize: 13 }} />
            </div>
          ))}
        </div>
        <div style={{ padding: "12px 22px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onFinish} style={barGhost}>Skip — use defaults</button>
          <button onClick={onFinish} style={barPrimary}>Continue →</button>
        </div>
    </ModalShell>
  );
}

export function TemplateGallery({
  tab, setTab, cat, setCat, onClose, onStart,
}: {
  tab: "funnel" | "playbook"; setTab: (t: "funnel" | "playbook") => void;
  cat: TemplateCategory; setCat: (c: TemplateCategory) => void;
  onClose: () => void;
  onStart: (queue: ConfigureQueue, steps: ConfigureStep[]) => void;
}) {
  return (
    <ModalShell label={tab === "funnel" ? "Choose a funnel template" : "Choose a business playbook"} onClose={onClose}
      panelStyle={{ width: "min(960px, 100%)", maxHeight: "86vh", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 18, boxShadow: "var(--shadow-panel)" }}>
        <div style={{ padding: "18px 22px 12px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>{tab === "funnel" ? "START FROM A TEMPLATE" : "START FROM A PLAYBOOK"}</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{tab === "funnel" ? "Choose a funnel template" : "Choose a business playbook"}</div>
          </div>
          <button onClick={onClose} style={barGhost}>Close</button>
        </div>
        <div style={{ display: "flex", gap: 6, padding: "12px 22px 0" }}>
          <button onClick={() => setTab("funnel")}
            style={{ ...barGhost, background: tab === "funnel" ? "var(--accent-soft)" : "transparent", color: tab === "funnel" ? ACCENT : "var(--muted)", borderColor: tab === "funnel" ? ACCENT : "var(--border3)", fontWeight: 700 }}>◇ Funnel templates</button>
          <button onClick={() => setTab("playbook")}
            style={{ ...barGhost, background: tab === "playbook" ? "var(--accent-soft)" : "transparent", color: tab === "playbook" ? ACCENT : "var(--muted)", borderColor: tab === "playbook" ? ACCENT : "var(--border3)", fontWeight: 700 }}>◆ Business playbooks</button>
        </div>
        {tab === "funnel" ? (
          <>
            <div style={{ display: "flex", gap: 6, padding: "12px 22px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
              {TEMPLATE_CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCat(c)}
                  style={{ ...barGhost, background: cat === c ? "var(--accent-soft)" : "transparent", color: cat === c ? ACCENT : "var(--muted)", borderColor: cat === c ? ACCENT : "var(--border3)", fontWeight: c === "Golden Examples" ? 800 : undefined }}>{c === "Golden Examples" ? `✦ ${c}` : c}</button>
              ))}
            </div>
            <div style={{ padding: 22, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
              {TEMPLATES.filter((t) => t.category === cat).map((t) => {
                const offer = t.nodes.find((n) => n.kind === "offer");
                const price = offer?.extra?.price;
                return (
                  <button key={t.key} onClick={() => onStart({ kind: "template", item: t }, t.nodes.map((n) => ({ id: n.id, label: n.label, url: "" })))}
                    style={{ textAlign: "left", cursor: "pointer", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 14, padding: 16, transition: "border-color .15s, transform .15s, box-shadow .15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "var(--shadow-soft)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                    <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                      {t.nodes.map((n, i) => (
                        <span key={n.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 22, height: 22, borderRadius: 6, background: `${KIND_COLOR[n.kind] ?? "#64748b"}1e`, color: KIND_COLOR[n.kind] ?? "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>{KIND_ICON[n.kind] ?? "●"}</span>
                          {i < t.nodes.length - 1 && <span style={{ color: "var(--dim)", fontSize: 11 }}>→</span>}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>{t.blurb}</div>
                    {t.category === "Golden Examples" && (() => {
                      const offers = t.nodes.filter((n) => n.kind === "offer");
                      const first = offers[0]?.extra;
                      const isLoss = (first?.price ?? 0) > 0 && (first?.unitCost ?? 0) > 0 && (first!.price! < first!.unitCost!);
                      return (
                        <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
                          {isLoss && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--bad-text)", background: "var(--bad-bg)", borderRadius: 6, padding: "2px 7px" }}>Loss leader {money(first!.price!)}</span>}
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--good-border)", background: "var(--good-bg)", borderRadius: 6, padding: "2px 7px" }}>Profit on the back end ↑</span>
                        </div>
                      );
                    })()}
                    <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 8 }}>{t.nodes.length} blocks{price != null && price > 0 ? ` · offer ${money(price)}` : ""}</div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ padding: 22 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>
              A playbook seeds the canvas, the business definition, and a starter checklist together — pick one, then finish the workbook it starts for you.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
              {PLAYBOOKS.map((pb) => (
                <button key={pb.key} onClick={() => {
                  const tpl = TEMPLATES.find((t) => t.key === pb.templateKey);
                  onStart({ kind: "playbook", item: pb }, (tpl?.nodes ?? []).map((n) => ({ id: n.id, label: n.label, url: "" })));
                }}
                  style={{ textAlign: "left", cursor: "pointer", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 14, padding: 16, transition: "border-color .15s, transform .15s, box-shadow .15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "var(--shadow-soft)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{pb.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.4, marginBottom: 8 }}>{pb.blurb}</div>
                  <div style={{ fontSize: 11, color: "var(--dim)" }}>{pb.checklist.length} checklist items · business definition prefilled</div>
                </button>
              ))}
            </div>
          </div>
        )}
    </ModalShell>
  );
}
