#!/usr/bin/env node
// server/fix-cobra-sub-team-mismap.mjs — one-off, re-runnable fix for a
// systemic sub_group_id mis-keying, owner-confirmed 2026-08-10.
//
// gijoe_db_figures_2.0.csv hand-keyed sub_group_id as a raw number, and six
// Cobra-side sub-teams got filed under the wrong bucket while their intended
// "Cobra ___" sibling group sat completely empty:
//
//   Street Fighter II  -> should be Iron Grenadiers   (Destro, T.A.R.G.A.T. v1, etc. — not one Street Fighter II name among them)
//   Mega Marines       -> should be Python Patrol     (every row is literally "Python ___")
//   Cobra Ninja Force  -> should be Dreadnoks         (every row is faction=Dreadnoks, not Cobra)
//   Ninja Force        -> Cobra/Dreadnok-faction rows move to Cobra Ninja Force (Dice, Slice x2, Night Creeper, Red Ninjas, Zartan v2)
//   Eco Warriors       -> Cobra-faction rows move to Cobra Eco Warriors (Cesspool, Sludge Viper, Toxo-Viper, Toxo-Zombie)
//   Star Brigade       -> Cobra-faction rows move to Cobra Star Brigade (Astro-Viper, T.A.R.G.A.T. v2, Blackstar, Carcass, Cobra Commander v7, Lobotomaxx, Predacon)
//
// The DB and CSV steps below are independent and each individually
// idempotent — re-running is always safe, whichever side is already fixed.
//
// The CSV is parsed and rewritten as raw arrays (not { columns: true }
// objects): the header has TWO columns both named `year_released` (position
// 1 and 17), and object-mode parsing collapses same-named columns into one
// key, silently dropping data on any row->object->row round-trip. Positional
// arrays sidestep that collision entirely.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CSV_PATH = path.join(ROOT, 'gijoe_db_figures_2.0.csv');

const subGroupId = (name) => {
  const row = db.prepare('SELECT sub_group_id FROM sub_groups WHERE name = ?').get(name);
  if (!row) throw new Error(`sub_group "${name}" not found`);
  return row.sub_group_id;
};
const joeFactionId = db.prepare("SELECT faction_id FROM factions WHERE name = 'G.I. Joe'").get().faction_id;

// Each rule: move every figure currently in `from` (optionally filtered to
// faction != joeFactionId, i.e. Cobra- or Dreadnok-faction rows only) to `to`.
const RULES = [
  { from: 'Street Fighter II', to: 'Iron Grenadiers',     onlyNonJoe: false },
  { from: 'Mega Marines',      to: 'Python Patrol',       onlyNonJoe: false },
  { from: 'Cobra Ninja Force', to: 'Dreadnoks',           onlyNonJoe: false },
  { from: 'Ninja Force',       to: 'Cobra Ninja Force',   onlyNonJoe: true },
  { from: 'Eco Warriors',      to: 'Cobra Eco Warriors',  onlyNonJoe: true },
  { from: 'Star Brigade',      to: 'Cobra Star Brigade',  onlyNonJoe: true },
];
// Resolve to concrete ids once, in RULES order — order matters (e.g. "Cobra
// Ninja Force" must be vacated into "Dreadnoks" before "Ninja Force" rows
// move into it) and applies identically to both the DB pass and the CSV pass.
const resolvedRules = RULES.map((r) => ({ ...r, fromId: subGroupId(r.from), toId: subGroupId(r.to) }));

// NOT safely re-runnable as a blind loop: "Cobra Ninja Force" is both a
// rule's `from` (draining its original, wrongly-keyed Dreadnok members) and
// a later rule's `to` (receiving its real Cobra-faction members). A second
// full pass would treat that second rule's legitimate output as leftover
// mis-keyed input and drain it right back out. Guard by checking whether the
// fix already landed (every `to` bucket has at least one member) and bail
// out before touching anything if so.
const alreadyApplied = resolvedRules.every(
  (r) => db.prepare('SELECT 1 FROM figures WHERE sub_group_id = ? LIMIT 1').get(r.toId)
);
if (alreadyApplied) {
  console.log('✓ Already applied (every target sub-team has members) — nothing to do.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 1. Live DB
// ---------------------------------------------------------------------------
const selectStmt = db.prepare('SELECT id, code_name, version, faction_id FROM figures WHERE sub_group_id = ?');
const updateStmt = db.prepare('UPDATE figures SET sub_group_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

const dbMoves = db.transaction(() => {
  const moved = [];
  for (const rule of resolvedRules) {
    const candidates = selectStmt.all(rule.fromId).filter((f) => !rule.onlyNonJoe || f.faction_id !== joeFactionId);
    for (const f of candidates) {
      updateStmt.run(rule.toId, f.id);
      moved.push({ id: f.id, code_name: f.code_name, version: f.version, from: rule.from, to: rule.to });
    }
  }
  return moved;
})();

console.log(`✓ DB: re-tagged ${dbMoves.length} figure(s)`);
for (const m of dbMoves) console.log(`  #${m.id} ${m.code_name} v${m.version || ''}: "${m.from}" -> "${m.to}"`);
if (dbMoves.length === 0) console.log('  (nothing to move — already applied)');

// ---------------------------------------------------------------------------
// 2. Source CSV — positional, so the duplicate `year_released` header can't
//    cause data loss. Column indexes (0-based) from the header row.
// ---------------------------------------------------------------------------
const rawRows = parse(fs.readFileSync(CSV_PATH, 'utf8'), { columns: false, bom: true });
const header = rawRows[0];
const idx = (name) => header.indexOf(name);
const CODE_NAME = idx('code_name'), VERSION = idx('version'), FACTION_ID = idx('faction_id'), SUB_GROUP_ID = idx('sub_group_id');
if ([CODE_NAME, VERSION, FACTION_ID, SUB_GROUP_ID].some((i) => i === -1)) {
  throw new Error('Expected column not found in gijoe_db_figures_2.0.csv header');
}

const csvField = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

let csvChanged = 0;
for (let i = 1; i < rawRows.length; i++) {
  const row = rawRows[i];
  const rowSubGroupId = row[SUB_GROUP_ID] === '' ? null : parseInt(row[SUB_GROUP_ID], 10);
  const rowFactionId = row[FACTION_ID] === '' ? null : parseInt(row[FACTION_ID], 10);
  const rule = resolvedRules.find((r) => r.fromId === rowSubGroupId && (!r.onlyNonJoe || rowFactionId !== joeFactionId));
  if (rule) {
    row[SUB_GROUP_ID] = String(rule.toId);
    csvChanged++;
  }
}

if (csvChanged > 0) {
  const csvText = rawRows.map((row) => row.map(csvField).join(',')).join('\n') + '\n';
  fs.writeFileSync(CSV_PATH, csvText);
}
console.log(`✓ CSV: patched ${csvChanged} row(s) in gijoe_db_figures_2.0.csv`);
if (csvChanged === 0) console.log('  (nothing to patch — already applied)');

console.log('\nRestart the backend (npm start) — it does not hot-reload — for /api/catalog to pick this up.');
