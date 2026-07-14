// server/blueprint-names.js — shared by catalog.js (what the frontend displays
// and uses as the accessory-tracking key) and instances.js (how a name PATCHed
// from the frontend gets resolved back to an accessory_id). Both must agree on
// the same disambiguated name for the same row, or a checkbox toggle silently
// resolves to the wrong (or an ambiguous) accessory.
//
// instance_accessories tracks ownership by accessory name, scoped to one
// figure's blueprint — an invariant that assumed names are unique within a
// figure. False whenever the source data has two same-named accessories on
// one figure (e.g. Firefly's two "Submachine Gun" entries, one per colour
// variant) — without this, both options collapse onto the same tracked row
// and toggling either one toggles both in the UI. Disambiguate by appending
// "(color)" when that's enough to tell rows apart; fall back to a numbered
// suffix for the case where even color collides (first hit: Outback v1's
// retail vs. convention green Flashlight, 2026-07-13) — two passes, since the
// color-appended label needs its own collision check rather than assuming
// color alone always resolves it.
export function disambiguateNames(rows) {
  const counts = new Map();
  for (const r of rows) counts.set(r.name, (counts.get(r.name) || 0) + 1);
  const withColor = rows.map((r) => {
    if (counts.get(r.name) <= 1) return { ...r };
    return { ...r, name: r.color ? `${r.name} (${r.color})` : r.name };
  });
  const labelCounts = new Map();
  for (const r of withColor) labelCounts.set(r.name, (labelCounts.get(r.name) || 0) + 1);
  const seen = new Map();
  return withColor.map((r) => {
    if (labelCounts.get(r.name) <= 1) return r;
    const idx = (seen.get(r.name) || 0) + 1;
    seen.set(r.name, idx);
    return { ...r, name: `${r.name} #${idx}` };
  });
}
