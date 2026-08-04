// Vercel Serverless Function: POST /api/delete-account
// Permanently deletes the signed-in visitor's account (favorites, history,
// profile, results, follows — everything). Clears the session cookie too,
// since there's nothing left to be signed into.

const { getSessionUser, clearSessionCookie } = require("./_lib/session");
const { deleteAccount } = require("./_lib/store");

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  const user = getSessionUser(req);
  if (!user) { res.status(401).json({ error: "Not signed in" }); return; }
  await deleteAccount(user);
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true });
};
