import { requireAdmin } from "../../../../../../lib/admin";
import { loadProject } from "../../../../../../lib/store";
import { deserializeDoc, PersistError } from "@onevyrt/engine";
import { withRouteLogging } from "../../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

// Read-only structural summary — never the full doc verbatim, and never run
// through the simulator (that's client-side conversion logic this route
// deliberately doesn't duplicate). Enough for an admin to see what's actually
// in a project without needing workspace membership, which normal project
// routes require.
export const GET = withRouteLogging("api/admin/projects/[wsId]/[id]:GET", async (req: Request, ctx: { params: Promise<{ wsId: string; id: string }> }): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  const { wsId, id } = await ctx.params;

  const stored = await loadProject(wsId, id);
  if (!stored) return json({ error: "project not found" }, 404);

  try {
    const doc = deserializeDoc(stored.doc);
    return json({
      name: doc.name,
      currency: doc.currency ?? "USD",
      archived: doc.archived === true,
      updatedAt: stored.updatedAt,
      nodes: doc.nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.label })),
      edgeCount: doc.edges.length,
      hasDefinition: Object.values(doc.program?.definition ?? {}).some((v) => typeof v === "string" && v.trim().length > 0),
      hasNotes: !!doc.notes?.trim(),
      checklist: doc.checklist ? { total: doc.checklist.length, done: doc.checklist.filter((c) => c.done).length } : null,
      riskCount: doc.riskRegister?.length ?? 0,
    });
  } catch (e) {
    return json({ error: e instanceof PersistError ? e.message : "Could not read this project's document." }, 400);
  }
});
