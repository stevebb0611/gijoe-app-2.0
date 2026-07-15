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
  // Roadblock (1984, v1, F102 -> catalog id 60): 'Roadblock' also matches 6
  // later versions by code_name, but the lowest id (60, v1) is the one with
  // these accessories, same pattern as Duke/Recondo/Spirit above. The CSV's
  // own group_id column (ext 8410/8411) cross-pairs MG+Tripod by color
  // instead of slotting each item separately — not used here, same reasoning
  // as Firefly/Recondo/Spirit. Two colorways, green (variant A) and dark
  // green (variant B) — the M-2X Heavy Machine Gun and Tripod each ship in
  // the matching color, tied via match_key (set separately, see
  // set-match-key.mjs) rather than by this grouping alone. Owner-confirmed
  // 2026-07-12.
  { extGroupId: null, figure: 'Roadblock', accessories: ['A0101', 'A0102'] }, // M-2X Heavy Machine Gun green/dark green
  { extGroupId: null, figure: 'Roadblock', accessories: ['A0103', 'A0104'] }, // Tripod green/dark green
  // Dodger (1987, v1, F198 -> catalog id 138): 'Dodger' also matches a later
  // v2 (id 268, F349), but the lowest id (138, v1) is the one with these
  // accessories, same pattern as Duke/Recondo/Spirit/Zartan/Dr. Mindbender/
  // T.A.R.G.A.T./Roadblock above. NOT a match_key case — a single slot, two
  // interchangeable Ultra-Sonic Photon Rifle molds (thin handle/thick handle),
  // same shape as Scrap-Iron/Recoil's Remote Activator/Mine Case above; own
  // any one for completion. Not in the CSV's group_id column (blank for both
  // A0315/A0316), so hand-built.
  { extGroupId: null, figure: 'Dodger', accessories: ['A0315', 'A0316'] }, // Ultra-Sonic Photon Rifle thin/thick handle
  // Countdown (1989, v1, F294 -> catalog id 220): 'Countdown' also matches a
  // later v2 (id 397, F491) and v3 (id 492, F592), but the lowest id (220,
  // v1) is the one with these accessories, same pattern as Duke/Recondo/
  // Spirit/Zartan/Dr. Mindbender/T.A.R.G.A.T./Roadblock/Dodger above. NOT a
  // match_key case — a single slot, two interchangeable Space Helmet molds
  // (soft plastic/hard plastic); own any one for completion. Blank in the
  // CSV's group_id column, so hand-built.
  { extGroupId: null, figure: 'Countdown', accessories: ['A0547', 'A0548'] }, // Space Helmet soft/hard plastic
  // Sonic Backpack pick-one pass (2026-07-15, owner-found): six 1990 Series 9
  // figures share the exact same interchangeable-mold pair (raised edges
  // around the backpack's buttons / no edges around the buttons), same shape
  // as Dodger/Countdown above. Each of these code_names also matches an
  // earlier or later version WITHOUT this accessory, so — unlike the
  // Duke/Recondo/Spirit/Zartan/… cases above where the lowest id happens to
  // be correct — the plain code_name lookup would resolve to the WRONG
  // figure here. Disambiguated via `fcode` (figures.figure_id, the unique
  // F-code) instead.
  { extGroupId: null, fcode: 'F347', figure: 'Dial-Tone',   accessories: ['A0709', 'A0710'] }, // Sonic Backpack raised/no edges around buttons
  { extGroupId: null, fcode: 'F349', figure: 'Dodger',      accessories: ['A0717', 'A0718'] }, // Sonic Backpack raised/no edges around buttons
  { extGroupId: null, fcode: 'F352', figure: 'Lampreys',    accessories: ['A0731', 'A0732'] }, // Sonic Backpack raised/no edges around buttons
  { extGroupId: null, fcode: 'F354', figure: 'Law',         accessories: ['A0740', 'A0741'] }, // Sonic Backpack raised/no edges around buttons
  { extGroupId: null, fcode: 'F373', figure: 'Tunnel Rat',  accessories: ['A0824', 'A0825'] }, // Sonic Backpack raised/no edges around buttons
  { extGroupId: null, fcode: 'F377', figure: 'Viper',       accessories: ['A0838', 'A0839'] }, // Sonic Backpack raised/no edges around buttons
  // Psyche-Out (1991, v3, F403): same mechanism, different mold detail
  // (raised peg on side / hole on side rather than button edges) but the
  // same interchangeable-backpack pattern — owner-confirmed same treatment.
  { extGroupId: null, fcode: 'F403', figure: 'Psyche-Out',  accessories: ['A0953', 'A0954'] }, // Sonic Backpack raised peg/hole on side
];

// Same label rule as the locked reference (subgroup-wire-v2.jsx groupLabel):
// text before the first "(" in the first member's name, else the full name.
function slotName(firstMemberName) {
  const m = firstMemberName.match(/^(.*?)\s*\(/);
  return m ? m[1].trim() : firstMemberName;
}

const getFigureByName = db.prepare('SELECT id FROM figures WHERE code_name = ?');
const getFigureByCode = db.prepare('SELECT id FROM figures WHERE figure_id = ?');
const getAccessory = db.prepare('SELECT id, name, group_id FROM figure_accessories fa JOIN accessories a ON a.id = fa.accessory_id WHERE fa.figure_id = ? AND a.accessory_code = ?');
const insertGroup = db.prepare('INSERT INTO accessory_groups (figure_id, slot_name, quantity_required) VALUES (?, ?, 1)');
const setGroupId = db.prepare('UPDATE figure_accessories SET group_id = ? WHERE figure_id = ? AND accessory_id = ?');

const summary = [];

const run = db.transaction(() => {
  for (const g of GROUPS) {
    // `fcode` (figures.figure_id, unique) disambiguates when code_name
    // matches multiple versions and the target isn't the lowest catalog id.
    const fig = g.fcode ? getFigureByCode.get(g.fcode) : getFigureByName.get(g.figure);
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
