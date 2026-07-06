#!/usr/bin/env node
// server/import-coo.mjs — one-off loader for gijoe_db_figures_coo.csv into
// figure_coo (migration 005). Run once after that migration is applied:
//   node server/import-coo.mjs
//
// The CSV has no header — each row is "code_name vVersion[ variant-letter],code",
// two rows per figure (it was produced in two of the three known countries).
// Code -> country mapping confirmed with the owner: 1=China, 2=Hong Kong, 3=Indonesia.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CSV_PATH = path.join(ROOT, 'gijoe_db_figures_coo.csv');

const COUNTRY = { 1: 'China', 2: 'Hong Kong', 3: 'Indonesia' };

// The CSV's figure string doesn't always match figures.code_name verbatim —
// these are typos in the source CSV, confirmed by name against the live
// catalog (see OPEN_QUESTIONS_ISSUES_FOUND.md #17). Astro-Viper v2 is a
// separate case: `figures` stores it without the hyphen at v2 only.
const NAME_CORRECTIONS = {
  'sneak peak': 'sneak peek',
  'ice crean soldier': 'ice cream soldier',
};

const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

const rows = parse(fs.readFileSync(CSV_PATH), { columns: false, bom: true });
const byFigure = new Map(); // raw figure string -> Set(code)
for (const [figure, code] of rows) {
  const key = figure.trim();
  if (!byFigure.has(key)) byFigure.set(key, new Set());
  byFigure.get(key).add(code.trim());
}

const findFigure = db.prepare(`
  SELECT id FROM figures WHERE LOWER(TRIM(code_name)) = ? AND version = ?
`);
const insertCoo = db.prepare(`
  INSERT INTO figure_coo (figure_id, country) VALUES (?, ?)
  ON CONFLICT(figure_id, country) DO NOTHING
`);

const unresolved = [];
let inserted = 0;

const run = db.transaction(() => {
  for (const [raw, codes] of byFigure) {
    const m = raw.match(/^(.*?)\s+[vV](\d+(?:\.\d+)?)(?:\s+[A-Z])?\s*$/);
    if (!m) { unresolved.push([raw, 'no version token found']); continue; }
    const [, name, version] = m;
    let normName = norm(name);
    if (NAME_CORRECTIONS[normName]) normName = NAME_CORRECTIONS[normName];
    if (normName === 'astro-viper' && version === '2') normName = 'astro viper';

    const candidates = findFigure.all(normName, version);
    if (candidates.length !== 1) {
      unresolved.push([raw, candidates.length === 0 ? `no match for "${normName}" v${version}` : `ambiguous, ${candidates.length} matches`]);
      continue;
    }
    for (const code of codes) {
      const country = COUNTRY[code];
      if (!country) { unresolved.push([raw, `unknown code "${code}"`]); continue; }
      insertCoo.run(candidates[0].id, country);
      inserted++;
    }
  }
});

run();

console.log(`✓ inserted/confirmed ${inserted} figure_coo rows from ${byFigure.size} CSV figures.`);
if (unresolved.length) {
  console.log(`✕ ${unresolved.length} unresolved:`);
  unresolved.forEach(([raw, reason]) => console.log(`  - ${raw}: ${reason}`));
  process.exitCode = 1;
} else {
  console.log('✓ all rows resolved.');
}
