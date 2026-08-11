// Shared Neon Postgres client for Next.js Route Handlers. Uses the pooled
// connection string (POSTGRES_URL / DATABASE_URL, both point at the
// "-pooler" endpoint) via the HTTP-based serverless driver — no persistent
// connection to manage, safe for a per-invocation serverless function model.

import { neon, NeonQueryFunction } from "@neondatabase/serverless";

export function getSql(): NeonQueryFunction<false, false> {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Server is missing POSTGRES_URL / DATABASE_URL");
  return neon(connectionString);
}
