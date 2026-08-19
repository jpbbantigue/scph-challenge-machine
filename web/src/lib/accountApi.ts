// Shared helpers for the Account (/account) and Public Profile (/profile)
// pages — ported from account.html/profile.html's inline <script>s.

export const ACCOUNT_CATEGORIES = [
  { id: "music", name: "Music" },
  { id: "characters", name: "Characters" },
  { id: "album", name: "Album/EP" }
];

export function catName(id: string): string {
  const c = ACCOUNT_CATEGORIES.find((c) => c.id === id);
  return c ? c.name : id;
}

export function initials(name: string | null | undefined): string {
  return String(name || "?").trim().slice(0, 1).toUpperCase();
}

export async function api(path: string, opts?: RequestInit): Promise<any> {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...(opts || {}) });
  let data: any = {};
  try {
    data = await res.json();
  } catch (e) {}
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// Socials/linked-account fields ask for just the unique handle/username on
// each platform (not a full URL) -- simpler to validate and cleaner to
// display. Letters, numbers, dots, underscores, hyphens, and an optional
// leading @; no spaces or "://" (so a pasted URL is rejected outright).
// Server-side sanitizeSocials/sanitizeLinkedAccounts apply the same check
// as a safety net (see lib/store.ts).
export function isValidHandle(v: string): boolean {
  const val = String(v || "").trim();
  return /^@?[a-zA-Z0-9._-]{1,40}$/.test(val);
}

// Handles are stored bare (no URL) -- build a deep link only for platforms
// with a well-known, unambiguous profile URL scheme. Unknown/"Other"
// platforms render as a plain (non-clickable) chip instead of guessing.
export function socialProfileUrl(platform: string, handle: string): string | null {
  const h = String(handle || "").trim().replace(/^@/, "");
  if (!h) return null;
  switch (platform) {
    case "YouTube":
      return "https://youtube.com/@" + h;
    case "Instagram":
      return "https://instagram.com/" + h;
    case "Facebook":
      return "https://facebook.com/" + h;
    case "X (Twitter)":
      return "https://x.com/" + h;
    case "TikTok":
      return "https://tiktok.com/@" + h;
    default:
      return null;
  }
}
