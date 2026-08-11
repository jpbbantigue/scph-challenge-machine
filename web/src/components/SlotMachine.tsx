"use client";

import { CATEGORIES, CategoryDef, ACCENTS } from "@/lib/categories";

export interface SlotMachineProps {
  category: CategoryDef;
  categoryId: string;
  values: Record<string, string | null>;
  spinningKeys: Set<string>;
  active: Record<string, boolean>;
  locks: Record<string, boolean>;
  favoriteCategoryIds: string[];
  rollCount: number;
  spinning: boolean;
  creditsExhausted: boolean;
  useAiNote: string;
  onCategoryChange: (id: string) => void;
  onToggleFavCat: () => void;
  onToggleActive: (key: string) => void;
  onToggleLock: (key: string) => void;
  onRerollSingle: (key: string) => void;
  onRollFree: () => void;
  onRollAI: () => void;
}

function sortedCategoriesForDropdown(favoriteCategoryIds: string[]) {
  const starred: CategoryDef[] = [];
  const rest: CategoryDef[] = [];
  CATEGORIES.forEach((cat) => (favoriteCategoryIds.includes(cat.id) ? starred : rest).push(cat));
  const byName = (a: CategoryDef, b: CategoryDef) => a.name.localeCompare(b.name);
  return starred.sort(byName).concat(rest.sort(byName));
}

export default function SlotMachine(props: SlotMachineProps) {
  const {
    category, categoryId, values, spinningKeys, active, locks, favoriteCategoryIds, rollCount,
    spinning, creditsExhausted, useAiNote,
    onCategoryChange, onToggleFavCat, onToggleActive, onToggleLock, onRerollSingle, onRollFree, onRollAI
  } = props;
  const accent = ACCENTS[category.accent] || ACCENTS.royal;
  const isFav = favoriteCategoryIds.includes(categoryId);
  const activeCount = category.reels.reduce((n, r) => n + (active[r.key] ? 1 : 0), 0);

  return (
    <div id="slot-machine">
      <div className="console-card" aria-label="Prompt roulette machine">
        <div className="console-top">
          <div className="console-top-left">
            <div className="category-select-wrap">
              <select
                className="category-select"
                aria-label="Prompt category"
                value={categoryId}
                onChange={(e) => onCategoryChange(e.target.value)}
              >
                {sortedCategoriesForDropdown(favoriteCategoryIds).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="fav-cat-btn"
              type="button"
              aria-pressed={isFav}
              aria-label="Favorite this category"
              onClick={onToggleFavCat}
            >
              {isFav ? "★" : "☆"}
            </button>
          </div>
          <div className="roll-count">
            Rolls: <span>{rollCount}</span>
          </div>
        </div>

        <div className="reels" role="group" aria-label="Prompt reels">
          {category.reels.map((r) => {
            const isOn = !!active[r.key];
            const isLocked = !!locks[r.key];
            const isSpinning = spinningKeys.has(r.key);
            const value = values[r.key];
            return (
              <div
                className={"reel-unit" + (isOn ? "" : " disabled")}
                key={r.key}
                style={{ borderColor: accent.border }}
              >
                <div className="reel-fade-top" aria-hidden="true" />
                <div className="reel-fade-bottom" aria-hidden="true" />
                <button
                  className="reel-switch"
                  aria-pressed={isOn}
                  aria-label={"Turn the " + r.label + " reel on or off"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isOn && activeCount <= 1) return; // don't allow turning off the last active reel
                    onToggleActive(r.key);
                  }}
                >
                  <span className="knob" />
                </button>
                <button
                  className="reel-lock"
                  aria-pressed={isLocked}
                  aria-label={"Lock " + r.label + " reel"}
                  disabled={!isOn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLock(r.key);
                  }}
                >
                  &#128274;
                </button>
                <div
                  className="reel-window"
                  tabIndex={0}
                  role="button"
                  aria-label={"Reroll " + r.label}
                  onClick={() => onRerollSingle(r.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRerollSingle(r.key);
                    }
                  }}
                >
                  <div className="reel-label">{r.label.toUpperCase()}</div>
                  <span className={"reel-value" + (isSpinning ? " spinning" : "")}>
                    {isOn ? value || "—" : "OFF"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="roll-row">
          <button className="roll-btn" type="button" disabled={spinning} onClick={onRollFree}>
            <span className="diamond" aria-hidden="true" />
            Roll Free <span className="roll-note">(Unlimited)</span>
          </button>
          <button
            className="roll-btn ai-variant"
            type="button"
            disabled={spinning || creditsExhausted}
            title={creditsExhausted ? "Daily AI limit reached — add your own key in Settings, or try again tomorrow." : ""}
            onClick={onRollAI}
          >
            <span className="diamond" aria-hidden="true" />
            Use AI <span className="roll-note">{useAiNote}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
