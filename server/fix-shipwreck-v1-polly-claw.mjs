#!/usr/bin/env node
// server/fix-shipwreck-v1-polly-claw.mjs — one-off, re-runnable fix for
// Shipwreck (v1, figure catalog id 87, source F135), owner-confirmed
// 2026-08-09.
//
// "Polly Claw" (A0201) was tracked as its own detachable accessory alongside
// Polly the parrot (A0200). It isn't detachable — the claw is molded as part
// of the same piece. A snapped-off claw is damage to Polly (units_damaged on
// the Polly instance_accessories row), not a separately missing accessory.
// Drop the figure_accessories link so Polly Claw stops appearing as its own
// checklist item; also clear the one existing instance_accessories row that
// was tracking it (units_owned was already 0, so no ownership data is lost).
// The orphaned accessories row (A0201) is left in place, same as other
// unlink-not-delete fixes (fix-zap-v1-5-bazooka.mjs) — Parts Bin only lists
// accessories still joined to a figure_accessories row, so it drops out of
// view on its own.
import db from './db.js';

const figure = db.prepare("SELECT id, code_name FROM figures WHERE figure_id = 'F135'").get();
if (!figure) { console.error('✕ F135 (Shipwreck v1) not found.'); process.exit(1); }

const claw = db.prepare("SELECT id FROM accessories WHERE accessory_code = 'A0201'").get();
if (!claw) { console.error('✕ A0201 (Polly Claw) not found.'); process.exit(1); }

const linked = db.prepare('SELECT 1 FROM figure_accessories WHERE figure_id = ? AND accessory_id = ?')
  .get(figure.id, claw.id);
if (!linked) { console.log('✓ Shipwreck v1 already has no Polly Claw link — nothing to do.'); process.exit(0); }

const run = db.transaction(() => {
  const delBlueprint = db.prepare('DELETE FROM figure_accessories WHERE figure_id = ? AND accessory_id = ?')
    .run(figure.id, claw.id);
  const delInstances = db.prepare(`
    DELETE FROM instance_accessories WHERE accessory_id = ? AND instance_id IN (
      SELECT id FROM instances WHERE figure_id = ?
    )
  `).run(claw.id, figure.id);
  return { blueprint: delBlueprint.changes, instances: delInstances.changes };
});

const result = run();
console.log(`✓ Shipwreck v1 (F135, id ${figure.id})`);
console.log(`  Removed Polly Claw (A0201) from the blueprint: ${result.blueprint} row(s).`);
console.log(`  Cleared stray instance_accessories tracking rows: ${result.instances} row(s).`);
console.log('  Shipwreck v1 blueprint now tracks Polly (whole, with claw) instead of Polly + Polly Claw separately.');
console.log('\nRestart the backend (npm start) — it does not hot-reload — for /api/catalog to pick this up.');
