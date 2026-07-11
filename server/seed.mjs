// server/seed.mjs — rebuilds gijoe_collection.db from gijoe_collection.sql (schema)
// + the current top-level CSVs (figures_2.0, accessories, figures_accessories_group_id).
// Re-run this whenever the CSVs change instead of hand-editing catalog-data.js (17d).
//
// Figure grouping: figures_2.0.csv still carries one row per production variant
// (e.g. Breaker A/B/C = F001/F002/F003). The schema wants one `figures` row per
// logical figure with variants folded into `variant_lookup`. We group CSV rows by
// (code_name, version, character_key) — character_key is required in the key because
// a handful of code names (Ace, Airborne, Mercer, Windchill) are reused by distinct
// people who can otherwise share the same version number (e.g. Airborne v1 covers
// both AIRBORNE_1's A/B variants and the unrelated AIRBORNE_2).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { parse } from 'csv-parse/sync';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'gijoe_collection.db');

const readCsv = (name, { raw = false } = {}) =>
  parse(fs.readFileSync(path.join(ROOT, name)), { columns: !raw, bom: true });

function normalizeReleaseContext(text) {
  const t = (text || '').trim();
  if (!t || t === 'Retail') return { bucket: 'retail', detail: null };
  if (/convention/i.test(t)) return { bucket: 'convention', detail: t };
  if (/mail order/i.test(t)) return { bucket: 'mail_in', detail: t };
  if (/^(sears|target|toys r us)$/i.test(t)) return { bucket: 'retail', detail: t + ' exclusive' };
  return { bucket: 'retail', detail: t };
}

function yearFromText(text) {
  const m = /\b(19|20)\d{2}\b/.exec(text || '');
  return m ? +m[0] : null;
}

const asInt = (v) => (v === '' || v == null ? null : parseInt(v, 10));
const asBool = (v) => (v ? 1 : 0);
const asText = (v) => (v === '' || v == null ? null : v);

// Safety check (added 2026-07-10, after a reseed silently wiped 231 owned
// instances): this script fully rebuilds the DB file from schema + CSVs — it
// does NOT preserve instances/instance_accessories/accessory_inventory (the
// owned collection), and the checked-in schema can drift from ad hoc live
// migrations (see the gijoe_collection.sql history around that date). Refuse
// to run against a DB that has real owned data unless --force is passed;
// always leave a timestamped backup behind first.
if (fs.existsSync(DB_PATH)) {
  const probe = new Database(DB_PATH, { readonly: true });
  let instanceCount = 0;
  try { instanceCount = probe.prepare('SELECT COUNT(*) AS n FROM instances').get().n; } catch { /* no instances table yet */ }
  probe.close();

  const backupPath = path.join(ROOT, `gijoe_collection.db.bak.${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`);
  fs.copyFileSync(DB_PATH, backupPath);
  console.log(`Backed up existing DB -> ${backupPath}`);

  if (instanceCount > 0 && !process.argv.includes('--force')) {
    console.error(`\nRefusing to reseed: the existing DB has ${instanceCount} owned instances that this script`);
    console.error('would silently delete (it only rebuilds catalog data from CSVs, not owned instances).');
    console.error('A backup was just written (see above). If you really mean to wipe and rebuild, re-run with --force,');
    console.error('and plan to restore owned data afterward via the app\'s Export/Import (or server/instances.js).');
    process.exit(1);
  }
}

console.log('Rebuilding gijoe_collection.db from gijoe_collection.sql + current CSVs...');

fs.rmSync(DB_PATH, { force: true });
const db = new Database(DB_PATH);
db.pragma('foreign_keys = OFF'); // re-enabled after bulk import
db.exec(fs.readFileSync(path.join(ROOT, 'gijoe_collection.sql'), 'utf8'));

const seriesIds = new Set(db.prepare('SELECT series_id FROM series').all().map((r) => r.series_id));

// ---------------------------------------------------------------------------
// 1. figures + variant_lookup, from gijoe_db_figures_2.0.csv
// ---------------------------------------------------------------------------
const figureRows = readCsv('gijoe_db_figures_2.0.csv');

const groups = new Map(); // key -> rows[]
for (const r of figureRows) {
  const key = [r.code_name, r.version, r.character_key || ''].join('|');
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}

