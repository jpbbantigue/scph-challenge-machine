// Shared Neon Postgres client for Vercel Functions. Uses the pooled
// connection string (POSTGRES_URL / DATABASE_URL, both point at the
// "-pooler" endpoint) via the HTTP-based serverless driver — no persistent
// connection to manage, safe for Vercel's per-invocation function model.

const { neon } = require("@neondatabase/serverless");

function getSql() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Server is missing POSTGRES_URL / DATABASE_URL");
  return neon(connectionString);
}

module.exports = { getSql };
