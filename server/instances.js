// server/instances.js — owned-copy CRUD + shaping, translating the instances/
// instance_accessories/variant_lookup/accessory_inventory tables back into the
// exact { instances, bin } shape store.js's localStorage state used to hold, so
// nothing downstream of store.js (app-inventory.jsx, app-add-figure.jsx,
// app-detail.jsx) has to change.
import db from './db.js';

// name -> accessory_id, scoped to one figure's blueprint (accessories.name isn't
// globally unique, but it is unique within a single figure's required list).
function blueprintNameMap(figureId) {
  const rows = db.prepare(`
    SELECT a.id, a.name FROM figure_accessories fa
    JOIN accessories a ON a.id = fa.accessory_id
    WHERE fa.figure_id = ?
  `).all(figureId);
  return new Map(rows.map((r) => [r.name, r.id]));
}

function accessoryIdForName(figureId, name) {
  const id = blueprintNameMap(figureId).get(name);
  if (id) return id;
  // fallback: best-effort global match (shouldn't normally be needed)
  const row = db.prepare('SELECT id FROM accessories WHERE name = ? LIMIT 1').get(name);
  return row ? row.id : null;
}

const instanceRowsStmt = db.prepare(`
  SELECT i.id, i.figure_id AS catalogId, vl.letter AS variant, i.is_moc AS moc,
         i.damage AS marks, i.location AS loc, i.notes,
         i.filecard_on_file, i.filecard_printing,
         i.created_at
  FROM instances i
  LEFT JOIN variant_lookup vl ON vl.id = i.variant_id
  ORDER BY i.id
`);

const instanceAccStmt = db.prepare(`
  SELECT ia.instance_id, a.name, ia.units_owned
  FROM instance_accessories ia
  JOIN accessories a ON a.id = ia.accessory_id
  WHERE ia.units_owned > 0
`);

function shapeInstance(row, accByInstance) {
  return {
    id: row.id,
    catalogId: row.catalogId,
    variant: row.variant || '',
    moc: !!row.moc,
    acc: accByInstance.get(row.id) || {},
    marks: row.marks ? JSON.parse(row.marks) : null,
    loc: row.loc || '',
    notes: row.notes || '',
    filecard: { onFile: !!row.filecard_on_file, printing: row.filecard_printing || 'A' },
    addedAt: row.created_at,
  };
}

const binRowsStmt = db.prepare(`
  SELECT ai.accessory_id, a.name AS accessory, ai.quantity_owned AS qty, ai.notes
  FROM accessory_inventory ai
  JOIN accessories a ON a.id = ai.accessory_id
  WHERE ai.quantity_owned > 0
  ORDER BY a.name
`);

function shapeBinEntry(row) {
  return { id: row.accessory_id, catalogId: null, accessory: row.accessory, qty: row.qty, notes: row.notes || '', addedAt: null };
}

export function getState() {
  const accByInstance = new Map();
  for (const r of instanceAccStmt.all()) {
    if (!accByInstance.has(r.instance_id)) accByInstance.set(r.instance_id, {});
    accByInstance.get(r.instance_id)[r.name] = r.units_owned;
  }
  return {
    instances: instanceRowsStmt.all().map((r) => shapeInstance(r, accByInstance)),
    bin: binRowsStmt.all().map(shapeBinEntry),
  };
}

function resolveVariantId(figureId, letter) {
  if (!letter) return null;
  const row = db.prepare('SELECT id FROM variant_lookup WHERE figure_id = ? AND letter = ?').get(figureId, letter);
  return row ? row.id : null;
}

const insertInstance = db.prepare(`
  INSERT INTO instances (figure_id, variant_id, is_moc, damage, location, notes, filecard_on_file, filecard_printing)
  VALUES (@figure_id, @variant_id, @is_moc, @damage, @location, @notes, @filecard_on_file, @filecard_printing)
`);
const upsertInstanceAcc = db.prepare(`
  INSERT INTO instance_accessories (instance_id, accessory_id, units_owned) VALUES (?, ?, ?)
  ON CONFLICT(instance_id, accessory_id) DO UPDATE SET units_owned = excluded.units_owned
`);

export const createInstance = db.transaction((payload) => {
  const { catalogId, variant, moc, acc, marks, loc, notes, filecard } = payload;
  const variantId = resolveVariantId(catalogId, variant);
  const id = insertInstance.run({
    figure_id: catalogId,
    variant_id: variantId,
    is_moc: moc ? 1 : 0,
    damage: moc ? null : JSON.stringify(marks || {}),
    location: (loc || '').trim() || null,
    notes: (notes || '').trim() || null,
    filecard_on_file: filecard && filecard.onFile ? 1 : 0,
    filecard_printing: (filecard && filecard.printing) || 'A',
  }).lastInsertRowid;

  for (const [name, units] of Object.entries(acc || {})) {
    if (!units) continue;
    const accId = accessoryIdForName(catalogId, name);
    if (accId) upsertInstanceAcc.run(id, accId, units);
  }
  return id;
});

