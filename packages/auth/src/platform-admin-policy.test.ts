import { describe, expect, it } from "vitest";
import {
  canManageCurriculum,
  assertCanManageCurriculum,
  PlatformAdminRequiredError,
  type PlatformAdminStatus,
} from "./platform-admin-policy";

const admin: PlatformAdminStatus = { userId: "u1", isPlatformAdmin: true };
const nonAdmin: PlatformAdminStatus = { userId: "u2", isPlatformAdmin: false };

describe("platform admin policy", () => {
  it("only allows platform admins to manage curriculum", () => {
    expect(canManageCurriculum(admin)).toBe(true);
    expect(canManageCurriculum(nonAdmin)).toBe(false);
    expect(canManageCurriculum(null)).toBe(false);
  });

  it("assertCanManageCurriculum throws PlatformAdminRequiredError for non-admins", () => {
    expect(() => assertCanManageCurriculum(nonAdmin)).toThrow(PlatformAdminRequiredError);
    expect(() => assertCanManageCurriculum(null)).toThrow(PlatformAdminRequiredError);
  });

  it("assertCanManageCurriculum does not throw for a platform admin", () => {
    expect(() => assertCanManageCurriculum(admin)).not.toThrow();
  });
});
