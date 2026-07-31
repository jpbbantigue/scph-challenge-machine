// Minimal HMAC-signed session token — no JWT library needed.
// Format: base64url(payload json) + "." + base64url(HMAC-SHA256(secret, payload json))

const crypto = require("crypto");

const COOKIE_NAME = "scph_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Server is missing SESSION_SECRET");
  return secret;
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}

// user: { provider, sub, name }
function createSessionToken(user) {
  const payload = JSON.stringify({ ...user, iat: Date.now(), exp: Date.now() + MAX_AGE_SECONDS * 1000 });
  const payloadPart = b64url(payload);
  const sig = crypto.createHmac("sha256", getSecret()).update(payloadPart).digest();
  return payloadPart + "." + b64url(sig);
}

function verifySessionToken(token) {
  if (!token || token.indexOf(".") === -1) return null;
  const [payloadPart, sigPart] = token.split(".");
  const expectedSig = b64url(crypto.createHmac("sha256", getSecret()).update(payloadPart).digest());
  const a = Buffer.from(sigPart);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(b64urlDecode(payloadPart).toString("utf8")); } catch (e) { return null; }
  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function getSessionUser(event) {
  const cookies = parseCookies(event.headers && (event.headers.cookie || event.headers.Cookie));
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifySessionToken(token);
}

function sessionCookie(token) {
  return COOKIE_NAME + "=" + token + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + MAX_AGE_SECONDS;
}

function clearSessionCookie() {
  return COOKIE_NAME + "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

module.exports = { createSessionToken, verifySessionToken, getSessionUser, sessionCookie, clearSessionCookie, parseCookies, b64url, b64urlDecode };
