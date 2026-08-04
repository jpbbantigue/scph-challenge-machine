// Vercel Serverless Function: GET /api/followers
// Private — the signed-in visitor's own follower list (handle + display
// name), for the "N followers" modal on Account > Profile. Never exposed
// for anyone else's account.

const { getSessionUser } = require("./_lib/session");
const { listFollowers } = require("./_lib/store");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = getSessionUser(req);
  if (!user) { res.status(401).json({ error: "Not signed in" }); return; }
  const followers = await listFollowers(user.provider + ":" + user.sub);
  res.status(200).json({ followers });
};
