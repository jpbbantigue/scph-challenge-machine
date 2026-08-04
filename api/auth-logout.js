// Vercel Serverless Function: POST /api/auth-logout
const { clearSessionCookie } = require("./_lib/session");

module.exports = async (req, res) => {
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true });
};
