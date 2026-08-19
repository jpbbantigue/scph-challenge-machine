"use client";

import { useState } from "react";
import { api, isValidHandle } from "@/lib/accountApi";
import FollowersModal from "./FollowersModal";

const SOCIAL_PLATFORMS = ["YouTube", "Instagram", "Facebook", "X (Twitter)", "TikTok", "Other"];
const CREATIVE_PLATFORMS = ["Suno", "Emochi", "DreamGen", "Other"];

type Row = { platform: string; value?: string; handle?: string };

function StatusMsg({ status }: { status: { text: string; error?: boolean } | null }) {
  return <p className={"status-msg" + (status && status.error ? " error" : "")}>{status ? status.text : ""}</p>;
}

export default function ProfileTab({ me, myData, setMyData, setMe }: { me: any; myData: any; setMyData: (d: any) => void; setMe: (m: any) => void }) {
  const p = myData.profile;
  const [displayName, setDisplayName] = useState(p.displayName || "");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState(p.bio || "");
  const [socials, setSocials] = useState<Row[]>(p.socials || []);
  const [linkedAccounts, setLinkedAccounts] = useState<Row[]>(p.linkedAccounts || []);
  const [showFollowers, setShowFollowers] = useState(false);

  const [nameStatus, setNameStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [bioStatus, setBioStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [socialsStatus, setSocialsStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [linkedStatus, setLinkedStatus] = useState<{ text: string; error?: boolean } | null>(null);

  function flash(setter: (s: any) => void, text: string, error?: boolean) {
    setter({ text, error });
    if (!error) setTimeout(() => setter((s: any) => (s && s.text === text ? null : s)), 3000);
  }

  function updateProfile(next: any) {
    setMyData({ ...myData, profile: next });
  }

  async function saveDisplayName() {
    try {
      const r = await api("/api/profile", { method: "PUT", body: JSON.stringify({ displayName }) });
      updateProfile(r.profile);
      flash(setNameStatus, "Saved.");
    } catch (e: any) {
      flash(setNameStatus, e.message, true);
    }
  }

  async function saveUsername() {
    try {
      const r = await api("/api/profile", { method: "PUT", body: JSON.stringify({ username }) });
      updateProfile(r.profile);
      flash(setUsernameStatus, "Username set.");
    } catch (e: any) {
      flash(setUsernameStatus, e.message, true);
    }
  }

  async function saveBio() {
    try {
      const r = await api("/api/profile", { method: "PUT", body: JSON.stringify({ bio }) });
      updateProfile(r.profile);
      flash(setBioStatus, "Bio saved.");
    } catch (e: any) {
      flash(setBioStatus, e.message, true);
    }
  }

  function rowValue(r: Row, isLinked: boolean): string {
    return (isLinked ? r.handle : r.value) || "";
  }

  async function saveSocials() {
    const empty = socials.find((r) => !String(r.value || "").trim());
    if (empty) {
      flash(setSocialsStatus, "Handle can't be empty — remove the row or fill it in.", true);
      return;
    }
    const bad = socials.find((r) => !isValidHandle(r.value || ""));
    if (bad) {
      flash(setSocialsStatus, '"' + bad.value + '" doesn\'t look like a valid handle (letters, numbers, dots, underscores, hyphens only).', true);
      return;
    }
    try {
      const r = await api("/api/profile", { method: "PUT", body: JSON.stringify({ socials }) });
      updateProfile(r.profile);
      flash(setSocialsStatus, "Saved.");
    } catch (e: any) {
      flash(setSocialsStatus, e.message, true);
    }
  }

  async function saveLinked() {
    const empty = linkedAccounts.find((r) => !String(r.handle || "").trim());
    if (empty) {
      flash(setLinkedStatus, "Handle can't be empty — remove the row or fill it in.", true);
      return;
    }
    const bad = linkedAccounts.find((r) => !isValidHandle(r.handle || ""));
    if (bad) {
      flash(setLinkedStatus, '"' + bad.handle + '" doesn\'t look like a valid handle (letters, numbers, dots, underscores, hyphens only).', true);
      return;
    }
    try {
      const r = await api("/api/profile", { method: "PUT", body: JSON.stringify({ linkedAccounts }) });
      updateProfile(r.profile);
      flash(setLinkedStatus, "Saved.");
    } catch (e: any) {
      flash(setLinkedStatus, e.message, true);
    }
  }

  function RowList({
    rows,
    setRows,
    kind
  }: {
    rows: Row[];
    setRows: (r: Row[]) => void;
    kind: "social" | "linked";
  }) {
    const platforms = kind === "social" ? SOCIAL_PLATFORMS : CREATIVE_PLATFORMS;
    if (!rows.length) return <p className="empty-note">Nothing added yet.</p>;
    return (
      <div className="row-list">
        {rows.map((row, i) => (
          <div className="row-item" key={i}>
            <select
              className="row-platform"
              value={row.platform}
              onChange={(e) => {
                const next = rows.slice();
                next[i] = { ...next[i], platform: e.target.value };
                setRows(next);
              }}
            >
              {platforms.map((pl) => (
                <option key={pl} value={pl}>
                  {pl}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="row-value"
              placeholder="@handle"
              value={rowValue(row, kind === "linked")}
              onChange={(e) => {
                const next = rows.slice();
                next[i] = kind === "linked" ? { ...next[i], handle: e.target.value } : { ...next[i], value: e.target.value };
                setRows(next);
              }}
            />
            <button
              className="row-remove"
              type="button"
              onClick={() => {
                const next = rows.slice();
                next.splice(i, 1);
                setRows(next);
              }}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="tab-header">
        <h1>Profile</h1>
        <button
          className="followers-link"
          type="button"
          style={{ margin: 0, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 999, padding: "6px 14px", textDecoration: "none" }}
          onClick={() => setShowFollowers(true)}
        >
          <strong style={{ color: "var(--ink)" }}>{me.followerCount || 0}</strong> followers{" "}
          <span style={{ color: "var(--ink-40)", fontSize: 10.5 }}>&middot; only visible to you</span>
        </button>
      </div>
      <p className="tab-sub">This is how creators will see you across Prompt Royale.{p.handle ? "" : " Set a username below to make your profile visible."}</p>

      <div className="profile-media" style={{ position: "relative", borderRadius: 20, overflow: "hidden", marginBottom: 56, border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="banner-slot" style={{ width: "100%", height: 180 }}>
          <span>Drop a banner image</span>
        </div>
        <div className="avatar-slot" style={{ position: "absolute", left: 24, bottom: -40, width: 96, height: 96, borderRadius: "50%", border: "4px solid #05070d", overflow: "hidden" }}>
          <span>Photo</span>
        </div>
      </div>

      <div className="panel">
        <label className="field-label" htmlFor="fDisplayName">
          Display name
        </label>
        <input id="fDisplayName" type="text" maxLength={60} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <button className="btn-primary small" type="button" style={{ marginTop: 8 }} onClick={saveDisplayName}>
          Save name
        </button>

        <label className="field-label">Username</label>
        <p className="hint-gold">Can only be set once — choose wisely.</p>
        {p.handle ? (
          <div className="username-row">🔒 @{p.handle}</div>
        ) : (
          <div className="username-row-edit">
            <input type="text" maxLength={20} placeholder="e.g. alexrivera" value={username} onChange={(e) => setUsername(e.target.value)} />
            <button className="btn-primary small" type="button" onClick={saveUsername}>
              Set Username
            </button>
          </div>
        )}
        <StatusMsg status={usernameStatus} />

        <label className="field-label" htmlFor="fBio">
          Bio
        </label>
        <textarea id="fBio" rows={3} maxLength={200} placeholder="Tell people what you create..." value={bio} onChange={(e) => setBio(e.target.value)} />
        <div className="char-count">{bio.length} / 200</div>
        <button className="btn-primary small" type="button" style={{ marginTop: 8 }} onClick={saveBio}>
          Save bio
        </button>
        <StatusMsg status={nameStatus} />
        <StatusMsg status={bioStatus} />
      </div>

      <div className="panel">
        <h2>Socials</h2>
        <p className="sub">Links shown on your public profile.</p>
        <RowList rows={socials} setRows={setSocials} kind="social" />
        <button className="add-row-btn" type="button" onClick={() => setSocials([...socials, { platform: SOCIAL_PLATFORMS[0], value: "" }])}>
          + Add social
        </button>
        <div>
          <button className="btn small" type="button" style={{ marginTop: 12 }} onClick={saveSocials}>
            Save
          </button>
        </div>
        <StatusMsg status={socialsStatus} />
      </div>

      <div className="panel">
        <h2>Linked Creative Accounts</h2>
        <p className="sub">Shows as &quot;Also on {"{platform}"}&quot; badges on your public profile.</p>
        <RowList rows={linkedAccounts} setRows={setLinkedAccounts} kind="linked" />
        <button className="add-row-btn" type="button" onClick={() => setLinkedAccounts([...linkedAccounts, { platform: CREATIVE_PLATFORMS[0], handle: "" }])}>
          + Add account
        </button>
        <div>
          <button className="btn small" type="button" style={{ marginTop: 12 }} onClick={saveLinked}>
            Save
          </button>
        </div>
        <StatusMsg status={linkedStatus} />
      </div>

      {showFollowers ? <FollowersModal onClose={() => setShowFollowers(false)} /> : null}
    </>
  );
}
