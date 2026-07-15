// server/accessories.js — accessory-level catalog for the Parts Bin: category
// label + shared-vs-single-use + home figure, computed from figure_accessories
// (the real compatibility join — see PARTS_BIN.md "DATA MODEL"). Only accessories
// actually used in at least one figure's blueprint are included, since the Add
// Part flow always starts from a figure's blueprint.
import db from './db.js';

const accessoriesStmt = db.prepare(`
  SELECT a.id, a.name, a.color, a.category_id, ac.name AS category_name,
         COUNT(DISTINCT fa.figure_id) AS figure_count,
         MIN(fa.figure_id) AS solo_figure_id
  FROM accessories a
  JOIN figure_accessories fa ON fa.accessory_id = a.id
  JOIN accessory_categories ac ON ac.category_id = a.category_id
  WHERE fa.release_context = 'retail'
  GROUP BY a.id
`);

// One row per (accessory, figure) — code_name + release year, so shared items
// can distinguish "different characters" from "same character, reissued in a
// later year" (e.g. Dusty's FAMAS gun spans the 1985 v1 and 1988 v2 rows;
// Budo's Ornamental Sword spans 1988 v1 and 1993 v2). Both count toward
// figure_count/"shared by N", but collapsing them to one bare name ("DUSTY")
// hid *why* the count was >1 — see PARTS_BIN.md confusion 2026-07-14.
const figureRowsStmt = db.prepare(`
  SELECT fa.accessory_id, f.code_name, COALESCE(s.year, f.year_released) AS year
  FROM figure_accessories fa
  JOIN figures f ON f.id = fa.figure_id
  LEFT JOIN series s ON s.series_id = f.series_id
  WHERE fa.release_context = 'retail'
`);

const figureNameStmt = db.prepare('SELECT code_name FROM figures WHERE id = ?');

function nameYearLabels(rows) {
  const byName = new Map();
  rows.forEach(({ code_name, year }) => {
    const upper = (code_name || '').toUpperCase();
    if (!byName.has(upper)) byName.set(upper, new Set());
    if (year) byName.get(upper).add(year);
  });
  return [...byName.entries()]
    .map(([name, years]) => {
      const sorted = [...years].sort((a, b) => a - b);
      return sorted.length > 1 ? name + ' (' + sorted.join('/') + ')' : name;
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
    const shared = r.figure_count > 1;
    const soloFigure = !shared ? figureNameStmt.get(r.solo_figure_id) : null;
    const homeFigureNames = shared ? nameYearLabels(rowsByAccessory.get(r.id) || []) : null;
    return {
      id: r.id,
      name: r.name,
      color: r.color,
      categoryId: r.category_id,
      categoryLabel: r.category_name,
      shared,
      figureCount: r.figure_count,
      homeFigureId: shared ? null : r.solo_figure_id,
      homeFigureName: soloFigure ? (soloFigure.code_name || '').toUpperCase() : null,
      homeFigureNames,
    };
  });
}
