/**
 * Admin moderation for community-shared content. Every regular community
 * endpoint only lets the original author remove their own post (see
 * lib/community/comments.ts, lib/campaign/shared-creatives.ts,
 * lib/studio/shared-templates.ts) — there was no way for anyone else to take
 * down a comment, creative, or template, however abusive. DELETE ?type=&id=
 * removes one, bypassing the author check, and audits the removal.
 */
import { requireAdmin } from "../../../../lib/admin";
import { recordAudit } from "../../../../lib/audit-log";
import { adminDeleteComment } from "../../../../lib/community/comments";
import { adminUnpublishCreative } from "../../../../lib/campaign/shared-creatives";
import { adminUnpublishTemplate } from "../../../../lib/studio/shared-templates";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const DELETE = withRouteLogging("api/admin/community:DELETE", async (req: Request): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  const sp = new URL(req.url).searchParams;
  const type = sp.get("type");
  const id = sp.get("id") || "";
  if (!id) return json({ error: "id is required" }, 400);

  switch (type) {
    case "comment": {
      const deleted = await adminDeleteComment(id);
      if (deleted) {
        await recordAudit({
          actorEmail: admin.email, action: "community.delete_comment", targetType: "community_comment", targetLabel: id,
          detail: `authored by workspace ${deleted.authorWorkspaceId} on ${deleted.artifactType} ${deleted.artifactId}: "${deleted.body.slice(0, 120)}"`,
        });
      }
      return json({ ok: !!deleted });
    }
    case "creative": {
      const deleted = await adminUnpublishCreative(id);
      if (deleted) {
        await recordAudit({
          actorEmail: admin.email, action: "community.unpublish_creative", targetType: "shared_creative", targetLabel: deleted.headline,
          detail: `authored by workspace ${deleted.authorWorkspaceId}`,
        });
      }
      return json({ ok: !!deleted });
    }
    case "template": {
      const deleted = await adminUnpublishTemplate(id);
      if (deleted) {
        await recordAudit({
          actorEmail: admin.email, action: "community.unpublish_template", targetType: "shared_template", targetLabel: deleted.name,
          detail: `authored by workspace ${deleted.authorWorkspaceId}`,
        });
      }
      return json({ ok: !!deleted });
    }
    default:
      return json({ error: "type must be 'comment', 'creative', or 'template'" }, 400);
  }
});
