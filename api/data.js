// Vercel Serverless Function:
// GET    /api/data — returns the signed-in visitor's stored favorites/history/settings/stats
// PUT    /api/data — replaces them with the given body: { favorites, history, settings, stats }
// DELETE /api/data — permanently deletes the account (favorites, history, profile, results,
//                    follows — everything) and clears the session cookie.
// Requires a valid session cookie (set by auth-callback after sign-in).
//
// DELETE was merged in from what used to be delete-account.js — Vercel's
// Hobby plan caps deployments at 12 serverless functions, so this reuses
// the same account-scoped endpoint instead of a separate file.

const { getSessionUser, clearSessionCookie } = require("./_lib/session");
const { loadUserData, saveUserData, deleteAccount } = require("./_lib/store");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  if (req.method === "GET") {
    const data = await loadUserData(user);
    res.status(200).json(data);
    return;
  }

  if (req.method === "PUT") {
    const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
    const saved = await saveUserData(user, body);
    res.status(200).json(saved);
    return;
  }

  if (req.method === "DELETE") {
    await deleteAccount(user);
    res.setHeader("Set-Cookie", clearSessionCookie());
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}
