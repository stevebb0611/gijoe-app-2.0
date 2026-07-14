// server/accessories.js — accessory-level catalog for the Parts Bin: category
// label + shared-vs-single-use + home figure, computed from figure_accessories
// (the real compatibility join — see PARTS_BIN.md "DATA MODEL"). Only accessories
// actually used in at least one figure's blueprint are included, since the Add
// Part flow always starts from a figure's blueprint.
import db from './db.js';

const accessoriesStmt = db.prepare(`
  SELECT a.id, a.name, a.category_id, ac.name AS category_name,
         COUNT(DISTINCT fa.figure_id) AS figure_count,
         MIN(fa.figure_id) AS solo_figure_id,
         GROUP_CONCAT(DISTINCT f.code_name) AS figure_names
  FROM accessories a
  JOIN figure_accessories fa ON fa.accessory_id = a.id
  JOIN accessory_categories ac ON ac.category_id = a.category_id
  JOIN figures f ON f.id = fa.figure_id
  WHERE fa.release_context = 'retail'
  GROUP BY a.id
`);

const figureNameStmt = db.prepare('SELECT code_name FROM figures WHERE id = ?');

export function buildAccessoryCatalog() {
  return accessoriesStmt.all().map((r) => {
    const shared = r.figure_count > 1;
    const soloFigure = !shared ? figureNameStmt.get(r.solo_figure_id) : null;
    const homeFigureNames = shared
      ? [...new Set((r.figure_names || '').split(','))].map((n) => n.toUpperCase()).sort()
      : null;
    return {
      id: r.id,
      name: r.name,
      categoryId: r.category_id,
      categoryLabel: r.category_name,
      shared,
      homeFigureId: shared ? null : r.solo_figure_id,
      homeFigureName: soloFigure ? (soloFigure.code_name || '').toUpperCase() : null,
      homeFigureNames,
    };
  });
}
