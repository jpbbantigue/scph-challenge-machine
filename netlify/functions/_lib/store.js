// Per-account data storage using Netlify Blobs — a zero-config key/value
// store bundled into the Netlify platform, so Phase 2 doesn't need a
// separate database service.

const { getStore } = require("@netlify/blobs");

const STORE_NAME = "scph-user-data";
const HANDLES_STORE_NAME = "scph-profile-handles";

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
    // Credits/stats/profile were added after initial launch — every account
    // (new or existing) starts these at zero/defaults from here forward;
    // there is no historical data to migrate into them.
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
  const store = getStore(STORE_NAME);
  const raw = await store.get(userKey(user), { type: "json" });
  return mergeWithDefaults(raw);
}

async function saveUserData(user, data) {
  const store = getStore(STORE_NAME);
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
  await store.setJSON(userKey(user), toSave);
  return toSave;
}

// Checks the signed-in user's daily AI-credit balance, consuming one if
// available. This only gates calls to this site's own Groq key (the site's
// cost) — a visitor's own BYOK Claude/OpenAI key is never limited, since
// that's their own API cost, not the site's.
async function consumeAICredit(user) {
  const store = getStore(STORE_NAME);
  const data = await loadUserData(user);
  const today = todayStr();
  let credits = data.credits;
  if (credits.date !== today) credits = { date: today, used: 0 };
  if (credits.used >= DAILY_AI_CREDIT_LIMIT) {
    data.credits = credits;
    await store.setJSON(userKey(user), data);
    return { ok: false, remaining: 0, limit: DAILY_AI_CREDIT_LIMIT };
  }
  credits.used += 1;
  data.credits = credits;
  data.updatedAt = Date.now();
  await store.setJSON(userKey(user), data);
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
// across all accounts, tracked in a separate handle -> account-key store so
// a public profile page can look someone up without knowing their provider/sub.
async function setProfileHandle(user, handle, isPublic) {
  const store = getStore(STORE_NAME);
  const handlesStore = getStore(HANDLES_STORE_NAME);
  const data = await loadUserData(user);
  const key = userKey(user);
  const oldHandle = data.profile && data.profile.handle;

  if (handle === null || handle === "") {
    if (oldHandle) await handlesStore.delete(oldHandle);
    data.profile = { handle: null, public: false };
    data.updatedAt = Date.now();
    await store.setJSON(key, data);
    return { ok: true, profile: data.profile };
  }

  const normalized = normalizeHandle(handle);
  if (!isValidHandle(normalized)) {
    return { ok: false, error: "Handle must be 3-20 characters: letters, numbers, - or _ only." };
  }
  const existingOwner = await handlesStore.get(normalized, { type: "text" });
  if (existingOwner && existingOwner !== key) {
    return { ok: false, error: "That handle is already taken." };
  }
  if (oldHandle && oldHandle !== normalized) await handlesStore.delete(oldHandle);
  await handlesStore.set(normalized, key);
  data.profile = { handle: normalized, public: !!isPublic };
  data.updatedAt = Date.now();
  await store.setJSON(key, data);
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
  const handlesStore = getStore(HANDLES_STORE_NAME);
  const key = await handlesStore.get(normalized, { type: "text" });
  if (!key) return null;
  const store = getStore(STORE_NAME);
  const raw = await store.get(key, { type: "json" });
  const data = mergeWithDefaults(raw);
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
