// OAuth provider configs — same as the Netlify version
// (netlify/functions/_lib/providers.js), ported for Vercel's (req, res) style.
// Each provider needs a client id/secret set as env vars (see README's
// "Accounts" section for exact registration steps). The redirect URI must be
// registered with each provider exactly, per Vercel domain (production and
// any preview URLs you test against).

function redirectUri(req, provider) {
  const host = req.headers.host;
  return "https://" + host + "/api/auth-callback?provider=" + provider;
}

const PROVIDERS = {
  google: {
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "openid email profile",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    extraAuthorizeParams: { access_type: "online", prompt: "select_account" },
    mapProfile: (p) => ({ sub: p.sub, name: p.name || p.email || "Google user" })
  },
  discord: {
    clientIdEnv: "DISCORD_CLIENT_ID",
    clientSecretEnv: "DISCORD_CLIENT_SECRET",
    authorizeUrl: "https://discord.com/api/oauth2/authorize",
    scope: "identify email",
    tokenUrl: "https://discord.com/api/oauth2/token",
    userInfoUrl: "https://discord.com/api/users/@me",
    extraAuthorizeParams: {},
    mapProfile: (p) => ({ sub: p.id, name: p.username ? (p.discriminator && p.discriminator !== "0" ? p.username + "#" + p.discriminator : p.username) : "Discord user" })
  },
  facebook: {
    clientIdEnv: "FACEBOOK_CLIENT_ID",
    clientSecretEnv: "FACEBOOK_CLIENT_SECRET",
    authorizeUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    scope: "public_profile email",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    userInfoUrl: "https://graph.facebook.com/me?fields=id,name,email",
    extraAuthorizeParams: {},
    mapProfile: (p) => ({ sub: p.id, name: p.name || "Facebook user" })
  }
};

function getProvider(name) {
  const cfg = PROVIDERS[name];
  if (!cfg) return null;
  const clientId = process.env[cfg.clientIdEnv];
  const clientSecret = process.env[cfg.clientSecretEnv];
  if (!clientId || !clientSecret) return null;
  return { ...cfg, name, clientId, clientSecret };
}

module.exports = { PROVIDERS, getProvider, redirectUri };
