"use client";
/**
 * A community author's public profile — everything one owner has shared, reached
 * by tapping "by <name>" on any artifact. Shows their display name, headline
 * totals, and their shared funnel templates + swipe-file creatives with the same
 * copy/use actions as the hub. Read-only; the copy action bumps the use counter.
 */
import { Notice } from "../../../../components/ui/Notice";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { SkeletonCards } from "../../../../components/Skeleton";
import { copyText } from "../../../../lib/clipboard";

interface Template { id: string; name: string; description: string | null; category: string | null; uses: number; }
interface Creative { id: string; headline: string; primaryText: string | null; cta: string | null; angle: string | null; score: number; uses: number; }
interface Profile { workspaceId: string; displayName: string; templates: Template[]; creatives: Creative[]; totalShared: number; totalUses: number; isMe: boolean; }

export default function AuthorProfilePage() {
  const params = useParams<{ wsId: string }>();
  const wsId = params?.wsId ?? "";
  const [state, setState] = useState<"loading" | "ok" | "not-authenticated" | "error">("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/community/authors/${encodeURIComponent(wsId)}`, { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (!r.ok) { setState("error"); return; }
      const d = await r.json(); setProfile(d.profile); setState("ok");
    } catch { setState("error"); }
  }, [wsId]);
  useEffect(() => { if (wsId) void load(); }, [wsId, load]);

  const copyAd = useCallback((c: Creative) => {
    const text = [c.headline, c.primaryText, c.cta ? `CTA: ${c.cta}` : ""].filter(Boolean).join("\n\n");
    void copyText(text).then((ok) => {
      if (!ok) return;
      setCopied(c.id); window.setTimeout(() => setCopied(""), 1500);
      void fetch(`/api/community/creatives?id=${encodeURIComponent(c.id)}`, { method: "PATCH", credentials: "include" }).catch(() => {});
      setProfile((p) => p ? { ...p, creatives: p.creatives.map((x) => x.id === c.id ? { ...x, uses: x.uses + 1 } : x) } : p);
    });
  }, []);

  if (state === "loading") return <Shell><SkeletonCards count={4} /></Shell>;
  if (state === "not-authenticated") return <Shell><Notice icon="🔑" title="Please sign in" href="/" cta="Go to sign in" /></Shell>;
  if (state === "error" || !profile) return <Shell><Notice icon="⚠️" title="Couldn&rsquo;t load this profile" onRetry={() => void load()} /></Shell>;

  const initial = (profile.displayName || "?").charAt(0).toUpperCase();
  return (
    <Shell>
      <a href="/community" className="back">← Community</a>
      <div className="pro-head">
        <div className="avatar">{initial}</div>
        <div className="pro-id">
          <h1>{profile.displayName}{profile.isMe && <span className="me-tag">you</span>}</h1>
          <div className="pro-stats">
            <span><b>{profile.totalShared}</b> shared</span>
            <span><b>{profile.totalUses}</b> total use{profile.totalUses === 1 ? "" : "s"}</span>
          </div>
        </div>
      </div>

      {profile.totalShared === 0 && <div className="empty big">This owner hasn&rsquo;t shared anything yet.</div>}

      {profile.templates.length > 0 && (
        <section className="sec">
          <div className="sec-head"><h2>🛠️ Funnel templates <span className="count">{profile.templates.length}</span></h2></div>
          <div className="grid">
            {profile.templates.map((t) => (
              <div className="tile" key={t.id}>
                <div className="tile-meta">{t.category || "Funnel"} · {t.uses} use{t.uses === 1 ? "" : "s"}</div>
                <div className="tile-name">{t.name}</div>
                {t.description && <div className="tile-desc">{t.description}</div>}
                <a className="btn sm primary" href={`/business/funnels?template=${encodeURIComponent(t.id)}`}>Use template →</a>
              </div>
            ))}
          </div>
        </section>
      )}

      {profile.creatives.length > 0 && (
        <section className="sec">
          <div className="sec-head"><h2>✨ Ad swipe file <span className="count">{profile.creatives.length}</span></h2></div>
          <div className="grid">
            {profile.creatives.map((c) => (
              <div className="tile" key={c.id}>
                <div className="tile-meta">{c.angle || "Ad"} · score {c.score} · {c.uses} copie{c.uses === 1 ? "" : "s"}</div>
                <div className="tile-name">{c.headline}</div>
                {c.primaryText && <div className="tile-desc clamp">{c.primaryText}</div>}
                {c.cta && <div className="tile-cta">CTA: <b>{c.cta}</b></div>}
                <button className="btn sm" onClick={() => copyAd(c)}>{copied === c.id ? "Copied ✓" : "Copy ad"}</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) { return <div className="cm-root"><style>{CSS}</style>{children}</div>; }

const CSS = `
.cm-root{
  --surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--tertiary:var(--ds-text-tertiary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:900px;margin:0 auto;padding:22px 18px 120px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);border-radius:16px;}
.cm-root *{box-sizing:border-box;}
.back{display:inline-block;color:var(--muted);text-decoration:none;font-size:13px;font-weight:500;margin-bottom:16px;}
.back:hover{color:var(--ds-brand);}
.pro-head{display:flex;align-items:center;gap:16px;margin-bottom:22px;}
.avatar{width:60px;height:60px;border-radius:50%;background:var(--ds-brand-soft);color:var(--ds-brand);display:grid;place-items:center;font-size:26px;font-weight:700;flex:none;}
.pro-id h1{font-size:24px;font-weight:700;margin:0;letter-spacing:-.4px;display:flex;align-items:center;gap:9px;}
.me-tag{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--ds-brand);background:var(--ds-brand-soft);border-radius:99px;padding:2px 9px;}
.pro-stats{display:flex;gap:16px;margin-top:6px;font-size:13px;color:var(--muted);}
.pro-stats b{color:var(--text);font-size:15px;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:10px;padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;}
.btn:hover{border-color:var(--ds-border-strong);background:var(--ds-surface-subtle);}
.btn.primary{background:var(--ds-brand);border-color:var(--ds-brand);color:#fff;}
.btn.primary:hover{background:var(--ds-brand-hover);border-color:var(--ds-brand-hover);}
.btn.sm{padding:6px 11px;font-size:12px;border-radius:8px;align-self:flex-start;margin-top:auto;}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;box-shadow:var(--ds-shadow-xs);}
.panel.center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:160px;text-align:center;color:var(--muted);}
.panel.notice{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:44px 22px;}
.panel.notice h2{margin:4px 0 0;font-size:19px;}
.lock{font-size:34px;}
.spinner{width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--ds-brand);border-radius:50%;animation:spin .8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.empty{background:var(--surface);border:1px dashed var(--border-strong);border-radius:12px;padding:20px 16px;text-align:center;color:var(--tertiary);font-size:13px;}
.empty.big{padding:40px 20px;font-size:14px;}
.sec{margin-bottom:26px;}
.sec-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;}
.sec-head h2{font-size:16px;font-weight:700;margin:0;display:flex;align-items:center;gap:8px;}
.count{font-size:11px;font-weight:700;color:var(--tertiary);background:var(--ds-bg-subtle);border:1px solid var(--border);border-radius:99px;padding:1px 8px;}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;}
.tile{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;box-shadow:var(--ds-shadow-xs);display:flex;flex-direction:column;gap:6px;min-height:120px;transition:border-color .12s,box-shadow .12s;}
.tile:hover{border-color:var(--border-strong);box-shadow:var(--ds-shadow-sm);}
.tile-meta{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--tertiary);}
.tile-name{font-size:15px;font-weight:700;letter-spacing:-.2px;line-height:1.3;}
.tile-desc{font-size:12.5px;color:var(--muted);line-height:1.5;}
.tile-desc.clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
.tile-cta{font-size:12px;color:var(--muted);}.tile-cta b{color:var(--text);}
`;
