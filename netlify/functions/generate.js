// Netlify Function: POST /.netlify/functions/generate
// (reachable at /api/generate via the redirect in netlify.toml)
//
// Body: { categoryName: string, reels: [{ label: string, examples: string[] }, ...] }
// Returns: { results: [{ label, text }], creditsRemaining }  or  { error: string }
//
// Batched by design: one request covers every reel needed for a single
// "Pull" (or a single reroll, as a one-item batch), so the daily credit
// spend is 1 per pull rather than 1 per reel regardless of how many reels
// that category has active.
//
// Requires the GROQ_API_KEY environment variable to be set in the Netlify
// site's dashboard (Site settings > Environment variables). Get a free key
// at https://console.groq.com — the key never reaches the browser.
//
// This endpoint calls a site-wide key (this site's own cost), so unlike the
// BYOK relay it requires sign-in and is metered by a daily credit allowance
// per account (see _lib/store.js: consumeAICredit / DAILY_AI_CREDIT_LIMIT).
// A visitor's own Claude/OpenAI key is never metered — that's their cost,
// not the site's.

const { getSessionUser } = require("./_lib/session");
const { consumeAICredit } = require("./_lib/store");

const MODEL = "llama-3.1-8b-instant";
const MAX_FIELD_LEN = 60;
const MAX_REELS_PER_REQUEST = 8;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const user = getSessionUser(event);
  if (!user) {
    return json(401, { error: "Sign in to use this site's AI (free daily credits) — or add your own Claude/ChatGPT key in Settings instead." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { error: "Invalid JSON body" });
  }

  const categoryName = typeof body.categoryName === "string" ? body.categoryName.trim().slice(0, MAX_FIELD_LEN) : "";
  const reelsIn = Array.isArray(body.reels) ? body.reels.slice(0, MAX_REELS_PER_REQUEST) : [];
  if (!categoryName || !reelsIn.length) {
    return json(400, { error: "Missing categoryName or reels" });
  }
  const reels = reelsIn.map((r) => ({
    label: typeof r.label === "string" ? r.label.trim().slice(0, MAX_FIELD_LEN) : "",
    examples: Array.isArray(r.examples) ? r.examples.slice(0, 5).map(String) : []
  })).filter((r) => r.label);
  if (!reels.length) {
    return json(400, { error: "No valid reels in request" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return json(500, { error: "Server is missing GROQ_API_KEY — set it in the Netlify site's environment variables." });
  }

  // One credit for the whole batch — this is what makes "1 pull = 1 credit"
  // true regardless of how many reels that pull touches.
  const credit = await consumeAICredit(user);
  if (!credit.ok) {
    return json(429, { error: "Daily AI limit reached (" + credit.limit + "/day) — try again tomorrow, or add your own Claude/ChatGPT key in Settings." });
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

  return json(200, { results: results, creditsRemaining: credit.remaining });
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

function json(statusCode, obj) {
  return {
    statusCode: statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj)
  };
}
