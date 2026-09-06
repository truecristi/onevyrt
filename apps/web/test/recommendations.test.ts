import test from "node:test";
import assert from "node:assert/strict";
import {
  rankRecommendations,
  topRecommendation,
  scoreRecommendation,
  fromProgrammeNextAction,
  fromJourneyNextStep,
  fromMomentumNextMove,
  fromReadinessGap,
  type Recommendation,
} from "../lib/recommendations";

const rec = (over: Partial<Recommendation>): Recommendation => ({
  id: "x", source: "readiness", title: "t", href: "/h", weight: 50, ...over,
});

test("money impact lifts a leak above an equally-urgent nudge", () => {
  const leak = rec({ id: "leak", source: "leak", weight: 50, impact: 20000 });
  const nudge = rec({ id: "nudge", source: "journey", weight: 50 });
  const ranked = rankRecommendations([nudge, leak]);
  assert.equal(ranked[0]?.id, "leak");
  assert.ok(scoreRecommendation(leak) > scoreRecommendation(nudge));
});

test("weight is the primary signal; higher weight wins regardless of source", () => {
  const readiness = rec({ id: "r", source: "readiness", weight: 65 });
  const journeyOnTrack = rec({ id: "j", source: "journey", weight: 70 });
  assert.equal(rankRecommendations([readiness, journeyOnTrack])[0]?.id, "j");
});

test("ties break by source rank (leak > momentum > journey > readiness > audience)", () => {
  const a = rec({ id: "aud", source: "audience", weight: 60 });
  const m = rec({ id: "mom", source: "momentum", weight: 60 });
  assert.equal(rankRecommendations([a, m])[0]?.id, "mom");
});

test("nullish entries are ignored so optional producers map straight in", () => {
  const ranked = rankRecommendations([null, rec({ id: "only" }), undefined]);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.id, "only");
});

test("topRecommendation returns null when there's nothing to do", () => {
  assert.equal(topRecommendation([null, undefined]), null);
});

test("adapter: an overdue journey step outranks the momentum pick and readiness gap", () => {
  const journey = fromJourneyNextStep({ title: "Pick up here", href: "/start" }, { overdueCount: 2 });
  const momentum = fromMomentumNextMove({ label: "Publish a funnel", href: "/business/funnels", why: "you have leads" });
  const gap = fromReadinessGap({ key: "offer", area: "Offer", label: "Sharpen your offer", href: "/psychology/offer", cta: "Build" });
  const top = topRecommendation([momentum, gap, journey]);
  assert.equal(top?.id, "journey:/start");
  assert.match(top?.why ?? "", /past their date/);
});

test("adapter: an on-track journey step defers to the momentum engine's pick", () => {
  const journey = fromJourneyNextStep({ title: "Next step", href: "/start" }, { overdueCount: 0 });
  const momentum = fromMomentumNextMove({ label: "Book a call", href: "/business/leads" });
  assert.equal(topRecommendation([journey, momentum])?.source, "momentum");
});

test("adapters return null on empty input", () => {
  assert.equal(fromJourneyNextStep(null), null);
  assert.equal(fromMomentumNextMove(undefined), null);
  assert.equal(fromMomentumNextMove({ label: "", href: "/x" }), null);
  assert.equal(fromReadinessGap(null), null);
  assert.equal(fromProgrammeNextAction(null), null);
});

test("adapter: the programme road leads — a new learner starts at the programme, not a mid-path tool", () => {
  // The exact gap the restructure fixes: a fresh learner used to be told "Write
  // your Message" (a momentum/journey pick) instead of the foundational work at
  // the start of the programme. The programme move must outrank both.
  const programme = fromProgrammeNextAction({
    currentStageId: "start", currentLessonId: "m-start-assessment", currentLessonTitle: "Personal & Business Assessment",
    overallPercent: 0, ctaLabel: "Start the programme", ctaHref: "/programme", done: false,
  });
  const momentum = fromMomentumNextMove({ label: "Write your Message", href: "/business/message", why: "start selling" });
  const journeyOverdue = fromJourneyNextStep({ title: "Write your Message", href: "/business/message" }, { overdueCount: 3 });
  const top = topRecommendation([momentum, journeyOverdue, programme]);
  assert.equal(top?.source, "programme");
  assert.equal(top?.title, "Personal & Business Assessment"); // the specific next module, as the headline
  assert.equal(top?.cta, "Start the programme");
  assert.equal(top?.href, "/programme");
});

test("adapter: a mid-programme learner keeps following the road (Continue Programme leads)", () => {
  const programme = fromProgrammeNextAction({
    currentStageId: "chapter-1", currentLessonId: "m-strategic-direction", currentLessonTitle: "Strategic Direction",
    overallPercent: 40, ctaLabel: "Continue Programme", ctaHref: "/programme", done: false,
  });
  const momentum = fromMomentumNextMove({ label: "Build a funnel", href: "/business/funnels" });
  const top = topRecommendation([programme, momentum]);
  assert.equal(top?.source, "programme");
  assert.equal(top?.title, "Strategic Direction");
});

test("adapter: a finished programme steps aside — the selling-machine moves lead, road points at the report", () => {
  const programme = fromProgrammeNextAction({
    currentStageId: null, currentLessonId: null, currentLessonTitle: null,
    overallPercent: 100, ctaLabel: "View your Transformation Report", ctaHref: "/programme", done: true,
  });
  assert.equal(programme?.title, "View your Transformation Report");
  const momentum = fromMomentumNextMove({ label: "Scale your winning ad", href: "/campaign-studio/creative" });
  // done → weight drops below momentum, so momentum leads once the road is complete.
  assert.equal(topRecommendation([programme, momentum])?.source, "momentum");
});

test("adapter: a paced-out learner (no lesson yet, not finished) yields no move", () => {
  // Waiting on the cohort — there is nothing to act on, so the other moves lead
  // rather than a dead "You're all caught up" CTA claiming the top slot.
  const programme = fromProgrammeNextAction({
    currentStageId: null, currentLessonId: null, currentLessonTitle: null,
    overallPercent: 20, ctaLabel: "You're all caught up", ctaHref: "/programme", done: false,
  });
  assert.equal(programme, null);
});
