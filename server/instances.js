// server/instances.js — owned-copy CRUD + shaping, translating the instances/
// instance_accessories/variant_lookup/accessory_inventory tables back into the
// exact { instances, bin } shape store.js's localStorage state used to hold, so
// nothing downstream of store.js (app-inventory.jsx, app-add-figure.jsx,
// app-detail.jsx) has to change.
import db from './db.js';
import { disambiguateNames } from './blueprint-names.js';

// Disambiguated (name, accessory_id) pairs for one figure's blueprint. Raw
// accessories.name isn't always unique within a figure (e.g. Firefly's two
// "Submachine Gun" entries, one per colour) — disambiguateNames() must match
// catalog.js's blueprint exactly, both directions: name -> id when the
// frontend PATCHes a toggle, and id -> name when getState() reads ownership
// back out, or the two colours collapse onto one tracked row.
function blueprintRows(figureId) {
  const rows = db.prepare(`
    SELECT a.id, a.name, a.color FROM figure_accessories fa
    JOIN accessories a ON a.id = fa.accessory_id
    WHERE fa.figure_id = ?
    ORDER BY fa.rowid
  `).all(figureId);
  return disambiguateNames(rows);
}
function blueprintNameMap(figureId) { return new Map(blueprintRows(figureId).map((r) => [r.name, r.id])); }
function blueprintIdNameMap(figureId) { return new Map(blueprintRows(figureId).map((r) => [r.id, r.name])); }

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
         i.filecard_on_file, i.filecard_id, i.country_of_origin AS coo,
         i.created_at
  FROM instances i
  LEFT JOIN variant_lookup vl ON vl.id = i.variant_id
  ORDER BY i.id
`);

const instanceAccStmt = db.prepare(`
  SELECT ia.instance_id, i.figure_id, ia.accessory_id, ia.units_owned, ia.units_damaged
  FROM instance_accessories ia
  JOIN instances i ON i.id = ia.instance_id
  WHERE ia.units_owned > 0
`);

function shapeInstance(row, accByInstance, damageByInstance) {
  return {
    id: row.id,
    catalogId: row.catalogId,
    variant: row.variant || '',
    moc: !!row.moc,
    acc: accByInstance.get(row.id) || {},
    accDamage: damageByInstance.get(row.id) || {},
    marks: row.marks ? JSON.parse(row.marks) : null,
    loc: row.loc || '',
    notes: row.notes || '',
    filecard: { onFile: !!row.filecard_on_file, fileCardId: row.filecard_id || null },
    coo: row.coo || '',
    addedAt: row.created_at,
  };
}

const binRowsStmt = db.prepare(`
  SELECT ai.accessory_id, a.name AS accessory, ai.quantity_owned AS qty, ai.units_damaged AS damaged, ai.notes
  FROM accessory_inventory ai
  JOIN accessories a ON a.id = ai.accessory_id
  WHERE ai.quantity_owned > 0
  ORDER BY a.name
`);

function shapeBinEntry(row) {
  return { id: row.accessory_id, catalogId: null, accessory: row.accessory, qty: row.qty, damaged: row.damaged || 0, notes: row.notes || '', addedAt: null };
}

export function getState() {
  const accByInstance = new Map();
  const damageByInstance = new Map();
  const idNameByFigure = new Map(); // figure_id -> Map(accessory_id -> disambiguated name)
  for (const r of instanceAccStmt.all()) {
    if (!idNameByFigure.has(r.figure_id)) idNameByFigure.set(r.figure_id, blueprintIdNameMap(r.figure_id));
    const name = idNameByFigure.get(r.figure_id).get(r.accessory_id);
    if (!name) continue; // accessory no longer on this figure's blueprint
    if (!accByInstance.has(r.instance_id)) accByInstance.set(r.instance_id, {});
    accByInstance.get(r.instance_id)[name] = r.units_owned;
    if (r.units_damaged > 0) {
      if (!damageByInstance.has(r.instance_id)) damageByInstance.set(r.instance_id, {});
      damageByInstance.get(r.instance_id)[name] = r.units_damaged;
    }
  }
  return {
    instances: instanceRowsStmt.all().map((r) => shapeInstance(r, accByInstance, damageByInstance)),
    bin: binRowsStmt.all().map(shapeBinEntry),
  };
}

function resolveVariantId(figureId, letter) {
  if (!letter) return null;
  const row = db.prepare('SELECT id FROM variant_lookup WHERE figure_id = ? AND letter = ?').get(figureId, letter);
  return row ? row.id : null;
}

const insertInstance = db.prepare(`
  INSERT INTO instances (figure_id, variant_id, is_moc, damage, location, notes, filecard_on_file, filecard_id, country_of_origin)
  VALUES (@figure_id, @variant_id, @is_moc, @damage, @location, @notes, @filecard_on_file, @filecard_id, @country_of_origin)
