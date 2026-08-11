// POST /api/openai-generate
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

import { NextRequest, NextResponse } from "next/server";

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_FIELD_LEN = 60;

export async function POST(req: NextRequest) {
  const body = await safeJson(req);
  const apiKey = (body.apiKey || "").trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OpenAI API key" }, { status: 400 });
  }

  const categoryName = typeof body.categoryName === "string" ? body.categoryName.trim().slice(0, MAX_FIELD_LEN) : "";
  const label = typeof body.label === "string" ? body.label.trim().slice(0, MAX_FIELD_LEN) : "";
  if (!categoryName || !label) {
    return NextResponse.json({ error: "Missing categoryName or label" }, { status: 400 });
  }
  const examples = Array.isArray(body.examples) ? body.examples.slice(0, 5).map(String) : [];
  const model = (body.model || "").trim() || DEFAULT_MODEL;

  const prompt = buildPrompt(categoryName, label, examples);

  let upstream: Response;
  try {
    upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 1.05,
        max_tokens: 60
      })
    });
  } catch (e) {
    return NextResponse.json({ error: "Couldn't reach OpenAI" }, { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await safeText(upstream);
    return NextResponse.json(
      { error: "OpenAI error (" + upstream.status + ")" + (detail ? ": " + detail.slice(0, 200) : "") },
      { status: upstream.status === 401 ? 401 : 502 }
    );
  }

  const data = await upstream.json();
  const raw = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  const text = sanitize(raw || "");
  if (!text) {
    return NextResponse.json({ error: "OpenAI returned an unusable response" }, { status: 502 });
  }

  return NextResponse.json({ text });
}

function buildPrompt(categoryName: string, label: string, examples: string[]): string {
  const exampleText = examples.join("; ");
  return (
    "You generate entries for a creative-prompt slot machine. Category: " +
    categoryName +
    " — reel: '" +
    label +
    "'. Examples already in use for this reel: " +
    exampleText +
    ". Give ONE brand-new entry for the '" +
    label +
    "' reel, 1-6 words, different from the examples," +
    " matching their tone, style, and length." +
    " This entry gets stitched together with other reels into" +
    " one sentence, so do not end it with a period or any other trailing punctuation." +
    " Reply with only the entry text — no quotes, no numbering, no explanation, no trailing punctuation."
  );
}

function sanitize(text: string): string {
  let t = String(text).trim().split("\n")[0].trim();
  t = t.replace(/^["'“”\-\s\d.]+/, "").replace(/["'“”]+$/, "").trim();
  t = t.replace(/[.!?,;:]+$/, "").trim();
  if (!t || t.length > 140) return "";
  return t;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch (e) {
    return "";
  }
}

async function safeJson(req: NextRequest): Promise<any> {
  try {
    return await req.json();
  } catch (e) {
    return {};
  }
}
