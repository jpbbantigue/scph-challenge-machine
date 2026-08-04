// Vercel Serverless Function: GET /api/auth-me — returns { signedIn: false } or
// { signedIn: true, provider, name, credits: {remaining, limit}, profile, followerCount, linkedProviders }
// followerCount is private — only ever returned here, to the account owner,
// never on the public profile response (see profile.js).
const { getSessionUser } = require("./_lib/session");
const { getProvider } = require("./_lib/providers");
const { getCreditsStatus, loadUserData, getFollowerCount, getLinkedProviders } = require("./_lib/store");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = getSessionUser(req);
  const providers = ["google", "discord", "facebook"].filter((p) => getProvider(p));
  if (!user) {
    res.status(200).json({ signedIn: false, providers });
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
    profile: data.profile,
    followerCount,
    linkedProviders
  });
};
