// Vercel Serverless Function: POST /api/openai-generate
//
// This is the "bring your own OpenAI key" relay. OpenAI's API doesn't allow
// direct browser calls (no CORS), so the visitor's own key has to pass
// through a server for one request. This function does NOT read any
// environment variable and does NOT log or persist the key anywhere — it
// takes the key from the request body, uses it for exactly one upstream
// call, and forgets it when the function returns.
//
// Body: { apiKey: string, model?: string, category: "genre"|"mood"|"subject"|"twist", examples: string[] }
// Returns: { text: string }  or  { error: string }

const CAT_DESC = {
  genre: "a music genre or micro-genre name, 1-4 words, in the spirit of names like 'Shoegaze' or 'Baile Funk'",
  genre2: "a second, different music genre or micro-genre name (1-4 words) meant to be fused with another genre, in the spirit of names like 'Shoegaze' or 'Baile Funk'",
  mood: "a short emotional mood or vibe for a song, 2-4 words, adjective + noun (like 'Bittersweet nostalgia')",
  subject: "a single vivid, specific lyrical premise for a song, written as a short story pitch, one sentence",
  twist: "one short production or songwriting constraint or dare for a song, one sentence, in the spirit of 'no drums until the final chorus'"
};

const DEFAULT_MODEL = "gpt-4o-mini";

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

  const category = body.category;
  const desc = CAT_DESC[category];
  if (!desc) {
    res.status(400).json({ error: "Unknown category: " + category });
    return;
  }
  const examples = Array.isArray(body.examples) ? body.examples.slice(0, 5) : [];
  const model = (body.model || "").trim() || DEFAULT_MODEL;

  const prompt = buildPrompt(category, desc, examples);

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

function buildPrompt(category, desc, examples) {
  const exampleText = examples.join("; ");
  return "You generate entries for a songwriting-challenge generator. Category: " + category + " — " + desc +
    ". Examples already in use: " + exampleText + ". Give ONE brand-new " + category +
    " entry, different from the examples, matching the same style and length. Reply with only the entry text — no quotes, no numbering, no explanation.";
}

function sanitize(text) {
  let t = String(text).trim().split("\n")[0].trim();
  t = t.replace(/^["'“”\-\s\d.]+/, "").replace(/["'“”]+$/, "").trim();
  if (!t || t.length > 140) return "";
  return t;
}

async function safeText(res) {
  try { return await res.text(); } catch (e) { return ""; }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}
