// Vercel Serverless Function: POST /api/openai-generate
//
// This is the "bring your own OpenAI key" relay. OpenAI's API doesn't allow
// direct browser calls (no CORS), so the visitor's own key has to pass
// through a server for one request. This function does NOT read any
// environment variable and does NOT log or persist the key anywhere — it
// takes the key from the request body, uses it for exactly one upstream
// call, and forgets it when the function returns.
//
// Body: { apiKey: string, model?: string, categoryName: string, label: string, examples: string[] }
// Returns: { text: string }  or  { error: string }
//
// Generic by design — see generate.js for why.

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_FIELD_LEN = 60;

// See generate.js — the Music category's "Twist" reel needs to stay a
// lyric/vocal-delivery constraint the person can actually pull off, not a
// precise audio-production or music-theory instruction AI music generators
// like Suno rarely execute without many regenerations.
const TWIST_FEASIBILITY_NOTE =
  " This entry must be a LYRIC-WRITING or VOCAL-DELIVERY constraint the person can" +
  " satisfy just by how they write the words or sing them (structure, POV, repetition," +
  " whispering, spoken word, a cappella, duet, etc.) — NOT a precise audio-production or" +
  " music-theory instruction (avoid exact chord counts, time-signature or key changes," +
  " mixing/instrumentation specifics, or precise melodic intervals), since AI music" +
  " generators like Suno rarely execute those reliably without many regenerations.";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  const apiKey = (body.apiKey || "").trim();
  if (!apiKey) {
    res.status(400).json({ error: "Missing OpenAI API key" });
    return;
  }

  const categoryName = typeof body.categoryName === "string" ? body.categoryName.trim().slice(0, MAX_FIELD_LEN) : "";
  const label = typeof body.label === "string" ? body.label.trim().slice(0, MAX_FIELD_LEN) : "";
  if (!categoryName || !label) {
    res.status(400).json({ error: "Missing categoryName or label" });
    return;
  }
  const examples = Array.isArray(body.examples) ? body.examples.slice(0, 5).map(String) : [];
  const model = (body.model || "").trim() || DEFAULT_MODEL;

  const prompt = buildPrompt(categoryName, label, examples);

  let upstream;
  try {
    upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 1.05,
        max_tokens: 60
      })
    });
  } catch (e) {
    res.status(502).json({ error: "Couldn't reach OpenAI" });
    return;
  }

  if (!upstream.ok) {
    const detail = await safeText(upstream);
    res.status(upstream.status === 401 ? 401 : 502).json({
      error: "OpenAI error (" + upstream.status + ")" + (detail ? ": " + detail.slice(0, 200) : "")
    });
    return;
  }

  const data = await upstream.json();
  const raw = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  const text = sanitize(raw || "");
  if (!text) {
    res.status(502).json({ error: "OpenAI returned an unusable response" });
    return;
  }

  res.status(200).json({ text: text });
};

function buildPrompt(categoryName, label, examples) {
  const exampleText = examples.join("; ");
  const isMusicTwist = /music/i.test(categoryName) && /twist/i.test(label);
  return "You generate entries for a creative-prompt slot machine. Category: " + categoryName +
    " — reel: '" + label + "'. Examples already in use for this reel: " + exampleText +
    ". Give ONE brand-new entry for the '" + label + "' reel, 1-6 words, different from the examples," +
    " matching their tone, style, and length." + (isMusicTwist ? TWIST_FEASIBILITY_NOTE : "") +
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

async function safeText(res) {
  try { return await res.text(); } catch (e) { return ""; }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}
