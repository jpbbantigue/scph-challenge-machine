// Per-account data storage using Neon Postgres — ported from api/_lib/store.js.
// One `accounts` row per signed-in user (JSONB blob for favorites/history/
// settings/credits/stats/profile), plus dedicated `results` and `follows`
// tables for the two relational bits.

import { getSql } from "./db";
import type { SessionUser } from "./session";

// Tiered daily AI-credit limits. "scph" is verified automatically at
// Discord sign-in (see auth-callback, which checks the visitor's guild list
// against SCPH_GUILD_ID and stamps the tier onto the session); "affiliate"
// is verified the same way against a partner server's guild ID (see
// affiliate_guilds table / auth-callback's computeDiscordTier). "paid" is a
// numbers-only placeholder tier — no billing integration exists yet, so
// nothing currently grants it, but the limit is wired up for when it does.
// BYOK (bring-your-own-key) is unlimited at every tier — none of this
// applies to it, it never calls this site's own Groq key.
export const CREDIT_LIMITS: Record<string, number> = { basic: 20, affiliate: 75, scph: 100, paid: 300 };
const DEFAULT_TIER = "basic";
export function creditLimitForTier(tier?: string | null): number {
  return (tier && CREDIT_LIMITS[tier]) || CREDIT_LIMITS[DEFAULT_TIER];
}
export const DAILY_AI_CREDIT_LIMIT = CREDIT_LIMITS[DEFAULT_TIER]; // kept for back-compat reference

// Anonymous (not signed-in) visitors get a small real daily allowance too,
// tracked by the scph_anon cookie (see lib/session.ts) plus a per-IP
// backstop against cookie-clearing abuse — see consumeAnonCredit below.
export const ANON_CREDIT_LIMIT = 3;
const MAX_SOCIALS = 8;
const MAX_LINKED_ACCOUNTS = 8;
const MAX_BIO_LEN = 200;

export interface Social {
  platform: string;
  value: string;
}
export interface LinkedAccount {
  platform: string;
  handle: string;
}
export interface Profile {
  handle: string | null;
  displayName: string | null;
  bio: string;
  socials: Social[];
  linkedAccounts: LinkedAccount[];
}
export interface Streak {
  current: number;
  longest: number;
  lastActiveDate: string | null;
}
export interface Stats {
  totalRolls: number;
  categoryRolls: Record<string, number>;
  streak: Streak;
}
export interface Credits {
  date: string;
  used: number;
}
// Groq's usage.total_tokens per call, summed per pull and tracked both
// per-day (resets like credits) and lifetime (never resets) — surfaced via
// /api/auth-me so account.html/Settings can show it.
export interface TokensUsed {
  date: string;
  today: number;
  lifetime: number;
}
export interface UserData {
  favorites: any[];
  history: any[];
  settings: any;
  credits: Credits;
  tokensUsed: TokensUsed;
  stats: Stats;
  profile: Profile;
  updatedAt: number;
}

// The account key a session operates on. Normally just "provider:sub" (the
// identity used to sign in), but if that identity has been linked to
// another account, the session carries the canonical accountKey instead.
function userKey(user: SessionUser): string {
  return user.accountKey || user.provider + ":" + user.sub;
}

// Looks up whether (provider, sub) has been linked to another account;
// falls back to its own default identity key if not. Called once at
// sign-in and baked into the session — not re-checked per request.
export async function resolveAccountKey({ provider, sub }: { provider: string; sub: string }): Promise<string> {
  const defaultKey = provider + ":" + sub;
  const sql = getSql();
  const rows = await sql`SELECT account_key FROM linked_identities WHERE provider = ${provider} AND sub = ${sub}`;
  return rows[0] ? (rows[0].account_key as string) : defaultKey;
}

async function ensureAccountExists(key: string): Promise<void> {
  const sql = getSql();
  await sql`INSERT INTO accounts (account_key, data) VALUES (${key}, '{}'::jsonb) ON CONFLICT (account_key) DO NOTHING`;
}

