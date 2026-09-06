/**
 * Instance admin gate. Admin-ness is NOT stored on the user record — it's an
 * allowlist of emails in the ADMIN_EMAILS env var (comma/space separated).
 * That keeps "who can see everyone's data" a deploy-time decision the operator
 * controls, out of the user store where a bug or a compromised account could
 * escalate it. No env var set = no admins = the admin surface is simply closed.
 */
import { currentUser, type User } from "./auth";

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email.trim().toLowerCase());
}

/** The signed-in user IF they are an admin, else null. Use at the top of every
 *  admin route — a non-admin (or logged-out) request is indistinguishable. */
export async function requireAdmin(cookieHeader: string | null): Promise<User | null> {
  const user = await currentUser(cookieHeader);
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}
