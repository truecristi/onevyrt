import test from "node:test";
import assert from "node:assert/strict";
import {
  NAV_SECTIONS, ADMIN_SECTIONS, NAV_PAGES, isVisibleTo, visibleSections,
  matchSection, sectionHref, withWorkspaceParam, type UserRole,
} from "../lib/navigation/structure";
import { NAV_COMMANDS } from "../lib/nav-commands";

test("every NAV_COMMANDS entry maps onto a known NavSection — the type-level guarantee spec §2.3 asked for", () => {
  const sectionLabels = new Set(NAV_SECTIONS.map((s) => s.label));
  for (const c of NAV_COMMANDS) {
    assert.ok(c.section && sectionLabels.has(c.section), `${c.id}: section "${c.section}" doesn't match any NavSection label`);
  }
  // Nothing silently dropped while deriving NAV_PAGES from NAV_COMMANDS.
  assert.equal(NAV_PAGES.length, NAV_COMMANDS.length);
});

test("sections and admin sections are well-formed: unique ids, app-relative hrefs, a match that matches their own href", () => {
  const ids = new Set<string>();
  for (const s of [...NAV_SECTIONS, ...ADMIN_SECTIONS]) {
    assert.ok(!ids.has(s.id), `duplicate section id ${s.id}`);
    ids.add(s.id);
    assert.ok(s.href.startsWith("/"), `${s.id} href must be app-relative`);
    assert.ok(s.match(s.href), `${s.id}'s own href should satisfy its own match()`);
  }
});

test("the canonical five have mutually exclusive matches — exactly one section claims each of its own hrefs", () => {
  for (const s of NAV_SECTIONS) {
    const claimants = NAV_SECTIONS.filter((other) => other.match(s.href));
    assert.equal(claimants.length, 1, `${s.href} is claimed by [${claimants.map((c) => c.id).join(", ")}]`);
  }
});

test("Coaching is hidden from learners, visible to coach/admin — the RBAC example from spec §3.2", () => {
  const coaching = NAV_SECTIONS.find((s) => s.id === "coaching");
  assert.ok(coaching);
  assert.equal(isVisibleTo(coaching, "learner"), false);
  assert.equal(isVisibleTo(coaching, "coach"), true);
  assert.equal(isVisibleTo(coaching, "admin"), true);
  assert.ok(!visibleSections("learner").some((s) => s.id === "coaching"));
  assert.ok(visibleSections("coach").some((s) => s.id === "coaching"));
});

test("every other canonical section stays visible to every role", () => {
  for (const role of ["learner", "coach", "admin"] as UserRole[]) {
    const visible = new Set(visibleSections(role).map((s) => s.id));
    for (const s of NAV_SECTIONS) {
      if (s.id === "coaching") continue;
      assert.ok(visible.has(s.id), `${s.id} should be visible to ${role}`);
    }
  }
});

test("admin sections are hidden from learner and coach, visible to admin", () => {
  for (const s of ADMIN_SECTIONS) {
    assert.equal(isVisibleTo(s, "learner"), false, s.id);
    assert.equal(isVisibleTo(s, "coach"), false, s.id);
    assert.equal(isVisibleTo(s, "admin"), true, s.id);
  }
});

test("matchSection finds the right section for nested routes and the legacy pillar aliases", () => {
  assert.equal(matchSection("/business/reality")?.id, "business");
  assert.equal(matchSection("/psychology/golden")?.id, "programme"); // old pillar alias, spec §2.1.2
  assert.equal(matchSection("/numbers/break-even")?.id, "programme");
  assert.equal(matchSection("/admin/learners")?.id, "admin-learners");
  assert.equal(matchSection("/admin/curriculum")?.id, "admin-curriculum");
  assert.equal(matchSection("/nowhere-known"), null);
});

test("sectionHref falls back to the default href when no per-role override is set", () => {
  const home = NAV_SECTIONS.find((s) => s.id === "home");
  assert.ok(home);
  for (const role of ["learner", "coach", "admin"] as UserRole[]) {
    assert.equal(sectionHref(home, role), home.href);
  }
});

test("withWorkspaceParam preserves existing query/hash, overwrites a stale ws, and is a no-op with no workspace", () => {
  assert.equal(withWorkspaceParam("/business", null), "/business");
  assert.equal(withWorkspaceParam("/business", undefined), "/business");
  assert.equal(withWorkspaceParam("/business", ""), "/business");
  assert.equal(withWorkspaceParam("/business", "abc123"), "/business?ws=abc123");
  assert.equal(withWorkspaceParam("/studio?panel=account", "abc123"), "/studio?panel=account&ws=abc123");
  assert.equal(withWorkspaceParam("/business?ws=old", "new"), "/business?ws=new");
  assert.equal(withWorkspaceParam("/programme#top", "abc123"), "/programme?ws=abc123#top");
});