`);
const upsertInstanceAcc = db.prepare(`
  INSERT INTO instance_accessories (instance_id, accessory_id, units_owned) VALUES (?, ?, ?)
  ON CONFLICT(instance_id, accessory_id) DO UPDATE SET units_owned = excluded.units_owned
`);

export const createInstance = db.transaction((payload) => {
  const { catalogId, variant, moc, acc, accDamage, marks, loc, notes, filecard, coo } = payload;
  const variantId = resolveVariantId(catalogId, variant);
  const id = insertInstance.run({
    figure_id: catalogId,
    variant_id: variantId,
    is_moc: moc ? 1 : 0,
    damage: moc ? null : JSON.stringify(marks || {}),
    location: (loc || '').trim() || null,
    notes: (notes || '').trim() || null,
    filecard_on_file: filecard && filecard.onFile ? 1 : 0,
    filecard_id: (filecard && filecard.fileCardId) || null,
    country_of_origin: coo || null,
  }).lastInsertRowid;

  for (const [name, units] of Object.entries(acc || {})) {
    if (!units) continue;
    const accId = accessoryIdForName(catalogId, name);
    if (accId) upsertInstanceAcc.run(id, accId, units);
  }
  // accDamage is a condition notation on units already added above — clamped
  // to [0, units_owned] same as setInstanceAccessoryDamage, since a copy
  // can't arrive already-damaged for an accessory it doesn't own.
  if (!moc) {
    for (const [name, damaged] of Object.entries(accDamage || {})) {
      if (!damaged) continue;
      const accId = accessoryIdForName(catalogId, name);
      if (!accId) continue;
      const owned = acc && acc[name] ? acc[name] : 0;
      if (owned) setInstanceAccDamage.run(Math.max(0, Math.min(damaged, owned)), id, accId);
    }
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

const setInstanceVariant = db.prepare('UPDATE instances SET variant_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
const setInstanceCoo = db.prepare('UPDATE instances SET country_of_origin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

export const updateInstance = db.transaction((id, patch) => {
  if ('loc' in patch) patchFieldsStmt.loc.run((patch.loc || '').trim() || null, id);
  if ('notes' in patch) patchFieldsStmt.notes.run((patch.notes || '').trim() || null, id);
  if ('moc' in patch) patchFieldsStmt.moc.run(patch.moc ? 1 : 0, id);
  if ('marks' in patch) patchFieldsStmt.marks.run(patch.marks ? JSON.stringify(patch.marks) : null, id);
  if ('variant' in patch) {
    const row = getInstanceFigure.get(id);
    if (row) setInstanceVariant.run(resolveVariantId(row.figure_id, patch.variant), id);
  }
  if ('coo' in patch) setInstanceCoo.run(patch.coo || null, id);
  if ('filecard' in patch) {
    db.prepare('UPDATE instances SET filecard_on_file = ?, filecard_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(patch.filecard.onFile ? 1 : 0, patch.filecard.fileCardId || null, id);
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

const setInstanceAccDamage = db.prepare(`
  UPDATE instance_accessories SET units_damaged = ? WHERE instance_id = ? AND accessory_id = ?
