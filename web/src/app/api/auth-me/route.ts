// GET /api/auth-me — returns { signedIn: false } or
// { signedIn: true, provider, name, credits: {remaining, limit}, profile, followerCount, linkedProviders }
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getProvider } from "@/lib/providers";
import { getCreditsStatus, loadUserData, getFollowerCount, getLinkedProviders } from "@/lib/store";

export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  const providers = ["google", "discord", "facebook"].filter((p) => getProvider(p));
  if (!user) {
    const res = NextResponse.json({ signedIn: false, providers });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  const accountKey = user.accountKey || user.provider + ":" + user.sub;
  const [credits, data, followerCount, linkedProviders] = await Promise.all([
    getCreditsStatus(user),
    loadUserData(user),
    getFollowerCount(accountKey),
    getLinkedProviders(user)
  ]);
  const res = NextResponse.json({
    signedIn: true,
    provider: user.provider,
    name: user.name,
    tier: user.tier || "basic",
    providers,
    credits,
    profile: data.profile,
    followerCount,
    linkedProviders
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
