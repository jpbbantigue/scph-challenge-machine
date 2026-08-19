"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CATEGORIES, CATEGORY_BY_ID, pick, pickDistinct, reelDef, loadMusicReelData } from "@/lib/categories";
import { buildMission, nowLabel, shuffle, Ticket } from "@/lib/roll";
import SlotMachine from "./SlotMachine";
import ResultTicket from "./ResultTicket";
import ExampleResults from "./ExampleResults";
import CategoryCards from "./CategoryCards";
import NavDropdown, { AccountState } from "./NavDropdown";

const STORE_KEY = "promptRoyale.v1";

function defaultActiveFor(catId: string) {
  const active: Record<string, boolean> = {};
  CATEGORY_BY_ID[catId].reels.forEach((r) => (active[r.key] = true));
  return active;
}
function defaultLocksFor(catId: string) {
  const locks: Record<string, boolean> = {};
  CATEGORY_BY_ID[catId].reels.forEach((r) => (locks[r.key] = false));
  return locks;
}

interface PersistedState {
  ticketNo: number;
  categoryId: string;
  favoriteCategoryIds: string[];
  active: Record<string, Record<string, boolean>>;
  locks: Record<string, Record<string, boolean>>;
  current: Ticket | null;
  history: Ticket[];
  favorites: Ticket[];
}

function loadState(): PersistedState {
  let saved: Partial<PersistedState> = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {};
  } catch (e) {
    saved = {};
  }
  const defaultCatId = CATEGORIES[0].id;
  const merged: PersistedState = Object.assign(
    {
      ticketNo: 0,
      categoryId: defaultCatId,
      favoriteCategoryIds: [],
      active: {},
      locks: {},
      current: null,
      history: [],
      favorites: []
    },
    saved
  );
  if (!CATEGORY_BY_ID[merged.categoryId]) merged.categoryId = defaultCatId;
  merged.favoriteCategoryIds = merged.favoriteCategoryIds || [];
  merged.active = merged.active || {};
  merged.locks = merged.locks || {};
  CATEGORIES.forEach((cat) => {
    merged.active[cat.id] = Object.assign(defaultActiveFor(cat.id), merged.active[cat.id] || {});
    merged.locks[cat.id] = Object.assign(defaultLocksFor(cat.id), merged.locks[cat.id] || {});
  });
  return merged;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const DEFAULT_SPIN_DURATION = 700;

const DEFAULT_CATEGORY_ID = CATEGORIES[0].id;

function placeholderValues(catId: string): Record<string, string | null> {
  const placeholder: Record<string, string | null> = {};
  CATEGORY_BY_ID[catId].reels.forEach((r) => (placeholder[r.key] = "—"));
  return placeholder;
}

