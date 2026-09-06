"use client";

/**
 * ProgrammeCentre — the COACHING-programme hub. A modal showing the member's
 * curriculum progress (stages/lessons), their cohorts and sessions, a workbook
 * PDF, and coach review — plus workspace switching and member management for
 * the programme they belong to.
 *
 * NOTE — do not confuse with ProgramCentre (one fewer "me"): that is the
 * business-MODEL authoring surface (money machine, drivers, business report).
 * This file is about the course the user is taking; that one is about their
 * own business model. Unrelated components, one letter apart.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { jsPDF } from "jspdf";
import { CANONICAL_STAGES, type PsychologicalState, type ReadinessLabel } from "@onevyrt/engine";
import { ACCENT, barGhost, barPrimary } from "../lib/studio-ui";
import { useDialogA11y } from "../lib/use-dialog-a11y";
import { confirmDialog } from "./Modal";
import { LessonGuide, type LessonGuideAssignment } from "./LessonGuide";
import { ClientProgressCard } from "./coaching/ClientProgressCard";

// Same helper app/programme/page.tsx and app/programme/lesson/[lessonId]/page.tsx
// already each have their own copy of — the canonical stage-id -> psychological-
// state lookup, for LessonGuide's cosmetic accent theming.
function stateOf(stageId: string): PsychologicalState {
  return CANONICAL_STAGES.find((s) => s.id === stageId)?.state ?? "clarity";
}

interface ChecklistTemplateItem { id: string; label: string; }
interface AssignmentTemplate { id: string; title: string; instructions: string; checklist: ChecklistTemplateItem[]; evidencePrompt: string; }
interface LessonTemplate { id: string; order: number; title: string; outcome: string; content: string; videoUrl?: string; resourceUrls?: string[]; toolDeepLink?: string; assignment?: AssignmentTemplate; estimatedMinutes?: number; }
interface StageTemplate { id: string; order: number; title: string; outcome: string; lessons: LessonTemplate[]; }
interface ProgrammeTemplate { id: string; name: string; status: string; stages: StageTemplate[]; }

type LessonStatus = "locked" | "available" | "in_progress" | "submitted" | "changes_requested" | "approved" | "completed";
interface Submission { id: string; submittedAt: string; evidence: string; checklistChecked: string[]; reviewStatus: "pending" | "approved" | "changes_requested"; coachFeedback?: string; reviewedAt?: string; reviewedBy?: string; }
interface EnrollmentLessonEntry { lessonId: string; status?: LessonStatus; startedAt?: string; submissions: Submission[]; }
interface Enrollment { id: string; lessons: EnrollmentLessonEntry[]; coachNotes?: string; accessGranted?: boolean; }
interface EnrollmentSummary { totalLessons: number; completedLessons: number; percentComplete: number; currentLessonId: string | null; awaitingReview: { lessonId: string; submission: Submission }[]; changesRequested: string[]; }
/** The subset of @onevyrt/engine's ProgrammeMap (buildProgrammeMap) this
 *  component actually reads: per-lesson status, already computed with the
 *  cohort pacing cap applied. Fetched from /api/programme/enrollment. */
interface ProgrammeMap { nodes: { lessons: { id: string; status: LessonStatus }[] }[]; }

const STATUS_COPY: Record<LessonStatus, { label: string; color: string }> = {
  locked: { label: "Locked", color: "var(--dim)" },
  available: { label: "Available", color: "var(--muted)" },
  in_progress: { label: "In progress", color: "#f59e0b" },
  submitted: { label: "Submitted", color: "#2563eb" },
  changes_requested: { label: "Changes requested", color: "#dc2626" },
  approved: { label: "Approved", color: "#16a34a" },
  completed: { label: "Completed", color: "#16a34a" },
};

/**
 * The hardcopy companion to the software itinerary: one printable PDF
 * covering the whole curriculum, laid out for someone to write in by hand
 * — every assignment gets real blank space, not just a line of "see app."
 * This is the third leg of the delivery model alongside video coaching
 * (the lesson's own videoUrl) and the online itinerary (this same
 * component) — a client should be able to work an entire stage from the
 * printed page and only touch the software to log evidence and get
 * reviewed.
 */
function buildWorkbookPdf(programme: ProgrammeTemplate): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - marginX * 2;
  let y = 56;
  const nextLine = (dy: number) => { y += dy; if (y > pageH - 60) { doc.addPage(); y = 56; } };
  const wrapped = (text: string, size: number, lineH: number, style: "normal" | "bold" | "italic" = "normal") => {
    doc.setFontSize(size).setFont("helvetica", style);
    for (const line of doc.splitTextToSize(text, contentW)) { doc.text(line, marginX, y); nextLine(lineH); }
  };
  const blankLines = (count: number) => {
    for (let i = 0; i < count; i++) {
      nextLine(22);
      doc.setDrawColor(180).line(marginX, y, marginX + contentW, y);
    }
    nextLine(10);
  };

  doc.setFontSize(22).setFont("helvetica", "bold");
  doc.text(programme.name, marginX, y);
  nextLine(20);
  doc.setFontSize(11).setFont("helvetica", "normal").setTextColor(100);
  doc.text("Workbook — write your answers here, then log the same evidence in the app for your coach to review.", marginX, y, { maxWidth: contentW });
  doc.setTextColor(0);
  nextLine(40);

  const stages = [...programme.stages].sort((a, b) => a.order - b.order);
  for (const stage of stages) {
    if (y > 100) doc.addPage();
    y = 56;
    doc.setFontSize(17).setFont("helvetica", "bold");
    doc.text(`Stage ${stage.order} — ${stage.title}`, marginX, y);
    nextLine(22);
    wrapped(stage.outcome, 11, 15, "italic");
    nextLine(14);

    if (stage.lessons.length === 0) {
      doc.setFontSize(11).setFont("helvetica", "italic").setTextColor(140);
      doc.text("Content for this stage is coming soon.", marginX, y);
      doc.setTextColor(0);
      nextLine(20);
      continue;
    }

    for (const lesson of [...stage.lessons].sort((a, b) => a.order - b.order)) {
      doc.setFontSize(14).setFont("helvetica", "bold");
      doc.text(lesson.title, marginX, y);
      nextLine(18);
      doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(120);
      doc.text(`${lesson.outcome}${lesson.estimatedMinutes ? `  ·  ~${lesson.estimatedMinutes} min` : ""}`, marginX, y, { maxWidth: contentW });
      doc.setTextColor(0);
      nextLine(20);

      doc.setFontSize(10).setFont("helvetica", "bold");
      doc.text(lesson.videoUrl ? `Coaching video: ${lesson.videoUrl}` : "Coaching video: your coach will provide this", marginX, y, { maxWidth: contentW });
      nextLine(18);

      wrapped(lesson.content, 11, 15);
      nextLine(6);

      if (lesson.assignment) {
        doc.setFontSize(12).setFont("helvetica", "bold");
        doc.text(`Assignment: ${lesson.assignment.title}`, marginX, y);
        nextLine(16);
        wrapped(lesson.assignment.instructions, 10.5, 14, "normal");
        nextLine(4);
        doc.setFontSize(10.5).setFont("helvetica", "normal");
        for (const item of lesson.assignment.checklist) { doc.text(`☐  ${item.label}`, marginX, y); nextLine(15); }
        nextLine(6);
        doc.setFontSize(10.5).setFont("helvetica", "bold");
        doc.text(lesson.assignment.evidencePrompt, marginX, y, { maxWidth: contentW });
        nextLine(16);
        blankLines(5);
      }
      nextLine(10);
      doc.setDrawColor(220).line(marginX, y - 6, marginX + contentW, y - 6);
      nextLine(10);
    }
  }

  doc.save(`${programme.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-workbook.pdf`);
}

