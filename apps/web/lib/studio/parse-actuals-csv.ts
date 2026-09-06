/**
 * Parse a tracking/actuals CSV — the inverse of the studio's "Export CSV" — into
 * per-node actuals. Accepts the exported header
 *   node_id,node_label,visits,conversions,revenue_minor
 * with these tolerances: column order is free, node_label is optional and
 * ignored, extra columns are ignored, `revenue` is accepted as an alias for
 * `revenue_minor`, and blank lines are skipped. Pure and defensive so it can be
 * unit-tested and reject a bad file with a clear message rather than silently
 * corrupting a plan.
 */
export interface ActualRow {
  nodeId: string;
  visits?: number;
  conversions?: number;
  revenue?: number;
}
export interface ParsedActuals {
  rows: ActualRow[];
  /** Data lines skipped because they had no node id. */
  skipped: number;
}

/** Minimal RFC-4180 CSV reader: quoted fields, escaped `""`, CRLF or LF. */
function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let sawAny = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true; sawAny = true;
    } else if (c === ",") {
      row.push(field); field = ""; sawAny = true;
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = ""; sawAny = false;
    } else if (c === "\r") {
      // handled by the following \n
    } else {
      field += c; sawAny = true;
    }
  }
  if (sawAny || field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function toNumber(raw: string | undefined): number | undefined {
  if (raw == null) return undefined;
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number(t.replace(/,/g, "")); // tolerate thousands separators
  return Number.isFinite(n) ? n : undefined;
}

export function parseActualsCsv(text: string): ParsedActuals {
  const table = readCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (table.length === 0) throw new Error("That file is empty.");

  const header = table[0]!.map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => {
    for (const n of names) { const i = header.indexOf(n); if (i !== -1) return i; }
    return -1;
  };
  const iId = col("node_id", "node id", "id");
  const iVisits = col("visits", "visit");
  const iConv = col("conversions", "conversion", "conversions_count");
  const iRev = col("revenue_minor", "revenue", "revenue_cents");
  if (iId === -1) throw new Error('The CSV needs a "node_id" column. Re-export from the tracking panel to get the right format.');
  if (iVisits === -1 && iConv === -1 && iRev === -1) {
    throw new Error("The CSV has no visits, conversions or revenue columns to import.");
  }

  const rows: ActualRow[] = [];
  let skipped = 0;
  for (let r = 1; r < table.length; r++) {
    const cells = table[r]!;
    const nodeId = (cells[iId] ?? "").trim();
    if (!nodeId) { skipped++; continue; }
    const row: ActualRow = { nodeId };
    const v = iVisits === -1 ? undefined : toNumber(cells[iVisits]);
    const c = iConv === -1 ? undefined : toNumber(cells[iConv]);
    const rev = iRev === -1 ? undefined : toNumber(cells[iRev]);
    if (v !== undefined) row.visits = Math.max(0, Math.round(v));
    if (c !== undefined) row.conversions = Math.max(0, Math.round(c));
    if (rev !== undefined) row.revenue = Math.max(0, Math.round(rev));
    rows.push(row);
  }
  if (rows.length === 0) throw new Error("No rows with a node id were found in that CSV.");
  return { rows, skipped };
}