export default function HomeApp() {
  const stateRef = useRef<PersistedState>({
    ticketNo: 0,
    categoryId: DEFAULT_CATEGORY_ID,
    favoriteCategoryIds: [],
    active: { [DEFAULT_CATEGORY_ID]: defaultActiveFor(DEFAULT_CATEGORY_ID) },
    locks: { [DEFAULT_CATEGORY_ID]: defaultLocksFor(DEFAULT_CATEGORY_ID) },
    current: null,
    history: [],
    favorites: []
  });

  // Renders with server-safe defaults on first paint (no localStorage
  // access during SSR); the init effect below then syncs in whatever was
  // persisted from a previous visit, and pulls the signed-in account.
  const [categoryId, setCategoryId] = useState(DEFAULT_CATEGORY_ID);
  const [favoriteCategoryIds, setFavoriteCategoryIds] = useState<string[]>([]);
  const [active, setActive] = useState<Record<string, boolean>>(() => defaultActiveFor(DEFAULT_CATEGORY_ID));
  const [locks, setLocks] = useState<Record<string, boolean>>(() => defaultLocksFor(DEFAULT_CATEGORY_ID));
  const [values, setValues] = useState<Record<string, string | null>>(() => placeholderValues(DEFAULT_CATEGORY_ID));
  const [spinningKeys, setSpinningKeys] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState<Ticket | null>(null);
  const [favorites, setFavorites] = useState<Ticket[]>([]);
  const [rollCount, setRollCount] = useState(0);
  const [spinning, setSpinning] = useState(false);
  // Session-scoped: starts false on every page load (never restored from
  // persisted state below), so a refresh always resets the printed ticket
  // to hidden/empty even if a previous roll is still sitting in localStorage.
  const [hasRolled, setHasRolled] = useState(false);
  const [tearing, setTearing] = useState(false);
  const [ticketAnimKey, setTicketAnimKey] = useState(0);
  const [aiFallbackMsg, setAiFallbackMsg] = useState<string | null>(null);
  const [lastRollUsedAI, setLastRollUsedAI] = useState(false);

  const [account, setAccount] = useState<AccountState>({ signedIn: false, provider: null, name: null, credits: null });
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);

  const category = CATEGORY_BY_ID[categoryId];
  const creditsExhausted = !!(account.signedIn && account.credits && account.credits.remaining <= 0);
  const useAiNote = account.signedIn && account.credits ? "(" + account.credits.remaining + "/" + account.credits.limit + " today)" : "(50/day)";

  const persist = useCallback(() => {
    const s = stateRef.current;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
    } catch (e) {}
  }, []);

  // ---- init ----
  useEffect(() => {
    loadMusicReelData().catch(() => {});
    const s = loadState();
    stateRef.current = s;
    setCategoryId(s.categoryId);
    setFavoriteCategoryIds(s.favoriteCategoryIds);
    setActive(s.active[s.categoryId]);
    setLocks(s.locks[s.categoryId]);
    setFavorites(s.favorites);
    setRollCount(s.history.length);
    if (s.current && s.current.categoryId === s.categoryId) {
      setCurrent(s.current);
      setValues(s.current.vals);
      // Intentionally NOT calling setHasRolled(true) here — the printed
      // ticket must start hidden on every fresh page load regardless of
      // persisted history (see hasRolled comment above).
    } else {
      setValues(placeholderValues(s.categoryId));
    }

    fetch("/api/auth-me")
      .then((r) => r.json())
      .then((data) => {
        setAvailableProviders(data.providers || []);
        setAccount({
          signedIn: !!data.signedIn,
          provider: data.provider || null,
          name: data.name || null,
          tier: data.tier,
          credits: data.credits || null
        });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isActive = useCallback((key: string) => !!active[key], [active]);

  function isFavorited(ticket: Ticket | null) {
    if (!ticket) return false;
    return favorites.some((f) => f.mission === ticket.mission);
  }

  // Music's Genre 1 and Genre 2 reels must never land on the same value
  // within a single pull — pickDistinct re-rolls genre2 against whatever
  // genre1 landed on (or vice versa, if only genre2 is being freshly rolled).
  function applyDistinctGenres(map: Record<string, string>, keys: string[]) {
    if (category.id !== "music" && category.id !== "album") return;
    if (keys.includes("genre2")) {
      const avoid = map.genre1 ?? (locks.genre1 && stateRef.current.current ? stateRef.current.current.vals.genre1 : null);
      map.genre2 = pickDistinct(category, "genre2", avoid as string | null);
    } else if (keys.includes("genre1") && !keys.includes("genre2")) {
      const avoid = locks.genre2 && stateRef.current.current ? stateRef.current.current.vals.genre2 : null;
      map.genre1 = pickDistinct(category, "genre1", avoid as string | null);
    }
  }

  async function getFreshValuesForPull(keys: string[], useAI: boolean): Promise<Record<string, string>> {
    if (!useAI) {
      const map: Record<string, string> = {};
      keys.forEach((key) => (map[key] = pick(category, key)));
      applyDistinctGenres(map, keys);
      return map;
    }
    if (!account.signedIn) {
      setAiFallbackMsg("Sign in to use this site's AI (free daily credits) — or add your own Claude/ChatGPT key in Settings instead. — showing built-in results instead.");
      const map: Record<string, string> = {};
      keys.forEach((key) => (map[key] = pick(category, key)));
      applyDistinctGenres(map, keys);
      return map;
    }
    const reelsPayload = keys.map((key) => {
      const r = reelDef(category, key)!;
      return { label: r.label, examples: shuffle(r.items).slice(0, 5) };
    });
    try {
      const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("AI timeout")), 12000));
      const res = await Promise.race([
        fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryName: category.name, reels: reelsPayload })
        }),
        timeout
      ]);
      if (!res.ok) {
        let detail = "";
        try {
          detail = (await res.json()).error || "";
        } catch (e) {}
        if (res.status === 429 && account.credits) {
          setAccount((a) => (a.credits ? { ...a, credits: { ...a.credits, remaining: 0 } } : a));
        }
        throw new Error(detail || "AI request failed (" + res.status + ")");
      }
      const data = await res.json();
      if (typeof data.creditsRemaining === "number") {
        setAccount((a) => (a.credits ? { ...a, credits: { ...a.credits, remaining: data.creditsRemaining } } : a));
      }
      const byLabel: Record<string, string> = {};
      (data.results || []).forEach((item: any) => {
        byLabel[item.label] = (item.text || "").trim();
      });
      const map: Record<string, string> = {};
      keys.forEach((key) => {
        const r = reelDef(category, key)!;
        map[key] = byLabel[r.label] || pick(category, key);
      });
      if (map.genre1 && map.genre2 && map.genre1 === map.genre2) applyDistinctGenres(map, keys);
      return map;
    } catch (err: any) {
      setAiFallbackMsg((err && err.message ? err.message : "AI unavailable") + " — showing built-in results instead.");
      const map: Record<string, string> = {};
      keys.forEach((key) => (map[key] = pick(category, key)));
      applyDistinctGenres(map, keys);
      return map;
    }
  }

  async function spinReel(key: string, valuePromise: Promise<string | null>): Promise<string | null> {
    if (!isActive(key)) return null;
    const currentTicket = stateRef.current.current;
    if (locks[key] && currentTicket && currentTicket.categoryId === category.id) {
      const v = await valuePromise;
      setValues((vs) => ({ ...vs, [key]: v }));
      return v;
    }
    const reduced = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const v = await valuePromise;
      setValues((vs) => ({ ...vs, [key]: v }));
      return v;
    }
    setSpinningKeys((s) => new Set(s).add(key));
    const minDuration = DEFAULT_SPIN_DURATION;
    const start = performance.now();
    let finalValue: string | null = null;
    valuePromise.then((v) => (finalValue = v)).catch(() => (finalValue = pick(category, key)));

    while (true) {
      const elapsed = performance.now() - start;
      if (finalValue !== null && elapsed >= minDuration) break;
      setValues((vs) => ({ ...vs, [key]: elapsed > minDuration ? "…" : pick(category, key) }));
      await sleep(Math.min(40 + (elapsed / minDuration) * 140, 220));
    }
    setSpinningKeys((s) => {
      const n = new Set(s);
      n.delete(key);
      return n;
    });
    setValues((vs) => ({ ...vs, [key]: finalValue }));
    return finalValue;
  }

  async function pullLever(useAI: boolean) {
    if (spinning || (useAI && creditsExhausted)) return;
    setLastRollUsedAI(useAI);
    setSpinning(true);
    setAiFallbackMsg(null);

    const keys = category.reels.map((r) => r.key);
    const s = stateRef.current;
    const hasCurrentSameCat = !!(s.current && s.current.categoryId === category.id);
    const keysNeedingFresh = keys.filter((key) => isActive(key) && !(locks[key] && hasCurrentSameCat));
    const freshMap = keysNeedingFresh.length ? await getFreshValuesForPull(keysNeedingFresh, useAI) : {};

    const results = await Promise.all(
      keys.map((key) => {
        if (!isActive(key)) return spinReel(key, Promise.resolve(null));
        const valuePromise =
          locks[key] && hasCurrentSameCat ? Promise.resolve(s.current!.vals[key]) : Promise.resolve(freshMap[key] ?? null);
        return spinReel(key, valuePromise);
      })
    );
    const vals: Record<string, string | null> = {};
    keys.forEach((key, i) => (vals[key] = results[i]));

    s.ticketNo += 1;
    const ticket: Ticket = {
      no: s.ticketNo,
      time: nowLabel(),
      categoryId: category.id,
      vals,
      mission: buildMission(category, isActive, vals),
      rollType: useAI ? "ai" : "free"
    };
    s.current = ticket;
    s.history.push(ticket);
    if (s.history.length > 100) s.history.shift();
    persist();

    setRollCount(s.history.length);

    // Must flip hasRolled to true, and set the new ticket as current, BEFORE
    // triggering the print animation — this mirrors a real ordering bug that
    // was fixed on the static site: renderTicket() there gates visibility on
    // hasRolled, so on the very first roll of a session it needs to already
    // be true or the newly-printed ticket renders hidden.
    setHasRolled(true);
    setCurrent(ticket);
    setTicketAnimKey((k) => k + 1);

    setSpinning(false);
  }

  // Entry point for both roll buttons: if a ticket is already showing, play
  // the tear-off first and only start the new roll once it finishes ("tear
  // off, then reprint"); first roll of the session has nothing to tear, so
  // it starts immediately.
  async function pullLeverEntry(useAI: boolean) {
    if (spinning || tearing) return;
    if (useAI && creditsExhausted) return;
    if (hasRolled && current && current.categoryId === categoryId) {
      setTearing(true);
      await sleep(360);
      // Without genuinely hiding the ticket here (not just letting the CSS
      // animation's fill-mode expire), the old ticket would flash back into
      // view for the whole reel-spin duration instead of staying torn-off
      // until the new roll prints — this was a real bug on the static site.
      setHasRolled(false);
      setTearing(false);
    }
    await pullLever(useAI);
  }

  async function rerollSingle(key: string) {
    if (spinning || tearing || locks[key] || !isActive(key)) return;
    if (lastRollUsedAI && creditsExhausted) return;
    const s = stateRef.current;
    if (!s.current || s.current.categoryId !== categoryId) {
      pullLeverEntry(lastRollUsedAI);
      return;
    }
    setSpinning(true);
    const freshMap = await getFreshValuesForPull([key], lastRollUsedAI);
    const value = await spinReel(key, Promise.resolve(freshMap[key] ?? null));
    s.current.vals[key] = value;
    s.current.mission = buildMission(category, isActive, s.current.vals);
    setCurrent({ ...s.current });
    persist();
    setSpinning(false);
  }

  function switchCategory(catId: string) {
    if (catId === categoryId) return;
    const s = stateRef.current;
    s.categoryId = catId;
    setCategoryId(catId);
    setActive(s.active[catId]);
    setLocks(s.locks[catId]);
    setValues(placeholderValues(catId));
    if (s.current && s.current.categoryId === catId) {
      setCurrent(s.current);
      setValues(s.current.vals);
    } else {
      setCurrent(null);
    }
    // No animation on a plain category switch — just sync visibility, same
    // as the static site's renderTicket() (hidden unless the current ticket
    // matches the newly-selected category).
    setTearing(false);
    persist();
  }

  function toggleFavCat() {
    const s = stateRef.current;
    const idx = s.favoriteCategoryIds.indexOf(categoryId);
    if (idx === -1) s.favoriteCategoryIds.push(categoryId);
    else s.favoriteCategoryIds.splice(idx, 1);
    setFavoriteCategoryIds([...s.favoriteCategoryIds]);
    persist();
  }

  function toggleActive(key: string) {
    const nextActive = { ...active, [key]: !active[key] };
    setActive(nextActive);
    stateRef.current.active[categoryId] = nextActive;
    const s = stateRef.current;
    if (s.current && s.current.categoryId === categoryId) {
      s.current.mission = buildMission(category, (k) => !!nextActive[k], s.current.vals);
      setCurrent({ ...s.current });
    }
    persist();
  }

  function toggleLock(key: string) {
    const nextLocks = { ...locks, [key]: !locks[key] };
    setLocks(nextLocks);
    stateRef.current.locks[categoryId] = nextLocks;
    persist();
  }

  function copyMissionToClipboard() {
    const s = stateRef.current;
    if (!s.current) return;
    const text = s.current.mission;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }

  function toggleFavorite() {
    const s = stateRef.current;
    if (!s.current) return;
    if (isFavorited(s.current)) {
      s.favorites = s.favorites.filter((f) => f.mission !== s.current!.mission);
    } else {
      // Newest-first, capped at 8 — matches the ticket's own save-slot spec.
      s.favorites = [s.current].concat(s.favorites).slice(0, 8);
    }
    setFavorites([...s.favorites]);
    persist();
  }

  return (
    <>
      <div className="nav-wrap">
        <nav className="topnav" aria-label="Primary">
          <a href="#top" className="brand">
            <span className="brand-mark" aria-hidden="true" />
            Prompt Royale
          </a>
          <div className="navlinks">
            <a className="navlink" href="#how-it-works">
              How It Works
            </a>
            <a className="navlink" href="#categories">
              Prompt Categories
            </a>
          </div>
          <div className="nav-actions">
            <NavDropdown account={account} availableProviders={availableProviders} />
            <a className="pill-cta" href="#slot-machine">
              Start Rolling
            </a>
          </div>
        </nav>
      </div>

      <div id="top" />
      <section className="hero">
        <div>
          <div className="eyebrow-pill">
            <span className="dot" aria-hidden="true" />
            Your next idea is one roll away
          </div>
          <h1>
            Generate the <span className="grad">unexpected</span> creative prompt.
          </h1>
          <p>
            A collision of genre, mood, and constraint engineered to knock you out of your default ideas — for songs and characters, with more
            mediums coming.
          </p>
          <a className="hero-link" href="#how-it-works">
            See how it works <span aria-hidden="true">&darr;</span>
          </a>
        </div>

        <SlotMachine
          category={category}
          categoryId={categoryId}
          values={values}
          spinningKeys={spinningKeys}
          active={active}
          locks={locks}
          favoriteCategoryIds={favoriteCategoryIds}
          rollCount={rollCount}
          spinning={spinning}
          creditsExhausted={creditsExhausted}
          useAiNote={useAiNote}
          onCategoryChange={switchCategory}
          onToggleFavCat={toggleFavCat}
          onToggleActive={toggleActive}
          onToggleLock={toggleLock}
          onRerollSingle={rerollSingle}
          onRollFree={() => pullLeverEntry(false)}
          onRollAI={() => pullLeverEntry(true)}
          ticket={
            <ResultTicket
              ticket={current}
              visible={hasRolled && !!(current && current.categoryId === categoryId)}
              tearing={tearing}
              animKey={ticketAnimKey}
              favorited={isFavorited(current)}
              onCopy={copyMissionToClipboard}
              onToggleFavorite={toggleFavorite}
            />
          }
        />
      </section>

      {aiFallbackMsg ? (
        <p
          className="hint"
          style={{
            maxWidth: 640,
            margin: "0 auto 14px",
            padding: "10px 16px",
            textAlign: "center",
            borderRadius: 12,
            background: "rgba(230,58,70,0.1)",
            border: "1px solid rgba(230,58,70,0.3)",
            color: "var(--crimson-hi)"
          }}
        >
          {aiFallbackMsg}
        </p>
      ) : null}

      <section className="section" id="how-it-works">
        <div className="section-head">
          <span className="section-eyebrow gold">How It Works</span>
          <h2>Three steps to a strange new idea</h2>
          <p>Free forever, using a curated library of built-in prompts, with optional AI-generated entries for even more variety.</p>
        </div>
        <div className="hiw-grid">
          <div className="hiw-card in-view">
            <div className="hiw-num">1</div>
            <h3>Choose a category</h3>
            <p>Pick the medium you want to be surprised in — Music or Characters, for now.</p>
          </div>
          <div className="hiw-card in-view">
            <div className="hiw-num">2</div>
            <h3>Roll the prompt</h3>
            <p>Reels spin, lock the parts you love, and let the rest land where it lands.</p>
          </div>
          <div className="hiw-card in-view">
            <div className="hiw-num">3</div>
            <h3>Create something unexpected</h3>
            <p>Copy or save the result and go make the thing only you would make from it.</p>
          </div>
        </div>
      </section>

      <section className="section wide" id="categories">
        <div className="section-head">
          <span className="section-eyebrow blue">Prompt Categories</span>
          <h2>Choose where the roll takes you</h2>
        </div>
        <CategoryCards />
      </section>

      <section className="section wide" id="examples">
        <div className="section-head">
          <span className="section-eyebrow crimson">Example Results</span>
          <h2>A few rolls, for inspiration</h2>
          <p>Link the results you create back to your rolls to see how far you&apos;ve come.</p>
        </div>
        <ExampleResults onTry={switchCategory} />
      </section>

      <div className="final-cta-wrap">
        <div className="final-cta">
          <div className="final-cta-inner">
            <h2>Ready for your next roll?</h2>
            <p>Chance favors the creative. Pull the lever and see where it takes you.</p>
            <a className="pill-cta" style={{ display: "inline-flex", padding: "16px 32px", fontSize: 16 }} href="#slot-machine">
              Roll Your First Prompt
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
