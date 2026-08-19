"use client";

import { useState } from "react";
import { catName } from "@/lib/accountApi";

// Shared renderer for the History and Favorites tabs -- ported from
// account.html's renderTicketList(). Shows the newest 50 rolls, newest
// first.
export default function TicketListTab({
  title,
  sub,
  items,
  showFavorite,
  showRemove,
  favorites,
  onSaveFavorite,
  onRemove
}: {
  title: string;
  sub: string;
  items: any[];
  showFavorite: boolean;
  showRemove: boolean;
  favorites: any[];
  onSaveFavorite?: (item: any) => void;
  onRemove?: (item: any) => void;
}) {
  const shown = items.slice().reverse().slice(0, 50);

  return (
    <>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>{title}</h1>
      <p className="tab-sub">{sub}</p>
      {shown.length ? (
        <div className="entry-list">
          {shown.map((item, i) => (
            <TicketEntry
              key={i}
              item={item}
              isFavorited={favorites.some((f) => f.mission === item.mission)}
              showFavorite={showFavorite}
              showRemove={showRemove}
              onSaveFavorite={onSaveFavorite}
              onRemove={onRemove}
            />
          ))}
        </div>
      ) : (
        <p className="empty-note">Nothing here yet.</p>
      )}
    </>
  );
}

function TicketEntry({
  item,
  isFavorited,
  showFavorite,
  showRemove,
  onSaveFavorite,
  onRemove
}: {
  item: any;
  isFavorited: boolean;
  showFavorite: boolean;
  showRemove: boolean;
  onSaveFavorite?: (item: any) => void;
  onRemove?: (item: any) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(isFavorited);
  const rollType = item.rollType === "ai" ? "ai" : "free";

  function copy() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(item.mission).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      });
    }
  }

  return (
    <div className="entry-card">
      <div className="entry-top">
        <div className="entry-top-left">
          <span className="entry-cat">{catName(item.categoryId)}</span>
          <span className={"type-badge " + rollType}>{rollType === "ai" ? "AI" : "Free"}</span>
        </div>
        <span className="entry-time">{item.time || ""}</span>
      </div>
      <p className="entry-text">{item.mission}</p>
      <div className="entry-actions">
        <button type="button" onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </button>
        {showFavorite ? (
          <button
            type="button"
            className="save-btn"
            onClick={() => {
              setSaved(true);
              onSaveFavorite && onSaveFavorite(item);
            }}
          >
            {saved ? "Saved!" : "Save to favorites"}
          </button>
        ) : null}
        {showRemove ? (
          <button type="button" className="remove-btn" onClick={() => onRemove && onRemove(item)}>
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
