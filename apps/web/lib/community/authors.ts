/**
 * A community author's public profile — everything one workspace has shared,
 * so a "by <name>" credit becomes a doorway to their work. Aggregates their
 * shared funnel templates and swipe-file creatives plus headline totals
 * (artifact count and how many times their work has been pulled in). Read-only
 * and public within the app; exposes no leads, email, or PII — only the
 * display name and the artifacts they chose to publish.
 */
import { resolveDisplayName } from "./profile";
import { listTemplatesByAuthor, type SharedTemplate } from "../studio/shared-templates";
import { listCreativesByAuthor, type SharedCreative } from "../campaign/shared-creatives";

export interface AuthorProfile {
  workspaceId: string;
  displayName: string;
  templates: SharedTemplate[];
  creatives: SharedCreative[];
  totalShared: number;
  totalUses: number;
}

export async function getAuthorProfile(workspaceId: string): Promise<AuthorProfile> {
  const [displayName, templates, creatives] = await Promise.all([
    resolveDisplayName(workspaceId),
    listTemplatesByAuthor(workspaceId),
    listCreativesByAuthor(workspaceId),
  ]);
  const totalUses = templates.reduce((n, t) => n + t.uses, 0) + creatives.reduce((n, c) => n + c.uses, 0);
  return { workspaceId, displayName, templates, creatives, totalShared: templates.length + creatives.length, totalUses };
}
