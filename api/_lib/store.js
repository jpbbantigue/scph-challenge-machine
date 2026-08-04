// Per-account data storage using Neon Postgres (see scripts/init-db.mjs for
// the schema): one `accounts` row per signed-in user (JSONB blob for
// favorites/history/settings/credits/stats/profile — cheap to evolve
// without migrations), plus dedicated `results` and `follows` tables for
// the two relational bits (a user has many results; follows are an edge
// between two accounts).

const { getSql } = require("./db");

const DAILY_AI_CREDIT_LIMIT = 50;
const MAX_SOCIALS = 8;
const MAX_LINKED_ACCOUNTS = 8;
const MAX_BIO_LEN = 200;

function userKey(user) {
  return user.provider + ":" + user.sub;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

function defaultProfile() {
  return { handle: null, public: false, displayName: null, bio: "", socials: [], linkedAccounts: [] };
}

function defaultUserData() {
  return {
    favorites: [],
    history: [],
    settings: null,
    credits: { date: todayStr(), used: 0 },
    stats: { totalRolls: 0, categoryRolls: {}, streak: { current: 0, longest: 0, lastActiveDate: null } },
    profile: defaultProfile(),
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
    profile: Object.assign(defaultProfile(), raw.profile || {}),
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
    profile: current.profile, // profile fields only change via the profile-* functions below
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

// Sets this account's username (the "handle" used for its public profile
// URL). Write-once by design, matching the mockup: once set, it can't be
// changed again — only the `public` visibility toggle stays editable
// afterward via setProfilePublic. Handles are unique across all accounts,
// enforced by profile_handles' primary key.
async function setUsername(user, handle) {
  const sql = getSql();
  const key = userKey(user);
  const data = await loadUserData(user);
  if (data.profile.handle) {
    return { ok: false, error: "Username can only be set once — it's already " + data.profile.handle + "." };
  }
  const normalized = normalizeHandle(handle);
  if (!isValidHandle(normalized)) {
    return { ok: false, error: "Username must be 3-20 characters: letters, numbers, - or _ only." };
  }
  const existing = await sql`SELECT account_key FROM profile_handles WHERE handle = ${normalized}`;
  if (existing[0] && existing[0].account_key !== key) {
    return { ok: false, error: "That username is already taken." };
  }
  await sql`
    INSERT INTO profile_handles (handle, account_key) VALUES (${normalized}, ${key})
    ON CONFLICT (handle) DO UPDATE SET account_key = EXCLUDED.account_key
  `;
  data.profile.handle = normalized;
  data.updatedAt = Date.now();
  await writeAccount(key, data);
  return { ok: true, profile: data.profile };
}

async function setProfilePublic(user, isPublic) {
  const key = userKey(user);
  const data = await loadUserData(user);
  data.profile.public = !!isPublic;
  data.updatedAt = Date.now();
  await writeAccount(key, data);
  return { ok: true, profile: data.profile };
}

function sanitizeSocials(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_SOCIALS).map((s) => ({
    platform: String((s && s.platform) || "").trim().slice(0, 40),
    value: String((s && s.value) || "").trim().slice(0, 200)
  })).filter((s) => s.platform && s.value);
}

function sanitizeLinkedAccounts(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_LINKED_ACCOUNTS).map((a) => ({
    platform: String((a && a.platform) || "").trim().slice(0, 40),
    handle: String((a && a.handle) || "").trim().slice(0, 100),
    connected: !!(a && a.connected)
  })).filter((a) => a.platform && a.handle);
}

// Updates the editable profile fields (everything except the write-once
// username and the visibility toggle, which have their own functions above).
async function updateProfileFields(user, fields) {
  const key = userKey(user);
  const data = await loadUserData(user);
  if (typeof fields.displayName === "string") data.profile.displayName = fields.displayName.trim().slice(0, 60) || null;
  if (typeof fields.bio === "string") data.profile.bio = fields.bio.trim().slice(0, MAX_BIO_LEN);
  if (fields.socials !== undefined) data.profile.socials = sanitizeSocials(fields.socials);
  if (fields.linkedAccounts !== undefined) data.profile.linkedAccounts = sanitizeLinkedAccounts(fields.linkedAccounts);
  data.updatedAt = Date.now();
  await writeAccount(key, data);
  return data.profile;
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

// Achievement tiers per category: Bronze 1+, Silver 3+, Gold 10+, Platinum
// 25+ linked results — thresholds are illustrative (per the design doc),
// adjust once real usage data exists. Conversion % = results / rolls in
// that category.
const ACHIEVEMENT_TIERS = [
  { min: 25, name: "Platinum" },
  { min: 10, name: "Gold" },
  { min: 3, name: "Silver" },
  { min: 1, name: "Bronze" }
];
function tierForCount(count) {
  const tier = ACHIEVEMENT_TIERS.find((t) => count >= t.min);
  return tier ? tier.name : null;
}
async function computeAchievements(accountKey, stats) {
  const sql = getSql();
  const rows = await sql`
    SELECT category_id, COUNT(*)::int AS count FROM results
    WHERE account_key = ${accountKey} GROUP BY category_id
  `;
  const catRolls = (stats && stats.categoryRolls) || {};
  return rows.map((r) => {
    const rolls = catRolls[r.category_id] || 0;
    return {
      categoryId: r.category_id,
      count: r.count,
      tier: tierForCount(r.count),
      conversionPct: rolls > 0 ? Math.round((r.count / rolls) * 100) : null
    };
  });
}

// ---------------- Results (user-linked "I made this" entries) ----------------

async function addResult(user, { categoryId, rollType, promptText, resultUrl }) {
  const sql = getSql();
  const key = userKey(user);
  const rows = await sql`
    INSERT INTO results (account_key, category_id, roll_type, prompt_text, result_url)
    VALUES (${key}, ${String(categoryId).slice(0, 40)}, ${String(rollType || "free").slice(0, 20)}, ${String(promptText).slice(0, 500)}, ${resultUrl ? String(resultUrl).slice(0, 500) : null})
    RETURNING id, category_id, roll_type, prompt_text, result_url, created_at
  `;
  return rows[0];
}

async function listResults(user) {
  const sql = getSql();
  const key = userKey(user);
  return sql`
    SELECT id, category_id, roll_type, prompt_text, result_url, created_at FROM results
    WHERE account_key = ${key} ORDER BY created_at DESC LIMIT 200
  `;
}

async function removeResult(user, id) {
  const sql = getSql();
  const key = userKey(user);
  await sql`DELETE FROM results WHERE id = ${id} AND account_key = ${key}`;
  return { ok: true };
}

async function listPublicResults(accountKey, categoryId) {
  const sql = getSql();
  if (categoryId) {
    return sql`
      SELECT id, category_id, prompt_text, result_url, created_at FROM results
      WHERE account_key = ${accountKey} AND category_id = ${categoryId}
      ORDER BY created_at DESC LIMIT 100
    `;
  }
  return sql`
    SELECT id, category_id, prompt_text, result_url, created_at FROM results
    WHERE account_key = ${accountKey} ORDER BY created_at DESC LIMIT 100
  `;
}

// ---------------- Follows ----------------

async function followAccount(followerUser, targetHandle) {
  const sql = getSql();
  const followerKey = userKey(followerUser);
  const normalized = normalizeHandle(targetHandle);
  const rows = await sql`SELECT account_key FROM profile_handles WHERE handle = ${normalized}`;
  if (!rows[0]) return { ok: false, error: "That user doesn't exist." };
  const followeeKey = rows[0].account_key;
  if (followeeKey === followerKey) return { ok: false, error: "You can't follow yourself." };
  await sql`
    INSERT INTO follows (follower_key, followee_key) VALUES (${followerKey}, ${followeeKey})
    ON CONFLICT DO NOTHING
  `;
  return { ok: true, following: true };
}

async function unfollowAccount(followerUser, targetHandle) {
  const sql = getSql();
  const followerKey = userKey(followerUser);
  const normalized = normalizeHandle(targetHandle);
  const rows = await sql`SELECT account_key FROM profile_handles WHERE handle = ${normalized}`;
  if (!rows[0]) return { ok: false, error: "That user doesn't exist." };
  await sql`DELETE FROM follows WHERE follower_key = ${followerKey} AND followee_key = ${rows[0].account_key}`;
  return { ok: true, following: false };
}

// Follower count is private — "only visible to you" per the design — so
// this is only ever called for the signed-in owner (see auth-me.js), never
// exposed on the public profile response.
async function getFollowerCount(accountKey) {
  const sql = getSql();
  const rows = await sql`SELECT COUNT(*)::int AS n FROM follows WHERE followee_key = ${accountKey}`;
  return rows[0] ? rows[0].n : 0;
}

// Full follower list (handle + display name) — private, for the "N
// followers" modal on the owner's own Account > Profile tab only.
async function listFollowers(accountKey) {
  const sql = getSql();
  const rows = await sql`
    SELECT h.handle, a.data->'profile'->>'displayName' AS display_name
    FROM follows f
    JOIN profile_handles h ON h.account_key = f.follower_key
    JOIN accounts a ON a.account_key = f.follower_key
    WHERE f.followee_key = ${accountKey}
    ORDER BY f.created_at DESC LIMIT 200
  `;
  return rows.map((r) => ({ handle: r.handle, displayName: r.display_name || r.handle }));
}

async function isFollowingHandle(viewerUser, targetHandle) {
  if (!viewerUser) return false;
  const sql = getSql();
  const followerKey = userKey(viewerUser);
  const normalized = normalizeHandle(targetHandle);
  const rows = await sql`
    SELECT 1 FROM follows f
    JOIN profile_handles h ON h.account_key = f.followee_key
    WHERE f.follower_key = ${followerKey} AND h.handle = ${normalized}
  `;
  return rows.length > 0;
}

// Public read by handle — only returns data if the profile is public.
// `viewerUser` (optional) is the signed-in visitor looking at this profile,
// used only to compute `isFollowing` — never to expose private data.
async function getPublicProfileByHandle(handle, { categoryId, viewerUser } = {}) {
  const normalized = normalizeHandle(handle);
  if (!isValidHandle(normalized)) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT a.account_key, a.data FROM profile_handles h
    JOIN accounts a ON a.account_key = h.account_key
    WHERE h.handle = ${normalized}
  `;
  if (!rows[0]) return null;
  const data = mergeWithDefaults(rows[0].data);
  if (!data.profile || data.profile.handle !== normalized || !data.profile.public) return null;

  const [results, achievements, following] = await Promise.all([
    listPublicResults(rows[0].account_key, categoryId),
    computeAchievements(rows[0].account_key, data.stats),
    isFollowingHandle(viewerUser, normalized)
  ]);

  return {
    handle: normalized,
    displayName: data.profile.displayName || normalized,
    bio: data.profile.bio || "",
    socials: data.profile.socials || [],
    linkedAccounts: data.profile.linkedAccounts || [],
    stats: data.stats,
    badges: computeBadges(data.stats),
    achievements: achievements,
    results: results,
    isFollowing: following
  };
}

// ---------------- Account deletion ----------------

async function deleteAccount(user) {
  const sql = getSql();
  const key = userKey(user);
  // profile_handles/results/follows all reference accounts(account_key)
  // ON DELETE CASCADE, so removing the account row is sufficient.
  await sql`DELETE FROM accounts WHERE account_key = ${key}`;
  return { ok: true };
}

module.exports = {
  loadUserData,
  saveUserData,
  consumeAICredit,
  getCreditsStatus,
  setUsername,
  setProfilePublic,
  updateProfileFields,
  computeBadges,
  computeAchievements,
  addResult,
  listResults,
  removeResult,
  listPublicResults,
  followAccount,
  unfollowAccount,
  getFollowerCount,
  listFollowers,
  isFollowingHandle,
  getPublicProfileByHandle,
  deleteAccount,
  DAILY_AI_CREDIT_LIMIT
};
