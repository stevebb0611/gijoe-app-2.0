#!/usr/bin/env node
// server/split-quick-kick-convention.mjs — one-off, re-runnable fix for Quick
// Kick (v1). The CSV carried this as two rows (F133 "A" 1985 retail, F404 "B"
// "Peach-colored skin" 1991 mail order) sharing code_name+version, so
// seed.mjs's dedup silently folded them into one catalog figure (id 85) whose
// blueprint wrongly required all 6 accessories (both colorways) at once.
//
// Per VARIANTS.md: "whole-figure mail-in/convention/exclusive releases get
// their own catalog row... a release with different gear is simply a
// different Figure." Owner-confirmed 2026-07-12: F404 is a Convention
// exclusive (peach skin, dark gray backpack, flimsy sword/nunchuks), not a
// same-release paint variant — split accordingly, dated to the generic
// undated Convention & Mail-In block (series_id 15) since no specific year
// is confirmed. Companion CSV edits already applied to gijoe_db_figures_2.0.csv,
// gijoe_db_accessories.csv, gijoe_db_figures_accessories(_group_id).csv so a
// future from-scratch reseed reproduces this same state.
import db from './db.js';

const CONVENTION_ACCESSORY_CODES = ['A0188', 'A0190', 'A0192']; // dark gray backpack, flimsy sword, flimsy nunchuks

const retail = db.prepare("SELECT id, figure_id, code_name FROM figures WHERE figure_id = 'F133'").get();
if (!retail) { console.error('✕ F133 (Quick Kick retail) not found — already migrated or data changed.'); process.exit(1); }

const already = db.prepare("SELECT id FROM figures WHERE figure_id = 'F404'").get();
if (already) { console.log('✓ F404 (Quick Kick convention) already exists — nothing to do.'); process.exit(0); }

const run = db.transaction(() => {
  const info = db.prepare(`
    INSERT INTO figures (
      figure_id, code_name, version, variant, variant_lookup,
      display_name, full_name, specialty, faction_id, series_id,
      release_context, is_mail_away, notes
    ) VALUES (
      'F404', 'Quick Kick', NULL, NULL, 'Peach-colored skin',
      'Quick Kick (convention)', 'Ito, MacArthur S.', 'Infantry', 1, 15,
      'convention', 0, 'Convention'
    )
  `).run();
  const conventionId = info.lastInsertRowid;

  const getAccByCode = db.prepare('SELECT id FROM accessories WHERE accessory_code = ?');
  const deleteFromRetail = db.prepare('DELETE FROM figure_accessories WHERE figure_id = ? AND accessory_id = ?');
  const insertOnConvention = db.prepare(
    'INSERT INTO figure_accessories (figure_id, accessory_id, quantity_required, release_context) VALUES (?, ?, 1, ?)'
  );
  for (const code of CONVENTION_ACCESSORY_CODES) {
    const acc = getAccByCode.get(code);
    if (!acc) throw new Error(`Accessory ${code} not found.`);
    deleteFromRetail.run(retail.id, acc.id);
    insertOnConvention.run(conventionId, acc.id, 'retail');
  }

  // Retail figure is now single-variant again (its only remaining sibling
  // moved to its own row) — collapse the leftover A/B variant_lookup split.
  db.prepare('DELETE FROM variant_lookup WHERE figure_id = ?').run(retail.id);
  db.prepare("UPDATE figures SET variant = 'A', variant_lookup = NULL WHERE id = ?").run(retail.id);

  // Split the "silver (flimsy)" color field into color + variant_notes.
  db.prepare(
    "UPDATE accessories SET color = 'silver', variant_notes = 'flimsy' WHERE accessory_code IN ('A0190','A0192')"
  ).run();

  return conventionId;
});

const conventionId = run();
console.log(`✓ Quick Kick split: F133 (retail, id ${retail.id}) stays 1985/Series 4, variant A only.`);
console.log(`✓ Created F404 (Quick Kick (convention), id ${conventionId}) — Convention & Mail-In block, dark gray backpack + flimsy sword/nunchuks.`);
console.log('✓ A0190/A0192 color split to "silver" + variant_notes "flimsy".');
console.log('\nRestart the backend (npm start) — it does not hot-reload — for /api/catalog to pick this up.');
