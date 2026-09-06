import test from "node:test";
import assert from "node:assert/strict";
import { visibleSections, isVisibleTo, NAV_SECTIONS } from "../lib/navigation/structure";

test("coaching section has hiddenFor learner rule", () => {
  const coachingSection = NAV_SECTIONS.find((s) => s.label === "Coaching");
  assert.ok(coachingSection, "Coaching section exists");
  assert.ok(coachingSection?.hiddenFor?.includes("learner"), "Coaching section has hiddenFor learner");
});

test("isVisibleTo returns false for learner, true for coach/admin on Coaching", () => {
  const coachingSection = NAV_SECTIONS.find((s) => s.label === "Coaching")!;
  assert.equal(isVisibleTo(coachingSection, "learner"), false, "Learner should not see Coaching");
  assert.equal(isVisibleTo(coachingSection, "coach"), true, "Coach should see Coaching");
  assert.equal(isVisibleTo(coachingSection, "admin"), true, "Admin should see Coaching");
});

test("visibleSections filters out Coaching for learner", () => {
  const visible = visibleSections("learner");
  const labels = visible.map((s) => s.label);

  assert.ok(labels.includes("Home"), "Learner should see Home");
  assert.ok(labels.includes("Programme"), "Learner should see Programme");
  assert.ok(labels.includes("My Business"), "Learner should see My Business");
  assert.ok(!labels.includes("Coaching"), "Learner should NOT see Coaching");
  assert.ok(labels.includes("Resources"), "Learner should see Resources");
});

test("visibleSections includes all sections for coach", () => {
  const visible = visibleSections("coach");
  const labels = visible.map((s) => s.label);

  assert.ok(labels.includes("Home"), "Coach should see Home");
  assert.ok(labels.includes("Programme"), "Coach should see Programme");
  assert.ok(labels.includes("My Business"), "Coach should see My Business");
  assert.ok(labels.includes("Coaching"), "Coach SHOULD see Coaching");
  assert.ok(labels.includes("Resources"), "Coach should see Resources");
});

test("visibleSections includes all sections for admin", () => {
  const visible = visibleSections("admin");
  const labels = visible.map((s) => s.label);

  assert.ok(labels.includes("Home"), "Admin should see Home");
  assert.ok(labels.includes("Programme"), "Admin should see Programme");
  assert.ok(labels.includes("My Business"), "Admin should see My Business");
  assert.ok(labels.includes("Coaching"), "Admin SHOULD see Coaching");
  assert.ok(labels.includes("Resources"), "Admin should see Resources");
});

test("visibleSections maintains section order", () => {
  const learnerSections = visibleSections("learner");
  const coachSections = visibleSections("coach");

  // All learner sections should appear in the same order in coach sections
  const learnerLabels = learnerSections.map((s) => s.label);
  const coachLabels = coachSections.map((s) => s.label);

  let learnerIdx = 0;
  for (const label of coachLabels) {
    if (label === learnerLabels[learnerIdx]) {
      learnerIdx++;
    }
  }
  assert.equal(learnerIdx, learnerLabels.length, "Learner sections should maintain order in coach view");
});

test("sections without hiddenFor are visible to all roles", () => {
  const home = NAV_SECTIONS.find((s) => s.label === "Home")!;
  const programme = NAV_SECTIONS.find((s) => s.label === "Programme")!;

  // These sections should not have hiddenFor rules
  assert.equal(home.hiddenFor, undefined, "Home should not have hiddenFor rule");
  assert.equal(programme.hiddenFor, undefined, "Programme should not have hiddenFor rule");

  // And should be visible to all roles
  assert.equal(isVisibleTo(home, "learner"), true, "Home visible to learner");
  assert.equal(isVisibleTo(programme, "learner"), true, "Programme visible to learner");
});
