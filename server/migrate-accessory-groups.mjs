#!/usr/bin/env node
// server/migrate-accessory-groups.mjs — one-off, additive import of accessory
// variant slots ("own any one member of this group") into the live DB.
//
// gijoe_db_figures_accessories_group_id.csv carries an external group_id column
// on 19 distinct slots, but only 8 are genuine interchangeable-variant pairs
// (same base item, different mold — Helmet/Helmet-with-holes, thin/thick
// handle, etc.) matching PARTS_BIN.md's "Accessory completeness model". The
// other 11 pair unrelated item types (e.g. Firefly's Submachine Gun +
// Walkie-Talkie) and are NOT variant alternates — owner-confirmed these stay
// independently required, so the CSV's own grouping is deliberately not used
// for those. Entries below with extGroupId: null are hand-built slots (not
// from that CSV column) for figures needing match_key cross-slot matching —
// see match_key.md for the running catalogue and why.
//
// This does NOT touch instances/instance_accessories (owned collection data) —
// only accessory_groups (empty today) and figure_accessories.group_id. Safe to
// run against the live DB. Re-runnable: every write is guarded by an
// existence check.
//
// Usage: node server/migrate-accessory-groups.mjs
import db from './db.js';

// Hand-verified against the live DB (see PR discussion) — external group_id
// kept in comments for traceability back to the source CSV.
const GROUPS = [
  { extGroupId: 8401, figure: 'Blowtorch', accessories: ['A0065', 'A0066'] }, // Helmet / Helmet (with holes)
  { extGroupId: 8402, figure: 'Blowtorch', accessories: ['A0069', 'A0070'] }, // Flamethrower / Flamethrower
  { extGroupId: 8405, figure: 'Mutt',      accessories: ['A0082', 'A0083'] }, // Helmet / Helmet (with holes)
  { extGroupId: 8408, figure: 'Rip Cord',  accessories: ['A0093', 'A0094'] }, // Helmet / Helmet (with holes)
  { extGroupId: 8409, figure: 'Rip Cord',  accessories: ['A0097', 'A0098'] }, // SLR-W1L1 Rifle / SLR-W1L1 Rifle
  { extGroupId: 8412, figure: 'Scrap-Iron', accessories: ['A0111', 'A0112'] }, // Remote Activator thin/thick handle
  { extGroupId: 8415, figure: 'Thunder',   accessories: ['A0125', 'A0126'] }, // Radio Headset / Radio Headset
  { extGroupId: 8601, figure: 'A.V.A.C.',  accessories: ['A0225', 'A0226'] }, // Parachute pack soft/hard plastic
  // Firefly (1984): NOT from the CSV's group_id column (that one cross-paired
  // gun+radio, which is wrong — see match_key.md). These two slots are each a
  // same-item colour pair; match_key (set separately, see set-match-key.mjs)
  // is what actually ties the two slots' light-green / dull-green members
  // together for completion.
  { extGroupId: null, figure: 'Firefly', accessories: ['A0078', 'A0079'] }, // Submachine Gun light/dull green
  { extGroupId: null, figure: 'Firefly', accessories: ['A0080', 'A0081'] }, // Walkie-Talkie light/dull green
  // Duke (1983, v1, F057-F061 -> catalog id 27): 'Duke' also matches 5 later
  // versions by code_name, but the lowest id (27, v1) is the one with these
  // accessories, so the unqualified code_name lookup below resolves correctly.
  // Not a plain interchangeable-variant slot: two Helmet molds (with-holes,
  // no-holes) share a colourway with the Submachine Gun, tied via match_key
  // (set separately, see set-match-key.mjs) rather than by this grouping alone.
  { extGroupId: null, figure: 'Duke', accessories: ['A0024', 'A0039', 'A0040'] }, // Helmet (with holes) light/bright green + Helmet (no holes) green
  { extGroupId: null, figure: 'Duke', accessories: ['A0041', 'A0042'] }, // M-32 Submachine Gun green/bright green
];

// Same label rule as the locked reference (subgroup-wire-v2.jsx groupLabel):
// text before the first "(" in the first member's name, else the full name.
function slotName(firstMemberName) {
  const m = firstMemberName.match(/^(.*?)\s*\(/);
  return m ? m[1].trim() : firstMemberName;
}

const getFigure = db.prepare('SELECT id FROM figures WHERE code_name = ?');
const getAccessory = db.prepare('SELECT id, name, group_id FROM figure_accessories fa JOIN accessories a ON a.id = fa.accessory_id WHERE fa.figure_id = ? AND a.accessory_code = ?');
const insertGroup = db.prepare('INSERT INTO accessory_groups (figure_id, slot_name, quantity_required) VALUES (?, ?, 1)');
const setGroupId = db.prepare('UPDATE figure_accessories SET group_id = ? WHERE figure_id = ? AND accessory_id = ?');

const summary = [];

const run = db.transaction(() => {
  for (const g of GROUPS) {
    const fig = getFigure.get(g.figure);
    if (!fig) { summary.push(`✕ SKIP ${g.figure} — figure not found`); continue; }

    const tag = g.extGroupId != null ? `ext group ${g.extGroupId}` : g.accessories.join('/');
    const members = g.accessories.map((code) => {
      const row = getAccessory.get(fig.id, code);
      if (!row) throw new Error(`Accessory ${code} not found on ${g.figure}'s blueprint (${tag})`);
      return row;
    });

    if (members.every((m) => m.group_id != null)) {
      summary.push(`· SKIP ${g.figure} — ${tag} already imported`);
      continue;
    }

    const name = slotName(members[0].name);
    const groupId = insertGroup.run(fig.id, name).lastInsertRowid;
    for (const m of members) setGroupId.run(groupId, fig.id, m.id);
    summary.push(`✓ ${g.figure} — "${name}" (accessory_groups.id ${groupId}): ${members.map((m) => m.name).join(' / ')}`);
  }
});

run();
console.log(summary.join('\n'));

const groupCount = db.prepare('SELECT COUNT(*) AS n FROM accessory_groups').get().n;
const linkedCount = db.prepare('SELECT COUNT(*) AS n FROM figure_accessories WHERE group_id IS NOT NULL').get().n;
console.log(`\naccessory_groups rows: ${groupCount}`);
console.log(`figure_accessories rows with group_id set: ${linkedCount}`);
