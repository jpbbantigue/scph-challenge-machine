// POST /api/generate
//
// Body: { categoryName: string, reels: [{ label: string, examples: string[] }, ...] }
// Returns: { results: [{ label, text }], creditsRemaining }  or  { error: string }
//
// Requires the GROQ_API_KEY environment variable. Get a free key at
// https://console.groq.com -- the key never reaches the browser.
//
// Batched: one request covers every reel needed for a single "Pull" (or a
// single reroll, as a one-item batch), so the daily credit spend is 1 per
// pull rather than 1 per reel.
//
// This endpoint calls a site-wide key (this site's own cost), so every
// caller is metered by a daily credit allowance, backed by Neon Postgres --
// signed-in accounts via lib/store.ts: reserveAICredit/commitAICreditUsage
// (per-tier limits, see CREDIT_LIMITS), and anonymous (not signed-in)
// visitors too via consumeAnonCredit, tracked by a first-party cookie ID
// (issued here on first use if not already set by /api/auth-me) plus a
// per-IP backstop. A visitor's own Claude/OpenAI key (openai-generate.ts)
// is never metered -- that's their own API cost, not the site's.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, parseCookies, ANON_COOKIE_NAME, newAnonId, anonIdCookie } from "@/lib/session";
import { reserveAICredit, commitAICreditUsage, consumeAnonCredit } from "@/lib/store";

const MODEL = "llama-3.1-8b-instant";
const MAX_FIELD_LEN = 60;
const MAX_REELS_PER_REQUEST = 8;

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (!fwd) return null;
  const first = fwd.split(",")[0].trim();
  return first || null;
}

export async function POST(req: NextRequest) {
  const user = getSessionUser(req);

  // Anonymous visitors get a small real free-API allowance too (see
  // lib/store.ts consumeAnonCredit) -- no hard sign-in requirement to use
  // this endpoint at all. Issue the tracking cookie here if the visitor
  // somehow reached "Use AI" without it already being set by /api/auth-me.
  let anonId: string | null = null;
  let anonSetCookie: string | null = null;
  if (!user) {
    const cookies = parseCookies(req.headers.get("cookie"));
    anonId = cookies[ANON_COOKIE_NAME];
    if (!anonId) {
      anonId = newAnonId();
      anonSetCookie = anonIdCookie(anonId);
    }
  }

  const body = await safeJson(req);
  const categoryName = typeof body.categoryName === "string" ? body.categoryName.trim().slice(0, MAX_FIELD_LEN) : "";
  const reelsIn = Array.isArray(body.reels) ? body.reels.slice(0, MAX_REELS_PER_REQUEST) : [];
  if (!categoryName || !reelsIn.length) {
    return NextResponse.json({ error: "Missing categoryName or reels" }, { status: 400 });
  }
  const reels = reelsIn
    .map((r: any) => ({
      label: typeof r.label === "string" ? r.label.trim().slice(0, MAX_FIELD_LEN) : "",
      examples: Array.isArray(r.examples) ? r.examples.slice(0, 5).map(String) : []
    }))
    .filter((r: any) => r.label);
  if (!reels.length) {
    return NextResponse.json({ error: "No valid reels in request" }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server is missing GROQ_API_KEY -- set it in the project's environment variables." }, { status: 500 });
  }

  // One credit for the whole batch -- this is what makes "1 pull = 1 credit"
  // true regardless of how many reels that pull touches. Signed-in and
  // anonymous callers use separate tracking (accounts.credits JSONB vs. the
  // anon_credits table), but both gate the Groq calls the same way.
  let reserved: Awaited<ReturnType<typeof reserveAICredit>> | null = null;
  let anonCredit: Awaited<ReturnType<typeof consumeAnonCredit>> | null = null;
  if (user) {
    reserved = await reserveAICredit(user);
    if (!reserved.ok) {
      return NextResponse.json(
        { error: "Daily AI limit reached (" + reserved.limit + "/day) -- try again tomorrow, or add your own Claude/ChatGPT key in Settings." },
        { status: 429 }
      );
    }
  } else {
    anonCredit = await consumeAnonCredit(anonId as string, clientIp(req));
    if (!anonCredit.ok) {
      const res = NextResponse.json(
        {
          error:
            "Daily AI limit reached (" +
            anonCredit.limit +
            "/day) -- sign in for a bigger daily allowance, or add your own Claude/ChatGPT key in Settings (requires an account)."
        },
        { status: 429 }
      );
      if (anonSetCookie) res.headers.append("Set-Cookie", anonSetCookie);
      return res;
    }
  }

  let totalTokens = 0;
  const results = await Promise.all(
    reels.map(async (r: { label: string; examples: string[] }) => {
      const prompt = buildPrompt(categoryName, r.label, r.examples);
      try {
        const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + apiKey
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
        if (data && data.usage && typeof data.usage.total_tokens === "number") {
          totalTokens += data.usage.total_tokens;
        }
        const raw = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        return { label: r.label, text: sanitize(raw || "") };
      } catch (e) {
        return { label: r.label, text: "" };
      }
    })
  );

  // Signed-in: commit credit + token usage in one write. Anonymous: credit
  // was already committed above (consumeAnonCredit); no token tracking --
  // there's no profile to attach it to.
  let creditsRemaining: number;
  if (user && reserved) {
    const committed = await commitAICreditUsage(user, reserved, totalTokens);
    creditsRemaining = committed.remaining;
  } else {
    creditsRemaining = anonCredit ? anonCredit.remaining : 0;
  }

  const res = NextResponse.json({ results, creditsRemaining });
  if (anonSetCookie) res.headers.append("Set-Cookie", anonSetCookie);
  return res;
}

function buildPrompt(categoryName: string, label: string, examples: string[]): string {
  const exampleText = examples.join("; ");
  return (
    "You generate entries for a creative-prompt slot machine. Category: " +
    categoryName +
    " -- reel: '" +
    label +
    "'. Examples already in use for this reel: " +
    exampleText +
    ". Give ONE brand-new entry for the '" +
    label +
    "' reel, 1-6 words, different from the examples," +
    " matching their tone, style, and length." +
    " This entry gets stitched together with other reels into" +
    " one sentence, so do not end it with a period or any other trailing punctuation." +
    " Reply with only the entry text -- no quotes, no numbering, no explanation, no trailing punctuation."
  );
}

function sanitize(text: string): string {
  let t = String(text).trim().split("\n")[0].trim();
  t = t.replace(/^["'\u201c\u201d\-\s\d.]+/, "").replace(/["'\u201c\u201d]+$/, "").trim();
  t = t.replace(/[.!?,;:]+$/, "").trim();
  if (!t || t.length > 140) return "";
  return t;
}

async function safeJson(req: NextRequest): Promise<any> {
  try {
    return await req.json();
  } catch (e) {
    return {};
  }
}
