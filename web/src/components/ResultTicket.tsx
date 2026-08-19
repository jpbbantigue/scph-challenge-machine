"use client";

import { useState } from "react";
import { Ticket, padTicketNo } from "@/lib/roll";
import { shareTicketImage } from "@/lib/ticketCanvas";

// Printed-receipt style ticket, ported from index.html's #ticket. Absolutely
// positioned below the dashed divider under the CTA row (see
// .ticket-divider/.ticket in globals.css) so it never affects card height.
// Visibility/animation phase is fully controlled by the parent (HomeApp) —
// this component just renders whatever it's told:
//   - `visible` false => renders nothing (equivalent to the static site's
//     `[hidden]`)
//   - `animKey` changes => remounts the <article>, restarting the CSS
//     "printing" reveal animation (ticket-print keyframe)
//   - `tearing` true => plays the tear-off animation instead
export default function ResultTicket({
  ticket,
  visible,
  tearing,
  animKey,
  favorited,
  onCopy,
  onToggleFavorite
}: {
  ticket: Ticket | null;
  visible: boolean;
  tearing: boolean;
  animKey: number;
  favorited: boolean;
  onCopy: () => void;
  onToggleFavorite: () => void;
}) {
  const [copyFlash, setCopyFlash] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  function copy() {
    if (!ticket) return;
    const text = ticket.mission;
    const done = () => {
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
    onCopy();
  }

  function save() {
    if (!ticket) return;
    onToggleFavorite();
    setSaveFlash(false);
    // restart the pop-flash animation even on repeated clicks
    requestAnimationFrame(() => setSaveFlash(true));
    setTimeout(() => setSaveFlash(false), 550);
  }

  function share() {
    if (!ticket) return;
    shareTicketImage(ticket).catch(() => {});
  }

  const disabled = !ticket || !visible;

  return (
    <div className="ticket-divider" id="ticketDivider">
      {visible && ticket ? (
        <article key={animKey} className={"ticket " + (tearing ? "tearing" : "printing")} aria-live="polite">
          <div className="ticket-text">
            <p className="ticket-mission">{ticket.mission}</p>
            <div className="ticket-meta">
              <span>{padTicketNo(ticket.no)}</span> · <span>{ticket.time}</span>
            </div>
          </div>
          <div className="ticket-actions">
            <button type="button" disabled={disabled} onClick={copy} className={copyFlash ? "copy-flash" : ""} aria-label="Copy prompt" title="Copy prompt">
              <span className="ticket-icon copy-icon" aria-hidden="true" />
            </button>
            <button
              type="button"
              id="favBtn"
              disabled={disabled}
              onClick={save}
              className={(favorited ? "favd " : "") + (saveFlash ? "saveflash" : "")}
              aria-label="Save to favorites"
              title="Save to favorites"
            >
              <span aria-hidden="true">{favorited ? "★" : "☆"}</span>
            </button>
            <button type="button" disabled={disabled} onClick={share} aria-label="Share as image" title="Share as image">
              <span className="ticket-icon share-icon" aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </span>
            </button>
          </div>
        </article>
      ) : null}
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
