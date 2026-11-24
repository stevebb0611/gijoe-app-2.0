// server/accessories.js — accessory-level catalog for the Parts Bin: category
// label + shared-vs-single-use + home figure, computed from figure_accessories
// (the real compatibility join — see PARTS_BIN.md "DATA MODEL"). Only accessories
// actually used in at least one figure's blueprint are included, since the Add
// Part flow always starts from a figure's blueprint.
import db from './db.js';

// series_id 15's sentinel "year" (gijoe_collection.sql) — the Convention &
// Mail-In Block, not a real chronological year. Mirrors web/src/fig-identity.js's
// formatYear(); duplicated here (not shared/) since it's two lines and server/
// doesn't otherwise import from web/src.
const SPECIAL_RELEASE_YEAR = 9999;
const formatYear = (year) => (year === SPECIAL_RELEASE_YEAR ? 'Special Release' : String(year));

const accessoriesStmt = db.prepare(`
  SELECT a.id, a.accessory_code, a.name, a.color, a.category_id, ac.name AS category_name,
         COUNT(DISTINCT fa.figure_id) AS figure_count
  FROM accessories a
  JOIN figure_accessories fa ON fa.accessory_id = a.id
  JOIN accessory_categories ac ON ac.category_id = a.category_id
  WHERE fa.release_context = 'retail'
  GROUP BY a.id
`);

// One row per (accessory, figure). character_key separates the few distinct
// characters that reuse one code name (migration 002); NULL/'' falls back to it.
const figureRowsStmt = db.prepare(`
  SELECT fa.accessory_id, fa.figure_id, f.code_name, f.version,
         COALESCE(NULLIF(f.character_key, ''), UPPER(f.code_name)) AS character,
         COALESCE(s.year, f.year_released) AS year
  FROM figure_accessories fa
  JOIN figures f ON f.id = fa.figure_id
  LEFT JOIN series s ON s.series_id = f.series_id
  WHERE fa.release_context = 'retail'
`);

// "DUSTY (1985/1988)" per code name. The year always shows, even for a single
// release — a bare "MUSKRAT" hid which Muskrat a part fits (PARTS_BIN.md,
// 2026-11-24). Two versions from one year add the version: "(1993 v1/1993 v2)".
function nameYearLabels(rows) {
  const byName = new Map();
  rows.forEach((r) => {
    const upper = (r.code_name || '').toUpperCase();
    if (!byName.has(upper)) byName.set(upper, []);
    byName.get(upper).push(r);
  });
  return [...byName.entries()]
    .map(([name, figs]) => {
      const versionsIn = (year) => new Set(figs.filter((f) => f.year === year).map((f) => f.version)).size;
      const years = figs
        .filter((f) => f.year)
        .sort((a, b) => a.year - b.year || a.version - b.version)
        .map((f) => formatYear(f.year) + (versionsIn(f.year) > 1 ? ' v' + f.version : ''));
      return years.length ? name + ' (' + [...new Set(years)].join('/') + ')' : name;
    })
    .sort();
}

export function buildAccessoryCatalog() {
  const rowsByAccessory = new Map();
  for (const r of figureRowsStmt.all()) {
    if (!rowsByAccessory.has(r.accessory_id)) rowsByAccessory.set(r.accessory_id, []);
    rowsByAccessory.get(r.accessory_id).push(r);
  }

  return accessoriesStmt.all().map((r) => {
    const rows = rowsByAccessory.get(r.id) || [];
    // Shared = fits more than one CHARACTER. A part spanning versions of one
    // character (Barbecue's '85/'89 backpack) has that character as its home.
    const shared = new Set(rows.map((x) => x.character)).size > 1;
    const labels = nameYearLabels(rows);
    return {
      id: r.id,
      code: r.accessory_code,
      name: r.name,
      color: r.color,
      categoryId: r.category_id,
      categoryLabel: r.category_name,
      shared,
      figureCount: r.figure_count,
      // Bare name for the group header ("BAZOOKA"); homeFigureName carries the
      // release year(s) for the row's "figure:" line.
      homeFigureIds: shared ? null : rows.map((x) => x.figure_id),
      homeFigureGroup: shared ? null : (rows[0].code_name || '').toUpperCase(),
      homeFigureName: shared ? null : labels[0],
      homeFigureNames: shared ? labels : null,
    };
  });
}
