import { NextResponse } from "next/server";
import { getCurrentUser, logout } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}

export async function DELETE() {
  await logout();
  return NextResponse.json({ ok: true });
}
