// One-time crawl of Wikipedia's "List of music genres and styles" article
// into an intermediate reviewable JSON file (name + parent name pairs).
// Not wired into any deploy/build step — a manual/occasional data-refresh
// operation. Run:
//
//   node scripts/crawl-genres.mjs
//
// Then review scripts/genres-crawled.json before running seed-genres.mjs.
//
// The article's body isn't one uniform <ul><li> tree — the "Classical"
// section is plain nested lists, but every other section (Blues, Country,
// Electronic, Rock, ...) is a section heading followed by a mix of
// "{vte}" navbox templates (collapsible genre-family tables) and
// "div-col" divs (flat comma-separated genre links). This crawler walks
// the parsed article's top-level children in document order, tracking the
// current section heading, and pulls genre names out of both shapes:
//   - div-col divs: every <a> becomes a genre parented to the section
//   - navbox tables: the navbox's own title becomes a genre (parented to
//     the section), and every <a> inside its body becomes a subgenre
//     parented to that navbox title
// This loses some of Wikipedia's deeper sub-sub-genre nesting (e.g.
// decade/country groupings inside a navbox aren't modeled as their own
// tier) but reliably captures genre -> subgenre pairs like
// "Rock" -> "Post-Punk" or "Electronic" -> "Synthwave", which is what the
// reel data needs.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as cheerio from "cheerio";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "genres-crawled.json");

const API_URL =
  "https://en.wikipedia.org/w/api.php?action=parse&page=List_of_music_genres_and_styles&format=json&prop=text";

const SKIP_NAMES = new Set(["v", "t", "e"]);

function cleanText(text) {
  return text
    .replace(/\[\d+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isJunk(name) {
  if (!name || name.length < 2 || name.length > 80) return true;
  if (SKIP_NAMES.has(name.toLowerCase())) return true;
  if (/^(see also|main article|list of|citation needed|this is a list)/i.test(name)) return true;
  // Bare decades / years / centuries as their own "genre" (real genre names
  // that merely start with a number, e.g. "2 step", are kept).
  if (/^\d{1,4}(s|st|nd|rd|th)?(–\d{1,4})?$/i.test(name)) return true;
  return false;
}

async function main() {
  console.log("Fetching Wikipedia article...");
  const res = await fetch(API_URL, {
    headers: { "User-Agent": "scph-challenge-machine/1.0 (genre reel data crawl)" },
  });
  if (!res.ok) throw new Error(`Wikipedia API request failed: ${res.status}`);
  const json = await res.json();
  const html = json?.parse?.text?.["*"];
  if (!html) throw new Error("Unexpected Wikipedia API response shape");

  const $ = cheerio.load(html);
  const root = $(".mw-parser-output");
  if (!root.length) throw new Error("Could not find article content root");

  const results = [];
  const seen = new Set();
  function add(name, parent) {
    name = cleanText(name);
    if (isJunk(name)) return;
    const key = `${name.toLowerCase()}|${parent || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ name, parent: parent || null });
  }

  let currentSection = null;

  root.children().each((_, el) => {
    const $el = $(el);
    const tag = el.tagName;

    // Section headings render as a div/heading whose text is
    // "SectionName[edit]" in the parsed HTML (edit-link text included).
    if ((tag === "div" || /^h[1-6]$/.test(tag)) && !$el.find("table").length) {
      const text = $el.text().trim();
      const m = text.match(/^([A-Za-z][A-Za-z0-9 &/'-]{1,40})\[edit\]$/);
      if (m) {
        currentSection = m[1].trim();
        return;
      }
    }

    // Classical section: plain nested <ul><li> tree.
    if (tag === "ul") {
      walkList($el, currentSection);
      return;
    }

    // "div-col" flat genre link lists (Blues/Country/Electronic/etc.
    // "By style" appendix lists).
    $el.find(".div-col").each((__, dc) => {
      $(dc)
        .find("a")
        .each((___, a) => add($(a).text(), currentSection));
    });

    // {{vte}} navbox templates: title becomes a genre under the current
    // section; every link inside becomes a subgenre under that title.
    $el.find("table.navbox, table.navbox-inner").each((__, nav) => {
      const $nav = $(nav);
      const titleCell = $nav.find(".navbox-title").first();
      // The title cell's text is "vte" (from the tiny view/talk/edit
      // navbar links) run together with the real title with no separator
      // — strip the .navbar element out first rather than trimming
      // leading v/t/e characters (which would also eat real words like
      // "Electronic" or "Vaporwave").
      const titleClone = titleCell.clone();
      titleClone.find(".navbar").remove();
      let navTitle = cleanText(titleClone.text());
      if (isJunk(navTitle)) navTitle = null;
      if (navTitle) add(navTitle, currentSection);
      const parentForChildren = navTitle || currentSection;
      const NON_GENRE_GROUP = /component|instrument|topic|see also|related|terminology|record label|media|history|timeline|technique|characteristic|culture|scene|festival|award/i;
      $nav
        .find("td.navbox-list, td.navbox-list-with-group")
        .each((__, td) => {
          const $td = $(td);
          const groupHeader = $td.prevAll("th.navbox-group").first().text() || $td.closest("tr").find("th.navbox-group").first().text();
          if (groupHeader && NON_GENRE_GROUP.test(groupHeader)) return;
          $td.find("a").each((___, a) => {
            const $a = $(a);
            if ($a.closest(".navbar").length) return;
            add($a.text(), parentForChildren);
          });
        });
    });
  });

  function walkList(ul, parentName) {
    ul.children("li").each((_, li) => {
      const $li = $(li);
      const clone = $li.clone();
      clone.children("ul").remove();
      const name = clone.text();
      const cleaned = cleanText(name);
      if (!isJunk(cleaned)) add(cleaned, parentName);
      const childUl = $li.children("ul");
      if (childUl.length) {
        childUl.each((__, cul) => walkList($(cul), isJunk(cleaned) ? parentName : cleaned));
      }
    });
  }

  if (results.length === 0) {
    throw new Error("Parsed zero genres — Wikipedia markup may have changed, inspect manually.");
  }

  writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
  const topLevel = results.filter((r) => !r.parent).length;
  console.log(`Wrote ${results.length} entries (${topLevel} top-level) to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
