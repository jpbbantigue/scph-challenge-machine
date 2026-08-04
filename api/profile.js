// Vercel Serverless Function:
// GET /api/profile?handle=xxx — public read of a public profile (no auth needed)
// PUT /api/profile — signed-in visitor sets/clears their own handle + visibility
//   body: { handle: string|null, public: boolean }

const { getSessionUser } = require("./_lib/session");
const { setProfileHandle, getPublicProfileByHandle } = require("./_lib/store");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const handle = req.query && req.query.handle;
    if (!handle) { res.status(400).json({ error: "Missing handle" }); return; }
    const profile = await getPublicProfileByHandle(handle);
    if (!profile) { res.status(404).json({ error: "Profile not found or not public" }); return; }
    res.status(200).json(profile);
    return;
  }

  if (req.method === "PUT") {
    const user = getSessionUser(req);
    if (!user) { res.status(401).json({ error: "Not signed in" }); return; }
    const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
    const result = await setProfileHandle(user, body.handle, !!body.public);
    if (!result.ok) { res.status(400).json({ error: result.error }); return; }
    res.status(200).json({ profile: result.profile });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}
