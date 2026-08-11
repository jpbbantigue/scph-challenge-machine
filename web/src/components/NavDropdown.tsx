"use client";

import { useEffect, useRef, useState } from "react";

export interface AccountState {
  signedIn: boolean;
  provider: string | null;
  name: string | null;
  tier?: string;
  credits: { remaining: number; limit: number } | null;
}

export default function NavDropdown({ account, availableProviders }: { account: AccountState; availableProviders: string[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (open && wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    try {
      await fetch("/api/auth-logout", { method: "POST" });
    } catch (e) {}
    window.location.reload();
  }

  const initial = account.signedIn ? (account.name || "?").trim().slice(0, 1).toUpperCase() : "•";

  return (
    <div className="account-menu-wrap" ref={wrapRef}>
      <button
        className="account-avatar-btn"
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span>{initial}</span>
      </button>
      <div className="account-dropdown" hidden={!open}>
        {account.signedIn ? (
          <>
            <div className="dd-user-row">
              <span className="dd-avatar">{initial}</span>
              <div>
                <div className="dd-name">
                  {account.name}
                  {account.tier === "scph" ? <span className="dd-tier-badge"> SCPH</span> : null}
                </div>
                {account.credits ? (
                  <>
                    <div className="dd-credits">
                      {account.credits.remaining} / {account.credits.limit} AI rolls left
                    </div>
                    <div className="dd-credits-bar">
                      <div
                        className="dd-credits-bar-fill"
                        style={{ width: Math.round((account.credits.remaining / account.credits.limit) * 100) + "%" }}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </div>
            <div className="dd-links">
              <a href="account.html#profile">Profile</a>
              <a href="account.html#history">History</a>
              <a href="account.html#favorites">Favorites</a>
              <a href="account.html#results">Results</a>
              <a href="account.html#settings">Settings</a>
            </div>
            <div className="dd-divider" />
            <button type="button" className="dd-signout" onClick={signOut}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <h3>Sign in to Prompt Royale</h3>
            <p>Save favorites, track history, and roll with AI.</p>
            {availableProviders.includes("google") ? (
              <button type="button" className="dd-signin-btn" onClick={() => (window.location.href = "/api/auth-start?provider=google")}>
                Continue with Google
              </button>
            ) : null}
            {availableProviders.includes("discord") ? (
              <button type="button" className="dd-signin-btn" onClick={() => (window.location.href = "/api/auth-start?provider=discord")}>
                Continue with Discord
              </button>
            ) : null}
            <p className="dd-discord-cta">
              <a href="https://discord.gg/nSdj4wBZv" target="_blank" rel="noopener">
                Join the Discord community →
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
