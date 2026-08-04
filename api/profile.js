// Vercel Serverless Function:
// GET /api/profile?handle=xxx&category=music — public read of a profile
//     (no auth needed; category filters the Results list). Profiles are
//     always public once a username exists — no separate visibility toggle.
// PUT /api/profile — signed-in visitor updates their own profile.
//     body can include any of:
//       { username: string }        — write-once, only works if not already set
//       { displayName, bio, socials, linkedAccounts } — editable profile fields

const { getSessionUser } = require("./_lib/session");
const { setUsername, updateProfileFields, getPublicProfileByHandle, loadUserData } = require("./_lib/store");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const handle = req.query && req.query.handle;
    if (!handle) { res.status(400).json({ error: "Missing handle" }); return; }
    const categoryId = (req.query && req.query.category) || null;
    const viewerUser = getSessionUser(req); // optional — only used for isFollowing
    const profile = await getPublicProfileByHandle(handle, { categoryId, viewerUser });
    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
    res.status(200).json(profile);
    return;
  }

  if (req.method === "PUT") {
    const user = getSessionUser(req);
    if (!user) { res.status(401).json({ error: "Not signed in" }); return; }
    const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});

    if (typeof body.username === "string") {
      const result = await setUsername(user, body.username);
      if (!result.ok) { res.status(400).json({ error: result.error }); return; }
    }
    if (body.displayName !== undefined || body.bio !== undefined || body.socials !== undefined || body.linkedAccounts !== undefined) {
      await updateProfileFields(user, body);
    }
    const data = await loadUserData(user);
    res.status(200).json({ profile: data.profile });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}
