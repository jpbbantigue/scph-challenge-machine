// GET /api/profile?handle=xxx&category=music -- public read of a profile
//     (no auth needed; category filters the Results list). Profiles are
//     always public once a username exists -- no separate visibility toggle.
// PUT /api/profile -- signed-in visitor updates their own profile.
//     body can include any of:
//       { username: string }        -- write-once, only works if not already set
//       { displayName, bio, socials, linkedAccounts } -- editable profile fields

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { setUsername, updateProfileFields, getPublicProfileByHandle, loadUserData } from "@/lib/store";

export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("handle");
  if (!handle) {
    const res = NextResponse.json({ error: "Missing handle" }, { status: 400 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  const categoryId = req.nextUrl.searchParams.get("category");
  const viewerUser = getSessionUser(req); // optional -- only used for isFollowing
  const profile = await getPublicProfileByHandle(handle, { categoryId, viewerUser });
  const res = profile ? NextResponse.json(profile) : NextResponse.json({ error: "Profile not found" }, { status: 404 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function PUT(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) {
    const res = NextResponse.json({ error: "Not signed in" }, { status: 401 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  const body = await safeJson(req);

  if (typeof body.username === "string") {
    const result = await setUsername(user, body.username);
    if (!result.ok) {
      const res = NextResponse.json({ error: result.error }, { status: 400 });
      res.headers.set("Cache-Control", "no-store");
      return res;
    }
  }
  if (body.displayName !== undefined || body.bio !== undefined || body.socials !== undefined || body.linkedAccounts !== undefined) {
    await updateProfileFields(user, body);
  }
  const data = await loadUserData(user);
  const res = NextResponse.json({ profile: data.profile });
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