const insertFigure = db.prepare(`
  INSERT INTO figures (
    figure_id, code_name, character_key, alt_name, version, variant, variant_lookup,
    display_name, full_name, specialty, faction_id, sub_group_id, series_id,
    year_released, release_context, is_mail_away, mail_in_notes, is_vehicle_driver,
    vehicle, notes
  ) VALUES (
    @figure_id, @code_name, @character_key, @alt_name, @version, @variant, @variant_lookup,
    @display_name, @full_name, @specialty, @faction_id, @sub_group_id, @series_id,
    @year_released, @release_context, @is_mail_away, @mail_in_notes, @is_vehicle_driver,
    @vehicle, @notes
  )
`);
const insertVariantLookup = db.prepare(`
  INSERT INTO variant_lookup (figure_id, letter, tell) VALUES (?, ?, ?)
`);

// original CSV figure_id (e.g. F002) -> { dbId: figures.id, letter }
const csvFigureIdToDb = new Map();
let multiVariantGroups = 0;
let skippedBlankVariant = 0;
const skippedDupeLetters = []; // pre-existing CSV data-quality dupes (see OPEN_QUESTIONS #18) — not fixed here

const insertFiguresTxn = db.transaction(() => {
  for (const rows of groups.values()) {
    rows.sort((a, b) => +a.id - +b.id);
    const canon = rows[0];
    const isMulti = rows.length > 1;

    const seriesId = asInt(canon.series_id);
    const seriesExists = seriesId != null && seriesIds.has(seriesId);
    const { bucket, detail } = normalizeReleaseContext(canon.release_context);
    const derivedYear = seriesExists ? null : yearFromText(canon.release_context || canon.mail_in_notes);
    const noteBits = [asText(canon.notes), detail].filter(Boolean);

    const dbId = insertFigure.run({
      figure_id: canon.figure_id,
      code_name: canon.code_name,
      character_key: asText(canon.character_key),
      alt_name: asText(canon.alt_name),
      version: asText(canon.version),
      variant: isMulti ? null : asText(canon.variant),
      variant_lookup: isMulti ? null : asText(canon.variant_lookup),
      display_name: asText(canon.display_name),
      full_name: asText(canon.full_name),
      specialty: asText(canon.specialty),
      faction_id: asInt(canon.faction_id),
      sub_group_id: asInt(canon.sub_group_id),
      series_id: seriesExists ? seriesId : null,
      year_released: derivedYear,
      release_context: bucket,
      is_mail_away: asBool(canon.is_mail_away),
      mail_in_notes: asText(canon.mail_in_notes),
      is_vehicle_driver: asBool(canon.is_vehicle_driver),
      vehicle: asText(canon.vehicle),
      notes: noteBits.length ? noteBits.join(' · ') : null,
    }).lastInsertRowid;

    if (isMulti) {
      multiVariantGroups++;
      const seenLetters = new Set();
      for (const r of rows) {
        if (!r.variant) { skippedBlankVariant++; continue; }
        if (seenLetters.has(r.variant)) {
          skippedDupeLetters.push(`${canon.code_name} v${canon.version} ${r.variant} (kept ${rows.find(x=>x.variant===r.variant).figure_id}, dropped ${r.figure_id})`);
          continue;
        }
        seenLetters.add(r.variant);
        insertVariantLookup.run(dbId, r.variant, r.variant_lookup || '');
      }
    }

    for (const r of rows) csvFigureIdToDb.set(r.figure_id, { dbId, letter: r.variant || null });
  }
});
insertFiguresTxn();

console.log(`figures: ${groups.size} groups from ${figureRows.length} CSV rows ` +
  `(${multiVariantGroups} multi-variant, ${skippedBlankVariant} blank-variant rows skipped in variant_lookup)`);
if (skippedDupeLetters.length) {
  console.log(`\nNOTE: ${skippedDupeLetters.length} pre-existing duplicate-letter rows in the CSV were skipped ` +
    `(likely the same data-quality backlog as OPEN_QUESTIONS #18 — not corrected here, just not allowed to crash the seed):`);
  skippedDupeLetters.forEach((s) => console.log('  -', s));
}

