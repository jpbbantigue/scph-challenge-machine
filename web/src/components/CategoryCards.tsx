import { CATEGORIES, ACCENTS } from "@/lib/categories";

// Cards are plain non-interactive divs per the design spec — clicking does
// nothing; the category <select> in the slot machine is the only way to
// change category.
export default function CategoryCards() {
  return (
    <div className="cat-grid">
      {CATEGORIES.map((cat) => {
        const accent = ACCENTS[cat.accent] || ACCENTS.royal;
        return (
          <div className="cat-card" key={cat.id} style={{ borderColor: accent.border }}>
            <span className="cat-glyph" style={{ background: accent.glyph }} />
            <span className="cat-name">{cat.name}</span>
            <span className="cat-blurb">{cat.blurb}</span>
          </div>
        );
      })}
    </div>
  );
}
