// Vercel Serverless Function: GET /api/auth-start?provider=google|discord|facebook[&link=1]
// Redirects the browser to the provider's consent screen.
//
// ?link=1 (only honored if the visitor already has a valid session) starts
// an "account linking" flow instead of a normal sign-in — auth-callback.js
// checks for the extra cookie set below and, if present, links the new
// identity to the existing account instead of creating/switching sessions.
// See _lib/store.js: linkIdentity.

const crypto = require("crypto");
const { getProvider, redirectUri } = require("./_lib/providers");
const { getSessionUser } = require("./_lib/session");

module.exports = async (req, res) => {
  const provider = req.query && req.query.provider;
  const cfg = provider && getProvider(provider);
  if (!cfg) {
    res.status(400).send("Unknown or unconfigured provider: " + provider);
    return;
  }

  const wantsLink = req.query && req.query.link === "1";
  const isSignedIn = !!getSessionUser(req);

  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri(req, provider),
    response_type: "code",
    scope: cfg.scope,
    state,
    ...cfg.extraAuthorizeParams
  });

  const cookies = ["scph_oauth_state=" + state + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600"];
  if (wantsLink && isSignedIn) {
    cookies.push("scph_oauth_link=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600");
  }

  res.setHeader("Set-Cookie", cookies);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Location", cfg.authorizeUrl + "?" + params.toString());
  res.status(302).end();
};
