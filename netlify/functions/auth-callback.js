// GET /api/auth-callback?provider=...&code=...&state=...
// Exchanges the code for a token, fetches the visitor's profile, and
// redirects home with a signed session cookie set.

const { getProvider, redirectUri } = require("./_lib/providers");
const { createSessionToken, sessionCookie, parseCookies } = require("./_lib/session");

exports.handler = async (event) => {
  const qs = event.queryStringParameters || {};
  const provider = qs.provider;
  const cfg = provider && getProvider(provider);
  if (!cfg) return { statusCode: 400, body: "Unknown or unconfigured provider: " + provider };
  if (!qs.code) return { statusCode: 400, body: "Missing code" };

  const cookies = parseCookies(event.headers && (event.headers.cookie || event.headers.Cookie));
  if (!qs.state || !cookies.scph_oauth_state || qs.state !== cookies.scph_oauth_state) {
    return { statusCode: 400, body: "Invalid or expired sign-in attempt — please try again." };
  }

  const tokenParams = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code: qs.code,
    redirect_uri: redirectUri(event, provider),
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
    return { statusCode: 502, body: "Couldn't reach " + provider };
  }
  if (!tokenRes.ok) {
    const detail = await safeText(tokenRes);
    return { statusCode: 502, body: "Sign-in with " + provider + " failed: " + detail.slice(0, 300) };
  }
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) return { statusCode: 502, body: "Sign-in with " + provider + " didn't return an access token" };

  let profileRes;
  try {
    profileRes = await fetch(cfg.userInfoUrl, { headers: { Authorization: "Bearer " + accessToken } });
  } catch (e) {
    return { statusCode: 502, body: "Couldn't fetch your " + provider + " profile" };
  }
  if (!profileRes.ok) return { statusCode: 502, body: "Couldn't fetch your " + provider + " profile" };
  const profile = await profileRes.json();
  const mapped = cfg.mapProfile(profile);
  if (!mapped.sub) return { statusCode: 502, body: "Provider profile was missing an id" };

  const token = createSessionToken({ provider, sub: String(mapped.sub), name: mapped.name });

  return {
    statusCode: 302,
    headers: { Location: "/" },
    multiValueHeaders: {
      "Set-Cookie": [
        sessionCookie(token),
        "scph_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
      ]
    },
    body: ""
  };
};

async function safeText(res) {
  try { return await res.text(); } catch (e) { return ""; }
}
