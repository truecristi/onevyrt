/**
 * Leads CSV export. Streams the workspace's leads as a CSV download so the
 * owner can pull them into a CRM or spreadsheet. Scoped to the viewer's
 * workspace (same as the inbox) — never cross-tenant.
 */
import { currentUser } from "../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, listWorkspaceMemberSummaries } from "../../../../../lib/workspaces";
import { listWorkspaceLeads } from "../../../../../lib/acquisition/leads";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/**
 * RFC-4180-ish quoting plus CSV-injection neutralization.
 *
 * Lead name/UTM fields come straight from the public lead form, so a crafted
 * value beginning with =, +, -, @ (or a leading tab / carriage return, which
 * some spreadsheets strip before re-evaluating the cell) can execute a formula
 * when the owner opens the export in Excel/Google Sheets. Prefix any such cell
 * with a single quote so the spreadsheet treats it as literal text, then apply
 * the usual quoting for embedded commas/quotes/newlines.
 */
function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function adSource(a: Record<string, unknown> | null): string {
  if (!a) return "";
  return (a.utmSource as string) || (a.source as string) || (a.campaignId ? String(a.campaignId) : "") || (a.fbclid ? "meta" : "");
}

export const GET = withRouteLogging("api/business/leads/export:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  const [leads, members] = await Promise.all([listWorkspaceLeads(wsId, 5000), listWorkspaceMemberSummaries(wsId)]);
  const emailById = new Map(members.map((m) => [m.userId, m.email]));
  const headers = ["created_at", "funnel", "status", "stage", "assignee", "next_action", "due_at", "score", "verified", "name", "email", "phone", "route", "source"];
  const rows = leads.map((l) => [
    l.createdAt, l.funnelSlug, l.status, l.lifecycle,
    l.assigneeId ? (emailById.get(l.assigneeId) ?? l.assigneeId) : "", l.nextAction ?? "", l.dueAt ?? "",
    l.score, l.verified ? "yes" : "no",
    l.name ?? "", l.email ?? "", l.phone ?? "", l.route ?? "",
    adSource(l.attribution as Record<string, unknown> | null),
  ].map(csvCell).join(","));
  const csv = [headers.join(","), ...rows].join("\r\n") + "\r\n";

  const today = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="onevyrt-leads-${today}.csv"`,
    },
  });
});
