// One-time (idempotent) schema setup for the Vercel/Neon Postgres accounts
// store. Run manually — not on every request — since DDL doesn't belong in
// a request path:
//
//   node scripts/init-db.mjs
//
// Reads DATABASE_URL from the environment (pull it locally first with
// `vercel env pull .env.local`, or export it directly).

import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL / POSTGRES_URL in the environment.");
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  // One row per account, keyed by "provider:sub" — mirrors the JSON shape
  // the Netlify Blobs version used, so the app logic on top barely changes.
  await sql`
    CREATE TABLE IF NOT EXISTS accounts (
      account_key TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Public profile handle -> account lookup, kept separate so handle
  // uniqueness is enforced by the primary key rather than an app-level check.
  await sql`
    CREATE TABLE IF NOT EXISTS profile_handles (
      handle TEXT PRIMARY KEY,
      account_key TEXT NOT NULL REFERENCES accounts(account_key) ON DELETE CASCADE
    )
  `;
  // User-linked "I made this from a prompt" results — Account > Results
  // (private, all of a user's own) and Public Profile > Results (public
  // subset, filterable by category).
  await sql`
    CREATE TABLE IF NOT EXISTS results (
      id SERIAL PRIMARY KEY,
      account_key TEXT NOT NULL REFERENCES accounts(account_key) ON DELETE CASCADE,
      category_id TEXT NOT NULL,
      roll_type TEXT NOT NULL DEFAULT 'free',
      prompt_text TEXT NOT NULL,
      result_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS results_account_idx ON results(account_key)`;
  // Bidirectional follow graph. follower_key follows followee_key.
  await sql`
    CREATE TABLE IF NOT EXISTS follows (
      follower_key TEXT NOT NULL REFERENCES accounts(account_key) ON DELETE CASCADE,
      followee_key TEXT NOT NULL REFERENCES accounts(account_key) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (follower_key, followee_key)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS follows_followee_idx ON follows(followee_key)`;
  // Lets one account have multiple sign-in identities (e.g. both Google and
  // Discord). The account's *first* sign-in identity is implicit — its
  // "provider:sub" IS the account_key in `accounts`. Every additional
  // identity linked afterward gets a row here pointing back at that same
  // account_key, resolved at sign-in time (see _lib/store.js: resolveAccountKey).
  await sql`
    CREATE TABLE IF NOT EXISTS linked_identities (
      provider TEXT NOT NULL,
      sub TEXT NOT NULL,
      account_key TEXT NOT NULL REFERENCES accounts(account_key) ON DELETE CASCADE,
      linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (provider, sub)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS linked_identities_account_idx ON linked_identities(account_key)`;

  // Wikipedia-sourced genre/subgenre reference data for the Music reel
  // (Genre 1 / Genre 2 picks). Self-referencing parent_id models genre ->
  // subgenre; top-level genres have parent_id NULL. Seeded by
  // scripts/crawl-genres.mjs + scripts/seed-genres.mjs, not on every deploy.
  await sql`
    CREATE TABLE IF NOT EXISTS genres (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      parent_id INTEGER REFERENCES genres(id) ON DELETE SET NULL,
      source TEXT NOT NULL DEFAULT 'wikipedia',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS genres_parent_idx ON genres(parent_id)`;

  // Mood / Subject / Twist reel content, Music-scoped for now
  // (category_id lets future categories point their own reels at these
  // tables). Seeded by scripts/seed-reel-data.mjs.
  await sql`
    CREATE TABLE IF NOT EXISTS moods (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      category_id TEXT NOT NULL DEFAULT 'music',
      active BOOLEAN NOT NULL DEFAULT true
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS subjects (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      category_id TEXT NOT NULL DEFAULT 'music',
      active BOOLEAN NOT NULL DEFAULT true
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS twists (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      category_id TEXT NOT NULL DEFAULT 'music',
      active BOOLEAN NOT NULL DEFAULT true
    )
  `;

  // Approved partner Discord servers whose members get the `affiliate`
  // credit tier (between `basic` and `scph`). Populated manually via
  // scripts/seed-affiliate-guilds.mjs, no admin UI yet — empty is fine.
  await sql`
    CREATE TABLE IF NOT EXISTS affiliate_guilds (
      id SERIAL PRIMARY KEY,
      guild_id TEXT UNIQUE NOT NULL,
      name TEXT,
      added_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Free-API (Groq) credit tracking for anonymous (not signed-in)
  // visitors, keyed by a random ID issued in a first-party cookie rather
  // than an account_key. Same daily-reset shape as the accounts.credits
  // JSON field, just its own table since there's no account row to hang
  // it off of. last_ip backs the secondary per-IP abuse ceiling.
  await sql`
    CREATE TABLE IF NOT EXISTS anon_credits (
      cookie_id TEXT PRIMARY KEY,
      date DATE NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      last_ip INET
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS anon_credits_ip_date_idx ON anon_credits(last_ip, date)`;

  console.log("Schema ready: accounts, profile_handles, results, follows, linked_identities, genres, moods, subjects, twists, affiliate_guilds, anon_credits");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
