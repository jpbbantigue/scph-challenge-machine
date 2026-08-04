// Vercel Serverless Function: GET /api/auth-callback?provider=...&code=...&state=...
// Exchanges the code for a token, fetches the visitor's profile, and
// redirects home with a signed session cookie set.

const { getProvider, redirectUri } = require("./_lib/providers");
const { createSessionToken, sessionCookie, parseCookies } = require("./_lib/session");

module.exports = async (req, res) => {
  const q = req.query || {};
  const provider = q.provider;
  const cfg = provider && getProvider(provider);
  if (!cfg) { res.status(400).send("Unknown or unconfigured provider: " + provider); return; }
  if (!q.code) { res.status(400).send("Missing code"); return; }

  const cookies = parseCookies(req.headers && (req.headers.cookie || req.headers.Cookie));
  if (!q.state || !cookies.scph_oauth_state || q.state !== cookies.scph_oauth_state) {
    res.status(400).send("Invalid or expired sign-in attempt — please try again.");
    return;
  }

  const tokenParams = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code: q.code,
    redirect_uri: redirectUri(req, provider),
    grant_type: "authorization_code"
  });

  let tokenRes;
  try {
    tokenRes = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: tokenParams.toString()
    });
  } catch (e) {
    res.status(502).send("Couldn't reach " + provider);
    return;
  }
  if (!tokenRes.ok) {
    const detail = await safeText(tokenRes);
    res.status(502).send("Sign-in with " + provider + " failed: " + detail.slice(0, 300));
    return;
  }
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) { res.status(502).send("Sign-in with " + provider + " didn't return an access token"); return; }

  let profileRes;
  try {
    profileRes = await fetch(cfg.userInfoUrl, { headers: { Authorization: "Bearer " + accessToken } });
  } catch (e) {
    res.status(502).send("Couldn't fetch your " + provider + " profile");
    return;
  }
  if (!profileRes.ok) { res.status(502).send("Couldn't fetch your " + provider + " profile"); return; }
  const profile = await profileRes.json();
  const mapped = cfg.mapProfile(profile);
  if (!mapped.sub) { res.status(502).send("Provider profile was missing an id"); return; }

  const token = createSessionToken({ provider, sub: String(mapped.sub), name: mapped.name });

  res.setHeader("Set-Cookie", [
    sessionCookie(token),
    "scph_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
  ]);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Location", "/");
  res.status(302).end();
};

async function safeText(res) {
  try { return await res.text(); } catch (e) { return ""; }
}
