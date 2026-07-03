#!/usr/bin/env node
// server/set-match-key.mjs — owner CLI to tag an accessory_groups member with
// a match_key. When two or more of a figure's group_id slots have members
// tagged with the same match_key, those slots must resolve to that SAME key
// together for the figure to count as Complete (e.g. Firefly's light-green
// Submachine Gun only completes alongside the light-green Walkie-Talkie,
// never the dull-green one). See match_key.md for the running catalogue.
//
// The accessory must already be in a group_id slot — run
// server/migrate-accessory-groups.mjs (or add a GROUPS entry there) first.
//
// Usage:
//   node server/set-match-key.mjs --figure F096 --accessory A0078,A0080 --key A
//   node server/set-match-key.mjs --figure F096 --accessory A0079,A0081 --key B
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
  node server/set-match-key.mjs --figure F096 --accessory A0078,A0080 --key A

--figure <F-code>              required — e.g. F096 (figures.figure_id)
--accessory <A-code[,A-code…]> required — e.g. A0078,A0080 (accessories.accessory_code)
--key <tag>                    required — short tag shared across the matching slots, e.g. A / B`);
  process.exit(0);
}

if (!args.figure) fail('--figure is required');
if (!args.accessory) fail('--accessory is required');
if (!args.key) fail('--key is required');

const figure = db.prepare('SELECT id, code_name FROM figures WHERE figure_id = ?').get(args.figure);
if (!figure) fail(`No figure with code ${args.figure}.`);

const codes = String(args.accessory).split(',').map((s) => s.trim()).filter(Boolean);
const getBlueprintRow = db.prepare(`
  SELECT fa.accessory_id, a.accessory_code, a.name, fa.group_id, fa.match_key AS was
  FROM figure_accessories fa
  JOIN accessories a ON a.id = fa.accessory_id
  WHERE fa.figure_id = ? AND a.accessory_code = ?
`);
const setKey = db.prepare('UPDATE figure_accessories SET match_key = ? WHERE figure_id = ? AND accessory_id = ?');

const run = db.transaction(() => {
  const changed = [];
  for (const code of codes) {
    const row = getBlueprintRow.get(figure.id, code);
    if (!row) fail(`${code} isn't on ${figure.code_name}'s blueprint.`);
    if (row.group_id == null) fail(`${code} isn't in a group_id slot yet — add it via migrate-accessory-groups.mjs first.`);
    setKey.run(args.key, figure.id, row.accessory_id);
    changed.push(`${row.name} (${code}): ${row.was || '—'} → ${args.key}`);
  }
  return changed;
});

const changed = run();
console.log(`✓ ${figure.code_name} (${args.figure})`);
changed.forEach((line) => console.log('  ' + line));
