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

  // Credit tier is decided once, here, at sign-in — not re-checked on every
  // request — so it stays fixed for the life of the session (up to 30 days).
  // Signing out and back in re-evaluates it. Only Discord can be checked
  // (via the "guilds" scope); Google/Facebook sign-ins are always "basic".
  const tier = provider === "discord" ? await computeDiscordTier(accessToken) : "basic";

  const token = createSessionToken({ provider, sub: String(mapped.sub), name: mapped.name, tier });

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

// Checks whether the visitor is a member of the Suno Creatives PH Discord
// server, for the 100/day credit tier. SCPH_GUILD_ID must be set as an env
// var (Discord: enable Developer Mode, right-click the server icon, Copy
// Server ID). Fails safe to "basic" on any error — a broken guild check
// should never block sign-in.
async function computeDiscordTier(accessToken) {
  const scphGuildId = process.env.SCPH_GUILD_ID;
  if (!scphGuildId) return "basic";
  try {
    const res = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: "Bearer " + accessToken }
    });
    if (!res.ok) return "basic";
    const guilds = await res.json();
    const isMember = Array.isArray(guilds) && guilds.some((g) => g.id === scphGuildId);
    return isMember ? "scph" : "basic";
  } catch (e) {
    return "basic";
  }
}
