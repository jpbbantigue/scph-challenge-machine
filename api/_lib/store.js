// Per-account data storage using Neon Postgres (see scripts/init-db.mjs for
// the schema): one `accounts` row per signed-in user (JSONB blob for
// favorites/history/settings/credits/stats/profile — cheap to evolve
// without migrations), plus dedicated `results` and `follows` tables for
// the two relational bits (a user has many results; follows are an edge
// between two accounts).

const { getSql } = require("./db");

// Tiered daily AI-credit limits. "scph" is verified automatically at
// Discord sign-in (see auth-callback.js, which checks the visitor's guild
// list against SCPH_GUILD_ID and stamps the tier onto the session). A third
// "affiliate" tier (75/day, for approved partner Discord servers) is
// planned but deferred — see PHASING.md.
const CREDIT_LIMITS = { basic: 50, scph: 100 };
const DEFAULT_TIER = "basic";
function creditLimitForTier(tier) {
  return CREDIT_LIMITS[tier] || CREDIT_LIMITS[DEFAULT_TIER];
}
const DAILY_AI_CREDIT_LIMIT = CREDIT_LIMITS[DEFAULT_TIER]; // kept for back-compat reference
const MAX_SOCIALS = 8;
const MAX_LINKED_ACCOUNTS = 8;
const MAX_BIO_LEN = 200;

// The account key a session operates on. Normally just "provider:sub" (the
// identity used to sign in), but if that identity has been linked to
// another account (see linkIdentity below), the session carries the
// canonical accountKey from sign-in time instead — see auth-callback.js.
function userKey(user) {
  return user.accountKey || (user.provider + ":" + user.sub);
}

// Looks up whether (provider, sub) has been linked to another account;
// falls back to its own default identity key if not. Called once at
// sign-in (auth-callback.js) and baked into the session — not re-checked
// per request.
async function resolveAccountKey({ provider, sub }) {
  const defaultKey = provider + ":" + sub;
  const sql = getSql();
  const rows = await sql`SELECT account_key FROM linked_identities WHERE provider = ${provider} AND sub = ${sub}`;
  return rows[0] ? rows[0].account_key : defaultKey;
}

async function ensureAccountExists(key) {
  const sql = getSql();
  await sql`INSERT INTO accounts (account_key, data) VALUES (${key}, '{}'::jsonb) ON CONFLICT (account_key) DO NOTHING`;
}

// Links a second (or third) sign-in identity to the visitor's existing
// account, so they can sign in with either Google or Discord afterward and
// land on the same account. Refuses to link an identity that's already
// tied to a *different* account (no automatic merging — that's a support
// request, not a self-serve action, to avoid silently discarding data).
async function linkIdentity(existingUser, newProvider, newSub) {
  const existingKey = userKey(existingUser);
  const newIdentityKey = newProvider + ":" + newSub;
  if (newIdentityKey === existingKey) return { ok: true }; // no-op: same identity
  const sql = getSql();

  const existingLink = await sql`SELECT account_key FROM linked_identities WHERE provider = ${newProvider} AND sub = ${newSub}`;
  if (existingLink[0]) {
    if (existingLink[0].account_key === existingKey) return { ok: true }; // already linked here
    return { ok: false, error: "That account is already linked to a different Prompt Royale account." };
  }
  const ownAccount = await sql`SELECT 1 FROM accounts WHERE account_key = ${newIdentityKey}`;
  if (ownAccount[0]) {
    return { ok: false, error: "That account already has its own Prompt Royale profile — sign in with it directly instead of linking." };
  }

  await ensureAccountExists(existingKey);
  await sql`INSERT INTO linked_identities (provider, sub, account_key) VALUES (${newProvider}, ${newSub}, ${existingKey})`;
  return { ok: true };
}

// Every provider currently linked to this account — its own primary
// identity (implicit: the provider prefix of its account_key) plus
// anything in linked_identities. Used to render Connect/Connected state in
// Settings.
async function getLinkedProviders(user) {
  const key = userKey(user);
  const sql = getSql();
  const rows = await sql`SELECT provider FROM linked_identities WHERE account_key = ${key}`;
  const providers = new Set(rows.map((r) => r.provider));
  providers.add(key.split(":")[0]);
  return Array.from(providers);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

function defaultProfile() {
  return { handle: null, displayName: null, bio: "", socials: [], linkedAccounts: [] };
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
  const limit = creditLimitForTier(user.tier);
  const data = await loadUserData(user);
  const today = todayStr();
  let credits = data.credits;
  if (credits.date !== today) credits = { date: today, used: 0 };
  if (credits.used >= limit) {
    data.credits = credits;
    await writeAccount(key, data);
    return { ok: false, remaining: 0, limit };
  }
  credits.used += 1;
  data.credits = credits;
  data.updatedAt = Date.now();
  await writeAccount(key, data);
  return { ok: true, remaining: limit - credits.used, limit };
}

async function getCreditsStatus(user) {
  const limit = creditLimitForTier(user.tier);
  const data = await loadUserData(user);
  const today = todayStr();
  const credits = data.credits.date === today ? data.credits : { date: today, used: 0 };
  return { remaining: limit - credits.used, limit };
}

function normalizeHandle(handle) {
  return String(handle || "").trim().toLowerCase();
}

function isValidHandle(handle) {
  return /^[a-z0-9_-]{3,20}$/.test(handle);
}

// Sets this account's username (the "handle" used for its public profile
// URL). Write-once by design, matching the mockup: once set, it can't be
// changed again. There's no separate public/private toggle — per the
// design, a profile is simply visible once it has a username. Handles are
// unique across all accounts, enforced by profile_handles' primary key.
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
  if (!data.profile || data.profile.handle !== normalized) return null;

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
  resolveAccountKey,
  linkIdentity,
  getLinkedProviders,
  CREDIT_LIMITS,
  creditLimitForTier,
  DAILY_AI_CREDIT_LIMIT
};