`);

// units_damaged is a condition notation on units the copy already owns — never
// creates a row (upsertInstanceAcc already did that when units_owned was set)
// and is clamped to [0, units_owned] since you can't damage a part you don't have.
export function setInstanceAccessoryDamage(instanceId, name, units) {
  const row = getInstanceFigure.get(instanceId);
  if (!row) return false;
  const accId = accessoryIdForName(row.figure_id, name);
  if (!accId) return false;
  const cur = db.prepare('SELECT units_owned FROM instance_accessories WHERE instance_id = ? AND accessory_id = ?').get(instanceId, accId);
  const owned = cur ? cur.units_owned : 0;
  if (!owned) return false;
  setInstanceAccDamage.run(Math.max(0, Math.min(units, owned)), instanceId, accId);
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

const getBinRow = db.prepare('SELECT quantity_owned, units_damaged FROM accessory_inventory WHERE accessory_id = ?');
const setBinDamaged = db.prepare('UPDATE accessory_inventory SET units_damaged = ? WHERE accessory_id = ?');

// units_damaged is app-clamped to [0, quantity_owned] (migration 006, same
// rule as instance_accessories.units_damaged) — shrinking quantity_owned
// below the current damaged count pulls units_damaged down with it.
export function adjustPart(accessoryId, delta) {
  const row = getBinRow.get(accessoryId);
  const nextQty = (row ? row.quantity_owned : 0) + delta;
  if (nextQty <= 0) { db.prepare('DELETE FROM accessory_inventory WHERE accessory_id = ?').run(accessoryId); return; }
  upsertBin.run(accessoryId, nextQty - (row ? row.quantity_owned : 0), null);
  if (row && row.units_damaged > nextQty) setBinDamaged.run(nextQty, accessoryId);
}

export function removePart(accessoryId) {
  db.prepare('DELETE FROM accessory_inventory WHERE accessory_id = ?').run(accessoryId);
}

// Pulls one loose unit from the bin onto an instance. Prefers clean stock;
// only reaches for damaged stock if that's all the bin has, in which case
// the damage status carries over onto the instance rather than silently
// laundering a broken part as clean. adjustPart's own units_damaged clamp
// keeps the bin side correct once quantity_owned drops (see adjustPart).
export const pullPart = db.transaction((accessoryId, instanceId) => {
  const row = getBinRow.get(accessoryId);
  if (!row || row.quantity_owned <= 0) return false;
  const pullingDamaged = row.units_damaged >= row.quantity_owned; // no clean stock left

  const cur = db.prepare('SELECT units_owned, units_damaged FROM instance_accessories WHERE instance_id = ? AND accessory_id = ?').get(instanceId, accessoryId);
  const ownedNow = cur ? cur.units_owned : 0;
  upsertInstanceAcc.run(instanceId, accessoryId, ownedNow + 1);
  if (pullingDamaged) {
    const damagedNow = cur ? cur.units_damaged : 0;
    setInstanceAccDamage.run(damagedNow + 1, instanceId, accessoryId);
  }

  adjustPart(accessoryId, -1);
  return true;
});

// Trades a damaged unit on an instance for a clean one from the bin. A
// symmetric swap, not a quantity change: the instance's units_owned and the
// bin's quantity_owned are untouched — only which units are flagged damaged
// moves (instance -1 damaged, bin +1 damaged). Fails if the instance has no
// damaged unit of this accessory, or the bin has no clean stock to trade for.
export const swapAccessoryForClean = db.transaction((instanceId, name) => {
  const row = getInstanceFigure.get(instanceId);
  if (!row) return false;
  const accId = accessoryIdForName(row.figure_id, name);
  if (!accId) return false;

  const instRow = db.prepare('SELECT units_owned, units_damaged FROM instance_accessories WHERE instance_id = ? AND accessory_id = ?').get(instanceId, accId);
  if (!instRow || instRow.units_damaged <= 0) return false;

  const binRow = getBinRow.get(accId);
  const cleanInBin = binRow ? binRow.quantity_owned - binRow.units_damaged : 0;
  if (cleanInBin <= 0) return false;

  setInstanceAccDamage.run(instRow.units_damaged - 1, instanceId, accId);
  setBinDamaged.run(binRow.units_damaged + 1, accId);
  return true;
});

export function clearAll() {
  db.exec('DELETE FROM instances; DELETE FROM accessory_inventory;');
}