interface BusinessSnapshot { projectId: string | null; projectName: string | null; readinessScore: number | null; readinessLabel: ReadinessLabel; topGoal: { title: string; level: string; status: string } | null; overdueCount: number; }
interface ChapterSubmission { stageId: string; submittedAt: string; evidence: string; reviewStatus: "submitted" | "approved" | "changes_requested"; coachFeedback?: string; reviewedAt?: string; reviewedBy?: string; }
interface ChapterReviewEntry { stageId: string; stageTitle: string; order: number; submission: ChapterSubmission; }
interface CoachClient { workspaceId: string; workspaceName: string; plan: string; role: "owner" | "manager"; summary: EnrollmentSummary; snapshot: BusinessSnapshot; lastActivityAt: string | null; coachNotes?: string; accessGranted: boolean; chaptersAwaitingReview: ChapterReviewEntry[]; }
interface CohortSession { id: string; title: string; date: string; meetingUrl?: string; }
interface CohortAnnouncement { id: string; message: string; postedAt: string; postedBy: string; }
interface Cohort { id: string; name: string; startDate: string; endDate: string; coachEmail: string; memberWorkspaceIds: string[]; sessions: CohortSession[]; announcements: CohortAnnouncement[]; stageAccessLimit?: number; }

const READINESS_COPY: Record<string, { text: string; color: string }> = {
  no_data: { text: "Not enough data", color: "var(--dim)" },
  fragile: { text: "Fragile", color: "#dc2626" },
  developing: { text: "Developing", color: "#f59e0b" },
  strong: { text: "Strong", color: "#16a34a" },
};

