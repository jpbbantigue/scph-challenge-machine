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
  console.log("Schema ready: accounts, profile_handles");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
