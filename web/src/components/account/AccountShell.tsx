"use client";

import { useEffect, useState } from "react";
import { api, initials } from "@/lib/accountApi";
import ProfileTab from "./ProfileTab";
import TicketListTab from "./TicketListTab";
import ResultsTab from "./ResultsTab";
import SettingsTab from "./SettingsTab";

const NAV_ITEMS = [
  { id: "profile", label: "Profile", color: "#4D7CFF", radius: "50%" },
  { id: "history", label: "History", color: "#9AB4FF", radius: "2px" },
  { id: "favorites", label: "Favorites", color: "#FFD978", radius: "2px" },
  { id: "results", label: "Results", color: "#E63A46", radius: "2px" },
  { id: "settings", label: "Settings", color: "rgba(243,245,252,0.5)", radius: "2px" }
];

export default function AccountShell() {
  const [state, setState] = useState<"loading" | "signedOut" | "error" | "ready">("loading");
  const [me, setMe] = useState<any>(null);
  const [myData, setMyData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("profile");

  useEffect(() => {
    const hash = (typeof window !== "undefined" && window.location.hash ? window.location.hash : "#profile").slice(1);
    setActiveTab(hash || "profile");

    (async () => {
      let meRes: any;
      try {
        meRes = await api("/api/auth-me");
      } catch (e) {
        setState("error");
        return;
      }
      if (!meRes.signedIn) {
        setState("signedOut");
        return;
      }
      setMe(meRes);
      const data = await api("/api/data");
      setMyData(data);
      setState("ready");
    })();
  }, []);

  function switchTab(id: string) {
    setActiveTab(id);
    if (typeof window !== "undefined") window.location.hash = "#" + id;
  }

  async function signOut() {
    try {
      await fetch("/api/auth-logout", { method: "POST" });
    } catch (e) {}
    window.location.href = "/";
  }

  // Persists favorites/history back to /api/data -- shared by the History
  // and Favorites tabs (save-to-favorites / remove-favorite actions).
  async function persistFavoritesHistory(next: { favorites?: any[]; history?: any[] }) {
    const merged = { ...myData, ...next };
    setMyData(merged);
    await api("/api/data", {
      method: "PUT",
      body: JSON.stringify({
        favorites: merged.favorites,
        history: merged.history,
        settings: merged.settings,
        stats: merged.stats
      })
    });
  }

  if (state === "loading") return <p className="acct-state-msg">Loading account…</p>;
  if (state === "error") return <p className="acct-state-msg">Couldn&apos;t reach the server.</p>;
  if (state === "signedOut")
    return (
      <p className="acct-state-msg">
        You need to sign in first. <a href="/">Go back and sign in →</a>
      </p>
    );

  return (
    <div className="acct-layout">
      <div className="acct-sidebar">
        <a href="/" className="back-link">
          ← Back to Prompt Royale
        </a>
        <div className="side-head">
          <span className="avatar-big">{initials(myData.profile.displayName || me.name)}</span>
          <div className="side-head-text">
            <div className="side-name">{myData.profile.displayName || me.name}</div>
            <div className="side-credits">
              {me.credits ? me.credits.remaining + " / " + me.credits.limit + " credits today" : ""}
              {me.tier === "scph" ? <span className="tier-badge"> SCPH</span> : null}
              {me.tier === "affiliate" ? <span className="tier-badge"> AFFILIATE</span> : null}
              {me.tier === "paid" ? <span className="tier-badge"> PAID</span> : null}
            </div>
          </div>
        </div>
        {me.credits ? (
          <div className="side-credits-bar">
            <div
              className="side-credits-bar-fill"
              style={{ width: Math.round((me.credits.remaining / me.credits.limit) * 100) + "%" }}
            />
          </div>
        ) : null}
        <nav className="side-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={activeTab === item.id ? "active" : ""}
              onClick={() => switchTab(item.id)}
              type="button"
            >
              <span className="nav-glyph" style={{ borderRadius: item.radius, background: item.color }} />
              {item.label}
            </button>
          ))}
        </nav>
        <hr />
        <button className="signout-btn" type="button" onClick={signOut}>
          Sign out
        </button>
      </div>
      <div className="content">
        {activeTab === "history" && (
          <TicketListTab
            title="Roll History"
            sub="Every prompt you've rolled since signing up."
            items={myData.history || []}
            showFavorite
            showRemove={false}
            favorites={myData.favorites || []}
            onSaveFavorite={(item) => {
              const favorites = myData.favorites || [];
              if (!favorites.some((f: any) => f.mission === item.mission)) {
                persistFavoritesHistory({ favorites: [...favorites, item] });
              }
            }}
          />
        )}
        {activeTab === "favorites" && (
          <TicketListTab
            title="Favorites"
            sub="Prompts you've saved for later."
            items={myData.favorites || []}
            showFavorite={false}
            showRemove
            favorites={myData.favorites || []}
            onRemove={(item) => {
              persistFavoritesHistory({ favorites: (myData.favorites || []).filter((f: any) => f.mission !== item.mission) });
            }}
          />
        )}
        {activeTab === "results" && <ResultsTab />}
        {activeTab === "settings" && <SettingsTab me={me} />}
        {activeTab === "profile" && <ProfileTab me={me} myData={myData} setMyData={setMyData} setMe={setMe} />}
      </div>
    </div>
  );
}
