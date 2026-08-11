// POST /api/auth-logout
import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearSessionCookie());
  res.headers.set("Cache-Control", "no-store");
  return res;
}
