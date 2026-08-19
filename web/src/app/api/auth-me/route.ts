// GET /api/auth-me -- returns
// { signedIn: false, tier: "anonymous", credits: {remaining, limit} } or
// { signedIn: true, provider, name, tier, credits, tokensUsed, profile, followerCount, linkedProviders }
//
// Anonymous callers get a credits/tier status too (tier:"anonymous"), same
// {remaining,limit} shape as signed-in accounts, so the client's "(N/day)"
// hint has something to read before any pull is attempted. This is also
// where the anonymous tracking cookie gets issued on a visitor's first
// request, so it's already set by the time they hit "Use AI".
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, parseCookies, ANON_COOKIE_NAME, newAnonId, anonIdCookie } from "@/lib/session";
import { getProvider } from "@/lib/providers";
import { getCreditsStatus, loadUserData, getFollowerCount, getLinkedProviders, getAnonCreditsStatus, ANON_CREDIT_LIMIT } from "@/lib/store";

export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  const providers = ["google", "discord", "facebook"].filter((p) => getProvider(p));
  if (!user) {
    const cookies = parseCookies(req.headers.get("cookie"));
    let anonId = cookies[ANON_COOKIE_NAME];
    let setCookie: string | null = null;
    if (!anonId) {
      anonId = newAnonId();
      setCookie = anonIdCookie(anonId);
    }
    let credits = { remaining: ANON_CREDIT_LIMIT, limit: ANON_CREDIT_LIMIT };
    try {
      credits = await getAnonCreditsStatus(anonId);
    } catch (e) {
      // DB unavailable -- fall back to "full allowance" rather than error,
      // same resilience principle as the reel-data fetch fallback.
    }
    const res = NextResponse.json({ signedIn: false, providers, tier: "anonymous", credits });
    res.headers.set("Cache-Control", "no-store");
    if (setCookie) res.headers.append("Set-Cookie", setCookie);
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
    tokensUsed: data.tokensUsed,
    profile: data.profile,
    followerCount,
    linkedProviders
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
