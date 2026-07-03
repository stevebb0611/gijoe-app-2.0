#!/usr/bin/env node
// server/add-figure.mjs — CLI helper for the one genuinely fiddly part of adding
// a figure the catalog doesn't have yet: resolving the faction/series foreign
// keys and attaching accessories by id without typos. Everything rarer than that
// (a brand-new accessory type, a historically-accurate figure_id F-code) stays
// plain SQL — this is a small helper, not a form.
//
// The app reads the catalog once at page load (not live), so reload the tab
// after running this to see the new figure in Add Figure's search.
//
// Usage:
//   node server/add-figure.mjs --name "COBRA COMMANDER" --faction Cobra --year 1993 --series "Series 12"
//   node server/add-figure.mjs --search-series 1993
//   node server/add-figure.mjs --search-accessories "helmet"
//   node server/add-figure.mjs --delete 524
//
// Options:
//   --name <code name>            required
//   --faction <name>               required — G.I. Joe | Cobra | Oktober Guard | Dreadnoks
//   --year <year>                  required
//   --series <label or id>         required if the year has more than one series
//   --specialty <text>
//   --code <F-code>                optional, defaults to F### from the new internal id
//   --character-key <key>          only if --name collides with an existing different character
//   --release-context <ctx>        retail (default) | convention | mail_in
//   --mail-away                    sets is_mail_away
//   --variants "A:tell text;B:tell text"
//   --accessories "accessoryId:qty,accessoryId:qty"   (look up ids via --search-accessories)
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
  node server/add-figure.mjs --name "COBRA COMMANDER" --faction Cobra --year 1993 --series "Series 12"
  node server/add-figure.mjs --search-series 1993
  node server/add-figure.mjs --search-accessories "helmet"

See the file header for the full option list.`);
  process.exit(0);
}

if (args['search-series']) {
  const year = +args['search-series'];
  const rows = db.prepare('SELECT series_id, label, description FROM series WHERE year = ?').all(year);
  if (!rows.length) console.log(`No series found for ${year}.`);
  else rows.forEach(r => console.log(`${r.series_id}\t${r.label}\t${r.description}`));
  process.exit(0);
}

if (args['search-accessories']) {
  const q = String(args['search-accessories']).toLowerCase();
  const rows = db.prepare(`
    SELECT a.id, a.name, ac.name AS category
    FROM accessories a JOIN accessory_categories ac ON ac.category_id = a.category_id
    WHERE lower(a.name) LIKE ?
    ORDER BY a.name
  `).all('%' + q + '%');
  if (!rows.length) console.log('No accessories match.');
  else rows.forEach(r => console.log(`${r.id}\t${r.name}\t(${r.category})`));
  process.exit(0);
}

if (args.delete) {
  const id = +args.delete;
  const fig = db.prepare('SELECT code_name FROM figures WHERE id = ?').get(id);
  if (!fig) fail(`No figure with internal id ${id}.`);
  // this connection has foreign_keys=ON (server/db.js), so variant_lookup and
  // figure_accessories rows cascade — a plain `sqlite3 the.db` CLI session
  // would NOT cascade (pragma is off by default per-connection) and needs
  // those tables cleaned up by hand.
  db.prepare('DELETE FROM figures WHERE id = ?').run(id);
  console.log(`✓ Deleted ${fig.code_name} (id ${id}) and its variants/blueprint.`);
  process.exit(0);
}

if (!args.name) fail('--name is required');
if (!args.faction) fail('--faction is required');
if (!args.year) fail('--year is required');

const faction = db.prepare('SELECT faction_id FROM factions WHERE lower(name) = lower(?)').get(args.faction);
if (!faction) fail(`Unknown faction "${args.faction}". Options: G.I. Joe, Cobra, Oktober Guard, Dreadnoks`);

const year = +args.year;
const seriesForYear = db.prepare('SELECT series_id, label, description FROM series WHERE year = ?').all(year);
let seriesId = null;
if (args.series) {
  const bySeriesId = /^\d+$/.test(args.series) ? db.prepare('SELECT series_id FROM series WHERE series_id = ?').get(+args.series) : null;
  const byLabel = seriesForYear.find(s => (s.label || '').toLowerCase() === String(args.series).toLowerCase()
    || s.description.toLowerCase().includes(String(args.series).toLowerCase()));
  seriesId = bySeriesId ? bySeriesId.series_id : (byLabel ? byLabel.series_id : null);
  if (!seriesId) fail(`--series "${args.series}" didn't match a series for ${year}. Run --search-series ${year} to see options.`);
} else if (seriesForYear.length === 1) {
  seriesId = seriesForYear[0].series_id;
} else if (seriesForYear.length === 0) {
  fail(`No series defined for ${year} yet — add one to the series table first.`);
} else {
  fail(`${year} has ${seriesForYear.length} series — pass --series to disambiguate. Run --search-series ${year} to see options.`);
}