// Links a second (or third) sign-in identity to the visitor's existing
// account. Refuses to link an identity that's already tied to a *different*
// account (no automatic merging).
export async function linkIdentity(
  existingUser: SessionUser,
  newProvider: string,
  newSub: string
): Promise<{ ok: boolean; error?: string }> {
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

// Every provider currently linked to this account.
export async function getLinkedProviders(user: SessionUser): Promise<string[]> {
  const key = userKey(user);
  const sql = getSql();
  const rows = await sql`SELECT provider FROM linked_identities WHERE account_key = ${key}`;
  const providers = new Set<string>(rows.map((r: any) => r.provider));
  providers.add(key.split(":")[0]);
  return Array.from(providers);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

function defaultProfile(): Profile {
  return { handle: null, displayName: null, bio: "", socials: [], linkedAccounts: [] };
}

function defaultUserData(): UserData {
  return {
    favorites: [],
    history: [],
    settings: null,
    credits: { date: todayStr(), used: 0 },
    tokensUsed: { date: todayStr(), today: 0, lifetime: 0 },
    stats: { totalRolls: 0, categoryRolls: {}, streak: { current: 0, longest: 0, lastActiveDate: null } },
    profile: defaultProfile(),
    updatedAt: 0
  };
}

function mergeWithDefaults(raw: any): UserData {
  const def = defaultUserData();
  if (!raw) return def;
  return {
    favorites: Array.isArray(raw.favorites) ? raw.favorites : def.favorites,
    history: Array.isArray(raw.history) ? raw.history : def.history,
    settings: raw.settings || def.settings,
    credits: raw.credits && typeof raw.credits.used === "number" ? raw.credits : def.credits,
    tokensUsed: raw.tokensUsed && typeof raw.tokensUsed.lifetime === "number" ? raw.tokensUsed : def.tokensUsed,
    stats: raw.stats || def.stats,
    profile: Object.assign(defaultProfile(), raw.profile || {}),
    updatedAt: raw.updatedAt || 0
  };
}

export async function loadUserData(user: SessionUser): Promise<UserData> {
  const sql = getSql();
  const rows = await sql`SELECT data FROM accounts WHERE account_key = ${userKey(user)}`;
  return mergeWithDefaults(rows[0] && rows[0].data);
}

async function writeAccount(key: string, data: any): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO accounts (account_key, data, updated_at)
    VALUES (${key}, ${JSON.stringify(data)}::jsonb, now())
    ON CONFLICT (account_key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
  `;
}

export async function saveUserData(user: SessionUser, data: Partial<UserData>): Promise<UserData> {
  const key = userKey(user);
  const current = await loadUserData(user);
  const toSave: UserData = {
    favorites: Array.isArray(data.favorites) ? data.favorites.slice(0, 200) : current.favorites,
    history: Array.isArray(data.history) ? data.history.slice(-100) : current.history,
    settings: data.settings || current.settings,
    credits: current.credits, // credits only change via reserveAICredit/commitAICreditUsage
    tokensUsed: current.tokensUsed, // tokensUsed only changes via commitAICreditUsage
    stats: data.stats || current.stats,
    profile: current.profile, // profile fields only change via the profile-* functions below
    updatedAt: Date.now()
  };
  await writeAccount(key, toSave);
  return toSave;
}

// Checks the signed-in user's daily AI-credit balance, consuming one if
// available. This only gates calls to this site's own Groq key. Split into
// reserve (before the Groq calls, so a request over the limit never even
// starts them) + commit (after, once the actual token usage is known) —
// see commitAICreditUsage below.
export async function reserveAICredit(
  user: SessionUser
): Promise<{ ok: boolean; remaining: number; limit: number; data: UserData }> {
  const limit = creditLimitForTier(user.tier);
  const data = await loadUserData(user);
  const today = todayStr();
  let credits = data.credits;
  if (credits.date !== today) credits = { date: today, used: 0 };
  if (credits.used >= limit) {
    data.credits = credits;
    return { ok: false, remaining: 0, limit, data };
  }
  credits.used += 1;
  data.credits = credits;
  return { ok: true, remaining: limit - credits.used, limit, data };
}

// Commits the reservation from reserveAICredit and records this pull's
// token usage (per-day + lifetime) in one write.
export async function commitAICreditUsage(
  user: SessionUser,
  reserved: { data: UserData },
  totalTokens: number
): Promise<{ remaining: number }> {
  const key = userKey(user);
  const data = reserved.data;
  const today = todayStr();
  let tokensUsed = data.tokensUsed || { date: today, today: 0, lifetime: 0 };
  if (tokensUsed.date !== today) tokensUsed = { date: today, today: 0, lifetime: tokensUsed.lifetime || 0 };
  tokensUsed.today += totalTokens;
  tokensUsed.lifetime = (tokensUsed.lifetime || 0) + totalTokens;
  data.tokensUsed = tokensUsed;
  data.updatedAt = Date.now();
  await writeAccount(key, data);
  const limit = creditLimitForTier(user.tier);
  return { remaining: limit - data.credits.used };
}

export async function getCreditsStatus(user: SessionUser): Promise<{ remaining: number; limit: number }> {
  const limit = creditLimitForTier(user.tier);
  const data = await loadUserData(user);
  const today = todayStr();
  const credits = data.credits.date === today ? data.credits : { date: today, used: 0 };
  return { remaining: limit - credits.used, limit };
}

// ---------------- Anonymous (not signed-in) AI credits ----------------
// Backed by the `anon_credits` table (see scripts/init-db.mjs on the static
// site: cookie_id TEXT PK, date, used, last_ip INET) keyed by the
// scph_anon cookie ID, with a per-IP daily cap (3x the per-cookie limit) as
// a backstop against clearing the cookie to farm more pulls. This table
// already exists in the shared Neon DB (same project as the static site),
// so column names here must match that schema exactly rather than
// introducing a parallel shape.
export const ANON_IP_CREDIT_LIMIT = ANON_CREDIT_LIMIT * 3;

export async function getAnonCreditsStatus(anonId: string): Promise<{ remaining: number; limit: number }> {
  const sql = getSql();
  const today = todayStr();
  const rows = await sql`SELECT to_char(date, 'YYYY-MM-DD') AS date, used FROM anon_credits WHERE cookie_id = ${anonId}`;
  const used = rows[0] && rows[0].date === today ? (rows[0].used as number) : 0;
  return { remaining: Math.max(0, ANON_CREDIT_LIMIT - used), limit: ANON_CREDIT_LIMIT };
}

export async function consumeAnonCredit(
  anonId: string,
  ip: string | null
): Promise<{ ok: boolean; remaining: number; limit: number }> {
  const sql = getSql();
  const today = todayStr();

  const rows = await sql`SELECT to_char(date, 'YYYY-MM-DD') AS date, used FROM anon_credits WHERE cookie_id = ${anonId}`;
  const cookieUsed = rows[0] && rows[0].date === today ? (rows[0].used as number) : 0;
  if (cookieUsed >= ANON_CREDIT_LIMIT) {
    return { ok: false, remaining: 0, limit: ANON_CREDIT_LIMIT };
  }

  // Per-IP backstop: even with a fresh cookie, the same IP can't blow past
  // 3x the per-cookie limit either — blunts trivial cookie-clearing abuse
  // without blocking legitimate distinct users behind a shared IP.
  if (ip) {
    const ipRows = await sql`
      SELECT COALESCE(SUM(used), 0)::int AS total FROM anon_credits
      WHERE last_ip = ${ip}::inet AND date = ${today}::date
    `;
    const ipUsed = ipRows[0] ? (ipRows[0].total as number) : 0;
    if (ipUsed >= ANON_IP_CREDIT_LIMIT) {
      return { ok: false, remaining: 0, limit: ANON_CREDIT_LIMIT };
    }
  }

  const nextUsed = cookieUsed + 1;
  const ipParam = ip || null;
  await sql`
    INSERT INTO anon_credits (cookie_id, date, used, last_ip)
    VALUES (${anonId}, ${today}::date, ${nextUsed}, ${ipParam}::inet)
    ON CONFLICT (cookie_id) DO UPDATE SET date = ${today}::date, used = ${nextUsed}, last_ip = COALESCE(${ipParam}::inet, anon_credits.last_ip)
  `;
  return { ok: true, remaining: ANON_CREDIT_LIMIT - nextUsed, limit: ANON_CREDIT_LIMIT };
}

function normalizeHandle(handle: string | undefined | null): string {
  return String(handle || "").trim().toLowerCase();
}

function isValidUsername(handle: string): boolean {
  return /^[a-z0-9_-]{3,20}$/.test(handle);
}

// Sets this account's username (the "handle" used for its public profile
// URL). Write-once by design.
export async function setUsername(user: SessionUser, handle: string): Promise<{ ok: boolean; error?: string; profile?: Profile }> {
  const sql = getSql();
  const key = userKey(user);
  const data = await loadUserData(user);
  if (data.profile.handle) {
    return { ok: false, error: "Username can only be set once — it's already " + data.profile.handle + "." };
  }
  const normalized = normalizeHandle(handle);
  if (!isValidUsername(normalized)) {
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

// Client-side is the primary UX gate; this is a safety net. Both fields ask
// for just the platform handle/username (not a full URL).
function isValidHandle(v: any): boolean {
  const val = String(v || "").trim();
  return /^@?[a-zA-Z0-9._-]{1,40}$/.test(val);
}

export function sanitizeSocials(list: any): Social[] {
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, MAX_SOCIALS)
    .map((s) => ({
      platform: String((s && s.platform) || "").trim().slice(0, 40),
      value: String((s && s.value) || "").trim().slice(0, 200)
    }))
    .filter((s) => s.platform && s.value && isValidHandle(s.value));
}

export function sanitizeLinkedAccounts(list: any): LinkedAccount[] {
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, MAX_LINKED_ACCOUNTS)
    .map((a) => ({
      platform: String((a && a.platform) || "").trim().slice(0, 40),
      handle: String((a && a.handle) || "").trim().slice(0, 100)
    }))
    .filter((a) => a.platform && a.handle && isValidHandle(a.handle));
}

// Updates the editable profile fields (everything except the write-once
// username, which has its own function above).
export async function updateProfileFields(
  user: SessionUser,
  fields: { displayName?: string; bio?: string; socials?: any; linkedAccounts?: any }
): Promise<Profile> {
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
// storage, just thresholds evaluated on read.
export function computeBadges(stats: Stats): { id: string; label: string }[] {
  const badges: { id: string; label: string }[] = [];
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
// 25+ linked results.
const ACHIEVEMENT_TIERS = [
  { min: 25, name: "Platinum" },
  { min: 10, name: "Gold" },
  { min: 3, name: "Silver" },
  { min: 1, name: "Bronze" }
];
function tierForCount(count: number): string | null {
  const tier = ACHIEVEMENT_TIERS.find((t) => count >= t.min);
  return tier ? tier.name : null;
}
export async function computeAchievements(accountKey: string, stats: Stats) {
  const sql = getSql();
  const rows = await sql`
    SELECT category_id, COUNT(*)::int AS count FROM results
    WHERE account_key = ${accountKey} GROUP BY category_id
  `;
  const catRolls = (stats && stats.categoryRolls) || {};
  return rows.map((r: any) => {
    const rolls = catRolls[r.category_id] || 0;
    return {
      categoryId: r.category_id as string,
      count: r.count as number,
      tier: tierForCount(r.count),
      conversionPct: rolls > 0 ? Math.round((r.count / rolls) * 100) : null
    };
  });
}

// ---------------- Results (user-linked "I made this" entries) ----------------

export async function addResult(
  user: SessionUser,
  { categoryId, rollType, promptText, resultUrl }: { categoryId: string; rollType?: string; promptText: string; resultUrl?: string | null }
) {
  const sql = getSql();
  const key = userKey(user);
  const rows = await sql`
    INSERT INTO results (account_key, category_id, roll_type, prompt_text, result_url)
    VALUES (${key}, ${String(categoryId).slice(0, 40)}, ${String(rollType || "free").slice(0, 20)}, ${String(promptText).slice(0, 500)}, ${
    resultUrl ? String(resultUrl).slice(0, 500) : null
  })
    RETURNING id, category_id, roll_type, prompt_text, result_url, created_at
  `;
  return rows[0];
}

export async function listResults(user: SessionUser) {
  const sql = getSql();
  const key = userKey(user);
  return sql`
    SELECT id, category_id, roll_type, prompt_text, result_url, created_at FROM results
    WHERE account_key = ${key} ORDER BY created_at DESC LIMIT 200
  `;
}

export async function removeResult(user: SessionUser, id: number | string) {
  const sql = getSql();
  const key = userKey(user);
  await sql`DELETE FROM results WHERE id = ${id} AND account_key = ${key}`;
  return { ok: true };
}

export async function listPublicResults(accountKey: string, categoryId?: string | null) {
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

export async function followAccount(followerUser: SessionUser, targetHandle: string) {
  const sql = getSql();
  const followerKey = userKey(followerUser);
  const normalized = normalizeHandle(targetHandle);
  const rows = await sql`SELECT account_key FROM profile_handles WHERE handle = ${normalized}`;
  if (!rows[0]) return { ok: false, error: "That user doesn't exist." };
  const followeeKey = rows[0].account_key as string;
  if (followeeKey === followerKey) return { ok: false, error: "You can't follow yourself." };
  await sql`
    INSERT INTO follows (follower_key, followee_key) VALUES (${followerKey}, ${followeeKey})
    ON CONFLICT DO NOTHING
  `;
  return { ok: true, following: true };
}

export async function unfollowAccount(followerUser: SessionUser, targetHandle: string) {
  const sql = getSql();
  const followerKey = userKey(followerUser);
  const normalized = normalizeHandle(targetHandle);
  const rows = await sql`SELECT account_key FROM profile_handles WHERE handle = ${normalized}`;
  if (!rows[0]) return { ok: false, error: "That user doesn't exist." };
  await sql`DELETE FROM follows WHERE follower_key = ${followerKey} AND followee_key = ${rows[0].account_key}`;
  return { ok: true, following: false };
}

// Follower count is private — only ever called for the signed-in owner.
export async function getFollowerCount(accountKey: string): Promise<number> {
  const sql = getSql();
  const rows = await sql`SELECT COUNT(*)::int AS n FROM follows WHERE followee_key = ${accountKey}`;
  return rows[0] ? (rows[0].n as number) : 0;
}

// Full follower list (handle + display name) — private.
export async function listFollowers(accountKey: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT h.handle, a.data->'profile'->>'displayName' AS display_name
    FROM follows f
    JOIN profile_handles h ON h.account_key = f.follower_key
    JOIN accounts a ON a.account_key = f.follower_key
    WHERE f.followee_key = ${accountKey}
    ORDER BY f.created_at DESC LIMIT 200
  `;
  return rows.map((r: any) => ({ handle: r.handle, displayName: r.display_name || r.handle }));
}

export async function isFollowingHandle(viewerUser: SessionUser | null, targetHandle: string): Promise<boolean> {
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
export async function getPublicProfileByHandle(
  handle: string,
  { categoryId, viewerUser }: { categoryId?: string | null; viewerUser?: SessionUser | null } = {}
) {
  const normalized = normalizeHandle(handle);
  if (!isValidUsername(normalized)) return null;
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
    isFollowingHandle(viewerUser ?? null, normalized)
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

export async function deleteAccount(user: SessionUser) {
  const sql = getSql();
  const key = userKey(user);
  // profile_handles/results/follows all reference accounts(account_key)
  // ON DELETE CASCADE, so removing the account row is sufficient.
  await sql`DELETE FROM accounts WHERE account_key = ${key}`;
  return { ok: true };
}
