// filecards.jsx — per-figure file-card printing catalog + shared display atoms (swatch +
// "tell" line). One module, imported by app-detail.jsx (instance detail modal) and
// app-add-figure.jsx (Add Figure CONDITION step) so the printing list and its markup
// can't drift between screens — same pattern as fig-identity.jsx.
//
// Printings come from the figure's own `fileCards` array (server/catalog.js, joined off
// file_cards/figure_file_cards — see FILE_CARDS.md for the worklog these rows come from
// and server/migrate-file-cards.mjs for how they're synced), not a fixed global list —
// real vintage file cards vary by figure (card-back color, logo, print differences), so
// a generic A/B/C set couldn't represent them. Most figures have zero catalogued
// printings today; both components below degrade gracefully for that case.
import React from 'react';
import { AccSwatch } from './acc-colors.jsx';

export function filecardsFor(fig) {
  return (fig && fig.fileCards) || [];
}

export function filecardById(fig, id) {
  if (id == null) return null;
  return filecardsFor(fig).find((c) => c.file_card_id === id) || null;
}

// Swatch chip + <select> + caret. Shows an explicit "select one" placeholder rather than
// guessing a default when a copy is on-file but no printing has been chosen yet.
export function FileCardRow({ fig, printing, onChange }) {
  const cards = filecardsFor(fig);
  if (cards.length === 0) {
    return <span className="fc-empty">No printings catalogued for this figure yet</span>;
  }
  const sel = filecardById(fig, printing);
  return (
    <span className="fc-selwrap">
      {sel && <AccSwatch color={sel.card_back} size={14} title={(sel.card_back || "unknown") + " card back"} />}
      <select className="fc-sel" value={printing || ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        {!sel && <option value="">Select printing…</option>}
        {cards.map((c) => <option key={c.file_card_id} value={c.file_card_id}>{c.file_card_code} · {c.notes || c.card_back}</option>)}
      </select>
      <span className="fc-caret">▾</span>
    </span>
  );
}

// Descriptive line under the row, built from the selected printing's real DB fields
// rather than invented flavor text. Printings can differ on any combination of these —
// card_back/card_color (the visual "tell", also what drives the swatch), logo_version
// (e.g. G.I. Joe vs. Cobra), text_version (bio-copy edits between print runs — e.g.
// Zartan's "schizophrenia" line being removed in a later run, same card_back color), or
// release_type/country. All of them surface here so a text-only or logo-only distinction
// isn't invisible just because the color didn't change. Sibling to FileCardRow, not
// nested in it — app-detail.jsx / app-add-figure.jsx render it as its own row under the
// .acc.fc-row grid, matching the shape .fc-tellrow/.fc-cat were already built for (see
// web/src/app.css).
export function FileCardTell({ fig, printing }) {
  const cards = filecardsFor(fig);
  if (cards.length === 0) return null;
  const sel = filecardById(fig, printing);
  if (!sel) return <div className="fc-tellrow"><span>Pick a printing to see its details</span><span className="fc-cat">{cards.length} on record</span></div>;
  const parts = [
    sel.card_back && sel.card_back + " card back",
    sel.logo_version && sel.logo_version + " logo",
    sel.text_version && sel.text_version + " text",
    sel.release_type,
    sel.country,
    sel.notes,
  ].filter(Boolean);
  return <div className="fc-tellrow"><span>{parts.join(" · ")}</span><span className="fc-cat">{cards.length} on record</span></div>;
}
