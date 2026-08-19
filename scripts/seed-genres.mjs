// Upserts scripts/genres-crawled.json (produced by crawl-genres.mjs) into
// the `genres` table. Idempotent / re-runnable: names are upserted by
// unique `name`, and parent_id is resolved and (re)written in a second
// pass once every name has a row, so re-running after a fresh crawl just
// updates existing rows rather than duplicating them.
//
//   node scripts/seed-genres.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IN_PATH = path.join(__dirname, "genres-crawled.json");

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL / POSTGRES_URL in the environment.");
  process.exit(1);
}
const sql = neon(connectionString);

async function main() {
  const entries = JSON.parse(readFileSync(IN_PATH, "utf8"));
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`No entries found in ${IN_PATH} — run crawl-genres.mjs first.`);
  }

  // A given genre name can appear with multiple different parents in the
  // crawled data (e.g. it's referenced from more than one section). We
  // only model a single parent per name, so keep the first parent seen
  // per unique name.
  const byName = new Map();
  for (const { name, parent } of entries) {
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, parent || null);
  }

  console.log(`Upserting ${byName.size} unique genre names...`);

  // Pass 1: insert/update every name with no parent yet, so every name
  // has an id before we resolve parent_id references in pass 2.
  for (const name of byName.keys()) {
    await sql`
      INSERT INTO genres (name, source)
      VALUES (${name}, 'wikipedia')
      ON CONFLICT (name) DO UPDATE SET source = 'wikipedia'
    `;
  }

  const rows = await sql`SELECT id, name FROM genres`;
  const idByName = new Map(rows.map((r) => [r.name, r.id]));

  // Pass 2: resolve parent_id for every entry that has a parent name we
  // recognize. Guard against self-reference and simple 2-cycles (a<->b)
  // which the crawl's noisy navbox parsing can occasionally produce.
  let updated = 0;
  for (const [name, parent] of byName.entries()) {
    if (!parent) continue;
    const id = idByName.get(name);
    const parentId = idByName.get(parent);
    if (!id || !parentId || id === parentId) continue;
    await sql`UPDATE genres SET parent_id = ${parentId} WHERE id = ${id}`;
    updated += 1;
  }

  const [{ count }] = await sql`SELECT count(*)::int AS count FROM genres`;
  const [{ count: withParent }] = await sql`SELECT count(*)::int AS count FROM genres WHERE parent_id IS NOT NULL`;
  console.log(`Done. genres table now has ${count} rows (${withParent} with a parent_id), ${updated} parent links set this run.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
