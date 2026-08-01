// Vercel Serverless Function: POST /api/generate
//
// Body: { category: "genre"|"mood"|"subject"|"twist", examples: string[] }
// Returns: { text: string }  or  { error: string }
//
// Requires the GROQ_API_KEY environment variable to be set in the Vercel
// project's dashboard (Settings > Environment Variables). Get a free key
// at https://console.groq.com — the key never reaches the browser.

const CAT_DESC = {
  genre: "a music genre or micro-genre name, 1-4 words, in the spirit of names like 'Shoegaze' or 'Baile Funk'",
  genre2: "a second, different music genre or micro-genre name (1-4 words) meant to be fused with another genre, in the spirit of names like 'Shoegaze' or 'Baile Funk'",
  mood: "a short emotional mood or vibe for a song, 2-4 words, adjective + noun (like 'Bittersweet nostalgia')",
  subject: "a single vivid, specific lyrical premise for a song, written as a short story pitch, one sentence",
  twist: "one short production or songwriting constraint or dare for a song, one sentence, in the spirit of 'no drums until the final chorus'"
};

const MODEL = "llama-3.1-8b-instant";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  const category = body.category;
  const desc = CAT_DESC[category];
  if (!desc) {
    res.status(400).json({ error: "Unknown category: " + category });
    return;
  }
  const examples = Array.isArray(body.examples) ? body.examples.slice(0, 5) : [];

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server is missing GROQ_API_KEY — set it in the Vercel project's environment variables." });
    return;
  }

  const prompt = buildPrompt(category, desc, examples);

  let upstream;
  try {
    upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
  } catch (e) {
    res.status(502).json({ error: "Couldn't reach the AI provider" });
    return;
  }

  if (!upstream.ok) {
    const detail = await safeText(upstream);
    res.status(502).json({ error: "AI provider error (" + upstream.status + ")" + (detail ? ": " + detail.slice(0, 200) : "") });
    return;
  }

  const data = await upstream.json();
  const raw = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  const text = sanitize(raw || "");
  if (!text) {
    res.status(502).json({ error: "AI returned an unusable response" });
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
