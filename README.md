# SCPH Challenge Machine

A webapp that generates random songwriting-challenge prompts (genre + mood + subject + a production twist) for use with Suno. It works as a single static file with no backend at all — and it optionally upgrades to AI-generated (rather than fixed-list) entries, and to signed-in accounts, if you deploy it with a few small serverless functions.

Built by [SCPH — Suno Creatives PH](https://discord.gg/nSdj4wBZv). Join the Discord if you want to share challenges, prompts, or tracks made with this.

## What it does

- Pull the lever to spin five "reels": Genre, Genre 2, Mood, Subject, Twist.
- Lock any reel (🔒) to keep its value while the others reroll.
- Click a single reel window to reroll just that one.
- Flip any reel on/off with the switch under each one — mix and match freely (e.g. Genre-only, Subject + Twist only, all five, whatever). At least one reel always stays on so there's something to write.
- **Genre 2 is a genre-fusion reel**, off by default. Turn it on to pull a second, independent genre alongside the first — when they land on two different genres, the mission reads as a fusion (e.g. "Shoegaze x Cumbia fusion"); if they land on the same genre, or only one Genre reel is on, it just reads as that one genre.
- Copy the assembled prompt straight into Suno.
- Save favorites and browse history — stored in the visitor's own browser (`localStorage`) by default, so nothing is shared across users and no server storage is needed. Optionally sign in (see **Accounts** below) to sync the same data across devices.
- Optional **AI-generated entries**, with a choice of three sources: this site's own Groq key (if deployed with one), or a visitor's own Claude or ChatGPT API key.

## Two ways to run it

### Option A — plain static hosting (no AI mode, zero setup)

If you don't care about AI mode, `index.html` is entirely self-contained. Upload it to any static host — shared hosting, GitHub Pages, an S3 bucket, whatever — and it works immediately with the built-in lists. The AI toggle will just fail gracefully (it calls `/api/generate`, gets a 404, and falls back to the built-in lists) if there's no function behind it.

### Option B — Netlify or Vercel (adds AI mode)

Both platforms can serve the same files. Pick whichever you're more comfortable with.

**Files involved:**
```
index.html                       — the app itself
netlify.toml                     — Netlify config + /api/* redirect
netlify/functions/generate.js    — Groq call, as a Netlify Function
netlify/functions/openai-generate.js — OpenAI BYOK relay, as a Netlify Function
api/generate.js                  — the same Groq call, as a Vercel Function
api/openai-generate.js           — the same OpenAI BYOK relay, as a Vercel Function
package.json                     — just pins the Node version
```
You don't need to touch any of these — deploy the whole folder as-is. The client always calls `/api/generate` and `/api/openai-generate`; on Vercel those are native serverless functions, and on Netlify, `netlify.toml` quietly redirects those paths to the equivalent Netlify Functions. Same `index.html`, same URLs, works on either host.

#### 1. Get a free Groq API key

The AI function calls [Groq](https://console.groq.com) (an OpenAI-compatible API with a fast, free tier). Sign up, then create an API key from the Groq console. You'll paste this into an environment variable — it's never exposed to visitors' browsers, since only the serverless function reads it.

#### 2. Deploy

**Netlify:**
1. Push this folder to a GitHub/GitLab repo (or use `netlify deploy` from the Netlify CLI directly on the folder).
2. In the Netlify dashboard: **Add new site → Import an existing project**, pick the repo. Build command: leave blank. Publish directory: `.` (already set in `netlify.toml`).
3. **Site settings → Environment variables → Add a variable**: key `GROQ_API_KEY`, value = your Groq key.
4. Deploy. Netlify will detect `netlify/functions/generate.js` automatically.

**Vercel:**
1. Push this folder to a GitHub/GitLab repo (or use `vercel` CLI directly on the folder).
2. In the Vercel dashboard: **Add New → Project**, import the repo. Vercel auto-detects `api/generate.js` as a serverless function — no build command needed.
3. **Project settings → Environment Variables → Add**: key `GROQ_API_KEY`, value = your Groq key. Redeploy if you added it after the first deploy.
4. Done.

#### 3. Turn it on

Open the deployed site, open Settings, and pick a source from the **AI-generated entries** dropdown:

- **This site's AI (Groq)** — uses the `GROQ_API_KEY` you set above. No visitor-facing key needed.
- **My own Claude API key** — the visitor pastes their own Anthropic API key. This calls `api.anthropic.com` **directly from their browser** (Anthropic supports this via a special CORS header) — the key never touches your server at all. Get a key at [console.anthropic.com](https://console.anthropic.com).
- **My own ChatGPT (OpenAI) API key** — the visitor pastes their own OpenAI key. Unlike Anthropic, OpenAI's API blocks direct browser calls, so this one routes through `/api/openai-generate` (Netlify Function / Vercel Function, same dual-deploy trick as the Groq one). That function uses the key for exactly one upstream request and doesn't store or log it — but it does pass through your server's memory momentarily, so it's less "purely client-side" than the Claude option. Get a key at [platform.openai.com](https://platform.openai.com/api-keys).

Either BYOK option needs the Claude/ChatGPT key stored somewhere, which is the visitor's own browser (`localStorage`) — it's per-visitor, never sent to you, and clears if they clear site data. Each dropdown option also has an optional "Model" field defaulting to a small/cheap model (`claude-haiku-4-5-20251001` for Claude, `gpt-4o-mini` for OpenAI) — override it if you want a different one, since model names change over time and these defaults may go stale.

Whichever source is selected, hitting "Test connection" (or just picking it) pings it once and shows a status line either way. If AI mode is on but a given request fails or times out (12s), that single pull just falls back to the built-in list — nothing breaks.

A note on the OpenAI relay if you deploy this publicly: `/api/openai-generate` will forward *any* key it's given to OpenAI, for anyone who can reach your deployed URL — it's not a security hole against you (no cost to you, no data of yours exposed), but it does mean your deployment doubles as an open relay to OpenAI. That's a fine tradeoff for personal or low-traffic use; if you want to lock it down further later, add a rate limit or an allowlist check at the top of that function.

#### Testing locally

Both platforms have a CLI that runs the functions locally:
- Netlify: `npm install -g netlify-cli`, then `netlify dev` in this folder (serves the site + function together, reading `GROQ_API_KEY` from a local `.env` file).
- Vercel: `npm install -g vercel`, then `vercel dev` in this folder (same idea, reads `.env`).

Either way, create a `.env` file locally with `GROQ_API_KEY=your-key-here` (and don't commit it).

## Accounts (Phase 2, Netlify only)

Signing in with Google, Discord, or Facebook lets a visitor's favorites, history, and settings follow them across devices instead of staying on one browser (`localStorage`). This is built on Netlify specifically — it uses [Netlify Blobs](https://docs.netlify.com/blobs/overview/) (a zero-config key/value store bundled into the platform) for storage, so it doesn't work on the Vercel deploy path.

It's fully optional and degrades gracefully: with no provider credentials configured, the sign-in buttons just don't appear and the app behaves exactly like Phase 1 (local-only).

**Files involved:**
```
netlify/functions/auth-start.js     — redirects to the provider's consent screen
netlify/functions/auth-callback.js  — exchanges the code, sets a signed session cookie
netlify/functions/auth-logout.js    — clears the session cookie
netlify/functions/auth-me.js        — tells the frontend who's signed in (if anyone)
netlify/functions/data.js           — GET/PUT the signed-in visitor's favorites/history/settings
netlify/functions/_lib/*.js         — shared session-signing, provider configs, and Blobs helpers
```

#### 1. Register an OAuth app with each provider you want to offer

You don't have to do all three — only providers with both env vars set (below) show up as sign-in options.

- **Google**: [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create Credentials → OAuth client ID → Web application. Authorized redirect URI: `https://<your-site>/api/auth-callback?provider=google`.
- **Discord**: [Discord Developer Portal](https://discord.com/developers/applications) → New Application → OAuth2. Redirect URI: `https://<your-site>/api/auth-callback?provider=discord`.
- **Facebook**: [Meta for Developers](https://developers.facebook.com/apps) → Create App → add the "Facebook Login" product. Valid OAuth redirect URI: `https://<your-site>/api/auth-callback?provider=facebook`. Note: while the app is in development mode, Facebook only lets *your own* Facebook account sign in — you'd need to submit the app for review to open it to the public.

#### 2. Set environment variables in Netlify

`Site configuration → Environment variables`, mark each as secret:

| Variable | Where it comes from |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console credential |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Discord application's OAuth2 page |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | Facebook app's Basic Settings |
| `SESSION_SECRET` | Any long random string you generate yourself (e.g. `openssl rand -hex 32`) — signs the session cookie, don't reuse it elsewhere |

You only need the client id/secret pair for the providers you actually registered — omit the rest and those buttons stay hidden.

#### 3. Deploy

Netlify Blobs needs no separate setup or database to provision — it's available automatically to any Netlify site. Push to `main` (or your deploy branch) and redeploy after adding the env vars above.

#### How it works, briefly

- Sign-in is a standard OAuth "authorization code" redirect flow — no third-party auth library, just three small functions per provider path plus one shared session helper (a self-contained HMAC-signed cookie, using only Node's built-in `crypto`, no JWT dependency).
- On first sign-in, this browser's local favorites/history are merged with whatever's already on the account (de-duplicated by challenge text) rather than one side overwriting the other.
- After that, favorites/history/settings changes are still saved to `localStorage` immediately (so nothing is lost if a request fails) and pushed to the account in the background, debounced.

## AI credits (Netlify only, requires Accounts)

This site's own Groq key ("This site's AI" in Settings) is metered at 50 free rolls per day per signed-in account, since that key is the site's cost. A visitor's own Claude/OpenAI key (BYOK) is never metered — that's their API cost, not the site's.

- Requires sign-in — anonymous visitors are prompted to sign in or use their own key instead.
- Tracked in the same Netlify Blobs record as favorites/history (see `_lib/store.js`: `consumeAICredit`, `DAILY_AI_CREDIT_LIMIT`), resetting daily (UTC).
- `auth-me.js` returns the live balance so Settings can show "N / 50 free AI rolls left today" without an extra request.
- No purchase/top-up flow yet — a "Get More Credits" option to extend the daily limit after a paid transaction is a planned future addition, not built.

## Contact form (Resend)

The footer's "Contact Us" modal sends submissions to `jpbb.uiux@gmail.com` via [Resend](https://resend.com)'s API — works identically on Netlify and Vercel.

1. Sign up at [resend.com](https://resend.com) and create an API key (no domain verification needed — this uses Resend's shared sandbox sender `onboarding@resend.dev`).
2. Set `RESEND_API_KEY` in your site's environment variables (Netlify: Site configuration → Environment variables; Vercel: Project settings → Environment Variables).
3. That's it — `netlify/functions/contact.js` / `api/contact.js` handle the rest. No storage involved; if the email fails to send, the visitor sees an error and can retry.

## Public profile & gamification (Netlify only, requires Accounts)

Signed-in visitors can opt into a public profile page showing total rolls, a daily streak, and milestone badges — no favorites or history are ever exposed publicly.

- In Settings, a signed-in visitor sets a public **handle** (3-20 chars, letters/numbers/`-`/`_`) and toggles **"Make my stats profile public"**. Handles are unique across all accounts.
- The public page is `profile.html?u=<handle>` — a static page that fetches `/api/profile?handle=...` (no auth needed for the read; returns 404 if the handle doesn't exist or isn't public).
- Stats tracked: `totalRolls`, `categoryRolls` (per category), and a daily streak (`current`/`longest`). Badges (`First Roll`, `10/50/100 Rolls`, `Music Fan`/`Character Fan` at 20+ rolls in that category, `3-Day`/`7-Day Streak`) are computed from those numbers on read — no separate badge storage.
- **These stats start at zero for every account, including accounts that existed before this feature shipped** — there's no historical roll data to backfill into them, so profiles reflect activity from this point forward only.
- Files: `netlify/functions/profile.js` (GET public read / PUT set handle+visibility), `_lib/store.js` (`setProfileHandle`, `getPublicProfileByHandle`, `computeBadges`), `profile.html` (the public page itself).

## Customizing the prompt lists

All the content lives in one place near the top of the `<script>` block, in the `DATA` object:

```js
const DATA = {
  genre: [...],
  mood: [...],
  subject: [...],
  twist: [...]
};
```

Add, remove, or edit entries in any of those four arrays — everything else (spinning, locking, the ticket text, favorites, and what the AI is told to imitate) works off these lists automatically. No other code needs to change.

## Roadmap

### Phase 1 — MVP (done)
- Static, no-backend reel/lever mechanic with lock/reroll per category.
- Favorites + history + settings, persisted client-side via `localStorage`.
- Optional AI-generated entries (Groq site-wide key, or visitor's own Claude/OpenAI BYOK key).
- Deployable as either a plain static file or with serverless functions (Netlify/Vercel).

### Phase 2 — Accounts + cross-device sync (done, Netlify only)
Favorites/history/settings can now follow the person instead of the browser — see the **Accounts** section above for setup:

- **Sign in with Google / Discord / Facebook** (OAuth) — no passwords to manage.
- Storage via **Netlify Blobs** (no separate database service needed), keyed per account, holding favorites, history, and settings (active reels + locks).
- Anonymous/local mode stays fully supported — signing in is an upgrade, not a requirement. On first sign-in, local favorites/history are merged into the account rather than overwritten.
- Netlify-only for now — the Vercel deploy path still works for the static app + AI mode, just not accounts (Vercel would need its own KV choice, e.g. Vercel KV/Upstash, to get parity).

### Phase 3 — ideas beyond that (not committed, just directions)
- Shareable links for a single ticket/prompt (e.g. `?t=<id>`) so a challenge can be sent to someone else and render identically, signed in or not.
- Public favorites/leaderboard of community-submitted challenges, opt-in.
- The "project type" switch mentioned below (songwriting vs. general writing vs. app ideas) as a swappable `DATA` set, possibly per-account default.
- Rate limiting / abuse protection on the AI endpoints if traffic grows (noted as a known gap in the OpenAI relay section above).
- **Monetize the page through ads** — likely a lightweight ad network (e.g. Google AdSense or an ethical/privacy-respecting alternative) placed around the machine without disrupting the pull/lock/reroll flow; would need a placement pass so ads don't compete with the lever or ticket for attention, plus a look at CMP/consent requirements depending on visitor region.
- **Audit the `twist` list for real-world Suno feasibility.** Some existing constraints are technically achievable in Suno but expensive to actually land — they take many regenerations/credits before Suno respects the exact constraint (e.g. precise structural rules like "no drums until the final chorus" or "under 90 seconds total"). Worth tagging or reweighting twists by how reliably Suno honors them, so the dares stay fun without burning credits chasing an edge case.
- **Add Google Analytics (or a privacy-friendlier alternative like Plausible/Fathom)** to track usage and visitors — pulls per session, which reels get toggled off most, AI mode adoption, sign-in conversion, etc. Would need a cookie-consent banner if using GA specifically (depending on visitor region), and a decision on whether to gate it behind consent before firing.

## Notes

- Fully responsive, keyboard-operable (Tab to a reel + Enter/Space to reroll it, Space on the page to pull the lever), and respects `prefers-reduced-motion`.
- Data persists per-browser via `localStorage` under the key `sunoChallengeMachine.v1` (kept as-is from Phase 1 so existing visitors don't lose data on the rename). Clearing site data resets history/favorites/ticket counter, unless signed in — see **Accounts**.
- The only external calls from the page itself are to Google Fonts (Baloo 2, IBM Plex Mono, Nunito). AI mode additionally calls your own `/api/generate` endpoint, which in turn calls Groq server-side; account sign-in calls `/api/auth-*` and `/api/data`.
- No tracking, no client-side API keys sent anywhere but the provider they're for. Accounts are opt-in (see **Accounts** above) — nothing is tracked beyond what's needed to sync your own favorites/history.
- The app is structured category-by-category (`DATA`, `LABELS`, `ORDER`, `AI_CAT_DESC` all keyed the same way) so it'd be straightforward later to add a "project type" switch (songwriting vs. general writing vs. app ideas, etc.) that swaps in a different `DATA` set — not built yet, but the code doesn't fight that direction.