const patchFieldsStmt = {
  loc: db.prepare('UPDATE instances SET location = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  notes: db.prepare('UPDATE instances SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  moc: db.prepare('UPDATE instances SET is_moc = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  marks: db.prepare('UPDATE instances SET damage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
};
const getInstanceFigure = db.prepare('SELECT figure_id FROM instances WHERE id = ?');

export const updateInstance = db.transaction((id, patch) => {
  if ('loc' in patch) patchFieldsStmt.loc.run((patch.loc || '').trim() || null, id);
  if ('notes' in patch) patchFieldsStmt.notes.run((patch.notes || '').trim() || null, id);
  if ('moc' in patch) patchFieldsStmt.moc.run(patch.moc ? 1 : 0, id);
  if ('marks' in patch) patchFieldsStmt.marks.run(patch.marks ? JSON.stringify(patch.marks) : null, id);
  if ('filecard' in patch) {
    db.prepare('UPDATE instances SET filecard_on_file = ?, filecard_printing = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(patch.filecard.onFile ? 1 : 0, patch.filecard.printing || 'A', id);
  }
  if ('acc' in patch) {
    const row = getInstanceFigure.get(id);
    if (row) {
      for (const [name, units] of Object.entries(patch.acc)) {
        const accId = accessoryIdForName(row.figure_id, name);
        if (accId) upsertInstanceAcc.run(id, accId, units);
      }
    }
  }
});

export function setInstanceAccessory(instanceId, name, units) {
  const row = getInstanceFigure.get(instanceId);
  if (!row) return false;
  const accId = accessoryIdForName(row.figure_id, name);
  if (!accId) return false;
  upsertInstanceAcc.run(instanceId, accId, units);
  return true;
}

export function removeInstance(id) {
  db.prepare('DELETE FROM instances WHERE id = ?').run(id);
}

// ---------------------------------------------------------------------------
// Parts Bin — global loose-accessory stock (accessory_inventory). Simplification
// vs. the prototype: not scoped per catalogId (a loose Bipod isn't "for" one
// figure — matches PARTS_BIN.md's actual reverse-lookup model).
// ---------------------------------------------------------------------------
const upsertBin = db.prepare(`
  INSERT INTO accessory_inventory (accessory_id, quantity_owned, notes) VALUES (?, ?, ?)
  ON CONFLICT(accessory_id) DO UPDATE SET quantity_owned = quantity_owned + excluded.quantity_owned,
    notes = COALESCE(excluded.notes, accessory_inventory.notes)
`);

export function addPart({ catalogId, accessory, qty = 1, notes = '' }) {
  const accId = accessoryIdForName(catalogId, accessory);
  if (!accId) return false;
  upsertBin.run(accId, qty, notes || null);
  return true;
}

export function depositParts(catalogId, parts) {
  for (const { accessory, qty } of parts) {
    if (!qty) continue;
    addPart({ catalogId, accessory, qty });
  }
}

export function adjustPart(accessoryId, delta) {
  const row = db.prepare('SELECT quantity_owned FROM accessory_inventory WHERE accessory_id = ?').get(accessoryId);
  const next = (row ? row.quantity_owned : 0) + delta;
  if (next <= 0) db.prepare('DELETE FROM accessory_inventory WHERE accessory_id = ?').run(accessoryId);
  else upsertBin.run(accessoryId, next - (row ? row.quantity_owned : 0), null);
}

export function removePart(accessoryId) {
  db.prepare('DELETE FROM accessory_inventory WHERE accessory_id = ?').run(accessoryId);
}

export function pullPart(accessoryId, instanceId) {
  const row = db.prepare('SELECT quantity_owned FROM accessory_inventory WHERE accessory_id = ?').get(accessoryId);
  if (!row || row.quantity_owned <= 0) return false;
  const cur = db.prepare('SELECT units_owned FROM instance_accessories WHERE instance_id = ? AND accessory_id = ?').get(instanceId, accessoryId);
  upsertInstanceAcc.run(instanceId, accessoryId, (cur ? cur.units_owned : 0) + 1);
  adjustPart(accessoryId, -1);
  return true;
}

export function clearAll() {
  db.exec('DELETE FROM instances; DELETE FROM accessory_inventory;');
}