export function ProgrammeCentre({ onClose, activeWsId, onSwitchWorkspace, onManageMembers }: { onClose: () => void; activeWsId: string; onSwitchWorkspace: (wsId: string) => void; onManageMembers: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, onClose); // focus trap + Escape + focus-return
  const [programme, setProgramme] = useState<ProgrammeTemplate | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [summary, setSummary] = useState<EnrollmentSummary | null>(null);
  const [programmeMap, setProgrammeMap] = useState<ProgrammeMap | null>(null);
  const [snapshot, setSnapshot] = useState<BusinessSnapshot | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [view, setView] = useState<"programme" | "review" | "clients" | "cohorts">("programme");
  const [myCohorts, setMyCohorts] = useState<Cohort[]>([]);

  const [reviewItems, setReviewItems] = useState<{ lessonId: string; lessonTitle: string; stageTitle: string; submission: Submission }[]>([]);
  const [reviewFeedback, setReviewFeedback] = useState<Record<string, string>>({});
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);

  // Chapter-review mirrors the lesson-review state above, keyed by
  // "workspaceId:stageId" rather than just lessonId — unlike lesson review
  // (scoped to the active workspace via loadReview()'s ?ws=), chapter review
  // pools awaiting-review chapters across every workspace this user coaches
  // (see loadClients()/chaptersAwaitingReview below), so the same stageId can
  // appear once per learner.
  const [chapterReviewFeedback, setChapterReviewFeedback] = useState<Record<string, string>>({});
  const [chapterReviewBusy, setChapterReviewBusy] = useState<string | null>(null);

  const [clients, setClients] = useState<CoachClient[] | null>(null);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteBusy, setNoteBusy] = useState<string | null>(null);
  const [accessBusy, setAccessBusy] = useState<string | null>(null);

  const [learnerCohorts, setLearnerCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [newCohortName, setNewCohortName] = useState("");
  const [newCohortStart, setNewCohortStart] = useState("");
  const [newCohortEnd, setNewCohortEnd] = useState("");
  const [cohortBusy, setCohortBusy] = useState(false);
  const [cohortErr, setCohortErr] = useState("");
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [newSessionDate, setNewSessionDate] = useState("");
  const [newSessionUrl, setNewSessionUrl] = useState("");
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [addMemberWsId, setAddMemberWsId] = useState("");

  const [offers, setOffers] = useState<{ id: string; name: string; priceLabel: string; description: string; active: boolean }[]>([]);
  useEffect(() => {
    fetch("/api/programme/offers").then((r) => r.json()).then((d: { offers?: typeof offers }) => { if (d.offers) setOffers(d.offers); }).catch(() => {});
  }, []);

  // A workspace switch (via the coach client list) must drop any lesson
  // selected in the PREVIOUS workspace — otherwise load() below keeps it
  // via the `cur ??` fallback and the detail pane shows the wrong client's
  // lesson under the new client's data.
  useEffect(() => { setSelectedLessonId(null); }, [activeWsId]);

  // activeWsId is a prop, not local state — it starts "" in funnel-studio.tsx
  // and gets resolved to a real id (from ?ws= or the workspace list) shortly
  // after mount, via its own separate async effect there. That means load()
  // below can fire twice in quick succession — once for "" (before the
  // resolve), once for the real id — and their responses can arrive
  // OUT OF ORDER: a stale "" request 403ing with "not a member of this
  // workspace" has been observed completing AFTER the real request already
  // succeeded, so its setErr(...) silently clobbered the good state that had
  // just loaded (role/enrollment/etc. all correct, but frozen behind a
  // permanent, wrong error banner for the rest of this component's life,
  // since nothing here ever calls setErr("") again). This ref lets a
  // response check "is the id I was fetched for still the current one" and
  // discard itself if not, instead of trusting completion order.
  const activeWsIdRef = useRef(activeWsId);
  activeWsIdRef.current = activeWsId;

  const load = useCallback(async () => {
    const requestedWsId = activeWsId;
    setLoading(true); setErr("");
    try {
      const [progRes, enrollRes] = await Promise.all([
        fetch("/api/programme"),
        fetch(`/api/programme/enrollment?ws=${encodeURIComponent(activeWsId)}`),
      ]);
      const progData = await progRes.json() as { programme?: ProgrammeTemplate; error?: string };
      const enrollData = await enrollRes.json() as { enrollment?: Enrollment; summary?: EnrollmentSummary; map?: ProgrammeMap; role?: string; snapshot?: BusinessSnapshot; cohorts?: Cohort[]; error?: string };
      if (requestedWsId !== activeWsIdRef.current) return; // superseded by a newer load() — let that one's own state win
      if (!progRes.ok || !progData.programme) { setErr(progData.error ?? "Could not load the programme."); setLoading(false); return; }
      if (!enrollRes.ok || !enrollData.enrollment || !enrollData.summary) { setErr(enrollData.error ?? "Could not load your progress."); setLoading(false); return; }
      setProgramme(progData.programme);
      setEnrollment(enrollData.enrollment);
      setSummary(enrollData.summary);
      setProgrammeMap(enrollData.map ?? null);
      setSnapshot(enrollData.snapshot ?? null);
      setRole(enrollData.role ?? null);
      setLearnerCohorts(enrollData.cohorts ?? []);
      setSelectedLessonId((cur) => cur ?? enrollData.summary!.currentLessonId ?? progData.programme!.stages[0]?.lessons[0]?.id ?? null);
    } catch {
      if (requestedWsId === activeWsIdRef.current) setErr("Network error — is the app reachable?");
    }
    if (requestedWsId === activeWsIdRef.current) setLoading(false);
  }, [activeWsId]);

  useEffect(() => { void load(); }, [load]);

  const loadClients = useCallback(async () => {
    setClientsLoading(true);
    try {
      const r = await fetch("/api/programme/coach-workspaces");
      const data = await r.json() as { clients?: CoachClient[]; error?: string };
      if (r.ok && data.clients) setClients(data.clients);
    } catch { /* best effort */ }
    setClientsLoading(false);
  }, []);
  useEffect(() => { if (view === "clients") void loadClients(); }, [view, loadClients]);

  const saveCoachNotes = async (workspaceId: string, notes: string) => {
    setNoteBusy(workspaceId);
    try {
      await fetch("/api/programme/coach-notes", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ws: workspaceId, notes }),
      });
      setClients((cur) => cur && cur.map((c) => (c.workspaceId === workspaceId ? { ...c, coachNotes: notes } : c)));
    } catch { /* best effort */ }
    setNoteBusy(null);
  };

  const toggleAccess = async (workspaceId: string, granted: boolean) => {
    // Pausing access is destructive to the client — confirm it. Granting is safe.
    if (!granted) {
      const ok = await confirmDialog({ title: "Pause this client's access?", message: "They'll lose access to the programme's sessions and pacing until you grant it again.", confirmLabel: "Pause access", danger: true });
      if (!ok) return;
    }
    setAccessBusy(workspaceId); setErr("");
    try {
      const r = await fetch("/api/programme/access", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ws: workspaceId, granted }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErr((d as { error?: string }).error || "Couldn't update access — please try again."); setAccessBusy(null); return; }
      setClients((cur) => cur && cur.map((c) => (c.workspaceId === workspaceId ? { ...c, accessGranted: granted } : c)));
      // If the toggled client IS the currently active workspace (a coach
      // acting on their own workspace, or after switching into a client's),
      // the "My progress" view's own enrollment is now stale — refresh it.
      if (workspaceId === activeWsId) await load();
    } catch { setErr("Network error — couldn't update access."); }
    setAccessBusy(null);
  };

  const loadMyCohorts = useCallback(async () => {
    try {
      const r = await fetch("/api/cohorts");
      const data = await r.json() as { cohorts?: Cohort[]; error?: string };
      if (r.ok && data.cohorts) {
        setMyCohorts(data.cohorts);
        setSelectedCohortId((cur) => cur ?? data.cohorts![0]?.id ?? null);
      }
    } catch { /* best effort */ }
  }, []);
  useEffect(() => { if (view === "cohorts") void loadMyCohorts(); }, [view, loadMyCohorts]);
  // Separate effect so a client-list load finishing (which changes `clients`)
  // doesn't re-trigger loadMyCohorts() too — each fetch only reacts to its
  // own trigger, not to the other one's completion.
  useEffect(() => { if (view === "cohorts" && !clients) void loadClients(); }, [view, clients, loadClients]);

  const selectedCohort = myCohorts.find((c) => c.id === selectedCohortId) ?? null;

  const createCohort = async () => {
    if (!newCohortName.trim() || !newCohortStart || !newCohortEnd || cohortBusy) return;
    setCohortBusy(true); setCohortErr("");
    try {
      const r = await fetch("/api/cohorts", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newCohortName, startDate: newCohortStart, endDate: newCohortEnd }),
      });
      const data = await r.json() as { cohort?: Cohort; error?: string };
      if (!r.ok || !data.cohort) { setCohortErr(data.error ?? "Could not create cohort."); setCohortBusy(false); return; }
      setNewCohortName(""); setNewCohortStart(""); setNewCohortEnd("");
      await loadMyCohorts();
      setSelectedCohortId(data.cohort.id);
    } catch { setCohortErr("Network error — is the app reachable?"); }
    setCohortBusy(false);
  };

  const addMember = async () => {
    if (!selectedCohort || !addMemberWsId || cohortBusy) return;
    setCohortBusy(true); setCohortErr("");
    try {
      const r = await fetch(`/api/cohorts/${encodeURIComponent(selectedCohort.id)}/members`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId: addMemberWsId }),
      });
      const data = await r.json() as { error?: string };
      if (!r.ok) { setCohortErr(data.error ?? "Could not add client."); setCohortBusy(false); return; }
      setAddMemberWsId("");
      await loadMyCohorts();
    } catch { setCohortErr("Network error — is the app reachable?"); }
    setCohortBusy(false);
  };

  const removeMember = async (wsId: string) => {
    if (!selectedCohort || cohortBusy) return;
    // Removing a client from a cohort is destructive and was previously
    // fire-and-forget: no confirm, no busy guard, and no error surfaced when
    // the DELETE failed (it just silently reloaded with the member still
    // there). Confirm first, then guard + report like every other action here.
    const ok = await confirmDialog({ title: "Remove this client?", message: "They'll lose access to this cohort's sessions and pacing. You can re-add them later.", confirmLabel: "Remove", danger: true });
    if (!ok) return;
    setCohortBusy(true); setCohortErr("");
    try {
      const r = await fetch(`/api/cohorts/${encodeURIComponent(selectedCohort.id)}/members?ws=${encodeURIComponent(wsId)}`, { method: "DELETE" });
      if (!r.ok) {
        const data = await r.json().catch(() => null) as { error?: string } | null;
        setCohortErr(data?.error ?? "Could not remove this client."); setCohortBusy(false); return;
      }
      await loadMyCohorts();
    } catch { setCohortErr("Network error — is the app reachable?"); }
    setCohortBusy(false);
  };

  const addSession = async () => {
    if (!selectedCohort || !newSessionTitle.trim() || !newSessionDate || cohortBusy) return;
    setCohortBusy(true); setCohortErr("");
    try {
      const r = await fetch(`/api/cohorts/${encodeURIComponent(selectedCohort.id)}/sessions`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: newSessionTitle, date: newSessionDate, meetingUrl: newSessionUrl || undefined }),
      });
      const data = await r.json() as { error?: string };
      if (!r.ok) { setCohortErr(data.error ?? "Could not add session."); setCohortBusy(false); return; }
      setNewSessionTitle(""); setNewSessionDate(""); setNewSessionUrl("");
      await loadMyCohorts();
    } catch { setCohortErr("Network error — is the app reachable?"); }
    setCohortBusy(false);
  };

  const postAnnouncement = async () => {
    if (!selectedCohort || !newAnnouncement.trim() || cohortBusy) return;
    setCohortBusy(true); setCohortErr("");
    try {
      const r = await fetch(`/api/cohorts/${encodeURIComponent(selectedCohort.id)}/announcements`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: newAnnouncement }),
      });
      const data = await r.json() as { error?: string };
      if (!r.ok) { setCohortErr(data.error ?? "Could not post announcement."); setCohortBusy(false); return; }
      setNewAnnouncement("");
      await loadMyCohorts();
    } catch { setCohortErr("Network error — is the app reachable?"); }
    setCohortBusy(false);
  };

  const setAccessLimit = async (cohortId: string, stageAccessLimit: number | null) => {
    setCohortBusy(true); setCohortErr("");
    try {
      const r = await fetch(`/api/cohorts/${encodeURIComponent(cohortId)}/access-limit`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stageAccessLimit }),
      });
      const data = await r.json() as { error?: string };
      if (!r.ok) { setCohortErr(data.error ?? "Could not update the access rule."); setCohortBusy(false); return; }
      await loadMyCohorts();
    } catch { setCohortErr("Network error — is the app reachable?"); }
    setCohortBusy(false);
  };

  const loadReview = useCallback(async () => {
    try {
      const r = await fetch(`/api/programme/review?ws=${encodeURIComponent(activeWsId)}`);
      const data = await r.json() as { awaitingReview?: typeof reviewItems; error?: string };
      if (r.ok && data.awaitingReview) setReviewItems(data.awaitingReview);
    } catch { /* best effort */ }
  }, [activeWsId]);

  useEffect(() => { if (view === "review") void loadReview(); }, [view, loadReview]);
  // The chapter-review section below reads the same coached-workspaces roster
  // as "My clients" (loadClients/coach-workspaces) — a chapter awaiting review
  // can belong to ANY workspace this user coaches, not just activeWsId, so it
  // can't reuse the single-workspace loadReview() above.
  useEffect(() => { if (view === "review") void loadClients(); }, [view, loadClients]);

  const isCoach = role === "owner" || role === "manager";
  const allLessons: LessonTemplate[] = programme ? programme.stages.flatMap((s) => [...s.lessons].sort((a, b) => a.order - b.order)) : [];
  // Per-lesson status, straight from the canonical engine's buildProgrammeMap
  // (via /api/programme/enrollment's `map` field) — already computed with the
  // cohort pacing cap applied, so this never has to re-derive status locally
  // and can't drift from the same logic /programme itself renders from.
  const lessonStatusById = useMemo(() => {
    const byId = new Map<string, LessonStatus>();
    if (programmeMap) for (const node of programmeMap.nodes) for (const l of node.lessons) byId.set(l.id, l.status);
    return byId;
  }, [programmeMap]);
  // Flattened across every coached workspace's chaptersAwaitingReview (see
  // coach-workspaces/route.ts) — the chapter-review counterpart of reviewItems.
  const chapterReviewItems = (clients ?? []).flatMap((c) =>
    c.chaptersAwaitingReview.map((entry) => ({ ...entry, workspaceId: c.workspaceId, workspaceName: c.workspaceName })));
  const selectedLesson = allLessons.find((l) => l.id === selectedLessonId) ?? null;
  // The lesson pane below embeds LessonGuide (the same component
  // /programme/lesson/[id] renders) instead of a second hand-rolled
  // implementation of the same "content + assignment + submit" screen —
  // it resolves its own live status/submission history/coach-feedback
  // internally via /api/programme/enrollment, so this only needs to find
  // the STRUCTURAL stage/position context LessonGuide's props ask for.
  const selectedStage = selectedLesson ? (programme?.stages.find((s) => s.lessons.some((l) => l.id === selectedLesson.id)) ?? null) : null;
  const selectedStageLessons = selectedStage ? [...selectedStage.lessons].sort((a, b) => a.order - b.order) : [];
  const selectedNumInStage = selectedLesson ? selectedStageLessons.findIndex((l) => l.id === selectedLesson.id) + 1 : 0;

  const selectLesson = (lesson: LessonTemplate, status: LessonStatus) => {
    if (status === "locked") return;
    setSelectedLessonId(lesson.id);
    if (status === "available") {
      void fetch(`/api/programme/lessons/${encodeURIComponent(lesson.id)}/start?ws=${encodeURIComponent(activeWsId)}`, { method: "POST" }).then(() => load());
    }
  };

  const review = async (lessonId: string, decision: "approved" | "changes_requested") => {
    setReviewBusy(lessonId); setErr("");
    try {
      const r = await fetch(`/api/programme/lessons/${encodeURIComponent(lessonId)}/review?ws=${encodeURIComponent(activeWsId)}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, feedback: reviewFeedback[lessonId] }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErr((d as { error?: string }).error || "Couldn't submit your review — please try again."); setReviewBusy(null); return; }
      await loadReview();
      if (lessonId === selectedLessonId) await load();
    } catch { setErr("Network error — couldn't submit your review."); }
    setReviewBusy(null);
  };

  // Same shape as review() above, but hits the chapter-review endpoint (whose
  // body field names differ — reviewStatus/coachFeedback, not decision/feedback
  // — see api/programme/chapters/[stageId]/review) and needs an explicit
  // workspaceId since a chapter card isn't necessarily in the active workspace.
  const reviewChapter = async (workspaceId: string, stageId: string, decision: "approved" | "changes_requested") => {
    const key = `${workspaceId}:${stageId}`;
    setChapterReviewBusy(key); setErr("");
    try {
      const r = await fetch(`/api/programme/chapters/${encodeURIComponent(stageId)}/review?ws=${encodeURIComponent(workspaceId)}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewStatus: decision, coachFeedback: chapterReviewFeedback[key] }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErr((d as { error?: string }).error || "Couldn't submit your review — please try again."); setChapterReviewBusy(null); return; }
      await loadClients();
      if (workspaceId === activeWsId) await load();
    } catch { setErr("Network error — couldn't submit your review."); }
    setChapterReviewBusy(null);
  };

  return (
    <div onClick={onClose} className="pc-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 }}>
      <style>{`
        .pc-split { display: flex; flex: 1; min-height: 0; }
        .pc-sidebar { width: 280px; border-right: 1px solid var(--border); overflow-y: auto; padding: 14px; flex-shrink: 0; }
        .pc-sidebar-sm { width: 260px; }
        @media (max-width: 640px) {
          .pc-backdrop { padding: 8px; }
          .pc-split { flex-direction: column; overflow-y: auto; }
          .pc-sidebar, .pc-sidebar-sm { width: 100%; max-height: 46vh; border-right: none; border-bottom: 1px solid var(--border); }
        }
      `}</style>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Programme" onClick={(e) => e.stopPropagation()} style={{ width: "min(920px, 100%)", minWidth: 0, maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 18, boxShadow: "var(--shadow-panel)" }}>
        <div style={{ padding: "18px 22px 12px", borderBottom: "1px solid var(--border)", display: "flex", flexWrap: "wrap", rowGap: 10, justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>PROGRAMME</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{programme?.name ?? "Loading…"}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {isCoach && (
              <div style={{ display: "flex", gap: 2, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8, padding: 2 }}>
                <button onClick={() => setView("programme")} style={{ background: view === "programme" ? ACCENT : "transparent", color: view === "programme" ? "#fff" : "var(--muted)", border: "none", borderRadius: 6, padding: "3px 9px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>My progress</button>
                <button onClick={() => setView("review")} style={{ background: view === "review" ? ACCENT : "transparent", color: view === "review" ? "#fff" : "var(--muted)", border: "none", borderRadius: 6, padding: "3px 9px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Coach review{reviewItems.length + chapterReviewItems.length > 0 ? ` (${reviewItems.length + chapterReviewItems.length})` : ""}</button>
                <button onClick={() => setView("clients")} style={{ background: view === "clients" ? ACCENT : "transparent", color: view === "clients" ? "#fff" : "var(--muted)", border: "none", borderRadius: 6, padding: "3px 9px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>My clients</button>
                <button onClick={() => setView("cohorts")} style={{ background: view === "cohorts" ? ACCENT : "transparent", color: view === "cohorts" ? "#fff" : "var(--muted)", border: "none", borderRadius: 6, padding: "3px 9px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Cohorts</button>
              </div>
            )}
            {programme && <button onClick={() => buildWorkbookPdf(programme)} style={barGhost} title="A printable hardcopy of the whole curriculum, with space to write by hand">📖 Workbook</button>}
            <button onClick={onClose} style={barGhost}>Close</button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--dim)", fontSize: 13 }}>Loading programme…</div>
        ) : err ? (
          <div style={{ padding: 22, fontSize: 13, color: "#dc2626" }}>{err}</div>
        ) : view === "review" ? (
          <div style={{ padding: 22, overflowY: "auto" }}>
            <div style={{ fontSize: 11, color: "var(--dim)", fontWeight: 700, letterSpacing: 0.4, marginBottom: 10 }}>LESSON SUBMISSIONS</div>
            {reviewItems.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 26 }}>Nothing awaiting review right now.</div>
            ) : (
              <div style={{ marginBottom: 26 }}>
                {reviewItems.map((item) => (
                  <div key={item.lessonId} style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 2 }}>{item.stageTitle}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{item.lessonTitle}</div>
                    <div style={{ fontSize: 13, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 8, whiteSpace: "pre-wrap" }}>{item.submission.evidence}</div>
                    {item.submission.checklistChecked.length > 0 && <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 8 }}>{item.submission.checklistChecked.length} checklist item(s) marked done</div>}
                    <textarea value={reviewFeedback[item.lessonId] ?? ""} onChange={(e) => setReviewFeedback((f) => ({ ...f, [item.lessonId]: e.target.value }))} placeholder="Feedback (optional)"
                      style={{ width: "100%", minHeight: 50, boxSizing: "border-box", background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: 8, fontSize: 12, marginBottom: 8, resize: "vertical" }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => void review(item.lessonId, "approved")} disabled={reviewBusy === item.lessonId} style={{ ...barPrimary, opacity: reviewBusy === item.lessonId ? 0.6 : 1 }}>Approve</button>
                      <button onClick={() => void review(item.lessonId, "changes_requested")} disabled={reviewBusy === item.lessonId} style={{ ...barGhost, opacity: reviewBusy === item.lessonId ? 0.6 : 1, color: "#dc2626" }}>Request changes</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: 11, color: "var(--dim)", fontWeight: 700, letterSpacing: 0.4, marginBottom: 10, paddingTop: 14, borderTop: "1px solid var(--border)" }}>CHAPTER APPROVALS</div>
            {clientsLoading && !clients ? (
              <div style={{ fontSize: 13, color: "var(--dim)" }}>Loading chapter reviews…</div>
            ) : chapterReviewItems.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--dim)" }}>No chapter outputs awaiting review right now.</div>
            ) : (
              chapterReviewItems.map((item) => {
                const key = `${item.workspaceId}:${item.stageId}`;
                return (
                  <div key={key} style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 2 }}>{item.workspaceName}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Chapter {item.order} — {item.stageTitle}</div>
                    <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 8 }}>Submitted {new Date(item.submission.submittedAt).toLocaleString()}</div>
                    <div style={{ fontSize: 13, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 8, whiteSpace: "pre-wrap" }}>{item.submission.evidence}</div>
                    <textarea value={chapterReviewFeedback[key] ?? ""} onChange={(e) => setChapterReviewFeedback((f) => ({ ...f, [key]: e.target.value }))} placeholder="Feedback (optional)"
                      style={{ width: "100%", minHeight: 50, boxSizing: "border-box", background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: 8, fontSize: 12, marginBottom: 8, resize: "vertical" }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => void reviewChapter(item.workspaceId, item.stageId, "approved")} disabled={chapterReviewBusy === key} style={{ ...barPrimary, opacity: chapterReviewBusy === key ? 0.6 : 1 }}>Approve</button>
                      <button onClick={() => void reviewChapter(item.workspaceId, item.stageId, "changes_requested")} disabled={chapterReviewBusy === key} style={{ ...barGhost, opacity: chapterReviewBusy === key ? 0.6 : 1, color: "#dc2626" }}>Request changes</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : view === "clients" ? (
          <div style={{ padding: 22, overflowY: "auto" }}>
            <button onClick={onManageMembers} style={{ ...barGhost, marginBottom: 14 }}>+ Invite a client or coach</button>
            {clientsLoading ? (
              <div style={{ fontSize: 13, color: "var(--dim)" }}>Loading clients…</div>
            ) : !clients || clients.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--dim)" }}>No clients yet — clients appear here once you own or manage their workspace.</div>
            ) : (
              clients.map((c) => {
                const needsAttention = c.summary.awaitingReview.length > 0 || c.snapshot.overdueCount > 0;
                const noteDraft = noteDrafts[c.workspaceId] ?? c.coachNotes ?? "";
                return (
                  <div key={c.workspaceId} style={{ background: "var(--surface2)", border: `1px solid ${needsAttention ? "#dc2626" : "var(--border2)"}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                    <button onClick={() => onSwitchWorkspace(c.workspaceId)} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                      <ClientProgressCard
                        workspaceName={c.workspaceName}
                        percentComplete={c.summary.percentComplete}
                        completedLessons={c.summary.completedLessons}
                        totalLessons={c.summary.totalLessons}
                        awaitingReviewCount={c.summary.awaitingReview.length}
                        changesRequestedCount={c.summary.changesRequested.length}
                        overdueCount={c.snapshot.overdueCount}
                        readinessLabel={c.snapshot.readinessLabel}
                        topGoalTitle={c.snapshot.topGoal?.title}
                        accessGranted={c.accessGranted}
                      />
                    </button>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                      <button onClick={() => void toggleAccess(c.workspaceId, !c.accessGranted)} disabled={accessBusy === c.workspaceId}
                        style={{ ...barGhost, padding: "2px 8px", fontSize: 11, color: c.accessGranted ? "#dc2626" : "#16a34a" }}>
                        {accessBusy === c.workspaceId ? "…" : c.accessGranted ? "Pause access" : "Resume access"}
                      </button>
                    </div>
                    {c.role === "manager" && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                        <div style={{ fontSize: 10, color: "var(--dim)", fontWeight: 700, letterSpacing: 0.4, marginBottom: 4 }}>PRIVATE COACH NOTES — not visible to this client</div>
                        <textarea value={noteDraft} onChange={(e) => setNoteDrafts((d) => ({ ...d, [c.workspaceId]: e.target.value }))}
                          placeholder="Notes only you (and other coaches on this workspace) can see…"
                          style={{ width: "100%", boxSizing: "border-box", minHeight: 50, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: 7, fontSize: 12, resize: "vertical", marginBottom: 6 }} />
                        <button onClick={() => void saveCoachNotes(c.workspaceId, noteDraft)} disabled={noteBusy === c.workspaceId} style={{ ...barGhost, padding: "2px 8px", fontSize: 11 }}>
                          {noteBusy === c.workspaceId ? "Saving…" : "Save note"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : view === "cohorts" ? (
          <div className="pc-split">
            <div className="pc-sidebar pc-sidebar-sm">
              <div style={{ fontSize: 11, color: "var(--dim)", fontWeight: 700, marginBottom: 8 }}>YOUR COHORTS</div>
              {myCohorts.length === 0 && <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 14 }}>No cohorts yet.</div>}
              {myCohorts.map((c) => (
                <button key={c.id} onClick={() => setSelectedCohortId(c.id)}
                  style={{ display: "block", width: "100%", textAlign: "left", background: c.id === selectedCohortId ? "var(--accent-soft)" : "transparent", border: "none", borderRadius: 6, padding: "8px 8px", marginBottom: 2, cursor: "pointer" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: c.id === selectedCohortId ? ACCENT : "var(--text)" }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: "var(--dim)" }}>{c.memberWorkspaceIds.length} client(s)</div>
                </button>
              ))}
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--dim)", fontWeight: 700, marginBottom: 8 }}>NEW COHORT</div>
                <input value={newCohortName} onChange={(e) => setNewCohortName(e.target.value)} placeholder="Cohort name"
                  style={{ width: "100%", boxSizing: "border-box", background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: 7, fontSize: 12, marginBottom: 6 }} />
                <input type="date" value={newCohortStart} onChange={(e) => setNewCohortStart(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: 7, fontSize: 12, marginBottom: 6 }} />
                <input type="date" value={newCohortEnd} onChange={(e) => setNewCohortEnd(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: 7, fontSize: 12, marginBottom: 8 }} />
                <button onClick={() => void createCohort()} disabled={cohortBusy || !newCohortName.trim() || !newCohortStart || !newCohortEnd} style={{ ...barPrimary, width: "100%", opacity: cohortBusy ? 0.6 : 1 }}>Create cohort</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 22, minWidth: 0 }}>
              {!selectedCohort ? (
                <div style={{ fontSize: 13, color: "var(--dim)" }}>Create or select a cohort to manage it.</div>
              ) : (
                <>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{selectedCohort.name}</div>
                  <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 18 }}>{selectedCohort.startDate} → {selectedCohort.endDate}</div>
                  {cohortErr && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{cohortErr}</div>}

                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Roster</div>
                  {selectedCohort.memberWorkspaceIds.length === 0 && <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 10 }}>No clients enrolled yet.</div>}
                  {selectedCohort.memberWorkspaceIds.map((wsId) => {
                    const client = clients?.find((c) => c.workspaceId === wsId);
                    return (
                      <div key={wsId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                        <span>{client?.workspaceName ?? wsId}</span>
                        <button onClick={() => void removeMember(wsId)} disabled={cohortBusy} style={{ ...barGhost, padding: "2px 8px", fontSize: 11, opacity: cohortBusy ? 0.6 : 1 }}>Remove</button>
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", gap: 6, marginTop: 10, marginBottom: 24 }}>
                    <select value={addMemberWsId} onChange={(e) => setAddMemberWsId(e.target.value)}
                      style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: 7, fontSize: 12 }}>
                      <option value="">Add a client…</option>
                      {(clients ?? []).filter((c) => !selectedCohort.memberWorkspaceIds.includes(c.workspaceId)).map((c) => (
                        <option key={c.workspaceId} value={c.workspaceId}>{c.workspaceName}</option>
                      ))}
                    </select>
                    <button onClick={() => void addMember()} disabled={cohortBusy || !addMemberWsId} style={{ ...barGhost, opacity: cohortBusy || !addMemberWsId ? 0.6 : 1 }}>Add</button>
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Programme access rule</div>
                  <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 8 }}>Cap this cohort to a stage so members can't race ahead of your pacing.</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
                    <select value={selectedCohort.stageAccessLimit ?? ""} disabled={cohortBusy}
                      onChange={(e) => void setAccessLimit(selectedCohort.id, e.target.value === "" ? null : Number(e.target.value))}
                      style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: 7, fontSize: 12 }}>
                      <option value="">No cap — full curriculum</option>
                      {(programme?.stages ?? []).slice().sort((a, b) => a.order - b.order).map((s) => (
                        <option key={s.id} value={s.order}>Up to Stage {s.order} — {s.title}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Weekly sessions</div>
                  {selectedCohort.sessions.length === 0 && <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 10 }}>No sessions scheduled yet.</div>}
                  {selectedCohort.sessions.map((s) => (
                    <div key={s.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                      <div style={{ fontWeight: 500 }}>{s.title}</div>
                      <div style={{ color: "var(--dim)" }}>{new Date(s.date).toLocaleString()}{s.meetingUrl && <> · <a href={s.meetingUrl} target="_blank" rel="noreferrer" style={{ color: ACCENT }}>Join link</a></>}</div>
                    </div>
                  ))}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, marginBottom: 24 }}>
                    <input value={newSessionTitle} onChange={(e) => setNewSessionTitle(e.target.value)} placeholder="Session title"
                      style={{ flex: "1 1 140px", background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: 7, fontSize: 12 }} />
                    <input type="datetime-local" value={newSessionDate} onChange={(e) => setNewSessionDate(e.target.value)}
                      style={{ flex: "1 1 160px", background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: 7, fontSize: 12 }} />
                    <input value={newSessionUrl} onChange={(e) => setNewSessionUrl(e.target.value)} placeholder="Meeting URL (optional)"
                      style={{ flex: "1 1 160px", background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: 7, fontSize: 12 }} />
                    <button onClick={() => void addSession()} disabled={cohortBusy || !newSessionTitle.trim() || !newSessionDate} style={{ ...barGhost, opacity: cohortBusy || !newSessionTitle.trim() || !newSessionDate ? 0.6 : 1 }}>Add session</button>
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Announcements</div>
                  {selectedCohort.announcements.length === 0 && <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 10 }}>Nothing posted yet.</div>}
                  {[...selectedCohort.announcements].reverse().map((a) => (
                    <div key={a.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                      <div>{a.message}</div>
                      <div style={{ color: "var(--dim)", fontSize: 10 }}>{new Date(a.postedAt).toLocaleString()} · {a.postedBy}</div>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <input value={newAnnouncement} onChange={(e) => setNewAnnouncement(e.target.value)} placeholder="Post an announcement…"
                      style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 6, padding: 7, fontSize: 12 }} />
                    <button onClick={() => void postAnnouncement()} disabled={cohortBusy || !newAnnouncement.trim()} style={{ ...barGhost, opacity: cohortBusy || !newAnnouncement.trim() ? 0.6 : 1 }}>Post</button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : enrollment?.accessGranted === false ? (
          <div style={{ padding: 22, textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Programme access is paused</div>
            <div style={{ fontSize: 13, color: "var(--dim)" }}>Your coach has paused access to the programme for this workspace. Reach out to them to have it resumed.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            {summary && (
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", padding: "14px 22px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--dim)", fontWeight: 700, letterSpacing: 0.4 }}>PROGRAMME</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{summary.percentComplete}% complete</div>
                </div>
                {snapshot?.topGoal && (
                  <div>
                    <div style={{ fontSize: 10, color: "var(--dim)", fontWeight: 700, letterSpacing: 0.4 }}>CURRENT GOAL</div>
                    <div style={{ fontSize: 13 }}>{snapshot.topGoal.title}</div>
                  </div>
                )}
                {snapshot && snapshot.readinessLabel !== "no_data" && (
                  <div>
                    <div style={{ fontSize: 10, color: "var(--dim)", fontWeight: 700, letterSpacing: 0.4 }}>READINESS</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: (READINESS_COPY[snapshot.readinessLabel] ?? READINESS_COPY.no_data!).color }}>
                      {(READINESS_COPY[snapshot.readinessLabel] ?? READINESS_COPY.no_data!).text}{snapshot.readinessScore != null ? ` (${snapshot.readinessScore})` : ""}
                    </div>
                  </div>
                )}
                {snapshot && snapshot.overdueCount > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: "var(--dim)", fontWeight: 700, letterSpacing: 0.4 }}>OVERDUE</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{snapshot.overdueCount} item(s)</div>
                  </div>
                )}
                {summary.changesRequested.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: "var(--dim)", fontWeight: 700, letterSpacing: 0.4 }}>NEEDS YOUR ATTENTION</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{summary.changesRequested.length} lesson(s) — changes requested</div>
                  </div>
                )}
                {(() => {
                  const now = Date.now();
                  const upcoming = learnerCohorts
                    .flatMap((c) => c.sessions.map((s) => ({ cohort: c.name, session: s })))
                    .filter((x) => new Date(x.session.date).getTime() > now)
                    .sort((a, b) => a.session.date.localeCompare(b.session.date))[0];
                  if (!upcoming) return null;
                  return (
                    <div>
                      <div style={{ fontSize: 10, color: "var(--dim)", fontWeight: 700, letterSpacing: 0.4 }}>UPCOMING SESSION</div>
                      <div style={{ fontSize: 13 }}>
                        {upcoming.session.title} — {new Date(upcoming.session.date).toLocaleString()}
                        {upcoming.session.meetingUrl && <> · <a href={upcoming.session.meetingUrl} target="_blank" rel="noreferrer" style={{ color: ACCENT }}>Join</a></>}
                      </div>
                    </div>
                  );
                })()}
                {summary.currentLessonId && (
                  <button onClick={() => setSelectedLessonId(summary.currentLessonId)} style={{ ...barPrimary, marginLeft: "auto" }}>Continue programme →</button>
                )}
              </div>
            )}
            <div className="pc-split">
            <div className="pc-sidebar">
              {summary && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--dim)", marginBottom: 4 }}>
                    <span>Progress</span><span>{summary.completedLessons}/{summary.totalLessons} lessons</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "var(--surface2)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${summary.percentComplete}%`, background: ACCENT, borderRadius: 999 }} />
                  </div>
                </div>
              )}
              {offers.some((o) => o.active) && (
                <div style={{ marginBottom: 16, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 10, color: "var(--dim)", fontWeight: 700, marginBottom: 6 }}>WAYS TO WORK WITH US</div>
                  {offers.filter((o) => o.active).map((o) => (
                    <div key={o.id} style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{o.name} — <span style={{ fontWeight: 400, color: "var(--dim)" }}>{o.priceLabel}</span></div>
                      <div style={{ fontSize: 11, color: "var(--dim)" }}>{o.description}</div>
                    </div>
                  ))}
                </div>
              )}
              {programme?.stages.slice().sort((a, b) => a.order - b.order).map((stage) => (
                <div key={stage.id} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, letterSpacing: 0.4, color: "var(--dim)", fontWeight: 700, marginBottom: 4 }}>STAGE {stage.order} — {stage.title.toUpperCase()}</div>
                  {stage.lessons.length === 0 ? (
                    <div style={{ fontSize: 11, color: "var(--dim)", fontStyle: "italic", paddingLeft: 4 }}>Coming soon</div>
                  ) : (
                    [...stage.lessons].sort((a, b) => a.order - b.order).map((lesson) => {
                      const status: LessonStatus = lessonStatusById.get(lesson.id) ?? "locked";
                      const copy = STATUS_COPY[status];
                      const active = lesson.id === selectedLessonId;
                      return (
                        <button key={lesson.id} onClick={() => selectLesson(lesson, status)} disabled={status === "locked"}
                          style={{ display: "block", width: "100%", textAlign: "left", background: active ? "var(--accent-soft)" : "transparent", border: "none", borderRadius: 6, padding: "6px 8px", marginBottom: 2, cursor: status === "locked" ? "default" : "pointer", opacity: status === "locked" ? 0.55 : 1 }}>
                          <div style={{ fontSize: 12, color: active ? ACCENT : "var(--text)", fontWeight: active ? 700 : 400 }}>{lesson.title}</div>
                          <div style={{ fontSize: 10, color: copy.color }}>{copy.label}</div>
                        </button>
                      );
                    })
                  )}
                </div>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 22, minWidth: 0 }}>
              {!selectedLesson ? (
                <div style={{ fontSize: 13, color: "var(--dim)" }}>Select a lesson to begin.</div>
              ) : (
                <LessonGuide
                  key={selectedLesson.id}
                  lessonId={selectedLesson.id}
                  stageTitle={selectedStage?.title ?? ""}
                  stageState={stateOf(selectedStage?.id ?? "")}
                  moduleTitle={selectedLesson.title}
                  outcome={selectedLesson.outcome}
                  content={selectedLesson.content}
                  videoUrl={selectedLesson.videoUrl}
                  resourceUrls={selectedLesson.resourceUrls}
                  toolHref={selectedLesson.toolDeepLink ?? null}
                  assignment={selectedLesson.assignment ? {
                    title: selectedLesson.assignment.title,
                    instructions: selectedLesson.assignment.instructions,
                    evidencePrompt: selectedLesson.assignment.evidencePrompt,
                    checklist: selectedLesson.assignment.checklist,
                  } as LessonGuideAssignment : null}
                  numInStage={selectedNumInStage}
                  countInStage={selectedStageLessons.length}
                  // No prev/next: this modal's own sidebar (left) already
                  // switches lessons in place; LessonGuide's prev/next links
                  // navigate to a full /programme/lesson/:id page, which
                  // would leave the Studio modal instead of just advancing
                  // it — the sidebar is the correct nav for this embedding.
                  hideBack
                  onSubmitted={load}
                />
              )}
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
