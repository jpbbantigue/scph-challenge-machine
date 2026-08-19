// Seeds the moods/subjects/twists tables from scripts/reel-data-seed.json.
// Idempotent-ish: clears and re-inserts each table's 'music' rows every
// run (simplest correct behavior for a small hand-authored list that's
// edited in place rather than incrementally appended to).
//
//   node scripts/seed-reel-data.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IN_PATH = path.join(__dirname, "reel-data-seed.json");

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL / POSTGRES_URL in the environment.");
  process.exit(1);
}
const sql = neon(connectionString);

const TABLES = { moods: "moods", subjects: "subjects", twists: "twists" };

async function main() {
  const data = JSON.parse(readFileSync(IN_PATH, "utf8"));

  for (const [key, table] of Object.entries(TABLES)) {
    const items = data[key];
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error(`No items for "${key}" in ${IN_PATH}`);
    }
    // Re-seed music-category rows from scratch each run so edits to the
    // JSON list (additions/removals/rewording) are reflected exactly.
    if (table === "moods") await sql`DELETE FROM moods WHERE category_id = 'music'`;
    if (table === "subjects") await sql`DELETE FROM subjects WHERE category_id = 'music'`;
    if (table === "twists") await sql`DELETE FROM twists WHERE category_id = 'music'`;

    for (const text of items) {
      if (table === "moods") await sql`INSERT INTO moods (text, category_id, active) VALUES (${text}, 'music', true)`;
      if (table === "subjects") await sql`INSERT INTO subjects (text, category_id, active) VALUES (${text}, 'music', true)`;
      if (table === "twists") await sql`INSERT INTO twists (text, category_id, active) VALUES (${text}, 'music', true)`;
    }
    console.log(`Seeded ${items.length} rows into ${table}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
