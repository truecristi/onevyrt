/**
 * Project-comments slice of the Studio — the comment thread on the current
 * funnel/project behind the Comments panel. Extracted from funnel-studio.tsx
 * as a self-contained hook: it needs the current project id, the
 * active-workspace query, and whether the panel is open (to lazily refresh on
 * open), and owns the thread state + post/remove handlers. Third increment of
 * the funnel-studio decomposition; same hook-per-slice pattern.
 *
 * `projectId` must be the stable server row id (funnel-studio.tsx's
 * `projectId` state) — NOT the display name. A project's name can change
 * (rename); its id never does, which is exactly why the thread has to be
 * keyed on the id.
 */
import { useCallback, useEffect, useState } from "react";

export interface ProjectComment { id: string; userId: string; email: string; text: string; createdAt: string }

export function useProjectComments(projectId: string, wsQuery: string, commentsOpen: boolean) {
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");

  const commentsUrl = useCallback((pid: string) => `/api/projects/${encodeURIComponent(pid)}/comments${wsQuery}`, [wsQuery]);
  const refreshComments = useCallback(async () => {
    const pid = projectId; if (!pid) return;
    try {
      const r = await fetch(commentsUrl(pid));
      if (r.ok) { const d = await r.json() as { comments: ProjectComment[] }; setComments(d.comments); }
    } catch { /* server optional */ }
  }, [projectId, commentsUrl]);
  const postComment = useCallback(async () => {
    const pid = projectId; const text = commentDraft.trim();
    if (!pid || !text) return;
    try {
      const r = await fetch(commentsUrl(pid), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      if (r.ok) { setCommentDraft(""); await refreshComments(); }
    } catch { /* ignore */ }
  }, [projectId, commentDraft, commentsUrl, refreshComments]);
  const removeComment = useCallback(async (cid: string) => {
    const pid = projectId; if (!pid) return;
    try { await fetch(`${commentsUrl(pid)}${wsQuery ? "&" : "?"}comment=${encodeURIComponent(cid)}`, { method: "DELETE" }); await refreshComments(); } catch { /* ignore */ }
  }, [projectId, commentsUrl, wsQuery, refreshComments]);
  useEffect(() => { if (commentsOpen) void refreshComments(); }, [commentsOpen, refreshComments]);

  return { comments, commentDraft, setCommentDraft, postComment, removeComment };
}
