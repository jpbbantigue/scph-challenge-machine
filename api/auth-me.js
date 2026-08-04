// Vercel Serverless Function: GET /api/auth-me — returns { signedIn: false } or
// { signedIn: true, provider, name, credits: {remaining, limit}, profile: {handle, public} }
const { getSessionUser } = require("./_lib/session");
const { getProvider } = require("./_lib/providers");
const { getCreditsStatus, loadUserData } = require("./_lib/store");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = getSessionUser(req);
  const providers = ["google", "discord", "facebook"].filter((p) => getProvider(p));
  if (!user) {
    res.status(200).json({ signedIn: false, providers });
    return;
  }
  const [credits, data] = await Promise.all([getCreditsStatus(user), loadUserData(user)]);
  res.status(200).json({ signedIn: true, provider: user.provider, name: user.name, providers, credits: credits, profile: data.profile });
};
