"use client";
/**
 * Two simple content "glass panels" lifted out of funnel-studio.tsx — the
 * project Comments thread (collaboration) and the free-text Notes panel
 * (context). Both are presentational: they render the value the component owns
 * and write back through the callbacks passed in, so behaviour is identical.
 */
import { ACCENT, barGhost, barPrimary } from "../../lib/studio-ui";
import { GlassDrawer } from "./GlassDrawer";

export interface ProjectComment { id: string; userId: string; email: string; text: string; createdAt: string }

export function CommentsPanel({
  comments, draft, setDraft, postComment, removeComment, canEdit, userId, onClose,
}: {
  comments: ProjectComment[]; draft: string; setDraft: (v: string) => void;
  postComment: () => void; removeComment: (id: string) => void;
  canEdit: boolean; userId: string; onClose: () => void;
}) {
  return (
    <GlassDrawer width={400} label="Project comments" onClose={onClose}>
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>COLLABORATION</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Project comments</div>
          </div>
          <button onClick={onClose} style={barGhost} aria-label="Close panel">{"✕"}</button>
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Editors can comment and mention teammates. Viewers can read the discussion.</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 12, minHeight: 120 }}>
        {comments.length === 0 && <div style={{ textAlign: "center", color: "var(--dim)", fontSize: 13, padding: 24 }}>No comments yet.</div>}
        {comments.map((c) => (
          <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", marginBottom: 6, background: "var(--surface2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontSize: 11, fontWeight: 700 }}>{c.email}</span>
              <span style={{ fontSize: 11, color: "var(--dim)" }}>{new Date(c.createdAt).toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 13, marginTop: 4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {c.text.split(/(@[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g).map((part, i) =>
                part.startsWith("@") ? <span key={i} style={{ color: ACCENT, fontWeight: 500 }}>{part}</span> : <span key={i}>{part}</span>)}
            </div>
            {c.userId === userId && (
              <button onClick={() => removeComment(c.id)} style={{ ...barGhost, marginTop: 5, fontSize: 11, padding: "2px 6px", color: "#e11d48", borderColor: "transparent" }}>Delete</button>
            )}
          </div>
        ))}
      </div>
      {canEdit ? (
        <div style={{ borderTop: "1px solid var(--border)", padding: 10 }}>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); postComment(); } }}
            placeholder="Add a comment — @teammate@email.com to mention"
            style={{ width: "100%", boxSizing: "border-box", height: 64, background: "var(--surface2)", border: "1px solid var(--border3)", borderRadius: 8, color: "var(--text)", padding: 8, fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "var(--dim)" }}>Ctrl+Enter to post</span>
            <button onClick={() => postComment()} disabled={!draft.trim()} style={{ ...barPrimary, opacity: draft.trim() ? 1 : 0.5 }}>Comment</button>
          </div>
        </div>
      ) : (
        <div style={{ borderTop: "1px solid var(--border)", padding: 10, fontSize: 11, color: "var(--dim)" }}>Viewers can read but not comment.</div>
      )}
    </GlassDrawer>
  );
}

export function NotesPanel({ notes, setNotes, onClose }: { notes: string; setNotes: (v: string) => void; onClose: () => void }) {
  return (
    <GlassDrawer width={420} label="Notes" onClose={onClose}>
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>CONTEXT</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Notes</div>
        </div>
        <button onClick={onClose} style={barGhost}>Close</button>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 8 }}>Strategy, objective, assumptions, decision log — anything worth remembering about why this model looks the way it does.</div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What's the strategy here? Why these assumptions?"
          style={{ width: "100%", minHeight: 260, boxSizing: "border-box", resize: "vertical", background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 8, padding: "9px 11px", fontSize: 13, lineHeight: 1.5, fontFamily: "inherit" }} />
      </div>
    </GlassDrawer>
  );
}
