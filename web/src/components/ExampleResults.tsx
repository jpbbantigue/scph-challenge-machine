"use client";

import { useState } from "react";
import { CATEGORY_BY_ID, EXAMPLES } from "@/lib/categories";

function fallbackCopy(text: string, done: () => void) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    done();
  } catch (e) {}
  document.body.removeChild(ta);
}

export default function ExampleResults({ onTry }: { onTry: (categoryId: string) => void }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  function copy(idx: number, text: string) {
    const done = () => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((v) => (v === idx ? null : v)), 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  return (
    <div className="examples-grid" id="examplesGrid">
      {EXAMPLES.map((ex, idx) => {
        const cat = CATEGORY_BY_ID[ex.categoryId];
        if (!cat) return null;
        return (
          <div className="example-card" key={idx}>
            <span className="ex-cat">{cat.name}</span>
            <p className="ex-text">{ex.text}</p>
            <div className="example-actions">
              <button type="button" className="ex-copy-btn" onClick={() => copy(idx, ex.text)}>
                {copiedIdx === idx ? "Copied" : "Copy Prompt"}
              </button>
              <a
                href="#slot-machine"
                className="ex-try-btn"
                onClick={(e) => {
                  e.preventDefault();
                  onTry(ex.categoryId);
                  document.getElementById("slot-machine")?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              >
                Try This
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
