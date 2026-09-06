import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";
import { pgPool } from "../lib/db";

/** Same collision-safe id pattern as test/helpers/pg.ts — these specs run
 *  against the same real shared Postgres instance. */
export function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${randomBytes(4).toString("hex")}`;
}

/** Registers a fresh account through the real UI (not an API shortcut) —
 *  this is itself part of what these specs are meant to prove works. Ends
 *  on whatever screen registration lands on (the Command Centre). */
export async function registerNewAccount(page: Page, emailPrefix: string): Promise<string> {
  const email = `${emailPrefix}@example.com`;
  await page.goto("/");
  await page.getByRole("button", { name: "Get started free" }).first().click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill("e2e-test-password-1");
  await page.getByRole("button", { name: "Create account" }).click();
  // Post-auth now routes to the canonical home (/command-center), not the
  // Studio's own home view. Wait for that navigation to settle so callers land
  // signed-in on the Command Centre.
  await page.waitForURL("**/command-center", { timeout: 15_000 });
  await page.getByRole("button", { name: "Account menu" }).waitFor({ timeout: 15_000 });
  return email;
}

/** Seeds one reachable contact (a qualified lead with an email) into the
 *  account's workspace, straight through Postgres — the deterministic way to
 *  give a broadcast someone to reach without driving the whole public-funnel
 *  submission flow. funnel_slug has no FK, so a synthetic one is fine. */
export async function seedLead(ownerEmail: string, contactEmail: string, name = "E2E Lead"): Promise<void> {
  const pool = pgPool();
  const u = await pool.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [ownerEmail]);
  const ownerId = u.rows[0]?.id;
  if (!ownerId) throw new Error(`seedLead: no user for ${ownerEmail}`);
  const w = await pool.query<{ id: string }>("SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1", [ownerId]);
  const wsId = w.rows[0]?.id;
  if (!wsId) throw new Error(`seedLead: no workspace for ${ownerEmail}`);
  await pool.query(
    `INSERT INTO leads (id, funnel_slug, workspace_id, status, score, name, email)
     VALUES ($1,$2,$3,'qualified',80,$4,$5)`,
    [uid("lead"), uid("e2e-funnel"), wsId, name, contactEmail],
  );
}

/** Seeds a lead with recorded answers against a specific funnel slug — so the
 *  drawer can compute a score reason from the funnel's rules. */
export async function seedLeadWithAnswers(ownerEmail: string, opts: { slug: string; email: string; name?: string; score?: number; answers: Record<string, unknown> }): Promise<void> {
  const pool = pgPool();
  const u = await pool.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [ownerEmail]);
  const ownerId = u.rows[0]?.id;
  if (!ownerId) throw new Error(`seedLeadWithAnswers: no user for ${ownerEmail}`);
  const w = await pool.query<{ id: string }>("SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1", [ownerId]);
  const wsId = w.rows[0]?.id;
  if (!wsId) throw new Error(`seedLeadWithAnswers: no workspace for ${ownerEmail}`);
  await pool.query(
    `INSERT INTO leads (id, funnel_slug, workspace_id, status, score, name, email, answers)
     VALUES ($1,$2,$3,'qualified',$4,$5,$6,$7)`,
    [uid("lead"), opts.slug, wsId, opts.score ?? 10, opts.name ?? "Scored Lead", opts.email, JSON.stringify(opts.answers)],
  );
}

/** Publishes a qualification funnel owned by the account's workspace, straight
 *  through Postgres — the deterministic way to give /q/[slug] a funnel to serve
 *  (e.g. one with a paid step) without driving the whole builder UI. Returns the
 *  slug. `doc` must be a valid FunnelDoc (it's compiled on read). */
export async function seedFunnel(ownerEmail: string, doc: Record<string, unknown>): Promise<string> {
  const pool = pgPool();
  const u = await pool.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [ownerEmail]);
  const ownerId = u.rows[0]?.id;
  if (!ownerId) throw new Error(`seedFunnel: no user for ${ownerEmail}`);
  const w = await pool.query<{ id: string }>("SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1", [ownerId]);
  const wsId = w.rows[0]?.id;
  if (!wsId) throw new Error(`seedFunnel: no workspace for ${ownerEmail}`);
  const slug = String(doc.slug);
  await pool.query(
    `INSERT INTO qual_funnels (slug, workspace_id, doc, published, updated_at)
     VALUES ($1,$2,$3,true, now())
     ON CONFLICT (slug) DO UPDATE SET doc = EXCLUDED.doc, published = true, updated_at = now()`,
    [slug, wsId, JSON.stringify(doc)],
  );
  return slug;
}

/** Suppress an address for a workspace + channel (as an unsubscribe would),
 *  so broadcast previews and sends exclude it. */
export async function seedOptOut(ownerEmail: string, address: string, channel: "email" | "sms" = "email"): Promise<void> {
  const pool = pgPool();
  const u = await pool.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [ownerEmail]);
  const ownerId = u.rows[0]?.id;
  if (!ownerId) throw new Error(`seedOptOut: no user for ${ownerEmail}`);
  const w = await pool.query<{ id: string }>("SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1", [ownerId]);
  const wsId = w.rows[0]?.id;
  if (!wsId) throw new Error(`seedOptOut: no workspace for ${ownerEmail}`);
  await pool.query(
    "INSERT INTO contact_optouts (workspace_id, channel, address) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
    [wsId, channel, address.toLowerCase()],
  );
}

/** Upgrades the account's personal workspace to a paid plan, straight through
 *  Postgres. Editing the canvas (adding blocks, the inspector's node editor) is
 *  gated behind a non-free plan, so a spec that needs to *edit* the model must
 *  seed one first — registration always lands on "free". */
export async function seedPlan(ownerEmail: string, plan: "pro" | "business" | "performance" = "pro"): Promise<void> {
  const pool = pgPool();
  const u = await pool.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [ownerEmail]);
  const ownerId = u.rows[0]?.id;
  if (!ownerId) throw new Error(`seedPlan: no user for ${ownerEmail}`);
  // The personal workspace is created lazily server-side (ensurePersonalWorkspace)
  // the first time the account touches a workspace-scoped page after registration,
  // so poll briefly rather than racing that commit.
  for (let i = 0; i < 20; i++) {
    const r = await pool.query("UPDATE workspaces SET plan = $2 WHERE owner_id = $1", [ownerId, plan]);
    if ((r.rowCount ?? 0) > 0) return;
    await new Promise((res) => setTimeout(res, 250));
  }
  throw new Error(`seedPlan: no workspace for ${ownerEmail} after waiting`);
}

/** Seeds a coach-approved Chapter 4 Growth & Improvement Plan for the
 *  account's workspace, straight through Postgres — the deterministic way to
 *  reach the one state (an "approved" plan owned by this user) that unlocks
 *  the real share-link UI on /programme/chapter-4/growth-plan (see
 *  GrowthImprovementPlan's canShare: role === "owner" && plan.status ===
 *  "approved"), without re-driving the whole 5-subchapter wizard plus a
 *  second coach account through the UI — chapter-4.spec.ts already covers
 *  that full gate-chain journey; this just needs the one downstream state it
 *  produces. Safe to shortcut via direct SQL here specifically because
 *  GET /api/programme/chapter/4/get reads chapter_4_submissions.status with
 *  no additional engine-gate check of its own (see that route). Same lazy
 *  workspace-creation wait as seedPlan. */
export async function seedApprovedGrowthPlan(ownerEmail: string): Promise<void> {
  const pool = pgPool();
  const u = await pool.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [ownerEmail]);
  const ownerId = u.rows[0]?.id;
  if (!ownerId) throw new Error(`seedApprovedGrowthPlan: no user for ${ownerEmail}`);
  let wsId: string | undefined;
  for (let i = 0; i < 20; i++) {
    const w = await pool.query<{ id: string }>("SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1", [ownerId]);
    wsId = w.rows[0]?.id;
    if (wsId) break;
    await new Promise((res) => setTimeout(res, 250));
  }
  if (!wsId) throw new Error(`seedApprovedGrowthPlan: no workspace for ${ownerEmail} after waiting`);
  const now = new Date().toISOString();
  const data = {
    currentPosition: { monthlyRevenue: 10000, grossMarginPct: 40, conversionRatePct: 12, avgCustomerValue: 500 },
    bottleneck: { area: "Lead follow-up speed", currentValue: 12, targetValue: 25, why: "Leads go cold after 24h with no SOP." },
    actions: [{ title: "24-hour follow-up SOP", expectedImpact: "+8% conversion" }],
    impact: { leadVolume: 100 },
    completedSubchapters: ["4.1", "4.2", "4.3", "4.4", "4.5"],
  };
  await pool.query(
    `INSERT INTO chapter_4_submissions
       (workspace_id, id, status, data, submitted_at, submitted_by, reviewed_at, reviewed_by, coach_decision, coach_feedback, updated_at)
     VALUES ($1,$2,'approved',$3,$4,$5,$4,$5,'approved',NULL, now())
     ON CONFLICT (workspace_id) DO UPDATE SET
       status = 'approved', data = EXCLUDED.data, coach_decision = 'approved',
       reviewed_at = EXCLUDED.reviewed_at, reviewed_by = EXCLUDED.reviewed_by, updated_at = now()`,
    [wsId, uid("c4sub"), JSON.stringify(data), now, ownerEmail],
  );
}

/** Gets a user's ID by email. Throws if not found. */
export async function userIdFor(email: string): Promise<string> {
  const pool = pgPool();
  const u = await pool.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
  if (!u.rows[0]) throw new Error(`no user for ${email}`);
  return u.rows[0].id;
}

/** Gets a workspace ID by owner email. Throws if the user doesn't exist (a
 *  real bug — registration writes that row synchronously), but polls
 *  briefly for the workspace itself: the personal workspace is created
 *  lazily server-side (ensurePersonalWorkspace) the first time the account
 *  touches a workspace-scoped page, and callers of this helper (e.g.
 *  critical-flows.spec.ts's tests 3/5) call it immediately after
 *  registerNewAccount() resolves — which only waits for client-side signals
 *  (the URL, the Account Menu button), neither of which is causally ordered
 *  after that server-side row actually committing. Same race, same fix
 *  shape as seedPlan()'s own poll loop just above. */
export async function workspaceIdFor(email: string): Promise<string> {
  const pool = pgPool();
  const u = await pool.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
  if (!u.rows[0]) throw new Error(`no user for ${email}`);
  for (let i = 0; i < 20; i++) {
    const w = await pool.query<{ id: string }>("SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1", [u.rows[0].id]);
    if (w.rows[0]) return w.rows[0].id;
    await new Promise((res) => setTimeout(res, 250));
  }
  throw new Error(`no workspace for ${email} after waiting`);
}

/** Logs in via API and returns the authenticated page. */
export async function loginViaAPI(page: Page, email: string, password: string = "e2e-test-password-1"): Promise<void> {
  const r = await page.request.post("/api/auth/login", { data: { email, password } });
  if (!r.ok()) throw new Error(`login failed for ${email}: ${r.status()}`);
}

/** Adds a coach to a workspace by making them a manager. */
export async function addCoachToWorkspace(wsId: string, coachUserId: string): Promise<void> {
  await pgPool().query(
    `UPDATE workspaces SET members = members || $1::jsonb WHERE id = $2`,
    [JSON.stringify([{ userId: coachUserId, role: "manager" }]), wsId],
  );
}

/** Deletes the account (and anything it owns) created by registerNewAccount. */
export async function cleanupAccount(email: string): Promise<void> {
  const pool = pgPool();
  const res = await pool.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
  const id = res.rows[0]?.id;
  if (!id) return;
  await pool.query("DELETE FROM sessions WHERE user_id = $1", [id]);
  await pool.query("DELETE FROM app_events WHERE user_id = $1", [id]);
  const ws = await pool.query<{ id: string }>("SELECT id FROM workspaces WHERE owner_id = $1", [id]);
  for (const w of ws.rows) {
    // Broadcast/segment/lead rows are workspace-scoped; clear them before the workspace.
    await pool.query("DELETE FROM broadcast_sends WHERE workspace_id = $1", [w.id]);
    await pool.query("DELETE FROM broadcasts WHERE workspace_id = $1", [w.id]);
    await pool.query("DELETE FROM contact_optouts WHERE workspace_id = $1", [w.id]);
    await pool.query("DELETE FROM segments WHERE workspace_id = $1", [w.id]);
    await pool.query("DELETE FROM lead_events WHERE workspace_id = $1", [w.id]);
    await pool.query("DELETE FROM leads WHERE workspace_id = $1", [w.id]);
    await pool.query("DELETE FROM qual_funnels WHERE workspace_id = $1", [w.id]);
    await pool.query("DELETE FROM projects WHERE scope_key = $1", [w.id]);
    await pool.query("DELETE FROM workspaces WHERE id = $1", [w.id]);
  }
  await pool.query("DELETE FROM users WHERE id = $1", [id]);
}
