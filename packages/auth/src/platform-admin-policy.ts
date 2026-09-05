/**
 * Central server-side authorization policy for platform-wide (not
 * workspace-scoped) actions - curriculum authoring, and now the Phase 4
 * formula library. Same shape as workspace-policy.ts: pure functions
 * only, no DB access, so they're trivial to unit-test and are the single
 * place this rule lives. Callers (packages/domain) load the actual user
 * row and pass its isPlatformAdmin flag in here.
 */

export interface PlatformAdminStatus {
  userId: string;
  isPlatformAdmin: boolean;
}

/** Only a platform admin may create, edit or publish platform-wide content (curriculum, formula definitions, ...). */
export function canManagePlatformContent(status: PlatformAdminStatus | null): boolean {
  return status?.isPlatformAdmin === true;
}

export class PlatformAdminRequiredError extends Error {
  constructor() {
    super("This action requires platform admin access");
    this.name = "PlatformAdminRequiredError";
  }
}

/** Throws rather than returning a boolean, for call sites that want to fail closed in one line. */
export function assertCanManagePlatformContent(
  status: PlatformAdminStatus | null,
): asserts status is PlatformAdminStatus {
  if (!canManagePlatformContent(status)) {
    throw new PlatformAdminRequiredError();
  }
}

/** @deprecated use canManagePlatformContent - kept as an alias so existing curriculum call sites read naturally. */
export const canManageCurriculum = canManagePlatformContent;

/** @deprecated use assertCanManagePlatformContent - kept as an alias so existing curriculum call sites read naturally. */
export const assertCanManageCurriculum = assertCanManagePlatformContent;
