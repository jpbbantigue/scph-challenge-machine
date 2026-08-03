// Netlify Function: POST /.netlify/functions/generate
// (reachable at /api/generate via the redirect in netlify.toml)
//
// Body: { categoryName: string, label: string, examples: string[] }
// Returns: { text: string }  or  { error: string }
//
// Requires the GROQ_API_KEY environment variable to be set in the Netlify
// site's dashboard (Site settings > Environment variables). Get a free key
// at https://console.groq.com — the key never reaches the browser.
//
// Generic by design: Prompt Royale has many categories, each with its own
// reel labels, so instead of a hardcoded description per category+label
// (which doesn't scale), the description is built from the category name
// and reel label the client sends, plus a handful of example items from
// that reel's own list — same trust boundary as before (this is a public,
// unauthenticated, zero-stakes creative-prompt endpoint; the output is
// only ever shown back to the requester).

const MODEL = "llama-3.1-8b-instant";
const MAX_FIELD_LEN = 60;

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

  const categoryName = typeof body.categoryName === "string" ? body.categoryName.trim().slice(0, MAX_FIELD_LEN) : "";
  const label = typeof body.label === "string" ? body.label.trim().slice(0, MAX_FIELD_LEN) : "";
  if (!categoryName || !label) {
    return json(400, { error: "Missing categoryName or label" });
  }
  const examples = Array.isArray(body.examples) ? body.examples.slice(0, 5).map(String) : [];

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return json(500, { error: "Server is missing GROQ_API_KEY — set it in the Netlify site's environment variables." });
  }

  const prompt = buildPrompt(categoryName, label, examples);

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
    return json(502, { error: "Couldn't reach the AI provider" });
  }

  if (!upstream.ok) {
    const detail = await safeText(upstream);
    return json(502, { error: "AI provider error (" + upstream.status + ")" + (detail ? ": " + detail.slice(0, 200) : "") });
  }

  const data = await upstream.json();
  const raw = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  const text = sanitize(raw || "");
  if (!text) {
    return json(502, { error: "AI returned an unusable response" });
  }

  return json(200, { text: text });
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
