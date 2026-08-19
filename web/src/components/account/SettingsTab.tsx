"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/accountApi";

const STORE_KEY = "promptRoyale.v1";
const DEFAULT_BYOK_MODEL: Record<string, string> = { anthropic: "claude-haiku-4-5-20251001", openai: "gpt-4o-mini" };

const PROVIDER_META: Record<string, { label: string; initial: string; gradient: string }> = {
  google: { label: "Google", initial: "G", gradient: "linear-gradient(135deg,#4D7CFF,#1836B2)" },
  discord: { label: "Discord", initial: "D", gradient: "linear-gradient(135deg,#E63A46,#74182D)" }
};

// The reel machine's local state (favorites/history/reel toggles/AI source)
// lives in the same origin's localStorage under STORE_KEY -- this only ever
// patches the AI-provider fields, never touches the rest, since this page
// doesn't load the full reel-engine state.
function readSharedState(): any {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {};
  } catch (e) {
    return {};
  }
}
function writeSharedState(patch: any) {
  const current = readSharedState();
  Object.assign(current, patch);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(current));
  } catch (e) {}
}

export default function SettingsTab({ me }: { me: any }) {
  const [aiSource, setAiSource] = useState("off");
  const [byokKeys, setByokKeys] = useState<any>({ anthropic: "", openai: "" });
  const [byokModels, setByokModels] = useState<any>({ anthropic: "", openai: "" });
  const [byokKeyInput, setByokKeyInput] = useState("");
  const [byokModelInput, setByokModelInput] = useState("");
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [linkNotice, setLinkNotice] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    const shared = readSharedState();
    setAiSource(shared.aiSource || "off");
    const keys = shared.byokKeys || { anthropic: "", openai: "" };
    const models = shared.byokModels || { anthropic: "", openai: "" };
    setByokKeys(keys);
    setByokModels(models);
    setByokKeyInput(keys[shared.aiSource] || "");
    setByokModelInput(models[shared.aiSource] || "");

    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search);
      if (q.get("linked")) setLinkNotice({ text: "Account linked." });
      else if (q.get("linkError")) setLinkNotice({ text: q.get("linkError") || "", error: true });
    }
  }, []);

  function flash(text: string, error?: boolean) {
    setStatus({ text, error });
    if (!error) setTimeout(() => setStatus((s) => (s && s.text === text ? null : s)), 3000);
  }

  function onSourceChange(src: string) {
    setAiSource(src);
    writeSharedState({ aiSource: src });
    setByokKeyInput(byokKeys[src] || "");
    setByokModelInput(byokModels[src] || "");
    flash("Saved.");
  }

  function saveByok() {
    if (aiSource !== "anthropic" && aiSource !== "openai") {
      flash("Choose a provider above first.", true);
      return;
    }
    const nextKeys = { ...byokKeys, [aiSource]: byokKeyInput };
    const nextModels = { ...byokModels, [aiSource]: byokModelInput };
    setByokKeys(nextKeys);
    setByokModels(nextModels);
    writeSharedState({ byokKeys: nextKeys, byokModels: nextModels });
    flash("Saved.");
  }

  const linked: string[] = me.linkedProviders || [me.provider];
  const providers: string[] = (me.providers || []).filter((p: string) => PROVIDER_META[p]);

  async function deleteAccount() {
    try {
      await api("/api/data", { method: "DELETE" });
      window.location.href = "/";
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>Settings</h1>
      <p className="tab-sub">Account, connections, and API access.</p>

      <div className="panel">
        <h2>Connected accounts</h2>
        <p className="sub">Link both so you can sign in with either one.</p>
        {linkNotice ? (
          <p className={"status-msg" + (linkNotice.error ? " error" : "")} style={!linkNotice.error ? { color: "var(--gold-hi)" } : undefined}>
            {linkNotice.text}
          </p>
        ) : null}
        <div className="row-list">
          {providers.map((p) => {
            const meta = PROVIDER_META[p];
            const isLinked = linked.includes(p);
            return (
              <div
                key={p}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: meta.gradient,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#fff"
                    }}
                  >
                    {meta.initial}
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{meta.label}</span>
                </div>
                {isLinked ? (
                  <span className="connect-toggle connected">Connected</span>
                ) : (
                  <button
                    type="button"
                    className="connect-toggle not-connected"
                    style={{ cursor: "pointer" }}
                    onClick={() => (window.location.href = "/api/auth-start?provider=" + p + "&link=1")}
                  >
                    Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <h2>AI-generated entries</h2>
        <p className="sub">Controls the reel machine on the main page — applies next time you load it there.</p>
        <select value={aiSource} onChange={(e) => onSourceChange(e.target.value)}>
          <option value="off">Off — use the built-in lists</option>
          <option value="groq">This site&apos;s AI (Groq, no key needed)</option>
          <option value="anthropic">My own Claude API key</option>
          <option value="openai">My own ChatGPT (OpenAI) API key</option>
        </select>
        {aiSource === "anthropic" || aiSource === "openai" ? (
          <div style={{ marginTop: 12 }}>
            <label className="field-label">API key</label>
            <input type="text" placeholder="sk-ant-... / sk-..." value={byokKeyInput} onChange={(e) => setByokKeyInput(e.target.value)} />
            <label className="field-label">Model (optional override)</label>
            <input type="text" placeholder={DEFAULT_BYOK_MODEL[aiSource]} value={byokModelInput} onChange={(e) => setByokModelInput(e.target.value)} />
            <button className="btn small" type="button" style={{ marginTop: 10 }} onClick={saveByok}>
              Save
            </button>
            <p className="hint">Stored only in this browser&apos;s local storage.</p>
          </div>
        ) : null}
        <p className={"status-msg" + (status && status.error ? " error" : "")}>{status ? status.text : ""}</p>
      </div>

      <div className="panel">
        <h2>Delete Account</h2>
        <p className="sub">Permanently deletes your favorites, history, profile, results, and follows. This can&apos;t be undone.</p>
        <button className="btn danger" type="button" onClick={() => setConfirmingDelete(true)}>
          Delete my account
        </button>
        {confirmingDelete ? (
          <div className="confirm-box">
            <p>Are you sure? This permanently deletes everything and can&apos;t be undone.</p>
            <div className="confirm-actions">
              <button className="btn danger small" type="button" onClick={deleteAccount}>
                Yes, delete everything
              </button>
              <button className="btn secondary small" type="button" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
