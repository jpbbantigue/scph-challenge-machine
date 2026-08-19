"use client";

import { useEffect, useState } from "react";
import { api, ACCOUNT_CATEGORIES, catName, initials, socialProfileUrl } from "@/lib/accountApi";

function tierClassFor(tier: string | null): string {
  return tier ? tier.toLowerCase() : "bronze";
}

export default function ProfileView({ handle }: { handle: string }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [data, setData] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  async function load() {
    setNotFound(false);
    try {
      const me = await fetch("/api/auth-me").then((r) => r.json());
      setIsSignedIn(!!me.signedIn);
    } catch (e) {
      setIsSignedIn(false);
    }
    try {
      const d = await api("/api/profile?handle=" + encodeURIComponent(handle) + (categoryFilter ? "&category=" + encodeURIComponent(categoryFilter) : ""));
      setData(d);
      setIsFollowing(!!d.isFollowing);
    } catch (e) {
      setNotFound(true);
    }
  }

  useEffect(() => {
    if (!handle) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, categoryFilter]);

  async function toggleFollow() {
    setFollowBusy(true);
    try {
      if (isFollowing) {
        await api("/api/follow?handle=" + encodeURIComponent(handle), { method: "DELETE" });
      } else {
        await api("/api/follow", { method: "POST", body: JSON.stringify({ handle }) });
      }
      setIsFollowing(!isFollowing);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setFollowBusy(false);
    }
  }

  if (!handle) return <p className="acct-state-msg">No profile specified.</p>;
  if (notFound) return <p className="acct-state-msg">This profile doesn&apos;t exist.</p>;
  if (!data) return <p className="acct-state-msg">Loading profile…</p>;

  const socials = data.socials || [];
  const linkedAccounts = data.linkedAccounts || [];
  const results = data.results || [];
  const achievements = data.achievements || [];

  return (
    <>
      <div className="banner-wrap">
        <div className="profile-banner" />
        <div className="profile-avatar">{initials(data.displayName)}</div>
      </div>

      <div className="head-row">
        <div className="head-left">
          <div className="name-row">
            <h1 className="display-name">{data.displayName}</h1>
            {isSignedIn ? (
              <button type="button" className={"follow-btn" + (isFollowing ? " following" : "")} disabled={followBusy} onClick={toggleFollow}>
                {isFollowing ? "Following ✓" : "Follow"}
              </button>
            ) : null}
          </div>
          <p className="profile-handle">@{data.handle}</p>
          {data.bio ? <p className="profile-bio">{data.bio}</p> : null}
          <div className="profile-socials">
            {socials.map((s: any, i: number) => {
              const url = socialProfileUrl(s.platform, s.value);
              const inner = (
                <>
                  <span className="social-dot" aria-hidden="true" />
                  {s.platform}
                </>
              );
              return url ? (
                <a className="social-chip" key={i} href={url} target="_blank" rel="noopener noreferrer">
                  {inner}
                </a>
              ) : (
                <span className="social-chip" key={i}>
                  {inner}
                </span>
              );
            })}
          </div>
        </div>
        <div className="head-right">
          {linkedAccounts.map((a: any, i: number) => (
            <span className="linked-badge" key={i}>
              <span className="linked-dot" aria-hidden="true" />
              Also on {a.platform}
            </span>
          ))}
        </div>
      </div>

      <div className="profile-section">
        <div className="profile-section-head">
          <div>
            <h2>Results</h2>
            <p className="profile-section-sub">Finished work made from Prompt Royale rolls.</p>
          </div>
          <select className="cat-filter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {ACCOUNT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ height: 16 }} />
        <div>
          {results.length ? (
            results.map((r: any) => (
              <div className="result-card" key={r.id}>
                <div className="result-cat">{catName(r.category_id)}</div>
                <p className="result-text">{r.prompt_text}</p>
                <div className="result-actions">
                  {r.result_url ? (
                    <a className="view" href={r.result_url} target="_blank" rel="noopener noreferrer">
                      View Result ↗
                    </a>
                  ) : null}
                  <a className="try" href="/#slot-machine">
                    Try It Yourself
                  </a>
                </div>
              </div>
            ))
          ) : (
            <p className="empty-note">No results linked yet.</p>
          )}
        </div>
      </div>

      <div className="profile-section" style={{ marginBottom: 0 }}>
        <h2>Achievements</h2>
        <p className="profile-section-sub" style={{ marginBottom: 18 }}>
          Results generated per category.
        </p>
        <div className="achv-grid">
          {achievements.length ? (
            achievements.map((a: any, i: number) => {
              const tc = tierClassFor(a.tier);
              return (
                <div className={"achv-tile " + tc} key={i}>
                  <div className="achv-top">
                    <span className={"tier-diamond " + tc} aria-hidden="true" />
                    <span className="achv-cat">{catName(a.categoryId)}</span>
                  </div>
                  <span className="achv-count">{a.count}</span>
                  <span className="achv-tier">{a.tier || "—"}</span>
                  <div className="achv-divider" />
                  <span className="achv-conv-pct">{a.conversionPct != null ? a.conversionPct + "%" : "—"}</span>
                  <span className="achv-conv-note">of prompts turned into results</span>
                </div>
              );
            })
          ) : (
            <p className="empty-note">No achievements yet.</p>
          )}
        </div>
      </div>
    </>
  );
}
