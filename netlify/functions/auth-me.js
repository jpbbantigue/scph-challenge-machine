// GET /api/auth-me — returns { signedIn: false } or
// { signedIn: true, provider, name, credits: {remaining, limit}, profile: {handle, public} }
const { getSessionUser } = require("./_lib/session");
const { getProvider } = require("./_lib/providers");
const { getCreditsStatus, loadUserData } = require("./_lib/store");

exports.handler = async (event) => {
  const user = getSessionUser(event);
  const providers = ["google", "discord", "facebook"].filter((p) => getProvider(p));
  if (!user) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ signedIn: false, providers })
    };
  }
  const [credits, data] = await Promise.all([getCreditsStatus(user), loadUserData(user)]);
  const body = { signedIn: true, provider: user.provider, name: user.name, providers, credits: credits, profile: data.profile };
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body)
  };
};
