#!/usr/bin/env node
// server/set-accessory-context.mjs — owner CLI to reclassify a figure's
// accessory pairing's release_context (retail / convention / mail_in / bonus /
// retailer_exclusive).
// No source data exists yet for which accessories were convention/mail-in/
// bonus-only — the owner is going figure-by-figure from memory/file cards, so
// this is a small mutation helper, not a bulk importer. Look up accessory
// codes with `node server/add-figure.mjs --search-accessories "<name>"`.
//
// Usage:
//   node server/set-accessory-context.mjs --figure F007 --accessory A0013,A0014,A0028,A0029 --context convention
//   node server/set-accessory-context.mjs --figure F007 --accessory A0013 --context retail   (undo)
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
  node server/set-accessory-context.mjs --figure F007 --accessory A0013,A0014 --context convention

--figure <F-code>              required — e.g. F007 (figures.figure_id)
--accessory <A-code[,A-code…]> required — e.g. A0013,A0014 (accessories.accessory_code)
--context <ctx>                required — retail | convention | mail_in | bonus | retailer_exclusive`);
  process.exit(0);
}

if (!args.figure) fail('--figure is required');
if (!args.accessory) fail('--accessory is required');
if (!args.context) fail('--context is required');
if (!['retail', 'convention', 'mail_in', 'bonus', 'retailer_exclusive'].includes(args.context)) {
  fail('--context must be one of: retail, convention, mail_in, bonus, retailer_exclusive');
}

const figure = db.prepare('SELECT id, code_name FROM figures WHERE figure_id = ?').get(args.figure);
if (!figure) fail(`No figure with code ${args.figure}.`);

const codes = String(args.accessory).split(',').map((s) => s.trim()).filter(Boolean);
const getBlueprintRow = db.prepare(`
  SELECT fa.accessory_id, a.accessory_code, a.name, fa.release_context AS was
  FROM figure_accessories fa
  JOIN accessories a ON a.id = fa.accessory_id
  WHERE fa.figure_id = ? AND a.accessory_code = ?
`);
const setContext = db.prepare('UPDATE figure_accessories SET release_context = ? WHERE figure_id = ? AND accessory_id = ?');

const run = db.transaction(() => {
  const changed = [];
  for (const code of codes) {
    const row = getBlueprintRow.get(figure.id, code);
    if (!row) fail(`${code} isn't on ${figure.code_name}'s blueprint.`);
    setContext.run(args.context, figure.id, row.accessory_id);
    changed.push(`${row.name} (${code}): ${row.was} → ${args.context}`);
  }
  return changed;
});

const changed = run();
console.log(`✓ ${figure.code_name} (${args.figure})`);
changed.forEach((line) => console.log('  ' + line));
