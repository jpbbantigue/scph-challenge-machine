// Vercel Serverless Function: GET /api/reel-data?category=music
// Returns { genres: string[], moods: string[], subjects: string[], twists: string[] }
// — public, no auth required. Music-only for now (per scope); other
// category values currently just return empty arrays, letting the client
// fall back to its hardcoded lists the same way a failed fetch would.
//
// genres is flattened (both parent and child genre names, no hierarchy —
// the client just needs a flat pool to pick Genre 1 / Genre 2 from).
//
// Note: the quarterly-cron auto-recrawl (POST variant of this endpoint,
// re-running the Wikipedia crawl+seed on a schedule) is explicitly a
// follow-up piece, not built here — see scripts/crawl-genres.mjs /
// seed-genres.mjs for the one-time manual crawl this data currently comes
// from.

const { getSql } = require("./_lib/db");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");

  const category = (req.query && req.query.category) || "music";
  if (category !== "music") {
    res.status(200).json({ genres: [], moods: [], subjects: [], twists: [] });
    return;
  }

  try {
    const sql = getSql();
    const [genreRows, moodRows, subjectRows, twistRows] = await Promise.all([
      sql`SELECT name FROM genres ORDER BY name`,
      sql`SELECT text FROM moods WHERE category_id = 'music' AND active = true ORDER BY id`,
      sql`SELECT text FROM subjects WHERE category_id = 'music' AND active = true ORDER BY id`,
      sql`SELECT text FROM twists WHERE category_id = 'music' AND active = true ORDER BY id`
    ]);
    res.status(200).json({
      genres: genreRows.map((r) => r.name),
      moods: moodRows.map((r) => r.text),
      subjects: subjectRows.map((r) => r.text),
      twists: twistRows.map((r) => r.text)
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to load reel data", genres: [], moods: [], subjects: [], twists: [] });
  }
};
