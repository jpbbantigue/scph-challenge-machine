// Vercel Serverless Function:
// GET    /api/follow           — the signed-in visitor's own follower list (private, for the "N followers" modal)
// POST   /api/follow   { handle } — follow that user
// DELETE /api/follow?handle=xxx — unfollow that user
// All require sign-in. Follower counts/lists are private (see auth-me.js
// for the count) — this never exposes anyone else's followers.
//
// Merged with what used to be followers.js — Vercel's Hobby plan caps
// deployments at 12 serverless functions, so closely-related single-purpose
// endpoints get consolidated rather than kept as separate files.

const { getSessionUser } = require("./_lib/session");
const { followAccount, unfollowAccount, listFollowers } = require("./_lib/store");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = getSessionUser(req);
  if (!user) { res.status(401).json({ error: "Not signed in" }); return; }

  if (req.method === "GET") {
    const followers = await listFollowers(user.provider + ":" + user.sub);
    res.status(200).json({ followers });
    return;
  }

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