const releaseContext = args['release-context'] || 'retail';
if (!['retail', 'convention', 'mail_in'].includes(releaseContext)) fail('--release-context must be retail, convention, or mail_in');

const existing = db.prepare('SELECT id FROM figures WHERE code_name = ?').all(args.name.toUpperCase());
if (existing.length && !args['character-key']) {
  console.log(`⚠ "${args.name}" already exists (id${existing.length > 1 ? 's' : ''} ${existing.map(e => e.id).join(', ')}). `
    + `Continuing adds another row under the same code name — pass --character-key if this is a genuinely different character.`);
}

const insertFigure = db.prepare(`
  INSERT INTO figures (figure_id, code_name, character_key, specialty, faction_id, series_id, release_context, is_mail_away)
  VALUES (NULL, @code_name, @character_key, @specialty, @faction_id, @series_id, @release_context, @is_mail_away)
`);
const insertVariant = db.prepare('INSERT INTO variant_lookup (figure_id, letter, tell) VALUES (?, ?, ?)');
const insertBlueprint = db.prepare('INSERT INTO figure_accessories (figure_id, accessory_id, quantity_required, release_context) VALUES (?, ?, ?, ?)');
const getAccessory = db.prepare('SELECT id, name FROM accessories WHERE id = ?');

const run = db.transaction(() => {
  const info = insertFigure.run({
    code_name: args.name.toUpperCase(),
    character_key: args['character-key'] || null,
    specialty: args.specialty || null,
    faction_id: faction.faction_id,
    series_id: seriesId,
    release_context: releaseContext,
    is_mail_away: args['mail-away'] ? 1 : 0,
  });
  const id = info.lastInsertRowid;
  // figure_id (the "F-code") isn't read by the app anywhere — it's cosmetic
  // parity with the source CSV's numbering, which is NOT aligned with the
  // internal autoincrement id. Default to next-free-max so it can't collide;
  // pass --code for a historically-accurate number instead.
  const code = args.code || ('F' + (
    (db.prepare("SELECT MAX(CAST(substr(figure_id, 2) AS INTEGER)) AS n FROM figures WHERE figure_id LIKE 'F%'").get().n || 0) + 1
  ));
  db.prepare('UPDATE figures SET figure_id = ? WHERE id = ?').run(code, id);

  const variantLetters = [];
  if (args.variants) {
    for (const part of String(args.variants).split(';')) {
      const sep = part.indexOf(':');
      if (sep < 0) fail(`--variants entry "${part}" must be "letter:tell text"`);
      const letter = part.slice(0, sep).trim(), tell = part.slice(sep + 1).trim();
      if (!letter || !tell) fail(`--variants entry "${part}" must be "letter:tell text"`);
      insertVariant.run(id, letter, tell);
      variantLetters.push(letter);
    }
  }

  const blueprintLines = [];
  if (args.accessories) {
    for (const part of String(args.accessories).split(',')) {
      const [accId, qty] = part.split(':').map(s => s.trim());
      const acc = getAccessory.get(+accId);
      if (!acc) fail(`Accessory id ${accId} doesn't exist. Run --search-accessories "<name>" to find one.`);
      insertBlueprint.run(id, acc.id, +qty || 1, 'retail');
      blueprintLines.push(`${acc.name} ×${qty || 1}`);
    }
  }

  return { id, code, variantLetters, blueprintLines };
});

const result = run();
console.log(`✓ Added ${args.name.toUpperCase()} — internal id ${result.id}, code ${result.code}`);
if (result.variantLetters.length) console.log(`  variants: ${result.variantLetters.join(', ')}`);
if (result.blueprintLines.length) console.log(`  blueprint: ${result.blueprintLines.join(', ')}`);
console.log(`\nReload the app tab to see it — the catalog loads once at page load, not live.`);
