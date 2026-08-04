// Vercel Serverless Function:
// GET  /api/data  — returns the signed-in visitor's stored favorites/history/settings/stats
// PUT  /api/data  — replaces them with the given body: { favorites, history, settings, stats }
// Requires a valid session cookie (set by auth-callback after sign-in).

const { getSessionUser } = require("./_lib/session");
const { loadUserData, saveUserData } = require("./_lib/store");

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

  res.status(405).json({ error: "Method not allowed" });
};

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}
