// GET /api/auth-me — returns { signedIn: false } or { signedIn: true, provider, name }
const { getSessionUser } = require("./_lib/session");
const { getProvider } = require("./_lib/providers");

exports.handler = async (event) => {
  const user = getSessionUser(event);
  const providers = ["google", "discord", "facebook"].filter((p) => getProvider(p));
  const body = user
    ? { signedIn: true, provider: user.provider, name: user.name, providers }
    : { signedIn: false, providers };
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
};
