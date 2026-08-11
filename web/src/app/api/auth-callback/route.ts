// GET /api/auth-callback?provider=...&code=...&state=...
// Exchanges the code for a token, fetches the visitor's profile, and either:
//   - links this identity to the visitor's already-signed-in account, or
//   - signs in normally, resolving the canonical accountKey and baking it
//     into the session.

import { NextRequest, NextResponse } from "next/server";
import { getProvider, redirectUri } from "@/lib/providers";
import { createSessionToken, sessionCookie, parseCookies, getSessionUser } from "@/lib/session";
import { resolveAccountKey, linkIdentity } from "@/lib/store";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const provider = q.get("provider") || "";
  const cfg = provider && getProvider(provider);
  if (!cfg) return new NextResponse("Unknown or unconfigured provider: " + provider, { status: 400 });
  const code = q.get("code");
  if (!code) return new NextResponse("Missing code", { status: 400 });

  const cookies = parseCookies(req.headers.get("cookie"));
  const stateParam = q.get("state");
  if (!stateParam || !cookies.scph_oauth_state || stateParam !== cookies.scph_oauth_state) {
    return new NextResponse("Invalid or expired sign-in attempt — please try again.", { status: 400 });
  }
  const isLinkFlow = cookies.scph_oauth_link === "1";
  const existingUser = isLinkFlow ? getSessionUser(req) : null; // read BEFORE we touch the session cookie

  const host = req.headers.get("host") || "";
  const tokenParams = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code,
    redirect_uri: redirectUri(host, provider),
    grant_type: "authorization_code"
  });

  let tokenRes: Response;
  try {
    tokenRes = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: tokenParams.toString()
    });
  } catch (e) {
    return new NextResponse("Couldn't reach " + provider, { status: 502 });
  }
  if (!tokenRes.ok) {
    const detail = await safeText(tokenRes);
    return new NextResponse("Sign-in with " + provider + " failed: " + detail.slice(0, 300), { status: 502 });
  }
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) return new NextResponse("Sign-in with " + provider + " didn't return an access token", { status: 502 });

  let profileRes: Response;
  try {
    profileRes = await fetch(cfg.userInfoUrl, { headers: { Authorization: "Bearer " + accessToken } });
  } catch (e) {
    return new NextResponse("Couldn't fetch your " + provider + " profile", { status: 502 });
  }
  if (!profileRes.ok) return new NextResponse("Couldn't fetch your " + provider + " profile", { status: 502 });
  const profile = await profileRes.json();
  const mapped = cfg.mapProfile(profile);
  if (!mapped.sub) return new NextResponse("Provider profile was missing an id", { status: 502 });

  const clearOauthCookies = [
    "scph_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    "scph_oauth_link=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
  ];

  // --- Linking flow: attach this identity to the already-signed-in account,
  // then send them back to Settings without touching their session cookie. ---
  if (isLinkFlow && existingUser) {
    const result = await linkIdentity(existingUser, provider, String(mapped.sub));
    const res = new NextResponse(null, { status: 302 });
    clearOauthCookies.forEach((c) => res.headers.append("Set-Cookie", c));
    res.headers.set("Cache-Control", "no-store");
    res.headers.set(
      "Location",
      result.ok ? "/account.html?linked=1#settings" : "/account.html?linkError=" + encodeURIComponent(result.error || "") + "#settings"
    );
    return res;
  }

  // --- Normal sign-in ---
  // Credit tier is decided once, here, at sign-in — not re-checked on every
  // request. Only Discord can be checked (via the "guilds" scope);
  // Google/Facebook sign-ins are always "basic".
  const tier = provider === "discord" ? await computeDiscordTier(accessToken) : "basic";
  const accountKey = await resolveAccountKey({ provider, sub: String(mapped.sub) });

  const token = createSessionToken({ provider, sub: String(mapped.sub), name: mapped.name, tier, accountKey });

  const res = new NextResponse(null, { status: 302 });
  res.headers.append("Set-Cookie", sessionCookie(token));
  clearOauthCookies.forEach((c) => res.headers.append("Set-Cookie", c));
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Location", "/");
  return res;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch (e) {
    return "";
  }
}

// Checks whether the visitor is a member of the Suno Creatives PH Discord
// server, for the 100/day credit tier. Fails safe to "basic" on any error.
async function computeDiscordTier(accessToken: string): Promise<string> {
  const scphGuildId = process.env.SCPH_GUILD_ID;
  if (!scphGuildId) return "basic";
  try {
    const res = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: "Bearer " + accessToken }
    });
    if (!res.ok) return "basic";
    const guilds = await res.json();
    const isMember = Array.isArray(guilds) && guilds.some((g: any) => g.id === scphGuildId);
    return isMember ? "scph" : "basic";
  } catch (e) {
    return "basic";
  }
}
