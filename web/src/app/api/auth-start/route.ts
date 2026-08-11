// GET /api/auth-start?provider=google|discord|facebook[&link=1]
// Redirects the browser to the provider's consent screen.
//
// ?link=1 (only honored if the visitor already has a valid session) starts
// an "account linking" flow instead of a normal sign-in — auth-callback
// checks for the extra cookie set below and, if present, links the new
// identity to the existing account instead of creating/switching sessions.

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getProvider, redirectUri } from "@/lib/providers";
import { getSessionUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider") || "";
  const cfg = provider && getProvider(provider);
  if (!cfg) {
    return new NextResponse("Unknown or unconfigured provider: " + provider, { status: 400 });
  }

  const wantsLink = req.nextUrl.searchParams.get("link") === "1";
  const isSignedIn = !!getSessionUser(req);

  const state = crypto.randomBytes(16).toString("hex");
  const host = req.headers.get("host") || "";
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri(host, provider),
    response_type: "code",
    scope: cfg.scope,
    state,
    ...cfg.extraAuthorizeParams
  });

  const cookies = ["scph_oauth_state=" + state + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600"];
  if (wantsLink && isSignedIn) {
    cookies.push("scph_oauth_link=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600");
  }

  const res = new NextResponse(null, { status: 302 });
  cookies.forEach((c) => res.headers.append("Set-Cookie", c));
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Location", cfg.authorizeUrl + "?" + params.toString());
  return res;
}
