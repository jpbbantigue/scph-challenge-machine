// Vercel Serverless Function: POST /api/generate
//
// Body: { categoryName: string, reels: [{ label: string, examples: string[] }, ...] }
// Returns: { results: [{ label, text }], creditsRemaining }  or  { error: string }
//
// Requires the GROQ_API_KEY environment variable to be set in the Vercel
// project's dashboard (Settings > Environment Variables). Get a free key
// at https://console.groq.com — the key never reaches the browser.
//
// Batched: one request covers every reel needed for a single "Pull" (or a
// single reroll, as a one-item batch), so the daily credit spend is 1 per
// pull rather than 1 per reel.
//
// This endpoint calls a site-wide key (this site's own cost), so it requires
// sign-in and is metered by a daily credit allowance per account (see
// _lib/store.js: consumeAICredit / DAILY_AI_CREDIT_LIMIT), backed by Neon
// Postgres. A visitor's own Claude/OpenAI key (openai-generate.js) is never
// metered — that's their own API cost, not the site's.

const { getSessionUser } = require("./_lib/session");
const { consumeAICredit } = require("./_lib/store");

const MODEL = "llama-3.1-8b-instant";
const MAX_FIELD_LEN = 60;
const MAX_REELS_PER_REQUEST = 8;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in to use this site's AI (free daily credits) — or add your own Claude/ChatGPT key in Settings instead." });
    return;
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  const categoryName = typeof body.categoryName === "string" ? body.categoryName.trim().slice(0, MAX_FIELD_LEN) : "";
  const reelsIn = Array.isArray(body.reels) ? body.reels.slice(0, MAX_REELS_PER_REQUEST) : [];
  if (!categoryName || !reelsIn.length) {
    res.status(400).json({ error: "Missing categoryName or reels" });
    return;
  }
  const reels = reelsIn.map((r) => ({
    label: typeof r.label === "string" ? r.label.trim().slice(0, MAX_FIELD_LEN) : "",
    examples: Array.isArray(r.examples) ? r.examples.slice(0, 5).map(String) : []
  })).filter((r) => r.label);
  if (!reels.length) {
    res.status(400).json({ error: "No valid reels in request" });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server is missing GROQ_API_KEY — set it in the Vercel project's environment variables." });
    return;
  }

  // One credit for the whole batch — this is what makes "1 pull = 1 credit"
  // true regardless of how many reels that pull touches.
  const credit = await consumeAICredit(user);
  if (!credit.ok) {
    res.status(429).json({ error: "Daily AI limit reached (" + credit.limit + "/day) — try again tomorrow, or add your own Claude/ChatGPT key in Settings." });
    return;
  }

  const results = await Promise.all(reels.map(async (r) => {
    const prompt = buildPrompt(categoryName, r.label, r.examples);
    try {
      const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + apiKey
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content: prompt }],
          temperature: 1.05,
          max_tokens: 60
        })
      });
      if (!upstream.ok) return { label: r.label, text: "" };
      const data = await upstream.json();
      const raw = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      return { label: r.label, text: sanitize(raw || "") };
    } catch (e) {
      return { label: r.label, text: "" };
    }
  }));

  res.status(200).json({ results: results, creditsRemaining: credit.remaining });
};

function buildPrompt(categoryName, label, examples) {
  const exampleText = examples.join("; ");
  return "You generate entries for a creative-prompt slot machine. Category: " + categoryName +
    " — reel: '" + label + "'. Examples already in use for this reel: " + exampleText +
    ". Give ONE brand-new entry for the '" + label + "' reel, 1-6 words, different from the examples," +
    " matching their tone, style, and length." +
    " This entry gets stitched together with other reels into" +
    " one sentence, so do not end it with a period or any other trailing punctuation." +
    " Reply with only the entry text — no quotes, no numbering, no explanation, no trailing punctuation.";
}

function sanitize(text) {
  let t = String(text).trim().split("\n")[0].trim();
  t = t.replace(/^["'“”\-\s\d.]+/, "").replace(/["'“”]+$/, "").trim();
  t = t.replace(/[.!?,;:]+$/, "").trim();
  if (!t || t.length > 140) return "";
  return t;
}

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}
