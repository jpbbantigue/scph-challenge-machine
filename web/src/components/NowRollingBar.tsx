"use client";

import { useEffect, useState } from "react";
import { CategoryDef } from "@/lib/categories";
import { Ticket } from "@/lib/roll";

// Sticky "Now Rolling" strip — only rendered once the visitor has rolled at
// least once, and only visible while scrolled past the hero and before "How
// It Works". Uses separate show/hide thresholds (hysteresis) so it doesn't
// flicker right at the scroll boundary.
export default function NowRollingBar({
  hasRolled,
  ticket,
  category,
  onRollAgain,
  onCopy,
  onSave
}: {
  hasRolled: boolean;
  ticket: Ticket | null;
  category: CategoryDef;
  onRollAgain: () => void;
  onCopy: () => void;
  onSave: () => void;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    function update() {
      if (!hasRolled) {
        setShow(false);
        return;
      }
      const hero = document.getElementById("slot-machine");
      const howItWorks = document.getElementById("how-it-works");
      if (!hero || !howItWorks) return;
      const heroBottom = hero.getBoundingClientRect().bottom;
      const nextTop = howItWorks.getBoundingClientRect().top;
      setShow((wasShown) => {
        const pastHero = wasShown ? heroBottom < 130 : heroBottom < 70;
        const beforeNextSection = wasShown ? nextTop > 40 : nextTop > 100;
        return pastHero && beforeNextSection;
      });
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [hasRolled]);

  return (
    <div className={"mini-roller-wrap" + (show ? " show" : "")} aria-hidden={!show}>
      <div className="mini-roller">
        <div className="mini-roller-stripe" aria-hidden="true" />
        <div className="mini-roller-label">Now Rolling</div>
        <div className="mini-roller-values">
          {ticket
            ? category.reels
                .filter((r) => ticket.vals[r.key] !== undefined && ticket.vals[r.key] !== null)
                .map((r) => (
                  <div className="mini-roller-value" key={r.key}>
                    <span className="l">{r.label.toUpperCase()}</span>
                    <span className="v">{ticket.vals[r.key]}</span>
                  </div>
                ))
            : null}
        </div>
        <button className="mini-roller-btn roll" type="button" onClick={onRollAgain}>
          Roll Again
        </button>
        <button className="mini-roller-btn icon" type="button" aria-label="Copy prompt" onClick={onCopy}>
          &#10697;
        </button>
        <button className="mini-roller-btn icon gold" type="button" aria-label="Save prompt" onClick={onSave}>
          &#9734;
        </button>
      </div>
    </div>
  );
}
