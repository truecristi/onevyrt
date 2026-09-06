import test, { after } from "node:test";
import assert from "node:assert/strict";
import { getAuthorProfile } from "../lib/community/authors";
import { publishTemplate, recordTemplateUse } from "../lib/studio/shared-templates";
import { publishCreative, recordCreativeUse } from "../lib/campaign/shared-creatives";
import { setProfileName } from "../lib/community/profile";
import { blankFunnelDoc } from "../lib/studio/funnel-builder";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const WS = uid("author-ws");
const EMPTY_WS = uid("author-ws-empty");

after(async () => {
  await pgPool().query("DELETE FROM shared_templates WHERE author_workspace_id = $1", [WS]);
  await pgPool().query("DELETE FROM shared_creatives WHERE author_workspace_id = $1", [WS]);
  await pgPool().query("DELETE FROM community_profiles WHERE workspace_id = ANY($1)", [[WS, EMPTY_WS]]);
});

test("an author profile aggregates their templates, creatives, and totals", async () => {
  await setProfileName(WS, "Growth Labs");
  const t = await publishTemplate(WS, { name: uid("Author funnel"), doc: blankFunnelDoc("auth-fn", "Author funnel"), authorName: "Growth Labs" });
  await recordTemplateUse(t.id); await recordTemplateUse(t.id); // 2 uses
  const c = await publishCreative(WS, { headline: uid("Author ad"), authorName: "Growth Labs" });
  await recordCreativeUse(c.id); // 1 use

  const p = await getAuthorProfile(WS);
  assert.equal(p.displayName, "Growth Labs");
  assert.equal(p.templates.length, 1);
  assert.equal(p.creatives.length, 1);
  assert.equal(p.totalShared, 2, "one template + one creative");
  assert.equal(p.totalUses, 3, "2 template uses + 1 creative use");
  assert.equal(p.templates[0]!.id, t.id);
  assert.equal(p.creatives[0]!.id, c.id);
});

test("an author who has shared nothing still resolves a name and zero totals", async () => {
  const p = await getAuthorProfile(EMPTY_WS);
  assert.ok(p.displayName, "always has a display name");
  assert.equal(p.totalShared, 0);
  assert.equal(p.totalUses, 0);
  assert.deepEqual(p.templates, []);
  assert.deepEqual(p.creatives, []);
});
