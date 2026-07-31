// GET /api/auth-start?provider=google|discord|facebook
// Redirects the browser to the provider's consent screen.

const crypto = require("crypto");
const { getProvider, redirectUri } = require("./_lib/providers");

exports.handler = async (event) => {
  const provider = event.queryStringParameters && event.queryStringParameters.provider;
  const cfg = provider && getProvider(provider);
  if (!cfg) {
    return { statusCode: 400, body: "Unknown or unconfigured provider: " + provider };
  }

  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri(event, provider),
    response_type: "code",
    scope: cfg.scope,
    state,
    ...cfg.extraAuthorizeParams
  });

  return {
    statusCode: 302,
    headers: {
      Location: cfg.authorizeUrl + "?" + params.toString(),
      "Set-Cookie": "scph_oauth_state=" + state + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600",
      "Cache-Control": "no-store"
    },
    body: ""
  };
};
