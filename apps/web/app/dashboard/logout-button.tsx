"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@onevyrt/design-system";
import { deleteWithCsrf } from "@/lib/browser-api";

/** Client island inside the otherwise-server-rendered dashboard page - logout has to run in the browser to make the CSRF-protected DELETE request. */
export function LogoutButton() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await deleteWithCsrf("/api/auth/session");
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <Button variant="secondary" onClick={handleLogout} disabled={loggingOut}>
      {loggingOut ? "Logging out..." : "Log out"}
    </Button>
  );
}
