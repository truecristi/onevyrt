import { NextResponse } from "next/server";
import { ensureCsrfCookie } from "@/lib/csrf";

/** Clients call this once to obtain the CSRF token before making a mutating request (register/login/create-workspace). */
export async function GET() {
  const csrfToken = ensureCsrfCookie();
  return NextResponse.json({ csrfToken });
}
