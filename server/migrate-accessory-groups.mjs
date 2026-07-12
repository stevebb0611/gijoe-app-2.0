#!/usr/bin/env node
// server/migrate-accessory-groups.mjs — one-off, additive import of accessory
// variant slots ("own any one member of this group") into the live DB.
//
// gijoe_db_figures_accessories_group_id.csv carries an external group_id column
// on 19 distinct slots, but only 9 are genuine interchangeable-variant pairs
// (same base item, different mold/color — Helmet/Helmet-with-holes, thin/thick
// handle, Crimson Guard's 3-way Dress Backpack, etc.) matching PARTS_BIN.md's
// "Accessory completeness model". The other 10 pair unrelated item types (e.g.
// Firefly's Submachine Gun + Walkie-Talkie) and are NOT variant alternates —
// owner-confirmed these stay independently required, so the CSV's own
// grouping is deliberately not used for those. Entries below with
// extGroupId: null are hand-built slots (not from that CSV column) — some
// (Firefly, Duke, Recondo, Spirit, Zartan) need match_key cross-slot
// matching, others (Recoil, T.A.R.G.A.T.) don't — see ACCESSORY_GROUPS.md
// for the running catalogue and why.
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
  { extGroupId: null,  figure: 'Recoil',     accessories: ['A0616', 'A0617'] }, // Mine Case thin/thick handle
  { extGroupId: 8415, figure: 'Thunder',   accessories: ['A0125', 'A0126'] }, // Radio Headset / Radio Headset
  { extGroupId: 8601, figure: 'A.V.A.C.',  accessories: ['A0225', 'A0226'] }, // Parachute pack soft/hard plastic
  { extGroupId: 8501, figure: 'Crimson Guard', accessories: ['A0161', 'A0162', 'A0163'] }, // Dress Backpack solid-back light/dark red + hollow-back light red
  // Dr. Mindbender (1986, v1, F154 -> catalog id 103): 'Dr. Mindbender' also
  // matches a later v2 (id 406, F500), but the lowest id (103, v1) is the one
  // with these accessories, same pattern as Duke/Recondo/Spirit/Zartan/
  // T.A.R.G.A.T. above. NOT a match_key case — a single slot, two
  // interchangeable Cobra Cape applications (sewn-on patch / iron-on decal);
  // own any one for completion.
  { extGroupId: null, figure: 'Dr. Mindbender', accessories: ['A0243', 'A0244'] }, // Cobra Cape (patch) / Cobra Cape (iron-on)
  // Serpentor (1986, v1, F169 -> catalog id 117): single catalog row, no
  // version collision. NOT a match_key case — one slot, five interchangeable
  // colorways of the same "Snake" accessory (gold/bronze/dark brown/
  // translucent brown/green), own any one for completion. Snake Headdress,
  // Dagger, and Cape are separate items outside this slot, not tied to a
  // specific snake color.
  { extGroupId: null, figure: 'Serpentor', accessories: ['A0271', 'A0272', 'A0273', 'A0274', 'A0275'] }, // Snake gold/bronze/dark brown/translucent brown/green
  // Firefly (1984): NOT from the CSV's group_id column (that one cross-paired
  // gun+radio, which is wrong — see ACCESSORY_GROUPS.md). These two slots are each a
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
  // Recondo (1984, v1, F099 -> catalog id 58): two colorways, light green
  // (variant A) and dark green (variant B) — the Backpack and Rifle each ship
  // in the matching color, tied via match_key (set separately, see
  // set-match-key.mjs) rather than by this grouping alone.
  { extGroupId: null, figure: 'Recondo', accessories: ['A0089', 'A0090'] }, // Cross Country Backpack light/dark green
  { extGroupId: null, figure: 'Recondo', accessories: ['A0091', 'A0092'] }, // M-14E2X Rifle light/dark green
  // Spirit (1984, v1, F104 -> catalog id 62): two colorways, light green
  // (variant A) and dark green (variant B) — the Arrow Cassette Pack and
  // Auto-Arrow Launcher each ship in the matching color, tied via match_key
  // (set separately, see set-match-key.mjs) rather than by this grouping alone.
  { extGroupId: null, figure: 'Spirit', accessories: ['A0113', 'A0114'] }, // Arrow Cassette Pack light/dark green
  { extGroupId: null, figure: 'Spirit', accessories: ['A0115', 'A0116'] }, // Auto-Arrow Launcher light/dark green
  // Zartan (1984, v1, F112 -> catalog id 68): 'Zartan' also matches a later
  // Ninja Force v2 (id 478, F578), but the lowest id (68, v1) is the one with
  // these accessories, same pattern as Duke/Recondo/Spirit above. Chest Armor
  // and Thigh Pad each came with a single-sided or double-sided heat sticker,
  // tied via match_key (set separately, see set-match-key.mjs) so single
  // pairs with single and double with double. Both slots are release_context
  // 'bonus' (see set-accessory-context.mjs, 2026-07-06) — non-blocking either way.
  { extGroupId: null, figure: 'Zartan', accessories: ['A0136', 'A0138'] }, // Chest Armor Heat Sticker single/double-sided
  { extGroupId: null, figure: 'Zartan', accessories: ['A0137', 'A0139'] }, // Thigh Pad Heat Sticker single/double-sided
  // T.A.R.G.A.T. (1989, v1, F335 -> catalog id 255): code_name has a trailing
  // space ('T.A.R.G.A.T. ') shared by both v1 and v2, so the unqualified
  // lookup resolves to the lower id (255, v1), same pattern as
  // Duke/Recondo/Spirit/Zartan above. NOT a match_key case — a single slot,
  // three interchangeable Laser Gun molds (rigid plastic / soft plastic
  // opened clip / soft plastic closed clip); own any one for completion.
  { extGroupId: null, figure: 'T.A.R.G.A.T. ', accessories: ['A0657', 'A0658', 'A0659'] }, // Laser Gun rigid/soft-open/soft-closed
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
