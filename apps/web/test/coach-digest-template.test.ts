import test from "node:test";
import assert from "node:assert/strict";
import { renderCoachDigest, recommendedActionFor, type CoachDigestLearnerRow } from "../lib/email/coach-digest-template";

function row(over: Partial<CoachDigestLearnerRow> = {}): CoachDigestLearnerRow {
  return {
    learnerName: "learner@example.com",
    workspaceName: "Acme Co",
    daysSinceActivity: 30,
    status: "dormant",
    recommendedAction: recommendedActionFor("dormant"),
    ...over,
  };
}

test("renderCoachDigest: returns null when nobody is quiet (no empty emails)", () => {
  assert.equal(renderCoachDigest({ learners: [] }), null);
});

test("renderCoachDigest: singular subject/greeting for a lone learner", () => {
  const d = renderCoachDigest({ learners: [row()] });
  assert.ok(d);
  assert.equal(d.subject, "1 learner has gone quiet");
  assert.match(d.text, /^Hi there,/);
  assert.match(d.text, /1 learner needs a nudge/);
});

test("renderCoachDigest: plural subject for several learners", () => {
  const d = renderCoachDigest({
    learners: [row({ workspaceName: "Acme" }), row({ workspaceName: "Globex", status: "idle", daysSinceActivity: 9 })],
  });
  assert.ok(d);
  assert.equal(d.subject, "2 learners have gone quiet");
  assert.match(d.text, /2 learners need a nudge/);
});

test("renderCoachDigest: groups by status in urgency order and escapes HTML", () => {
  const d = renderCoachDigest({
    learners: [
      row({ workspaceName: "<script>alert(1)</script>", status: "dormant" }),
      row({ workspaceName: "Idle Co", status: "idle", daysSinceActivity: 9 }),
      row({ workspaceName: "Fresh Co", status: "never_started", daysSinceActivity: null }),
    ],
  });
  assert.ok(d);
  assert.match(d.text, /Gone quiet:/);
  assert.match(d.text, /Idle:/);
  assert.match(d.text, /Not started:/);
  // Text keeps the raw workspace name...
  assert.match(d.text, /<script>alert\(1\)<\/script>/);
  // ...but the HTML escapes it rather than passing it through as markup.
  assert.doesNotMatch(d.html, /<script>alert\(1\)<\/script>/);
  assert.match(d.html, /&lt;script&gt;/);
  assert.match(d.html, /No activity recorded/); // null daysSinceActivity renders honestly, not as "null" or "NaN"
});

test("renderCoachDigest: honors greeting, coachName, footer, and consoleUrl overrides", () => {
  const d = renderCoachDigest({
    learners: [row()],
    coachName: "Priya",
    footer: "Custom footer.",
    consoleUrl: "https://example.com/coach/roster",
  });
  assert.ok(d);
  assert.match(d.text, /^Hi Priya,/);
  assert.match(d.text, /Custom footer\./);
  assert.match(d.text, /https:\/\/example\.com\/coach\/roster/);
  assert.match(d.html, /Open your console/);

  const overridden = renderCoachDigest({ learners: [row()], coachName: "Priya", greeting: "Morning, P!" });
  assert.ok(overridden);
  assert.match(overridden.text, /^Morning, P!/);
});

test("recommendedActionFor: every quiet status maps to non-empty guidance", () => {
  for (const status of ["never_started", "idle", "dormant"] as const) {
    assert.ok(recommendedActionFor(status).length > 0);
  }
});
