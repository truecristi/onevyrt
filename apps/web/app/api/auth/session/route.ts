import { NextResponse } from "next/server";
import { getCurrentUser, clearSessionCookie } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}

export async function DELETE() {
  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
