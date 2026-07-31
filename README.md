# Suno Challenge Machine

A webapp that generates random songwriting-challenge prompts (genre + mood + subject + a production twist) for use with Suno. It works as a single static file with no backend at all — and it optionally upgrades to AI-generated (rather than fixed-list) entries if you deploy it with one small serverless function.

## What it does

- Pull the lever to spin four "reels": Genre, Mood, Subject, Twist.
- Lock any reel (🔒) to keep its value while the others reroll.
- Click a single reel window to reroll just that one.
- Copy the assembled prompt straight into Suno.
- Save favorites and browse history — stored in the visitor's own browser (`localStorage`), so nothing is shared across users and no server storage is needed.
- Turn **any** of the four reels off in Settings — mix and match freely (e.g. Genre-only, Subject + Twist only, all four, whatever). At least one reel always stays on so there's something to write.
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

### Phase 2 — Accounts + cross-device sync
The current favorites/history are per-browser only (`localStorage`) — nothing survives a new device, a cleared cache, or a different browser. Phase 2 adds real accounts so that data can follow the person, not the browser:

- **Sign in with Google / Discord / Facebook** (OAuth) — no passwords to manage, and Discord fits the Suno/music-community audience particularly well.
- A small backend + database to store, per account:
  - Favorites (already-shaped as `{no, time, vals, mission}` objects — the existing shape can move over largely as-is).
  - History (same shape, capped/paginated instead of the current 100-entry local cap).
  - Settings (which reels are active, preferred AI source/model) so a signed-in visitor's setup follows them.
- Anonymous/local mode stays fully supported — signing in is an upgrade, not a requirement. On first sign-in, offer to import the current browser's local favorites/history into the account (one-time merge).
- Needs: an auth provider (e.g. Auth.js/NextAuth, Clerk, Supabase Auth, or Netlify Identity) + a small database (Supabase/Postgres, Firebase, or a simple Netlify/Vercel-native KV store) — choice mainly depends on which host we lean into, since it changes the serverless-function story already in place for AI mode.

### Phase 3 — ideas beyond that (not committed, just directions)
- Shareable links for a single ticket/prompt (e.g. `?t=<id>`) so a challenge can be sent to someone else and render identically, signed in or not.
- Public favorites/leaderboard of community-submitted challenges, opt-in.
- The "project type" switch mentioned below (songwriting vs. general writing vs. app ideas) as a swappable `DATA` set, possibly per-account default.
- Rate limiting / abuse protection on the AI endpoints if traffic grows (noted as a known gap in the OpenAI relay section above).

## Notes

- Fully responsive, keyboard-operable (Tab to a reel + Enter/Space to reroll it, Space on the page to pull the lever), and respects `prefers-reduced-motion`.
- Data persists per-browser via `localStorage` under the key `sunoChallengeMachine.v1`. Clearing site data resets history/favorites/ticket counter.
- The only external calls from the page itself are to Google Fonts (Oswald, IBM Plex Mono, Work Sans). AI mode additionally calls your own `/api/generate` endpoint, which in turn calls Groq server-side.
- No accounts, no tracking, no client-side API keys.
- The app is structured category-by-category (`DATA`, `LABELS`, `ORDER`, `AI_CAT_DESC` all keyed the same way) so it'd be straightforward later to add a "project type" switch (songwriting vs. general writing vs. app ideas, etc.) that swaps in a different `DATA` set — not built yet, but the code doesn't fight that direction.
