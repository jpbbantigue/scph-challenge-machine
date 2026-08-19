"use client";

import { useEffect, useState } from "react";
import { api, catName, ACCOUNT_CATEGORIES } from "@/lib/accountApi";

export default function ResultsTab() {
  const [results, setResults] = useState<any[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [category, setCategory] = useState(ACCOUNT_CATEGORIES[0].id);
  const [rollType, setRollType] = useState("free");
  const [prompt, setPrompt] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);

  async function load() {
    try {
      const r = await api("/api/results");
      setResults(r.results);
      setLoadError(false);
    } catch (e) {
      setLoadError(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function flash(text: string, error?: boolean) {
    setStatus({ text, error });
    if (!error) setTimeout(() => setStatus((s) => (s && s.text === text ? null : s)), 3000);
  }

  async function linkResult() {
    const trimmed = prompt.trim();
    if (!trimmed) {
      flash("Prompt can't be empty.", true);
      return;
    }
    try {
      await api("/api/results", {
        method: "POST",
        body: JSON.stringify({ categoryId: category, rollType, promptText: trimmed, resultUrl: url.trim() })
      });
      setPrompt("");
      setUrl("");
      flash("Linked!");
      load();
    } catch (e: any) {
      flash(e.message, true);
    }
  }

  async function removeResult(id: number) {
    await api("/api/results?id=" + id, { method: "DELETE" });
    load();
  }

  return (
    <>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>Results</h1>
      <p className="tab-sub">Link the finished work you made from a prompt.</p>
      <div className="panel">
        <h2>Link a new result</h2>
        <div className="results-form">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {ACCOUNT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={rollType} onChange={(e) => setRollType(e.target.value)}>
            <option value="free">Free</option>
            <option value="ai">AI</option>
          </select>
          <input type="text" placeholder="Paste the prompt text" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <input type="url" placeholder="Result link (e.g. Suno URL)" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="btn-primary" type="button" onClick={linkResult}>
            Link It
          </button>
        </div>
        <p className={"status-msg" + (status && status.error ? " error" : "")}>{status ? status.text : ""}</p>
      </div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, margin: "0 0 14px" }}>Your Results</h2>
      <div>
        {loadError ? (
          <p className="empty-note">Couldn&apos;t load results.</p>
        ) : results === null ? (
          <p className="empty-note">Loading…</p>
        ) : results.length ? (
          <div className="entry-list">
            {results.map((item) => {
              const rt = item.roll_type === "ai" ? "ai" : "free";
              return (
                <div className="entry-card" key={item.id}>
                  <div className="entry-top">
                    <div className="entry-top-left">
                      <span className="entry-cat">{catName(item.category_id)}</span>
                      <span className={"type-badge " + rt}>{rt === "ai" ? "AI" : "Free"}</span>
                    </div>
                    <span className="entry-time">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="entry-text">{item.prompt_text}</p>
                  <div className="entry-actions">
                    {item.result_url ? (
                      <a className="save-btn" href={item.result_url} target="_blank" rel="noopener noreferrer">
                        View Result ↗
                      </a>
                    ) : null}
                    <button type="button" className="remove-btn" onClick={() => removeResult(item.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="empty-note">Nothing linked yet.</p>
        )}
      </div>
    </>
  );
}
