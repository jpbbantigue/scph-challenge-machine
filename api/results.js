// Vercel Serverless Function:
// GET    /api/results        — signed-in visitor's own results (private list, Account > Results)
// POST   /api/results        — link a new result: { categoryId, rollType, promptText, resultUrl }
// DELETE /api/results?id=123 — remove one of the signed-in visitor's own results

const { getSessionUser } = require("./_lib/session");
const { addResult, listResults, removeResult } = require("./_lib/store");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = getSessionUser(req);
  if (!user) { res.status(401).json({ error: "Not signed in" }); return; }

  if (req.method === "GET") {
    const results = await listResults(user);
    res.status(200).json({ results });
    return;
  }

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
    if (!body.categoryId || !body.promptText) {
      res.status(400).json({ error: "Missing categoryId or promptText" });
      return;
    }
    const result = await addResult(user, body);
    res.status(200).json({ result });
    return;
  }

  if (req.method === "DELETE") {
    const id = req.query && Number(req.query.id);
    if (!id) { res.status(400).json({ error: "Missing id" }); return; }
    await removeResult(user, id);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}
