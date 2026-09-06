import test, { after } from "node:test";
import assert from "node:assert/strict";
import { resolveDisplayName, getProfileName, setProfileName } from "../lib/community/profile";
import { publishTemplate, listSharedTemplates } from "../lib/studio/shared-templates";
import { publishCreative, listSharedCreatives } from "../lib/campaign/shared-creatives";
import { blankFunnelDoc } from "../lib/studio/funnel-builder";
import { pgPool } from "../lib/db";
import { registerUser } from "../lib/auth";
import { ensurePersonalWorkspace } from "../lib/workspaces";
import { uid } from "./helpers/pg";

const email = `${uid("ident")}@example.test`;
let userId = "";
let wsId = "";

after(async () => {
  if (wsId) {
    await pgPool().query("DELETE FROM shared_templates WHERE author_workspace_id = $1", [wsId]);
    await pgPool().query("DELETE FROM shared_creatives WHERE author_workspace_id = $1", [wsId]);
    await pgPool().query("DELETE FROM community_profiles WHERE workspace_id = $1", [wsId]);
    await pgPool().query("DELETE FROM workspaces WHERE id = $1", [wsId]);
  }
  if (userId) await pgPool().query("DELETE FROM users WHERE id = $1", [userId]);
});

test("default display name is derived from the email handle", async () => {
  const user = await registerUser(email, "Sm0ke!pass123");
  userId = user.id;
  wsId = (await ensurePersonalWorkspace(userId)).id;

  assert.equal(await getProfileName(wsId), null, "no explicit name yet");
  const name = await resolveDisplayName(wsId);
  // email local-part starts with "ident" — capitalised, no domain leaked.
  assert.match(name, /^Ident/, `default derives from the handle (got "${name}")`);
  assert.ok(!name.includes("@"), "never leaks the full email");
});

test("setting and clearing the community name", async () => {
  const saved = await setProfileName(wsId, "  Growth Labs  ");
  assert.equal(saved, "Growth Labs", "trimmed and stored");
  assert.equal(await getProfileName(wsId), "Growth Labs");
  assert.equal(await resolveDisplayName(wsId), "Growth Labs");

  const cleared = await setProfileName(wsId, "   ");
  assert.equal(await getProfileName(wsId), null, "blank clears the custom name");
  assert.match(cleared, /^Ident/, "resolves back to the default");
});

test("publishing snapshots the author name onto the artifact", async () => {
  await setProfileName(wsId, "Growth Labs");
  const authorName = await resolveDisplayName(wsId);

  const t = await publishTemplate(wsId, { name: uid("Ident funnel"), doc: blankFunnelDoc("id-fn", "Ident funnel"), authorName });
  assert.equal(t.authorName, "Growth Labs");
  const listedT = (await listSharedTemplates()).find((x) => x.id === t.id)!;
  assert.equal(listedT.authorName, "Growth Labs", "the gallery carries the credit");

  const c = await publishCreative(wsId, { headline: uid("Ident ad"), authorName });
  assert.equal(c.authorName, "Growth Labs");
  const listedC = (await listSharedCreatives()).find((x) => x.id === c.id)!;
  assert.equal(listedC.authorName, "Growth Labs");

  // The snapshot survives a later name change.
  await setProfileName(wsId, "Renamed Co");
  const stillOld = (await listSharedTemplates()).find((x) => x.id === t.id)!;
  assert.equal(stillOld.authorName, "Growth Labs", "credit is snapshotted, not re-resolved");
});
