import { eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema } from "@onevyrt/database";
import { assertCanManagePlatformContent } from "@onevyrt/auth";

/** Looks up the actual row fresh from the DB - never trust a cached/client-supplied admin flag. */
export async function checkPlatformAdmin(db: Database, userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  return user?.isPlatformAdmin === true;
}

/**
 * The single chokepoint every curriculum- and formula-authoring use case
 * calls before writing platform-wide content (curriculum-use-cases.ts,
 * formula-use-cases.ts). Same shape as workspace-use-cases.ts's
 * requireWorkspaceMembership: check the actual row, then fail closed via
 * the pure policy function in @onevyrt/auth.
 */
export async function requirePlatformAdmin(db: Database, userId: string): Promise<void> {
  const isAdmin = await checkPlatformAdmin(db, userId);
  assertCanManagePlatformContent(isAdmin ? { userId, isPlatformAdmin: true } : null);
}
