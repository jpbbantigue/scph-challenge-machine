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
  console.log("Schema ready: accounts, profile_handles, results, follows");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
