// Ported from index.html's inline <script> — mission-template builders and
// small text helpers used by the slot-machine roll flow.

import { CategoryDef } from "./categories";

export type ReelValues = Record<string, string | null>;

// Strips trailing sentence punctuation so fragments read cleanly once
// stitched together.
export function stripTrailingPunct(s: string): string {
  return String(s).trim().replace(/[.!?,;:]+$/, "").trim();
}

// Strips a leading "Haunted by "/"haunted by " prefix so Flaw values don't
// double up when the Characters template already supplies that phrasing.
export function stripHauntedByPrefix(s: string): string {
  return String(s).trim().replace(/^haunted by\s+/i, "").trim();
}

// Combines the two Music/Album genre reels into one descriptor.
export function genreFusionDescriptor(active: (k: string) => boolean, vals: ReelValues): string {
  const g1 = active("genre1") && vals.genre1 ? stripTrailingPunct(vals.genre1) : "";
  const g2 = active("genre2") && vals.genre2 ? stripTrailingPunct(vals.genre2) : "";
  if (g1 && g2 && g1.toLowerCase() !== g2.toLowerCase()) return g1 + " x " + g2 + " fusion";
  return g1 || g2 || "";
}

function buildMusicMission(active: (k: string) => boolean, vals: ReelValues): string {
  const useMood = active("mood") && vals.mood;
  const genreLabel = genreFusionDescriptor(active, vals);
  const useSubject = active("subject") && vals.subject;
  const useTwist = active("twist") && vals.twist;

  const descriptors: string[] = [];
  if (useMood) descriptors.push(stripTrailingPunct(vals.mood as string).toLowerCase());
  if (genreLabel) descriptors.push(genreLabel);

  let mission = "Write a " + (descriptors.length ? descriptors.join(" ") + " song" : "song");
  if (useSubject) mission += " about " + stripTrailingPunct(vals.subject as string);
  mission += ".";
  if (useTwist) mission += " Constraint: " + stripTrailingPunct(vals.twist as string) + ".";
  return mission;
}

function buildCharactersMission(active: (k: string) => boolean, vals: ReelValues): string {
  const useMood = active("mood") && vals.mood;
  const useArchetype = active("archetype") && vals.archetype;
  const useGenre = active("genre") && vals.genre;
  const useTrait = active("trait") && vals.trait;
  const useFlaw = active("flaw") && vals.flaw;
  const useTheme = active("theme") && vals.theme;

  let mission = "Create a";
  if (useMood) mission += " " + stripTrailingPunct(vals.mood as string).toLowerCase();
  mission += useArchetype ? " " + stripTrailingPunct(vals.archetype as string).toLowerCase() + " character" : " character";
  if (useGenre) mission += " in a " + stripTrailingPunct(vals.genre as string).toLowerCase() + " setting";
  if (useTrait) mission += " defined by " + stripTrailingPunct(vals.trait as string).toLowerCase();
  if (useFlaw) mission += ", haunted by " + stripHauntedByPrefix(stripTrailingPunct(vals.flaw as string)).toLowerCase();
  if (useTheme) mission += ", exploring " + stripTrailingPunct(vals.theme as string).toLowerCase();
  mission += ".";
  return mission;
}

function buildAlbumMission(active: (k: string) => boolean, vals: ReelValues): string {
  const useTheme = active("theme") && vals.theme;
  const genreLabel = genreFusionDescriptor(active, vals);
  const useStory = active("story") && vals.story;

  const descriptors: string[] = [];
  if (useTheme) descriptors.push(stripTrailingPunct(vals.theme as string).toLowerCase());
  if (genreLabel) descriptors.push(genreLabel);

  let mission = "Write a " + (descriptors.length ? descriptors.join(" ") + " album/EP" : "album/EP");
  if (useStory) mission += " centered on " + stripTrailingPunct(vals.story as string);
  mission += ".";
  return mission;
}

function buildGenericMission(cat: CategoryDef, active: (k: string) => boolean, vals: ReelValues): string {
  const parts: string[] = [];
  cat.reels.forEach((r) => {
    if (active(r.key) && vals[r.key]) parts.push(r.label + ": " + stripTrailingPunct(vals[r.key] as string));
  });
  if (!parts.length) return "Create something — pull the lever to get started.";
  return "Create a piece exploring — " + parts.join(", ") + ".";
}

export function buildMission(cat: CategoryDef, active: (k: string) => boolean, vals: ReelValues): string {
  if (cat.id === "music") return buildMusicMission(active, vals);
  if (cat.id === "characters") return buildCharactersMission(active, vals);
  if (cat.id === "album") return buildAlbumMission(active, vals);
  return buildGenericMission(cat, active, vals);
}

export function padTicketNo(n: number): string {
  return "NO. " + String(n).padStart(6, "0");
}

export function nowLabel(): string {
  const d = new Date();
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface Ticket {
  no: number;
  time: string;
  categoryId: string;
  vals: ReelValues;
  mission: string;
  rollType: "free" | "ai";
}
