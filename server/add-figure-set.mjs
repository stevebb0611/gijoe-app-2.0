#!/usr/bin/env node
// server/add-figure-set.mjs — CLI helper for cataloging a known multi-pack "set"
// (e.g. the 1982 JC Penney Cobra 3-pack) as a grouping over already-ownable
// figures — see FIGURE_SETS.md. Pure display layer: this never creates a new
// ownable catalog row, it only links existing figures.id rows together with a
// per-figure required quantity (a 3-pack needing 2 of one figure + 1 of another).
//
// The app reads the catalog once at page load (not live), so reload the tab
// after running this to see the new set's badge/progress.
//
// A from-scratch `npm run seed` does NOT repopulate figure_sets/figure_set_members
// (same reseed caveat figure_coo already has, see server/import-coo.mjs) — recovery
// after a reseed means re-running the commands logged in FIGURE_SETS.md.
//
// Usage:
//   node server/add-figure-set.mjs --name "1982 JC Penney Cobra 3-Pack" --year 1982 \
//     --description "..." --members "3:2,5:1"
//   node server/add-figure-set.mjs --search-figures "cobra"
//   node server/add-figure-set.mjs --delete 1
//
// Options:
//   --name <set name>              required
//   --year <year>                   optional
//   --description <text>            optional
//   --members "figureId:qty,figureId:qty"   required — look up ids via --search-figures
import db from './db.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else { args[key] = next; i++; }
  }
  return args;
}

function fail(msg) { console.error('✕ ' + msg); process.exit(1); }

const args = parseArgs(process.argv.slice(2));

if (args.help || Object.keys(args).length === 0) {
  console.log(`Usage:
  node server/add-figure-set.mjs --name "1982 JC Penney Cobra 3-Pack" --year 1982 --description "..." --members "3:2,5:1"
  node server/add-figure-set.mjs --search-figures "cobra"
  node server/add-figure-set.mjs --delete 1

See the file header for the full option list.`);
  process.exit(0);
}

if (args['search-figures']) {
  const q = String(args['search-figures']).toLowerCase();
  const rows = db.prepare(`
    SELECT id, code_name, version, display_name
    FROM figures
    WHERE lower(code_name) LIKE ? OR lower(display_name) LIKE ?
    ORDER BY code_name, version
  `).all('%' + q + '%', '%' + q + '%');
  if (!rows.length) console.log('No figures match.');
  else rows.forEach(r => console.log(`${r.id}\t${r.code_name} v${r.version || ''}\t${r.display_name || ''}`));
  process.exit(0);
}

if (args.delete) {
  const id = +args.delete;
  const set = db.prepare('SELECT name FROM figure_sets WHERE set_id = ?').get(id);
  if (!set) fail(`No set with id ${id}.`);
  // figure_set_members has ON DELETE CASCADE and this connection has
  // foreign_keys=ON (server/db.js), so its rows go with it.
  db.prepare('DELETE FROM figure_sets WHERE set_id = ?').run(id);
  console.log(`✓ Deleted "${set.name}" (id ${id}) and its member links.`);
  process.exit(0);
}

if (!args.name) fail('--name is required');
if (!args.members) fail('--members is required (e.g. "3:2,5:1") — run --search-figures "<name>" to find ids');

const getFigure = db.prepare('SELECT id, code_name, version FROM figures WHERE id = ?');
const members = [];
for (const part of String(args.members).split(',')) {
  const [figIdRaw, qtyRaw] = part.split(':').map(s => s.trim());
  const figId = +figIdRaw;
  const fig = getFigure.get(figId);
  if (!fig) fail(`Figure id ${figId} doesn't exist. Run --search-figures "<name>" to find one.`);
  members.push({ figureId: fig.id, quantity: +qtyRaw || 1, label: `${fig.code_name} v${fig.version || ''}` });
}

const insertSet = db.prepare('INSERT INTO figure_sets (name, year, description) VALUES (?, ?, ?)');
const insertMember = db.prepare('INSERT INTO figure_set_members (set_id, figure_id, quantity_required) VALUES (?, ?, ?)');

const run = db.transaction(() => {
  const info = insertSet.run(args.name, args.year ? +args.year : null, args.description || null);
  const setId = info.lastInsertRowid;
  for (const m of members) insertMember.run(setId, m.figureId, m.quantity);
  return setId;
});

const setId = run();
console.log(`✓ Added "${args.name}" — set id ${setId}`);
members.forEach(m => console.log(`  ${m.label} ×${m.quantity}`));

const valuesSql = members.map(m => `(${setId}, ${m.figureId}, ${m.quantity})`).join(', ');
console.log(`\nFor FIGURE_SETS.md's "reconstruct after a reseed" record, log this alongside the command above:\n`);
console.log(`INSERT OR IGNORE INTO figure_sets (set_id, name, year, description) VALUES\n    (${setId}, ${JSON.stringify(args.name)}, ${args.year ? +args.year : 'NULL'}, ${JSON.stringify(args.description || null)});`);
console.log(`INSERT OR IGNORE INTO figure_set_members (set_id, figure_id, quantity_required) VALUES\n    ${valuesSql};`);
console.log(`\nReload the app tab to see it — the catalog loads once at page load, not live.`);
