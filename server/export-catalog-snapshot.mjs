// server/export-catalog-snapshot.mjs — dumps the live catalog/reference tables
// (NOT the owned collection — instances/instance_accessories/accessory_inventory
// are deliberately excluded) into a fresh, timestamped, human-readable CSV
// snapshot under exports/. Safe to run anytime, as often as you like: it never
// writes back to the DB or touches the actual seed CSVs server/seed.mjs reads
// (gijoe_db_*.csv at repo root) — this is a read-only export for reference/
// history/backup diversity, not a re-importable seed source (see
// OPEN_QUESTIONS_Claude.md #21 for why the two are kept separate).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'gijoe_collection.db');

// Catalog/reference tables only. Deliberately excludes instances,
// instance_accessories, accessory_inventory, locations, wishlist — the
// owner's owned collection, per-copy notes and bin/box locations, and want
// list. Those already get backed up whole (with everything else) by
// server/backup-db.mjs; this export is scoped to the shared reference data
// that's safe to treat as commit-able/readable history.
const TABLES = [
  'series', 'conditions', 'accessory_categories', 'factions', 'sub_groups',
  'figures', 'accessories', 'variant_lookup', 'accessory_groups',
  'figure_accessories', 'file_cards', 'figure_file_cards', 'figure_coo',
];

function csvValue(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`No DB found at ${DB_PATH} — nothing to export.`);
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });

const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const outDir = path.join(ROOT, 'exports', stamp);
fs.mkdirSync(outDir, { recursive: true });

const manifest = { generatedAt: new Date().toISOString(), sourceDb: 'gijoe_collection.db', tables: {} };

for (const table of TABLES) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  const rows = db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();

  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvValue(row[c])).join(','));

  fs.writeFileSync(path.join(outDir, `${table}.csv`), lines.join('\n') + '\n');
  manifest.tables[table] = rows.length;
  console.log(`${table}: ${rows.length} rows -> exports/${stamp}/${table}.csv`);
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
db.close();
console.log(`\nSnapshot complete -> exports/${stamp}/ (${TABLES.length} tables, manifest.json included)`);
