#!/usr/bin/env node
// server/migrate-file-cards.mjs — CSV-driven, idempotent import of real per-figure
// file-card printings into the live DB. `file_cards` / `figure_file_cards` already
// existed in the schema but were empty and unwired — this syncs them from two
// hand-maintained CSVs, the same way server/import-coo.mjs syncs figure_coo from
// gijoe_db_figures_coo.csv. See FILE_CARDS.md for the narrative worklog.
//
// Source files (repo root):
//   gijoe_db_file_cards.csv        — one row per distinct printing (-> file_cards)
//   gijoe_db_figure_file_cards.csv — one row per figure <-> printing link
//                                    (-> figure_file_cards)
//
// Unlike server/migrate-accessory-groups.mjs (a small, hand-curated array that's
// added to once per figure and never revisited), these CSVs are meant to be the
// living source of truth — re-running this script after editing a CSV row UPDATEs
// the matching DB row rather than skipping it, so corrections/additions propagate.
// Safe to run against the live DB, any number of times.
//
// Usage: node server/migrate-file-cards.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const FILE_CARDS_CSV = path.join(ROOT, 'gijoe_db_file_cards.csv');
const FIGURE_FILE_CARDS_CSV = path.join(ROOT, 'gijoe_db_figure_file_cards.csv');

const blank = (v) => (v === undefined || v === '' ? null : v);

const fileCardRows = parse(fs.readFileSync(FILE_CARDS_CSV), { columns: true, bom: true, trim: true });
const linkRows = parse(fs.readFileSync(FIGURE_FILE_CARDS_CSV), { columns: true, bom: true, trim: true });

const upsertFileCard = db.prepare(`
  INSERT INTO file_cards (file_card_code, code_name, release_type, card_back, card_color, logo_version, text_version, country, notes)
  VALUES (@file_card_code, @code_name, @release_type, @card_back, @card_color, @logo_version, @text_version, @country, @notes)
  ON CONFLICT(file_card_code) DO UPDATE SET
    code_name = excluded.code_name, release_type = excluded.release_type, card_back = excluded.card_back,
    card_color = excluded.card_color, logo_version = excluded.logo_version, text_version = excluded.text_version,
    country = excluded.country, notes = excluded.notes, updated_at = CURRENT_TIMESTAMP
`);
const getFileCardByCode = db.prepare('SELECT file_card_id FROM file_cards WHERE file_card_code = ?');

const getFigureById = db.prepare('SELECT id FROM figures WHERE id = ?');
const getFigureByName = db.prepare('SELECT id FROM figures WHERE code_name = ? ORDER BY id LIMIT 1');
const countFigureByName = db.prepare('SELECT COUNT(*) AS n FROM figures WHERE code_name = ?');
const upsertLink = db.prepare(`
  INSERT INTO figure_file_cards (figure_id, file_card_id, is_original, notes)
  VALUES (@figure_id, @file_card_id, @is_original, @notes)
  ON CONFLICT(figure_id, file_card_id) DO UPDATE SET is_original = excluded.is_original, notes = excluded.notes
`);

const summary = [];

const run = db.transaction(() => {
  for (const r of fileCardRows) {
    if (!r.file_card_code) continue; // blank spacer rows
    const before = getFileCardByCode.get(r.file_card_code);
    upsertFileCard.run({
      file_card_code: r.file_card_code,
      code_name: blank(r.code_name),
      release_type: blank(r.release_type),
      card_back: blank(r.card_back),
      card_color: blank(r.card_color),
      logo_version: blank(r.logo_version),
      text_version: blank(r.text_version),
      country: blank(r.country),
      notes: blank(r.notes),
    });
    summary.push(`${before ? "~ UPDATE" : "✓ INSERT"} file_cards ${r.file_card_code} (${r.code_name || "?"} — ${r.notes || r.card_back || ""})`);
  }

  for (const r of linkRows) {
    if (!r.file_card_code) continue;
    const fc = getFileCardByCode.get(r.file_card_code);
    if (!fc) { summary.push(`✕ SKIP link ${r.code_name || r.figure_id} -> ${r.file_card_code} — file_card_code not found (check gijoe_db_file_cards.csv)`); continue; }

    let figureId = blank(r.figure_id) ? Number(r.figure_id) : null;
    if (figureId != null && !getFigureById.get(figureId)) { summary.push(`✕ SKIP link — figure_id ${figureId} not found`); continue; }
    if (figureId == null) {
      if (!r.code_name) { summary.push(`✕ SKIP link ${r.file_card_code} — no figure_id or code_name given`); continue; }
      const n = countFigureByName.get(r.code_name).n;
      const fig = getFigureByName.get(r.code_name);
      if (!fig) { summary.push(`✕ SKIP link ${r.code_name} -> ${r.file_card_code} — figure not found`); continue; }
      figureId = fig.id;
      if (n > 1) summary.push(`  ⚠ ${r.code_name} matches ${n} figures — resolved to lowest id (${figureId}); set figure_id explicitly in the CSV if you meant a different version`);
    }

    upsertLink.run({
      figure_id: figureId,
      file_card_id: fc.file_card_id,
      is_original: blank(r.is_original) == null ? 1 : Number(r.is_original),
      notes: blank(r.notes),
    });
    summary.push(`✓ LINK figure ${figureId} (${r.code_name || ""}) <-> ${r.file_card_code}`);
  }
});

run();
console.log(summary.join('\n'));

// One-time fixup: the sole instance with the old free-text filecard_printing set
// ('A' == "first print" under the retired 3-letter scheme) points at Breaker's
// matching real printing (FC001, "Carded Tan") instead. Guarded — only fires once.
const inst = db.prepare("SELECT id, filecard_id FROM instances WHERE id = 13 AND filecard_printing = 'A'").get();
if (inst && inst.filecard_id == null) {
  const fc001 = getFileCardByCode.get('FC001');
  if (fc001) {
    db.prepare('UPDATE instances SET filecard_id = ? WHERE id = ?').run(fc001.file_card_id, inst.id);
    console.log(`\n✓ instance 13 — filecard_id set to FC001 (was filecard_printing='A')`);
  }
}

const cardCount = db.prepare('SELECT COUNT(*) AS n FROM file_cards').get().n;
const linkCount = db.prepare('SELECT COUNT(*) AS n FROM figure_file_cards').get().n;
console.log(`\nfile_cards rows: ${cardCount}`);
console.log(`figure_file_cards rows: ${linkCount}`);
