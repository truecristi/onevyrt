/**
 * IconSystemShowcase — examples of the icon system in action.
 *
 * This component demonstrates all icon categories and their usage patterns.
 * Not meant for production; useful for visual testing and documentation.
 *
 * View at: /studio/icon-showcase (when wired into routing)
 */
import { ChapterIcon, ChapterBadge, StatusIcon, StatusBadge, ActionIcon, ActionButton } from "./index";
import { CHAPTER_ICONS, STATUS_ICONS, ACTION_ICONS, PSYCHOLOGICAL_STATE_COLORS, COACHING_STATUS_COLORS } from "@/lib/icons/icon-registry";

export function IconSystemShowcase() {
  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>ONEVYRT Icon System Showcase</h1>
      <p>Complete reference for all icon categories and their usage patterns.</p>

      {/* Chapter Icons */}
      <section style={{ marginTop: "40px" }}>
        <h2>Chapter Icons</h2>
        <p>Semantic visual identifiers for programme stages, with psychological state colors.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "20px", marginTop: "20px" }}>
          {(["define", "implement", "control", "improve", "finish"] as const).map((chapter) => (
            <div key={chapter} style={{ textAlign: "center", padding: "15px", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px" }}>
                <ChapterIcon chapter={chapter} size="lg" withBackground />
              </div>
              <div style={{ fontSize: "12px", fontWeight: 600 }}>{CHAPTER_ICONS[chapter].label}</div>
              <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
                {CHAPTER_ICONS[chapter].description}
              </div>
              <div
                style={{
                  fontSize: "10px",
                  marginTop: "8px",
                  padding: "4px 8px",
                  backgroundColor: PSYCHOLOGICAL_STATE_COLORS[
                    (
                      {
                        define: "clarity",
                        implement: "confidence",
                        control: "control",
                        improve: "momentum",
                        finish: "freedom",
                      } as const
                    )[chapter]
                  ].bgColor,
                }}
              >
                State: {
                  (
                    {
                      define: "clarity",
                      implement: "confidence",
                      control: "control",
                      improve: "momentum",
                      finish: "freedom",
                    } as const
                  )[chapter]
                }
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "30px" }}>
          <h3>With Badges</h3>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            {(["define", "implement", "control", "improve", "finish"] as const).map((chapter) => (
              <ChapterBadge key={chapter} chapter={chapter} size="sm" />
            ))}
          </div>
        </div>
      </section>

      {/* Status Icons */}
      <section style={{ marginTop: "40px" }}>
        <h2>Status Icons</h2>
        <p>Progress and state indicators for lessons, chapters, and submissions.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "15px", marginTop: "20px" }}>
          {(["locked", "available", "inProgress", "completed", "awaitingReview", "approved", "rejected", "skipped"] as const).map((status) => (
            <div key={status} style={{ padding: "12px", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <StatusIcon status={status} size="md" />
                <span style={{ fontSize: "12px", fontWeight: 600 }}>{status}</span>
              </div>
              <div style={{ fontSize: "11px", color: "#666" }}>{STATUS_ICONS[status]}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "30px" }}>
          <h3>With Badges</h3>
          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
            {(["locked", "available", "completed", "awaitingReview", "approved"] as const).map((status) => (
              <StatusBadge key={status} status={status} size="sm" inline />
            ))}
          </div>
        </div>
      </section>

      {/* Action Icons */}
      <section style={{ marginTop: "40px" }}>
        <h2>Action Icons</h2>
        <p>UI control icons for common operations (add, edit, delete, etc.).</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "15px", marginTop: "20px" }}>
          {(["add", "edit", "delete", "download", "share", "print", "save", "close", "back", "forward", "search", "filter"] as const).map((action) => (
            <div key={action} style={{ textAlign: "center", padding: "12px", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
                <ActionIcon action={action} size="md" />
              </div>
              <div style={{ fontSize: "11px" }}>{action}</div>
              <div style={{ fontSize: "11px", color: "#666" }}>{ACTION_ICONS[action]}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "30px" }}>
          <h3>Action Buttons</h3>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <ActionButton action="add" onClick={() => console.log("add")} />
            <ActionButton action="edit" onClick={() => console.log("edit")} />
            <ActionButton action="delete" onClick={() => console.log("delete")} />
            <ActionButton action="download" onClick={() => console.log("download")} />
            <ActionButton action="share" onClick={() => console.log("share")} />
          </div>
        </div>
      </section>

      {/* Icon Sizes */}
      <section style={{ marginTop: "40px" }}>
        <h2>Icon Sizes</h2>
        <p>All icons scale through xs/sm/md/lg size system.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px", marginTop: "20px" }}>
          {(["xs", "sm", "md", "lg"] as const).map((size) => (
            <div key={size} style={{ textAlign: "center" }}>
              <div style={{ marginBottom: "10px", fontSize: "12px", fontWeight: 600 }}>{size}</div>
              <ChapterIcon chapter="define" size={size} withBackground />
              <div style={{ fontSize: "10px", marginTop: "8px", color: "#666" }}>define chapter</div>
            </div>
          ))}
        </div>
      </section>

      {/* Psychological States */}
      <section style={{ marginTop: "40px" }}>
        <h2>Psychological States & Colors</h2>
        <p>Chapter progression through learner's psychological journey.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "15px", marginTop: "20px" }}>
          {Object.entries(PSYCHOLOGICAL_STATE_COLORS).map(([state, config]) => (
            <div
              key={state}
              style={{
                padding: "15px",
                backgroundColor: config.bgColor,
                color: config.color,
                borderRadius: "8px",
                border: `2px solid ${config.color}`,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>{config.label}</div>
              <div style={{ fontSize: "11px", opacity: 0.8 }}>State: {state}</div>
              <div style={{ fontSize: "10px", marginTop: "4px", fontFamily: "monospace" }}>{config.color}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Coaching Status Colors */}
      <section style={{ marginTop: "40px" }}>
        <h2>Coaching Status Colors</h2>
        <p>Approval workflow status indicators and their meanings.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "15px", marginTop: "20px" }}>
          {Object.entries(COACHING_STATUS_COLORS).map(([status, config]) => (
            <div
              key={status}
              style={{
                padding: "15px",
                backgroundColor: config.bgColor,
                color: config.color,
                borderRadius: "8px",
                border: `2px solid ${config.color}`,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>{config.label}</div>
              <div style={{ fontSize: "11px", opacity: 0.8 }}>Status: {status}</div>
              <div style={{ fontSize: "10px", marginTop: "4px", fontFamily: "monospace" }}>{config.color}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Integration Example */}
      <section style={{ marginTop: "40px" }}>
        <h2>Integration Example: Chapter Progress Card</h2>
        <p>Common pattern combining chapter icon, status, and actions.</p>

        <div style={{ maxWidth: "500px", marginTop: "20px", padding: "20px", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
          <div style={{ display: "flex", gap: "15px", alignItems: "start" }}>
            <ChapterIcon chapter="implement" size="lg" withBackground />
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: "0 0 4px 0" }}>Chapter 2: Implement</h3>
              <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#666" }}>
                Turn your strategy into a working business system.
              </p>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <StatusIcon status="inProgress" size="sm" />
                <span style={{ fontSize: "12px", color: "#666" }}>In Progress</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "4px" }}>
              <ActionButton action="download" />
              <ActionButton action="share" />
            </div>
          </div>
        </div>
      </section>

      <footer style={{ marginTop: "60px", paddingTop: "20px", borderTop: "1px solid #e5e7eb", color: "#666", fontSize: "12px" }}>
        <p>
          See <code>docs/ICON-SYSTEM.md</code> for complete documentation and usage patterns.
        </p>
      </footer>
    </div>
  );
}
