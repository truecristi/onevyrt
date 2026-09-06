#!/usr/bin/env node
/**
 * Admin CLI to enable free-access mode for a workspace.
 * Usage: tsx scripts/admin-enable-free-access.ts <workspace-id-or-name>
 */
import { enableFreeAccessForWorkspace } from "../lib/admin/enable-free-access-util";

const query = process.argv[2];

if (!query) {
  console.error("Usage: tsx scripts/admin-enable-free-access.ts <workspace-id-or-name>");
  process.exit(1);
}

enableFreeAccessForWorkspace(query).then(() => {
  process.exit(0);
});
