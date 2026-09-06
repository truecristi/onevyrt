/**
 * Composes the printable one-page funnel brief — a self-contained HTML string
 * the studio opens in a new window and prints (or "saves as PDF"). Pure and
 * dependency-free: it takes a plain data snapshot and returns escaped HTML, so
 * it's unit-testable and can't inject unescaped funnel text into the page.
 */
export interface BriefBlock {
  label: string;
  kind: string;
  metric: string; // already-formatted, e.g. "35% pass" or "$97"
  auditScore?: number;
}
export interface BriefFix {
  rank: number;
  tag: string;
  title: string;
  detail: string;
}
export interface BriefData {
  funnelName: string;
  generatedOn: string; // caller passes the date string (keeps this pure)
  revenue: string; // formatted
  profit: string; // formatted
  profitLabel: string; // "Plan profit" | "Actual profit"
  blocks: BriefBlock[];
  fixes: BriefFix[];
}

export function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildBriefHtml(d: BriefData): string {
  const blockRows = d.blocks.length
    ? d.blocks.map((b) => `<tr><td>${esc(b.label)}</td><td class="k">${esc(b.kind)}</td><td>${esc(b.metric)}</td><td>${b.auditScore != null ? `${Math.round(b.auditScore)}/100` : "—"}</td></tr>`).join("")
    : `<tr><td colspan="4" class="empty">No blocks yet.</td></tr>`;
  const fixList = d.fixes.length
    ? d.fixes.map((f) => `<li><b>${esc(f.title)}</b> <span class="tag">${esc(f.tag)}</span><br><span class="detail">${esc(f.detail)}</span></li>`).join("")
    : `<li class="empty">Nothing urgent to fix right now.</li>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.funnelName)} — funnel brief</title>
<style>
  * { box-sizing: border-box; }
  body { font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; margin: 32px; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  .sub { color: #666; font-size: 12px; margin-bottom: 20px; }
  .kpis { display: flex; gap: 28px; margin-bottom: 22px; }
  .kpi .n { font-size: 24px; font-weight:700; }
  .kpi .l { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: .04em; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: #444; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 22px 0 10px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 12.5px; }
  th { color: #666; font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; }
  td.k { color: #888; text-transform: capitalize; }
  .empty { color: #999; font-style: italic; }
  ol { padding-left: 18px; }
  li { margin-bottom: 8px; }
  .tag { font-size: 10px; text-transform: uppercase; letter-spacing: .03em; color: #b45309; background: #fef3c7; padding: 1px 6px; border-radius: 5px; }
  .detail { color: #555; font-size: 12px; }
  @media print { body { margin: 0; } }
</style></head><body>
  <h1>${esc(d.funnelName)}</h1>
  <div class="sub">Funnel brief · generated ${esc(d.generatedOn)}</div>
  <div class="kpis">
    <div class="kpi"><div class="n">${esc(d.revenue)}</div><div class="l">Revenue</div></div>
    <div class="kpi"><div class="n">${esc(d.profit)}</div><div class="l">${esc(d.profitLabel)}</div></div>
  </div>
  <h2>Funnel blocks</h2>
  <table><thead><tr><th>Block</th><th>Type</th><th>Metric</th><th>Audit</th></tr></thead><tbody>${blockRows}</tbody></table>
  <h2>Fix first</h2>
  <ol>${fixList}</ol>
</body></html>`;
}
