// Vercel Serverless Function: GET /api/auth-start?provider=google|discord|facebook
// Redirects the browser to the provider's consent screen.

const crypto = require("crypto");
const { getProvider, redirectUri } = require("./_lib/providers");

module.exports = async (req, res) => {
  const provider = req.query && req.query.provider;
  const cfg = provider && getProvider(provider);
  if (!cfg) {
    res.status(400).send("Unknown or unconfigured provider: " + provider);
    return;
  }

  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri(req, provider),
    response_type: "code",
    scope: cfg.scope,
    state,
    ...cfg.extraAuthorizeParams
  });

  res.setHeader("Set-Cookie", "scph_oauth_state=" + state + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Location", cfg.authorizeUrl + "?" + params.toString());
  res.status(302).end();
};
