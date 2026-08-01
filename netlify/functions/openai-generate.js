// Netlify Function: POST /.netlify/functions/openai-generate
// (reachable at /api/openai-generate via the redirect in netlify.toml)
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

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { error: "Invalid JSON body" });
  }

  const apiKey = (body.apiKey || "").trim();
  if (!apiKey) {
    return json(400, { error: "Missing OpenAI API key" });
  }

  const category = body.category;
  const desc = CAT_DESC[category];
  if (!desc) {
    return json(400, { error: "Unknown category: " + category });
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
    return json(502, { error: "Couldn't reach OpenAI" });
  }

  if (!upstream.ok) {
    const detail = await safeText(upstream);
    return json(upstream.status === 401 ? 401 : 502, {
      error: "OpenAI error (" + upstream.status + ")" + (detail ? ": " + detail.slice(0, 200) : "")
    });
  }

  const data = await upstream.json();
  const raw = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  const text = sanitize(raw || "");
  if (!text) {
    return json(502, { error: "OpenAI returned an unusable response" });
  }

  return json(200, { text: text });
};

function buildPrompt(category, desc, examples) {
  const exampleText = examples.join("; ");
  return "You generate entries for a songwriting-challenge generator. Category: " + category + " — " + desc +
    ". Examples already in use: " + exampleText + ". Give ONE brand-new " + category +
    " entry, different from the examples, matching the same style and length. This entry gets stitched together" +
    " with the other categories into one sentence, so do not end it with a period or any other trailing punctuation." +
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

function json(statusCode, obj) {
  return {
    statusCode: statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj)
  };
}
