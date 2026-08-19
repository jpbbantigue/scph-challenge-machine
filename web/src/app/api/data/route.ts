// GET    /api/data -- returns the signed-in visitor's stored favorites/history/settings/stats
// PUT    /api/data -- replaces them with the given body: { favorites, history, settings, stats }
// DELETE /api/data -- permanently deletes the account (favorites, history, profile, results,
//                     follows -- everything) and clears the session cookie.
// Requires a valid session cookie (set by auth-callback after sign-in).

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, clearSessionCookie } from "@/lib/session";
import { loadUserData, saveUserData, deleteAccount } from "@/lib/store";

function unauthorized() {
  const res = NextResponse.json({ error: "Not signed in" }, { status: 401 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return unauthorized();
  const data = await loadUserData(user);
  const res = NextResponse.json(data);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function PUT(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return unauthorized();
  const body = await safeJson(req);
  const saved = await saveUserData(user, body);
  const res = NextResponse.json(saved);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function DELETE(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return unauthorized();
  await deleteAccount(user);
  const res = NextResponse.json({ ok: true });
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Set-Cookie", clearSessionCookie());
  return res;
}

async function safeJson(req: NextRequest): Promise<any> {
  try {
    return await req.json();
  } catch (e) {
    return {};
  }
}
