// GET    /api/follow            -- the signed-in visitor's own follower list (private, for the "N followers" modal)
// POST   /api/follow   { handle } -- follow that user
// DELETE /api/follow?handle=xxx -- unfollow that user
// All require sign-in. Follower counts/lists are private (see auth-me for
// the count) -- this never exposes anyone else's followers.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { followAccount, unfollowAccount, listFollowers } from "@/lib/store";

function unauthorized() {
  const res = NextResponse.json({ error: "Not signed in" }, { status: 401 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return unauthorized();
  const accountKey = user.accountKey || user.provider + ":" + user.sub;
  const followers = await listFollowers(accountKey);
  const res = NextResponse.json({ followers });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return unauthorized();
  const body = await safeJson(req);
  if (!body.handle) {
    const res = NextResponse.json({ error: "Missing handle" }, { status: 400 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  const result = await followAccount(user, body.handle);
  if (!result.ok) {
    const res = NextResponse.json({ error: result.error }, { status: 400 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  const res = NextResponse.json({ following: true });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function DELETE(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return unauthorized();
  const handle = req.nextUrl.searchParams.get("handle");
  if (!handle) {
    const res = NextResponse.json({ error: "Missing handle" }, { status: 400 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  const result = await unfollowAccount(user, handle);
  if (!result.ok) {
    const res = NextResponse.json({ error: result.error }, { status: 400 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  const res = NextResponse.json({ following: false });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

async function safeJson(req: NextRequest): Promise<any> {
  try {
    return await req.json();
  } catch (e) {
    return {};
  }
}
