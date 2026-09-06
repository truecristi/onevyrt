"use client";
/**
 * /coaching/submissions/pending — every submission awaiting this coach's
 * review, across every workspace they coach (GET
 * /api/coaching/submissions/list), regardless of chapter. Filterable by
 * chapter; chapter-4 items link into this lane's own review page and support
 * a bulk "Approve selected" action, since that is the one decision endpoint
 * this lane owns (POST /api/coaching/chapter/4/review). Chapters 1-3 items
 * still show up (so this is a genuine single inbox, not a chapter-4-only
 * view) but link into the existing generic coach-review UI instead, and are
 * left out of the bulk action — approving someone's Business Psychology
 * Blueprint sight-unseen isn't a decision this page should make easy.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageShell } from "../../../../components/ui/PageShell";
import { Card, Badge } from "../../../../components/ui/Card";
import { Notice } from "../../../../components/ui/Notice";
import { confirmDialog } from "../../../../components/Modal";

interface PendingItem {
  submissionId: string;
  workspaceId: string;
  workspaceName: string;
  learnerEmail: string | null;
  chapter: string;
  chapterTitle: string;
  submittedAt: string;
  daysPending: number;
  reviewHref: string;
}
interface ListResponse { items: PendingItem[]; page: number; pageSize: number; total: number; totalPages: number; }

type ViewState = "loading" | "ok" | "not-authenticated" | "error";

const CHAPTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All chapters" },
  { value: "chapter-1", label: "Chapter 1" },
  { value: "chapter-2", label: "Chapter 2" },
  { value: "chapter-3", label: "Chapter 3" },
  { value: "chapter-4", label: "Chapter 4" },
];

function daysLabel(n: number): string {
  if (n <= 0) return "today";
  if (n === 1) return "1 day";
  return `${n} days`;
}

export default function PendingSubmissionsPage() {
  const [state, setState] = useState<ViewState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [data, setData] = useState<ListResponse | null>(null);
  const [chapter, setChapter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");

  const load = useCallback(async () => {
    setState("loading"); setErrorMsg("");
    try {
      const qs = new URLSearchParams({ page: String(page) });
      if (chapter) qs.set("chapter", chapter);
      const r = await fetch(`/api/coaching/submissions/list?${qs.toString()}`, { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      const d = (await r.json()) as ListResponse & { error?: string };
      if (!r.ok) { setErrorMsg((d as { error?: string }).error ?? "Could not load submissions."); setState("error"); return; }
      setData(d);
      setSelected(new Set());
      setState("ok");
    } catch {
      setErrorMsg("Network error — is the app reachable?");
      setState("error");
    }
  }, [chapter, page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [chapter]);

  const chapter4Ids = useMemo(() => new Set((data?.items ?? []).filter((i) => i.chapter === "chapter-4").map((i) => i.submissionId)), [data]);
  const selectedCount = selected.size;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected((prev) => (prev.size === chapter4Ids.size ? new Set() : new Set(chapter4Ids)));
  };

  const bulkApprove = async () => {
    if (selectedCount === 0 || bulkBusy) return;
    const ok = await confirmDialog({
      title: `Approve ${selectedCount} plan${selectedCount === 1 ? "" : "s"}?`,
      message: "This approves each selected Growth & Improvement Plan with no individual feedback. Learners will be notified.",
      confirmLabel: "Approve all",
    });
    if (!ok) return;
    setBulkBusy(true); setBulkMsg("");
    let succeeded = 0;
    let failed = 0;
    for (const submissionId of selected) {
      try {
        const r = await fetch("/api/coaching/chapter/4/review", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ submission_id: submissionId, decision: "approve" }),
        });
        if (r.ok) succeeded += 1; else failed += 1;
      } catch { failed += 1; }
    }
    setBulkMsg(failed === 0 ? `Approved ${succeeded} plan${succeeded === 1 ? "" : "s"}.` : `Approved ${succeeded}, ${failed} failed — try those individually.`);
    setBulkBusy(false);
    await load();
  };

  return (
    <PageShell
      eyebrow="Coach review"
      title="Pending submissions"
      subtitle="Every submission awaiting your review, across every workspace you coach."
      actions={
        <select className="ds-select" value={chapter} onChange={(e) => setChapter(e.target.value)} aria-label="Filter by chapter">
          {CHAPTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      }
    >
      {state === "not-authenticated" && <Notice icon="lock" title="Sign in required" body="Sign in to see your pending reviews." />}
      {state === "error" && <Notice icon="warning" title="Couldn't load submissions" body={errorMsg} onRetry={() => void load()} />}
      {state === "loading" && !data && <p className="ds-help">Loading…</p>}

      {data && (
        <>
          {chapter4Ids.size > 0 && (
            <div className="pend-bulkbar">
              <label className="pend-bulk-check">
                <input type="checkbox" checked={selectedCount > 0 && selectedCount === chapter4Ids.size} onChange={toggleAll} />
                Select all Chapter 4 items on this page
              </label>
              <button type="button" className="ds-btn ds-btn--sm ds-btn--primary" disabled={selectedCount === 0 || bulkBusy} onClick={() => void bulkApprove()}>
                {bulkBusy ? "Approving…" : `Approve selected (${selectedCount})`}
              </button>
              {bulkMsg && <span className="ds-help">{bulkMsg}</span>}
            </div>
          )}

          {data.items.length === 0 ? (
            <p className="ds-help">Nothing awaiting review right now.</p>
          ) : (
            <ul className="pend-list">
              {data.items.map((item) => (
                <li key={item.submissionId}>
                  <Card className="pend-card">
                    {item.chapter === "chapter-4" && (
                      <input
                        type="checkbox"
                        className="pend-check"
                        checked={selected.has(item.submissionId)}
                        onChange={() => toggle(item.submissionId)}
                        aria-label={`Select ${item.workspaceName}'s submission`}
                      />
                    )}
                    <div className="pend-card-body">
                      <div className="pend-card-head">
                        <span className="pend-learner">{item.learnerEmail ?? item.workspaceName}</span>
                        <span className="ds-help">{item.workspaceName}</span>
                      </div>
                      <div className="pend-card-meta">
                        <Badge tone="info">{item.chapterTitle}</Badge>
                        <span className="ds-help">{daysLabel(item.daysPending)} pending</span>
                      </div>
                    </div>
                    {item.chapter === "chapter-4" ? (
                      <Link className="ds-btn ds-btn--secondary ds-btn--sm" href={item.reviewHref}>Review →</Link>
                    ) : (
                      <a className="ds-btn ds-btn--secondary ds-btn--sm" href={item.reviewHref}>Review →</a>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {data.totalPages > 1 && (
            <div className="pend-pagination">
              <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" disabled={data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</button>
              <span className="ds-help">Page {data.page} of {data.totalPages} ({data.total} total)</span>
              <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" disabled={data.page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      <style>{`
        .pend-bulkbar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; padding: 10px 14px; background: var(--ds-surface-secondary, #f8fafc); border: 1px solid var(--ds-border, #e2e8f0); border-radius: 10px; }
        .pend-bulk-check { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
        .pend-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .pend-card { display: flex; align-items: center; gap: 14px; padding: 14px 16px; }
        .pend-check { flex-shrink: 0; width: 16px; height: 16px; }
        .pend-card-body { flex: 1; min-width: 0; }
        .pend-card-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
        .pend-learner { font-weight: 700; font-size: 14px; }
        .pend-card-meta { display: flex; align-items: center; gap: 10px; margin-top: 6px; flex-wrap: wrap; }
        .pend-pagination { display: flex; align-items: center; gap: 14px; justify-content: center; margin-top: 18px; }
      `}</style>
    </PageShell>
  );
}
