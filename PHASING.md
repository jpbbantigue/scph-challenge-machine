# Prompt Royale — phasing

This branch (`prompt-royale`) reworks the SCPH Challenge Machine into "Prompt Royale": a multi-category creative-prompt generator, based on the design handoff in `Prompt Royale site mockups.zip`. The full design doc covers many categories and pages (Account overhaul, Public Profile, credits system, animations, contact modal). This is being shipped in phases rather than all at once.

## Phase 1 — this branch (done)

- **Two categories only: Music and Characters.** The design doc lists more; the rest are deferred to keep this shippable and testable.
- Category picker (pill chips) swaps the whole reel set; each category has its own independently saved active/lock state.
- **Expanded static item pools** per reel (18–24 items, vs. the design doc's 6–8) — more variety without needing a database yet.
- **Music "Twist" reel: full original list, no Suno-feasibility curation.** An earlier revision filtered this down to ~31 lyric/vocal-delivery-only entries (dropping audio-production/music-theory ones like "a key change every chorus"), plus a matching AI-prompt restriction — both were reverted at the user's explicit request, since the fuller variety was preferred over strict achievability. The full 56-item list lives in `phase1-data.js` (reference copy) and inline in `index.html`; the AI-generation prompt (`generate.js` / `openai-generate.js`, both Netlify and Vercel, plus the client-side Anthropic path) has no Twist-specific restriction.
- Sentence templates:
  - Music: `Write a {mood} {genre1 x genre2 fusion|genre} song about {subject}. Constraint: {twist}.`
  - Characters: `Create a {mood} {archetype} character in a {genre} setting defined by {trait}, haunted by {flaw}, exploring {theme}.` (a leading "haunted by" on the Flaw value is stripped to avoid double phrasing)
  - Generic fallback (for any reel subset that doesn't match the above, or a future category without a hand-written template): labels every active reel explicitly.
- Prompt Royale visual identity: near-black background, royal blue / crimson / gold palette, Space Grotesk (display) + Inter (body) fonts — replacing the brass/amber and later near-black/neon-red-cyan SCPH looks.
- Reused as-is from the prior app: favorites/history/local persistence, Groq/Anthropic/OpenAI AI-source settings, Google/Discord/Facebook account sync (Netlify only). Local storage key changed to `promptRoyale.v1` (schema-incompatible with the old `sunoChallengeMachine.v1`, since reel keys are now per-category rather than fixed).

## Deferred items shipped without a database

These were originally deferred pending Phase 2, but turned out not to need a database — they reuse the existing Netlify Blobs account store instead:

- **Contact modal**, wired to actually send email (via Resend) rather than just being UI. See README's "Contact form" section.
- **Credits system** — 50/day free-AI-**pull** limit per signed-in account (1 credit per pull, batched across all reels in that pull — not per reel), gating only this site's own Groq key (not BYOK keys). A visible notice appears if a pull hits the limit, rather than silently falling back. See README's "AI credits" section.
- **Discord community bonus (100/day) — deferred, not built.** Plan: request the `guilds` OAuth scope at Discord sign-in, check membership in the Suno Creatives PH server via `/users/@me/guilds` automatically (no manual verification), and bump the daily limit for verified members. Needs the server's Discord guild ID to proceed.
- **Public Profile page + gamification** — opt-in public handle, stats (total rolls, per-category rolls, streak), and milestone badges computed on read. Stats start at zero for every account (new and pre-existing) as of this feature — no historical data is backfilled. See README's "Public profile & gamification" section.

## Phase 2 — not started

- **A real database backing reel content**, replacing the static in-file arrays — needed both to grow "Free mode" item pools further without bloating `index.html`, and as groundwork for adding more categories from the design doc without every category living in client-side JS.
- Additional categories from the design doc beyond Music + Characters.
- Netlify Blobs currently backs accounts, credits, and profiles — Phase 2's database work should evaluate whether the same store extends to reel content, or a separate DB (e.g. a hosted Postgres/SQLite) makes more sense.
- **"Get More Credits" purchase flow** — extending the daily AI-credit limit after a paid transaction. Noted as a future direction when the credits system shipped, not built.

## Planned: Community page (public profile directory)

Right now a public profile (`profile.html?u=handle`) is only discoverable if the owner shares the direct link — there's no search, browsing, or listing anywhere on the site. Planned for later:

- A `community.html` page listing all public profiles (handle, display name, total rolls, top badge), paginated, sorted by most-recent activity by default (with a "Most Rolls" sort option).
- Backend: a new `listPublicProfiles({ sort, cursor })` function in `api/_lib/store.js`, querying `accounts` joined to `profile_handles` where `data->profile->>'public' = 'true'`, plus a matching `api/community.js` GET endpoint (would need to fold into an existing file or the deployment stays under Vercel Hobby's 12-function cap — see the earlier function-count fix).
- Nav: a "Community" link, likely replacing or sitting alongside "Prompt Categories".
- No opt-out beyond the existing public/private toggle — anyone who's already made their profile public would appear once this ships; worth a one-time note in-app if that matters (e.g. "public profiles are now listed on /community").

## Deferred (from the original design handoff, no timeline yet)

- Account page overhaul (the handoff's dedicated account/profile UI, beyond the current Settings drawer — profile/credits/handle controls currently live in the Settings drawer, not a dedicated page).
- Reel-landing / UI animation polish beyond the current spin/settle effect.
- "Now Rolling" sticky status bar and the "Example Results" section from the mockup.
- SEO rebrand (meta tags, `robots.txt`, `sitemap.xml`, `README.md`) fully to "Prompt Royale" — the in-app copy/branding is updated on this branch, but the repo's SEO/README surface still reflects the old SCPH Challenge Machine name pending a decision on final domain/branding before this leaves staging.
