#!/usr/bin/env node
// server/fix-outback-v1-blueprint.mjs — one-off, re-runnable fix for Outback
// (v1, figure catalog id 152, source F-code F213), owner-confirmed 2026-07-13.
//
// Three corrections to one blueprint:
//   1. Flashlight (black, A0463) was leaking onto Outback v1 from Outback v2
//      (F262/id 192, the Toys R Us black-uniform release) — same class of
//      source-CSV duplication bug as the Blocker/Blaster mixup (see
//      migrations/007_variant_scoped_accessories.sql). Remove it outright;
//      Outback v1 never shipped with it.
//   2. Rifle (white, A0647) and Machine Gun (brown, A0652) are convention-only
//      — reclassify retail -> convention (same release_context mechanism as
//      Roadblock v2 / Snow Serpent / Flint / Falcon / Gung-Ho v2).
//   3. The convention release also included its own Flashlight (green) — same
//      name+color as the retail one (A0352) but a physically distinct pack-in,
//      not the same accessory reused. No spare green-flashlight row exists
//      elsewhere in the catalog to repurpose (checked: only A0352 is green),
//      so this creates a new accessory row (next code after the current max,
//      A1930) and attaches it convention-only. web/src/blueprint-names.js's
//      disambiguateNames() already handles same-name+same-color siblings via
//      numbered suffix, so no code change needed for display.
import db from './db.js';

const figure = db.prepare("SELECT id, code_name FROM figures WHERE figure_id = 'F213'").get();
if (!figure) { console.error('✕ F213 (Outback v1) not found.'); process.exit(1); }

const already = db.prepare(`
  SELECT 1 FROM figure_accessories fa JOIN accessories a ON a.id = fa.accessory_id
  WHERE fa.figure_id = ? AND a.name = 'Flashlight' AND a.color = 'green' AND a.accessory_code != 'A0352'
`).get(figure.id);
if (already) { console.log('✓ Outback v1 already has a second (convention) green Flashlight — nothing to do.'); process.exit(0); }

const run = db.transaction(() => {
  // 1. Remove the black flashlight leaked from Outback v2.
  const blackFlashlight = db.prepare("SELECT id FROM accessories WHERE accessory_code = 'A0463'").get();
  const del = db.prepare('DELETE FROM figure_accessories WHERE figure_id = ? AND accessory_id = ?')
    .run(figure.id, blackFlashlight.id);

  // 2. Rifle (white) + Machine Gun (brown) -> convention.
  const setContext = db.prepare('UPDATE figure_accessories SET release_context = ? WHERE figure_id = ? AND accessory_id = ?');
  for (const code of ['A0647', 'A0652']) {
    const acc = db.prepare('SELECT id FROM accessories WHERE accessory_code = ?').get(code);
    setContext.run('convention', figure.id, acc.id);
  }

  // 3. New accessory row for the convention-issue green Flashlight, modeled on
  // the retail one (A0352: category_id 37 "Tactical Gear", pack_quantity 1).
  const maxCode = db.prepare("SELECT MAX(CAST(SUBSTR(accessory_code, 2) AS INTEGER)) AS n FROM accessories").get().n;
  const newCode = 'A' + String(maxCode + 1).padStart(4, '0');
  const info = db.prepare(`
    INSERT INTO accessories (accessory_code, name, category_id, type, color, pack_quantity, variant_notes)
    VALUES (?, 'Flashlight', 37, 'Tactical Gear', 'green', 1, 'convention issue')
  `).run(newCode);
  const newAccId = info.lastInsertRowid;

  db.prepare(`
    INSERT INTO figure_accessories (figure_id, accessory_id, quantity_required, release_context)
    VALUES (?, ?, 1, 'convention')
  `).run(figure.id, newAccId);

  return { removed: del.changes, newCode, newAccId };
});

const result = run();
console.log(`✓ Outback v1 (F213, id ${figure.id})`);
console.log(`  Removed black Flashlight (A0463): ${result.removed} row(s) — belongs to Outback v2 only.`);
console.log('  Rifle (A0647): retail -> convention');
console.log('  Machine Gun (A0652): retail -> convention');
console.log(`  New accessory ${result.newCode} (id ${result.newAccId}): Flashlight, green, convention issue — attached convention-only.`);
console.log('\nRestart the backend (npm start) — it does not hot-reload — for /api/catalog to pick this up.');
