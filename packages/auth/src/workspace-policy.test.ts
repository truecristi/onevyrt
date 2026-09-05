import { describe, expect, it } from "vitest";
import {
  canReadWorkspace,
  canManageWorkspace,
  assertCanReadWorkspace,
  WorkspaceAccessDeniedError,
  type WorkspaceMembership,
} from "./workspace-policy";

const owner: WorkspaceMembership = { workspaceId: "w1", userId: "u1", role: "owner" };
const member: WorkspaceMembership = { workspaceId: "w1", userId: "u2", role: "member" };

describe("workspace policy", () => {
  it("allows owners and members to read", () => {
    expect(canReadWorkspace(owner)).toBe(true);
    expect(canReadWorkspace(member)).toBe(true);
  });

  it("denies reading with no membership", () => {
    expect(canReadWorkspace(null)).toBe(false);
  });

  it("only allows owners to manage", () => {
    expect(canManageWorkspace(owner)).toBe(true);
    expect(canManageWorkspace(member)).toBe(false);
    expect(canManageWorkspace(null)).toBe(false);
  });

  it("assertCanReadWorkspace throws WorkspaceAccessDeniedError for non-members", () => {
    expect(() => assertCanReadWorkspace(null, "w1")).toThrow(WorkspaceAccessDeniedError);
  });

  it("assertCanReadWorkspace does not throw for a member", () => {
    expect(() => assertCanReadWorkspace(member, "w1")).not.toThrow();
  });
});
