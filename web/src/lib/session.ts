// Minimal HMAC-signed session token — ported from api/_lib/session.js.
// Format: base64url(payload json) + "." + base64url(HMAC-SHA256(secret, payload json))

import crypto from "crypto";

export const COOKIE_NAME = "scph_session";
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface SessionUser {
  provider: string;
  sub: string;
  name: string;
  tier?: string;
  accountKey?: string;
  iat?: number;
  exp?: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Server is missing SESSION_SECRET");
  return secret;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf as any)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function b64urlDecode(str: string): Buffer {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}

// user: { provider, sub, name, ... }
export function createSessionToken(user: Omit<SessionUser, "iat" | "exp">): string {
  const payload = JSON.stringify({ ...user, iat: Date.now(), exp: Date.now() + MAX_AGE_SECONDS * 1000 });
  const payloadPart = b64url(payload);
  const sig = crypto.createHmac("sha256", getSecret()).update(payloadPart).digest();
  return payloadPart + "." + b64url(sig);
}

export function verifySessionToken(token: string | undefined | null): SessionUser | null {
  if (!token || token.indexOf(".") === -1) return null;
  const [payloadPart, sigPart] = token.split(".");
  const expectedSig = b64url(crypto.createHmac("sha256", getSecret()).update(payloadPart).digest());
  const a = Buffer.from(sigPart);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload: SessionUser;
  try {
    payload = JSON.parse(b64urlDecode(payloadPart).toString("utf8"));
  } catch (e) {
    return null;
  }
  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  (header || "").split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

// req: anything with a `headers` object/Headers exposing "cookie"
export function getSessionUser(req: { headers: Headers | Record<string, string | undefined> }): SessionUser | null {
  const cookieHeader =
    typeof (req.headers as Headers).get === "function"
      ? (req.headers as Headers).get("cookie")
      : (req.headers as Record<string, string | undefined>).cookie;
  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifySessionToken(token);
}

export function sessionCookie(token: string): string {
  return COOKIE_NAME + "=" + token + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + MAX_AGE_SECONDS;
}

export function clearSessionCookie(): string {
  return COOKIE_NAME + "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

// Anonymous-visitor tracking cookie — a bare random ID, not a signed
// session. Backs the "3 free-API pulls/day" anonymous credit tier (see
// lib/store.ts consumeAnonCredit/getAnonCreditsStatus): a per-IP backstop
// exists server-side too, but this cookie is what lets a returning visitor
// (same browser) keep a stable identity across days without an account.
export const ANON_COOKIE_NAME = "scph_anon";
const ANON_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export function newAnonId(): string {
  return crypto.randomUUID();
}

export function anonIdCookie(id: string): string {
  return ANON_COOKIE_NAME + "=" + id + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + ANON_COOKIE_MAX_AGE_SECONDS;
}
