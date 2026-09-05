import { eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
  newSessionExpiry,
  isSessionExpired,
} from "@onevyrt/auth";
import { EmailAlreadyRegisteredError, InvalidCredentialsError } from "./errors";

export interface RegisterInput {
  email: string;
  password: string;
  workspaceName: string;
}

export interface RegisterResult {
  user: { id: string; email: string };
  workspace: { id: string; name: string };
  sessionToken: string;
}

/**
 * PRD-AUTH-001 + PRD-TENANCY-001 vertical slice: register creates the user,
 * their first workspace (as owner) and a session, atomically, and appends
 * audit records - the full consequential-command lifecycle from §37,
 * scoped to what this phase needs (no separate authorize step: anyone may
 * register).
 */
export async function registerUser(
  db: Database,
  authSecret: string,
  input: RegisterInput,
): Promise<RegisterResult> {
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, input.email),
  });
  if (existing) {
    throw new EmailAlreadyRegisteredError(input.email);
  }

  const passwordHash = await hashPassword(input.password);
  const sessionToken = generateSessionToken();
  const tokenHash = hashSessionToken(sessionToken, authSecret);
  const expiresAt = newSessionExpiry();

  const result = await withTransaction(db, async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({ email: input.email, passwordHash })
      .returning();
    if (!user) throw new Error("Failed to create user");

    const [workspace] = await tx
      .insert(schema.workspaces)
      .values({ name: input.workspaceName, ownerUserId: user.id })
      .returning();
    if (!workspace) throw new Error("Failed to create workspace");

    await tx
      .insert(schema.workspaceMembers)
      .values({ workspaceId: workspace.id, userId: user.id, role: "owner" });

    await tx.insert(schema.sessions).values({ userId: user.id, tokenHash, expiresAt });

    await tx.insert(schema.auditLog).values([
      { actorUserId: user.id, workspaceId: null, action: "user.registered", metadata: {} },
      {
        actorUserId: user.id,
        workspaceId: workspace.id,
        action: "workspace.created",
        metadata: { name: workspace.name },
      },
    ]);

    return { user, workspace };
  });

  return {
    user: { id: result.user.id, email: result.user.email },
    workspace: { id: result.workspace.id, name: result.workspace.name },
    sessionToken,
  };
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  user: { id: string; email: string };
  sessionToken: string;
}

// A fixed, valid-format hash to compare against when no user is found, so
// login takes roughly the same time whether or not the email exists.
const DUMMY_HASH_FOR_TIMING =
  "scrypt$32768$8$1$00000000000000000000000000000000$" + "0".repeat(128);

export async function loginUser(
  db: Database,
  authSecret: string,
  input: LoginInput,
): Promise<LoginResult> {
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, input.email) });

  const passwordIsValid = await verifyPassword(
    input.password,
    user?.passwordHash ?? DUMMY_HASH_FOR_TIMING,
  );

  if (!user || !passwordIsValid) {
    throw new InvalidCredentialsError();
  }

  const sessionToken = generateSessionToken();
  const tokenHash = hashSessionToken(sessionToken, authSecret);
  const expiresAt = newSessionExpiry();

  await db.insert(schema.sessions).values({ userId: user.id, tokenHash, expiresAt });
  await db
    .insert(schema.auditLog)
    .values({ actorUserId: user.id, workspaceId: null, action: "user.logged_in", metadata: {} });

  return { user: { id: user.id, email: user.email }, sessionToken };
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}

/** Resolves a raw session-cookie token to the authenticated user, or null if absent/expired. */
export async function verifySessionToken(
  db: Database,
  authSecret: string,
  token: string,
): Promise<AuthenticatedUser | null> {
  const tokenHash = hashSessionToken(token, authSecret);
  const session = await db.query.sessions.findFirst({
    where: eq(schema.sessions.tokenHash, tokenHash),
  });
  if (!session || isSessionExpired(session.expiresAt)) return null;

  const user = await db.query.users.findFirst({ where: eq(schema.users.id, session.userId) });
  if (!user) return null;

  return { id: user.id, email: user.email };
}