// ---------------------------------------------------------------------------
// 2. accessories, from gijoe_db_accessories.csv
// ---------------------------------------------------------------------------
const accessoryRows = readCsv('gijoe_db_accessories.csv');
const insertAccessory = db.prepare(`
  INSERT INTO accessories (
    accessory_code, name, alt_name, category_id, type, color, pack_quantity,
    variant_notes, is_electronic_working, notes, image_url_primary
  ) VALUES (
    @accessory_code, @name, @alt_name, @category_id, @type, @color, @pack_quantity,
    @variant_notes, @is_electronic_working, @notes, @image_url_primary
  )
`);
const accessoryCodeToDb = new Map();
const insertAccessoriesTxn = db.transaction(() => {
  for (const r of accessoryRows) {
    const dbId = insertAccessory.run({
      accessory_code: r.accessory_id,
      name: r.name,
      alt_name: asText(r.alt_name),
      category_id: asInt(r.category_id),
      type: asText(r.type),
      color: asText(r.color),
      pack_quantity: asInt(r.pack_quantity) ?? 1,
      variant_notes: asText(r.variant_notes),
      is_electronic_working: r.is_electronic_working === '' ? null : asInt(r.is_electronic_working),
      notes: asText(r.notes),
      image_url_primary: asText(r.image_url),
    }).lastInsertRowid;
    accessoryCodeToDb.set(r.accessory_id, dbId);
  }
});
insertAccessoriesTxn();
console.log(`accessories: ${accessoryRows.length} rows`);

// ---------------------------------------------------------------------------
// 3. figure_accessories (blueprint), from gijoe_db_figures_accessories_group_id.csv
//    Columns (raw, header has duplicate figure_id/accessory_id names):
//    0 year_released, 1 code_name, 2 figure_id(text), 3 figure_id(numeric-legacy),
//    4 accessory_id(text), 5 accessory_id(numeric-legacy), 6 group_id, 7 release_context,
//    8 is_original, 9 is_shared, 10 quantity_required, 11-12 legacy owned/condition, 13 notes
//
//    group_id (col 6) is NOT imported here even though it's populated in the CSV:
//    of the 19 distinct external ids, only 8 are genuine "own any one" variant
//    pairs (matched item names, e.g. Helmet / Helmet (with holes)) — the other
//    11 pair unrelated item types (e.g. Firefly's Submachine Gun + Walkie-Talkie)
//    and are NOT interchangeable, per owner confirmation. That curated 8-group
//    import is a separate, hand-verified, additive-only script — see
//    server/migrate-accessory-groups.mjs — safe to re-run against the live DB,
//    unlike this file (which rebuilds figures/accessories from scratch).
//    release_context (col 7) is currently blank for every row in the source
//    CSV — real classification happens live via server/set-accessory-context.mjs
//    as the owner works through the collection figure-by-figure.
// ---------------------------------------------------------------------------
const blueprintRows = readCsv('gijoe_db_figures_accessories_group_id.csv', { raw: true }).slice(1);
const insertBlueprint = db.prepare(`
  INSERT OR IGNORE INTO figure_accessories (
    figure_id, accessory_id, quantity_required, release_context, notes
  ) VALUES (?, ?, ?, ?, ?)
`);
let blueprintInserted = 0, blueprintSkippedUnresolved = 0;
const insertBlueprintTxn = db.transaction(() => {
  for (const row of blueprintRows) {
    const fig = csvFigureIdToDb.get(row[2]);
    const accId = accessoryCodeToDb.get(row[4]);
    if (!fig || !accId) { blueprintSkippedUnresolved++; continue; }
    const releaseContext = normalizeReleaseContext(row[7]).bucket;
    const info = insertBlueprint.run(fig.dbId, accId, asInt(row[10]) ?? 1, releaseContext, asText(row[13]));
    if (info.changes) blueprintInserted++;
  }
});
insertBlueprintTxn();
console.log(`figure_accessories: ${blueprintInserted} inserted from ${blueprintRows.length} CSV rows ` +
  `(dupes collapsed across merged variants, ${blueprintSkippedUnresolved} unresolved skipped)`);

db.pragma('foreign_keys = ON');
const fkErrors = db.pragma('foreign_key_check');
if (fkErrors.length) {
  console.error('FOREIGN KEY violations after seed:', fkErrors);
  process.exitCode = 1;
} else {
  console.log('Foreign key check: clean.');
}

db.close();
console.log('Done ->', DB_PATH);
