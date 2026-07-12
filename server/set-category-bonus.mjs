#!/usr/bin/env node
// server/set-category-bonus.mjs — one-off, owner-confirmed bulk reclassification
// of figure_accessories.release_context to 'bonus' for entire accessory
// categories, as opposed to the figure-by-figure story set-accessory-context.mjs
// handles.
//
// Owner confirmed 2026-07-11: every accessory in these categories is a
// non-blocking bonus item regardless of which figure it ships with — Decal
// (accessory_categories.category_id 39), Putty (48), Cassette / VHS (52). See
// ACCESSORY_GROUPS.md's "Category-level bonus reclassification" section.
//
// Only touches figure_accessories.release_context (the column catalog.js /
// store.js actually read for completeness) — not the accessories.release_context
// top-level column, which stays at its default 'retail' and is unused by the
// app today, matching existing precedent (Duke's flag / Zartan's stickers never
// touched it either).
//
// Re-runnable: only rows not already 'bonus' are updated.
// Usage: node server/set-category-bonus.mjs
import db from './db.js';

const CATEGORY_IDS = [39, 48, 52]; // Decal, Putty, Cassette / VHS

const rows = db.prepare(`
  SELECT fa.figure_id, fa.accessory_id, f.code_name, f.version, a.accessory_code, a.name, fa.release_context AS was
  FROM figure_accessories fa
  JOIN accessories a ON a.id = fa.accessory_id
  JOIN figures f ON f.id = fa.figure_id
  WHERE a.category_id IN (${CATEGORY_IDS.join(',')}) AND fa.release_context != 'bonus'
  ORDER BY f.code_name, f.version
`).all();

const setBonus = db.prepare(`UPDATE figure_accessories SET release_context = 'bonus' WHERE figure_id = ? AND accessory_id = ?`);

const run = db.transaction(() => {
  for (const r of rows) setBonus.run(r.figure_id, r.accessory_id);
});
run();

console.log(`${rows.length} figure_accessories row(s) reclassified to 'bonus':`);
for (const r of rows) {
  console.log(`  ${r.code_name} v${r.version} — ${r.name} (${r.accessory_code}): ${r.was} → bonus`);
}
