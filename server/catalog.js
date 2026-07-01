// server/catalog.js — builds the catalog payload in the exact shape catalog-data.js
// used to hand the app (window.JOE_CATALOG), computed live from the figures/
// accessories/variant_lookup/figure_accessories tables instead of a static file (17d).
import db from './db.js';

const FACTION_CODE = {
  'G.I. Joe': 'JOE',
  Cobra: 'COBRA',
  'Oktober Guard': 'OKTOBER',
  Dreadnoks: 'DREADNOK',
};

const figuresStmt = db.prepare(`
  SELECT f.id, f.code_name, f.version, f.specialty, f.variant_lookup AS single_tell,
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

const blueprintStmt = db.prepare(`
  SELECT fa.figure_id, a.name, fa.quantity_required
  FROM figure_accessories fa
  JOIN accessories a ON a.id = fa.accessory_id
  WHERE fa.release_context = 'retail'
  ORDER BY fa.figure_id, fa.rowid
`);

export function buildCatalog() {
  const variantsByFigure = new Map();
  for (const v of variantsStmt.all()) {
    if (!variantsByFigure.has(v.figure_id)) variantsByFigure.set(v.figure_id, []);
    variantsByFigure.get(v.figure_id).push({ letter: v.letter, tell: v.tell });
  }

  const blueprintByFigure = new Map();
  for (const b of blueprintStmt.all()) {
    if (!blueprintByFigure.has(b.figure_id)) blueprintByFigure.set(b.figure_id, []);
    blueprintByFigure.get(b.figure_id).push([b.name, b.quantity_required]);
  }

  return figuresStmt.all().map((f) => ({
    id: f.id,
    name: (f.code_name || '').toUpperCase(),
    ver: f.version,
    year: f.year,
    faction: FACTION_CODE[f.faction_name] || f.faction_name,
    role: f.specialty,
    // Every figure has at least one variants[] entry — single-variant figures
    // (or the handful with no usable variant letter, see server/seed.mjs) get a
    // synthesized blank-letter entry so the frontend's isSingle() check holds.
    variants: variantsByFigure.get(f.id) || [{ letter: '', tell: f.single_tell || null }],
    blueprint: blueprintByFigure.get(f.id) || [],
  }));
}
