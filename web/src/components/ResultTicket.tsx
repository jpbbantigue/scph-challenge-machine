"use client";

import { useEffect, useRef, useState } from "react";
import { CategoryDef } from "@/lib/categories";
import { Ticket, padTicketNo } from "@/lib/roll";

export default function ResultTicket({
  ticket,
  category,
  show,
  favorited,
  onCopy,
  onToggleFavorite
}: {
  ticket: Ticket | null;
  category: CategoryDef;
  show: boolean;
  favorited: boolean;
  onCopy: () => void;
  onToggleFavorite: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  function copy() {
    if (!ticket) return;
    const text = ticket.mission;
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
    onCopy();
  }

  return (
    <div className={"ticket-wrap" + (show ? " show" : "")} id="ticketWrap" ref={wrapRef}>
      <article className="ticket" aria-live="polite">
        <div className="ticket-head">
          <span>{padTicketNo(ticket ? ticket.no : 0)}</span>
          <span>{ticket ? ticket.time : "--:--"}</span>
        </div>
        <div className="ticket-body">
          {ticket ? (
            category.reels
              .filter((r) => ticket.vals[r.key] !== undefined && ticket.vals[r.key] !== null)
              .map((r) => (
                <div className="ticket-line" key={r.key}>
                  <span className="tag">{r.label.toUpperCase()}</span>
                  <span className="val">{ticket.vals[r.key]}</span>
                </div>
              ))
          ) : (
            <div className="ticket-line">
              <span className="val">Pull the lever to get your first {category.name.toLowerCase()} challenge.</span>
            </div>
          )}
        </div>
        <div className="ticket-rule" />
        <p className="ticket-mission">{ticket ? ticket.mission : ""}</p>
        <div className="ticket-actions">
          <button type="button" onClick={copy} className={copied ? "copy-flash" : ""}>
            {copied ? "Copied!" : "Copy prompt"}
          </button>
          <button type="button" className={favorited ? "favd" : ""} onClick={onToggleFavorite}>
            <span aria-hidden="true">{favorited ? "★" : "☆"}</span> {favorited ? "Saved" : "Save to favorites"}
          </button>
        </div>
      </article>
    </div>
  );
}

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
