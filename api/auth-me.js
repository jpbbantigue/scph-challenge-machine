// Vercel Serverless Function: GET /api/auth-me — returns
// { signedIn: false, tier: "anonymous", credits: {remaining, limit} } or
// { signedIn: true, provider, name, tier, credits: {remaining, limit}, profile, followerCount, linkedProviders }
// followerCount is private — only ever returned here, to the account owner,
// never on the public profile response (see profile.js).
//
// Anonymous callers get a credits/tier status too (tier:"anonymous"), same
// {remaining,limit} shape as signed-in accounts, so the client's "(N/day)"
// hint has something to read before any pull is attempted — not just from
// /api/generate's response after a pull. This is also where the anonymous
// tracking cookie gets issued on a visitor's first request, so it's
// already set by the time they hit "Use AI".
const { getSessionUser, parseCookies, ANON_COOKIE_NAME, newAnonId, anonIdCookie } = require("./_lib/session");
const { getProvider } = require("./_lib/providers");
const { getCreditsStatus, loadUserData, getFollowerCount, getLinkedProviders, getAnonCreditsStatus, ANON_CREDIT_LIMIT } = require("./_lib/store");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = getSessionUser(req);
  const providers = ["google", "discord", "facebook"].filter((p) => getProvider(p));
  if (!user) {
    const cookies = parseCookies(req.headers && (req.headers.cookie || req.headers.Cookie));
    let anonId = cookies[ANON_COOKIE_NAME];
    if (!anonId) {
      anonId = newAnonId();
      res.setHeader("Set-Cookie", anonIdCookie(anonId));
    }
    let credits = { remaining: ANON_CREDIT_LIMIT, limit: ANON_CREDIT_LIMIT };
    try {
      credits = await getAnonCreditsStatus(anonId);
    } catch (e) {
      // DB unavailable — fall back to "full allowance" rather than error,
      // same resilience principle as the reel-data fetch fallback.
    }
    res.status(200).json({ signedIn: false, providers, tier: "anonymous", credits });
    return;
  }
  const accountKey = user.accountKey || (user.provider + ":" + user.sub);
  const [credits, data, followerCount, linkedProviders] = await Promise.all([
    getCreditsStatus(user),
    loadUserData(user),
    getFollowerCount(accountKey),
    getLinkedProviders(user)
  ]);
  res.status(200).json({
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
};
