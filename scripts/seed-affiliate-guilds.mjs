// Small maintenance script for the affiliate_guilds table (approved
// partner Discord servers whose members get the "affiliate" credit tier).
// No admin UI yet — edit AFFILIATE_GUILDS below and re-run to add/update
// entries. Upserts by guild_id, so it's safe to re-run any time; ships
// with an empty list (no partner servers yet), which is fine.
//
//   node scripts/seed-affiliate-guilds.mjs

import { neon } from "@neondatabase/serverless";

// Add entries here as partner servers are approved, e.g.:
//   { guildId: "123456789012345678", name: "Some Partner Server" },
const AFFILIATE_GUILDS = [];

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL / POSTGRES_URL in the environment.");
  process.exit(1);
}
const sql = neon(connectionString);

async function main() {
  if (AFFILIATE_GUILDS.length === 0) {
    console.log("AFFILIATE_GUILDS is empty — nothing to seed (this is fine, the table just stays empty).");
    return;
  }
  for (const { guildId, name } of AFFILIATE_GUILDS) {
    await sql`
      INSERT INTO affiliate_guilds (guild_id, name)
      VALUES (${guildId}, ${name || null})
      ON CONFLICT (guild_id) DO UPDATE SET name = EXCLUDED.name
    `;
  }
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM affiliate_guilds`;
  console.log(`Done. affiliate_guilds table now has ${count} rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
