#!/usr/bin/env node
// server/fix-zap-v1-5-bazooka.mjs — one-off, re-runnable fix for Zap
// (v1.5, figure catalog id 48, source F084), owner-confirmed 2026-07-22.
//
// Zap v1.5's blueprint carried all 3 Zap bazooka mold variants (Bazooka
// double handle A0027, single thin handle A0028, single thick handle A0029)
// as separately-required items — unlike Zap v1 (figure id 16), which groups
// the same 3 accessories under accessory_groups.group_id 37 ("own any one").
// Owner confirmed the real figure only ever came with one bazooka + the
// Binocular Headset (A0025); drop the double-handle and thin-handle rows.
//
// The remaining bazooka is now the only one Zap v1.5 requires, so the
// "(single thick handle)" qualifier (needed on Zap v1 / Cobra v1, which
// still have multiple bazooka molds each) is no longer meaningful here.
// accessories.name is a global column with no per-figure override, and
// A0029 is shared with Zap v1 + Cobra v1 (both still ambiguous), so rather
// than renaming it globally, this creates a new accessory row named plain
// "Bazooka" scoped only to Zap v1.5 — same "new row for a figure-specific
// need" pattern as fix-outback-v1-blueprint.mjs's convention-issue Flashlight.
import db from './db.js';

const figure = db.prepare("SELECT id, code_name, version FROM figures WHERE figure_id = 'F084'").get();
if (!figure) { console.error('✕ F084 (Zap v1.5) not found.'); process.exit(1); }

const already = db.prepare(`
  SELECT 1 FROM figure_accessories fa JOIN accessories a ON a.id = fa.accessory_id
  WHERE fa.figure_id = ? AND a.name = 'Bazooka'
`).get(figure.id);
if (already) { console.log('✓ Zap v1.5 already has its own plain "Bazooka" row — nothing to do.'); process.exit(0); }

const run = db.transaction(() => {
  // 1. Drop the double-handle and single-thin-handle bazookas outright.
  const del = db.prepare('DELETE FROM figure_accessories WHERE figure_id = ? AND accessory_id IN (27, 28)')
    .run(figure.id);

  // 2. Replace the shared single-thick-handle row (A0029, shared with Zap v1
  // + Cobra v1) with a new figure-scoped accessory named plain "Bazooka",
  // modeled on A0029 (category_id 13 "Weapon — bazooka / launcher", dark
  // green, Weapon Bazooka/ Launcher type).
  const delOld = db.prepare('DELETE FROM figure_accessories WHERE figure_id = ? AND accessory_id = 29').run(figure.id);

  const maxCode = db.prepare("SELECT MAX(CAST(SUBSTR(accessory_code, 2) AS INTEGER)) AS n FROM accessories").get().n;
  const newCode = 'A' + String(maxCode + 1).padStart(4, '0');
  const info = db.prepare(`
    INSERT INTO accessories (accessory_code, name, category_id, type, color, pack_quantity, variant_notes)
    VALUES (?, 'Bazooka', 13, 'Weapon Bazooka/ Launcher', 'dark green', 1, 'Zap v1.5 only — same mold as A0029, split off so the name doesn''t need a handle qualifier here')
  `).run(newCode);
  const newAccId = info.lastInsertRowid;

  db.prepare(`
    INSERT INTO figure_accessories (figure_id, accessory_id, quantity_required, release_context)
    VALUES (?, ?, 1, 'retail')
  `).run(figure.id, newAccId);

  return { removed: del.changes + delOld.changes, newCode, newAccId };
});

const result = run();
console.log(`✓ Zap v1.5 (F084, id ${figure.id})`);
console.log(`  Removed double-handle (A0027) + single-thin-handle (A0028) + old shared single-thick-handle (A0029) rows: ${result.removed} row(s).`);
console.log(`  New accessory ${result.newCode} (id ${result.newAccId}): "Bazooka" — attached retail-only, scoped to Zap v1.5 alone.`);
console.log('  Zap v1.5 blueprint is now: Binocular Headset + Bazooka.');
console.log('\nRestart the backend (npm start) — it does not hot-reload — for /api/catalog to pick this up.');
