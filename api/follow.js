// Vercel Serverless Function:
// POST   /api/follow   { handle } — follow that user
// DELETE /api/follow?handle=xxx — unfollow that user
// Requires sign-in. Follower counts are private (see auth-me.js) — this
// endpoint only toggles the relationship, it doesn't expose any counts.

const { getSessionUser } = require("./_lib/session");
const { followAccount, unfollowAccount } = require("./_lib/store");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = getSessionUser(req);
  if (!user) { res.status(401).json({ error: "Not signed in" }); return; }

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
    if (!body.handle) { res.status(400).json({ error: "Missing handle" }); return; }
    const result = await followAccount(user, body.handle);
    if (!result.ok) { res.status(400).json({ error: result.error }); return; }
    res.status(200).json({ following: true });
    return;
  }

  if (req.method === "DELETE") {
    const handle = req.query && req.query.handle;
    if (!handle) { res.status(400).json({ error: "Missing handle" }); return; }
    const result = await unfollowAccount(user, handle);
    if (!result.ok) { res.status(400).json({ error: result.error }); return; }
    res.status(200).json({ following: false });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}
