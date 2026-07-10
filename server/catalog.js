// server/catalog.js — builds the catalog payload in the exact shape catalog-data.js
// used to hand the app (window.JOE_CATALOG), computed live from the figures/
// accessories/variant_lookup/figure_accessories tables instead of a static file (17d).
import db from './db.js';
import { disambiguateNames } from './blueprint-names.js';

const FACTION_CODE = {
  'G.I. Joe': 'JOE',
  Cobra: 'COBRA',
  'Oktober Guard': 'OKTOBER',
  Dreadnoks: 'DREADNOK',
};

const figuresStmt = db.prepare(`
  SELECT f.id, f.code_name, f.version, f.specialty, f.variant_lookup AS single_tell,
         f.is_vehicle_driver, f.vehicle,
         fac.name AS faction_name,
         COALESCE(s.year, f.year_released) AS year
  FROM figures f
  LEFT JOIN factions fac ON fac.faction_id = f.faction_id
  LEFT JOIN series s ON s.series_id = f.series_id
  ORDER BY f.id
`);

const variantsStmt = db.prepare(`
  SELECT figure_id, letter, tell FROM variant_lookup ORDER BY figure_id, letter
`);

const fileCardsStmt = db.prepare(`
  SELECT ffc.figure_id, fc.file_card_id, fc.file_card_code, fc.card_back, fc.card_color,
         fc.release_type, fc.logo_version, fc.text_version, fc.country, fc.notes
  FROM figure_file_cards ffc
  JOIN file_cards fc ON fc.file_card_id = ffc.file_card_id
  ORDER BY ffc.figure_id, fc.file_card_id
`);

const cooStmt = db.prepare(`
  SELECT figure_id, country FROM figure_coo ORDER BY figure_id, country
`);

const blueprintStmt = db.prepare(`
  SELECT fa.figure_id, a.name, a.color, fa.quantity_required, a.id AS accessory_id,
         fa.group_id, fa.release_context, fa.match_key
  FROM figure_accessories fa
  JOIN accessories a ON a.id = fa.accessory_id
  ORDER BY fa.figure_id, fa.rowid
`);

export function buildCatalog() {
  const variantsByFigure = new Map();
  for (const v of variantsStmt.all()) {
    if (!variantsByFigure.has(v.figure_id)) variantsByFigure.set(v.figure_id, []);
    variantsByFigure.get(v.figure_id).push({ letter: v.letter, tell: v.tell });
  }

  const cooByFigure = new Map();
  for (const c of cooStmt.all()) {
    if (!cooByFigure.has(c.figure_id)) cooByFigure.set(c.figure_id, []);
    cooByFigure.get(c.figure_id).push(c.country);
  }

  const fileCardsByFigure = new Map();
  for (const fc of fileCardsStmt.all()) {
    if (!fileCardsByFigure.has(fc.figure_id)) fileCardsByFigure.set(fc.figure_id, []);
    fileCardsByFigure.get(fc.figure_id).push(fc);
  }

  const blueprintRowsByFigure = new Map();
  for (const b of blueprintStmt.all()) {
    if (!blueprintRowsByFigure.has(b.figure_id)) blueprintRowsByFigure.set(b.figure_id, []);
    blueprintRowsByFigure.get(b.figure_id).push(b);
  }
  const blueprintByFigure = new Map();
  for (const [figureId, rows] of blueprintRowsByFigure) {
    // color (index 6, added 2026-07-03) was already selected by blueprintStmt
    // above but dropped here before this fix — the frontend's AccSwatch
    // (web/src/acc-colors.jsx) had nothing to render off of until now.
    blueprintByFigure.set(figureId, disambiguateNames(rows)
      .map((b) => [b.name, b.quantity_required, b.accessory_id, b.group_id, b.release_context, b.match_key, b.color]));
  }

  return figuresStmt.all().map((f) => ({
    id: f.id,
    name: (f.code_name || '').toUpperCase(),
    ver: f.version,
    year: f.year,
    faction: FACTION_CODE[f.faction_name] || f.faction_name,
    role: f.specialty,
    vehicle: f.is_vehicle_driver && f.vehicle ? f.vehicle : null,
    // Every figure has at least one variants[] entry — single-variant figures
    // (or the handful with no usable variant letter, see server/seed.mjs) get a
    // synthesized blank-letter entry so the frontend's isSingle() check holds.
    variants: variantsByFigure.get(f.id) || [{ letter: '', tell: f.single_tell || null }],
    coo: cooByFigure.get(f.id) || [],
    fileCards: fileCardsByFigure.get(f.id) || [],
    blueprint: blueprintByFigure.get(f.id) || [],
  }));
}
