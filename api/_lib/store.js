// Per-account data storage using Neon Postgres (see scripts/init-db.mjs for
// the schema). Same shape and function signatures as the Netlify Blobs
// version (netlify/functions/_lib/store.js) — only the storage layer differs
// — so the account/credits/profile logic on top didn't need to change.

const { getSql } = require("./db");

const DAILY_AI_CREDIT_LIMIT = 50;

function userKey(user) {
  return user.provider + ":" + user.sub;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

function defaultUserData() {
  return {
    favorites: [],
    history: [],
    settings: null,
    credits: { date: todayStr(), used: 0 },
    stats: { totalRolls: 0, categoryRolls: {}, streak: { current: 0, longest: 0, lastActiveDate: null } },
    profile: { handle: null, public: false },
    updatedAt: 0
  };
}

function mergeWithDefaults(raw) {
  const def = defaultUserData();
  if (!raw) return def;
  return {
    favorites: Array.isArray(raw.favorites) ? raw.favorites : def.favorites,
    history: Array.isArray(raw.history) ? raw.history : def.history,
    settings: raw.settings || def.settings,
    credits: raw.credits && typeof raw.credits.used === "number" ? raw.credits : def.credits,
    stats: raw.stats || def.stats,
    profile: raw.profile || def.profile,
    updatedAt: raw.updatedAt || 0
  };
}

async function loadUserData(user) {
  const sql = getSql();
  const rows = await sql`SELECT data FROM accounts WHERE account_key = ${userKey(user)}`;
  return mergeWithDefaults(rows[0] && rows[0].data);
}

async function writeAccount(key, data) {
  const sql = getSql();
  await sql`
    INSERT INTO accounts (account_key, data, updated_at)
    VALUES (${key}, ${JSON.stringify(data)}::jsonb, now())
    ON CONFLICT (account_key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
  `;
}

async function saveUserData(user, data) {
  const key = userKey(user);
  const current = await loadUserData(user);
  const toSave = {
    favorites: Array.isArray(data.favorites) ? data.favorites.slice(0, 200) : current.favorites,
    history: Array.isArray(data.history) ? data.history.slice(-100) : current.history,
    settings: data.settings || current.settings,
    credits: current.credits, // credits only change via consumeAICredit
    stats: data.stats || current.stats,
    profile: current.profile, // profile handle/visibility only changes via setProfileHandle
    updatedAt: Date.now()
  };
  await writeAccount(key, toSave);
  return toSave;
}

// Checks the signed-in user's daily AI-credit balance, consuming one if
// available. This only gates calls to this site's own Groq key (the site's
// cost) — a visitor's own BYOK Claude/OpenAI key is never limited, since
// that's their own API cost, not the site's.
async function consumeAICredit(user) {
  const key = userKey(user);
  const data = await loadUserData(user);
  const today = todayStr();
  let credits = data.credits;
  if (credits.date !== today) credits = { date: today, used: 0 };
  if (credits.used >= DAILY_AI_CREDIT_LIMIT) {
    data.credits = credits;
    await writeAccount(key, data);
    return { ok: false, remaining: 0, limit: DAILY_AI_CREDIT_LIMIT };
  }
  credits.used += 1;
  data.credits = credits;
  data.updatedAt = Date.now();
  await writeAccount(key, data);
  return { ok: true, remaining: DAILY_AI_CREDIT_LIMIT - credits.used, limit: DAILY_AI_CREDIT_LIMIT };
}

async function getCreditsStatus(user) {
  const data = await loadUserData(user);
  const today = todayStr();
  const credits = data.credits.date === today ? data.credits : { date: today, used: 0 };
  return { remaining: DAILY_AI_CREDIT_LIMIT - credits.used, limit: DAILY_AI_CREDIT_LIMIT };
}

function normalizeHandle(handle) {
  return String(handle || "").trim().toLowerCase();
}

function isValidHandle(handle) {
  return /^[a-z0-9_-]{3,20}$/.test(handle);
}

// Sets (or clears) this account's public profile handle. Handles are unique
// across all accounts, enforced by profile_handles' primary key.
async function setProfileHandle(user, handle, isPublic) {
  const sql = getSql();
  const key = userKey(user);
  const data = await loadUserData(user);
  const oldHandle = data.profile && data.profile.handle;

  if (handle === null || handle === "") {
    if (oldHandle) await sql`DELETE FROM profile_handles WHERE handle = ${oldHandle}`;
    data.profile = { handle: null, public: false };
    data.updatedAt = Date.now();
    await writeAccount(key, data);
    return { ok: true, profile: data.profile };
  }

  const normalized = normalizeHandle(handle);
  if (!isValidHandle(normalized)) {
    return { ok: false, error: "Handle must be 3-20 characters: letters, numbers, - or _ only." };
  }
  const existing = await sql`SELECT account_key FROM profile_handles WHERE handle = ${normalized}`;
  if (existing[0] && existing[0].account_key !== key) {
    return { ok: false, error: "That handle is already taken." };
  }
  if (oldHandle && oldHandle !== normalized) await sql`DELETE FROM profile_handles WHERE handle = ${oldHandle}`;
  await sql`
    INSERT INTO profile_handles (handle, account_key) VALUES (${normalized}, ${key})
    ON CONFLICT (handle) DO UPDATE SET account_key = EXCLUDED.account_key
  `;
  data.profile = { handle: normalized, public: !!isPublic };
  data.updatedAt = Date.now();
  await writeAccount(key, data);
  return { ok: true, profile: data.profile };
}

// Computes a small set of milestone badges from stats — no separate badge
// storage, just thresholds evaluated on read so new badges can be added
// later without a migration.
function computeBadges(stats) {
  const badges = [];
  const total = stats.totalRolls || 0;
  if (total >= 1) badges.push({ id: "first-roll", label: "First Roll" });
  if (total >= 10) badges.push({ id: "ten-rolls", label: "10 Rolls" });
  if (total >= 50) badges.push({ id: "fifty-rolls", label: "50 Rolls" });
  if (total >= 100) badges.push({ id: "hundred-rolls", label: "100 Rolls" });
  const catRolls = stats.categoryRolls || {};
  if ((catRolls.music || 0) >= 20) badges.push({ id: "music-fan", label: "Music Fan" });
  if ((catRolls.characters || 0) >= 20) badges.push({ id: "character-fan", label: "Character Fan" });
  const streak = (stats.streak && stats.streak.longest) || 0;
  if (streak >= 3) badges.push({ id: "streak-3", label: "3-Day Streak" });
  if (streak >= 7) badges.push({ id: "streak-7", label: "7-Day Streak" });
  return badges;
}

// Public read by handle — only returns data if the profile is public.
async function getPublicProfileByHandle(handle) {
  const normalized = normalizeHandle(handle);
  if (!isValidHandle(normalized)) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT a.data FROM profile_handles h
    JOIN accounts a ON a.account_key = h.account_key
    WHERE h.handle = ${normalized}
  `;
  if (!rows[0]) return null;
  const data = mergeWithDefaults(rows[0].data);
  if (!data.profile || data.profile.handle !== normalized || !data.profile.public) return null;
  return {
    handle: normalized,
    stats: data.stats,
    badges: computeBadges(data.stats)
  };
}

module.exports = {
  loadUserData,
  saveUserData,
  consumeAICredit,
  getCreditsStatus,
  setProfileHandle,
  getPublicProfileByHandle,
  computeBadges,
  DAILY_AI_CREDIT_LIMIT
};
