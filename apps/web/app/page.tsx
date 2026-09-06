import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

/**
 * Phase 9 first UI slice: replaces the Phase 0/1 static placeholder now
 * that there's somewhere real to send a visitor - an authenticated
 * session goes to the dashboard, everyone else to login. The root route
 * itself renders nothing; it only ever redirects.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
