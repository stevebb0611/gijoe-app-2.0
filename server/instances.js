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
  // Blueprint-only — no global by-name fallback. Names like "Backpack" exist on
  // dozens of figures, so a global match just grabbed the lowest id (A0063,
  // Baroness's) and wrote a stray row onto Quick Kick copy 194. Every caller
  // already treats null as "skip" / 400, which is the right outcome here.
  return blueprintNameMap(figureId).get(name) || null;
}

const instanceRowsStmt = db.prepare(`
  SELECT i.id, i.figure_id AS catalogId, vl.letter AS variant, i.is_moc AS moc,
         i.damage AS marks, i.location AS loc, i.notes,
         i.filecard_on_file, i.filecard_id, i.filecard_color, i.filecard_grade, i.country_of_origin AS coo,
         i.is_master AS masterCollection, i.set_id AS setId, i.pinned_no AS pinnedNo,
         i.created_at
  FROM instances i
  LEFT JOIN variant_lookup vl ON vl.id = i.variant_id
  ORDER BY i.id
`);

const instanceAccStmt = db.prepare(`
  SELECT ia.instance_id, i.figure_id, ia.accessory_id, ia.units_owned
  FROM instance_accessories ia
  JOIN instances i ON i.id = ia.instance_id
  WHERE ia.units_owned > 0
`);
// One row per damaged unit (migration 021 — replaces the old scalar
// units_damaged/damage_notes columns so each unit can carry its own note).
const instanceDamageStmt = db.prepare(`
  SELECT iad.id, iad.instance_id, i.figure_id, iad.accessory_id, iad.notes
  FROM instance_accessory_damage iad
  JOIN instances i ON i.id = iad.instance_id
`);

function shapeInstance(row, accByInstance, damageByInstance, damageUnitsByInstance, splitsByInstance) {
  return {
    id: row.id,
    catalogId: row.catalogId,
    variant: row.variant || '',
    moc: !!row.moc,
    acc: accByInstance.get(row.id) || {},
    accDamage: damageByInstance.get(row.id) || {},
    // name -> [{id, notes}, ...], one entry per damaged unit — see DmgPopover
    // in web/src/app-detail.jsx for how each gets its own editable note.
    accDamageUnits: damageUnitsByInstance.get(row.id) || {},
    marks: row.marks ? JSON.parse(row.marks) : null,
    loc: row.loc || '',
    notes: row.notes || '',
    filecard: { onFile: !!row.filecard_on_file, fileCardId: row.filecard_id || null, color: row.filecard_color || '', grade: row.filecard_grade || null },
    coo: row.coo || '',
    masterCollection: !!row.masterCollection,
    setId: row.setId || null,
    pinnedNo: row.pinnedNo ?? null,
    // parent accessory ids this copy has split into pieces (migration 022)
    splits: splitsByInstance.get(row.id) || [],
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
const binDamageStmt = db.prepare('SELECT id, accessory_id, notes FROM bin_damage');

function shapeBinEntry(row, damageUnitsByAccessory) {
  const units = damageUnitsByAccessory.get(row.accessory_id) || [];
  return { id: row.accessory_id, catalogId: null, accessory: row.accessory, qty: row.qty, damaged: units.length, damageUnits: units, notes: row.notes || '', addedAt: null };
}

export function getState() {
  const accByInstance = new Map();
  const damageByInstance = new Map();
  const damageUnitsByInstance = new Map();
  const idNameByFigure = new Map(); // figure_id -> Map(accessory_id -> disambiguated name)
  const nameFor = (figureId, accessoryId) => {
    if (!idNameByFigure.has(figureId)) idNameByFigure.set(figureId, blueprintIdNameMap(figureId));
    return idNameByFigure.get(figureId).get(accessoryId);
  };
  for (const r of instanceAccStmt.all()) {
    const name = nameFor(r.figure_id, r.accessory_id);
    if (!name) continue; // accessory no longer on this figure's blueprint
    if (!accByInstance.has(r.instance_id)) accByInstance.set(r.instance_id, {});
    accByInstance.get(r.instance_id)[name] = r.units_owned;
  }
  for (const r of instanceDamageStmt.all()) {
    const name = nameFor(r.figure_id, r.accessory_id);
    if (!name) continue;
    if (!damageByInstance.has(r.instance_id)) damageByInstance.set(r.instance_id, {});
    const counts = damageByInstance.get(r.instance_id);
    counts[name] = (counts[name] || 0) + 1;
    if (!damageUnitsByInstance.has(r.instance_id)) damageUnitsByInstance.set(r.instance_id, {});
    const units = damageUnitsByInstance.get(r.instance_id);
    (units[name] || (units[name] = [])).push({ id: r.id, notes: r.notes || '' });
  }
  const binDamageByAcc = new Map();
  for (const r of binDamageStmt.all()) {
    if (!binDamageByAcc.has(r.accessory_id)) binDamageByAcc.set(r.accessory_id, []);
    binDamageByAcc.get(r.accessory_id).push({ id: r.id, notes: r.notes || '' });
  }
  const splitsByInstance = new Map();
  for (const r of instanceSplitsStmt.all()) {
    if (!splitsByInstance.has(r.instance_id)) splitsByInstance.set(r.instance_id, []);
    splitsByInstance.get(r.instance_id).push(r.accessory_id);
  }
  return {
    instances: instanceRowsStmt.all().map((r) => shapeInstance(r, accByInstance, damageByInstance, damageUnitsByInstance, splitsByInstance)),
    bin: binRowsStmt.all().map((r) => shapeBinEntry(r, binDamageByAcc)),
  };
}

function resolveVariantId(figureId, letter) {
  if (!letter) return null;
  const row = db.prepare('SELECT id FROM variant_lookup WHERE figure_id = ? AND letter = ?').get(figureId, letter);
  return row ? row.id : null;
}

const insertInstance = db.prepare(`
  INSERT INTO instances (figure_id, variant_id, is_moc, damage, location, notes, filecard_on_file, filecard_id, filecard_color, filecard_grade, country_of_origin, set_id)
  VALUES (@figure_id, @variant_id, @is_moc, @damage, @location, @notes, @filecard_on_file, @filecard_id, @filecard_color, @filecard_grade, @country_of_origin, @set_id)
`);
const upsertInstanceAcc = db.prepare(`
  INSERT INTO instance_accessories (instance_id, accessory_id, units_owned) VALUES (?, ?, ?)
  ON CONFLICT(instance_id, accessory_id) DO UPDATE SET units_owned = excluded.units_owned
`);

export const createInstance = db.transaction((payload) => {
  const { catalogId, variant, moc, acc, accDamage, accDamageNotes, marks, loc, notes, filecard, coo, setId } = payload;
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
    filecard_color: (filecard && filecard.color) || null,
    filecard_grade: (filecard && filecard.grade) || null,
    country_of_origin: coo || null,
    set_id: setId || null,
  }).lastInsertRowid;

  for (const [name, units] of Object.entries(acc || {})) {
    if (!units) continue;
    const accId = accessoryIdForName(catalogId, name);
    if (accId) upsertInstanceAcc.run(id, accId, units);
  }
  // accDamage is a condition notation on units already added above — clamped
  // to [0, units_owned] same as setInstanceAccessoryDamage, since a copy
  // can't arrive already-damaged for an accessory it doesn't own. Each
  // damaged unit gets its own row (migration 021); accDamageNotes[name] is
  // one note per damaged unit, index-aligned with the clamp below — same
  // shape as addPart's damageNotes. Missing/short arrays just leave later
  // units blank rather than erroring, so older callers with no notes at all
  // still work unchanged.
  if (!moc) {
    for (const [name, damaged] of Object.entries(accDamage || {})) {
      if (!damaged) continue;
      const accId = accessoryIdForName(catalogId, name);
      if (!accId) continue;
      const owned = acc && acc[name] ? acc[name] : 0;
      const clamped = Math.max(0, Math.min(damaged, owned));
      const notesArr = (accDamageNotes && accDamageNotes[name]) || [];
      for (let i = 0; i < clamped; i++) insertInstanceDamage.run(id, accId, (notesArr[i] || '').trim() || null);
    }
  }
  return id;
});

const patchFieldsStmt = {
  loc: db.prepare('UPDATE instances SET location = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  notes: db.prepare('UPDATE instances SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  moc: db.prepare('UPDATE instances SET is_moc = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  marks: db.prepare('UPDATE instances SET damage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  masterCollection: db.prepare('UPDATE instances SET is_master = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  pinnedNo: db.prepare('UPDATE instances SET pinned_no = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
};
const getInstanceFigure = db.prepare('SELECT figure_id FROM instances WHERE id = ?');

const setInstanceVariant = db.prepare('UPDATE instances SET variant_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
const setInstanceCoo = db.prepare('UPDATE instances SET country_of_origin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
const setInstanceSet = db.prepare('UPDATE instances SET set_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

export const updateInstance = db.transaction((id, patch) => {
  if ('loc' in patch) patchFieldsStmt.loc.run((patch.loc || '').trim() || null, id);
  if ('notes' in patch) patchFieldsStmt.notes.run((patch.notes || '').trim() || null, id);
  if ('moc' in patch) patchFieldsStmt.moc.run(patch.moc ? 1 : 0, id);
  if ('marks' in patch) patchFieldsStmt.marks.run(patch.marks ? JSON.stringify(patch.marks) : null, id);
  if ('masterCollection' in patch) patchFieldsStmt.masterCollection.run(patch.masterCollection ? 1 : 0, id);
  if ('pinnedNo' in patch) patchFieldsStmt.pinnedNo.run(patch.pinnedNo, id);
  if ('variant' in patch) {
    const row = getInstanceFigure.get(id);
    if (row) setInstanceVariant.run(resolveVariantId(row.figure_id, patch.variant), id);
  }
  if ('coo' in patch) setInstanceCoo.run(patch.coo || null, id);
  if ('setId' in patch) setInstanceSet.run(patch.setId || null, id);
  if ('filecard' in patch) {
    db.prepare('UPDATE instances SET filecard_on_file = ?, filecard_id = ?, filecard_color = ?, filecard_grade = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(patch.filecard.onFile ? 1 : 0, patch.filecard.fileCardId || null, patch.filecard.color || null, patch.filecard.grade || null, id);
  }
  if ('acc' in patch) {
    const row = getInstanceFigure.get(id);
    if (row) {
      for (const [name, units] of Object.entries(patch.acc)) {
        const accId = accessoryIdForName(row.figure_id, name);
        if (accId) { upsertInstanceAcc.run(id, accId, units); trimInstanceDamage(id, accId, units); }
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
  trimInstanceDamage(instanceId, accId, units); // a unit can't stay marked damaged once it's no longer owned
  return true;
}

// ---------------------------------------------------------------------------
// Per-unit damage (migration 021) — instance_accessory_damage holds one row
// per damaged unit of one instance's accessory, each with its own optional
// note, instead of the old scalar units_damaged count + one shared
// damage_notes string. "Which unit" has no real identity beyond its row —
// clean units are fully interchangeable — so create/delete just pick
// whichever row is cheapest to lose: a blank-note one before a noted one,
// oldest first within that.
// ---------------------------------------------------------------------------
const insertInstanceDamage = db.prepare('INSERT INTO instance_accessory_damage (instance_id, accessory_id, notes) VALUES (?, ?, ?)');
const countInstanceDamage = db.prepare('SELECT COUNT(*) AS n FROM instance_accessory_damage WHERE instance_id = ? AND accessory_id = ?');
const deleteInstanceDamageRow = db.prepare('DELETE FROM instance_accessory_damage WHERE id = ?');
const pickInstanceDamageRowsToTrim = db.prepare(`
  SELECT id FROM instance_accessory_damage WHERE instance_id = ? AND accessory_id = ?
  ORDER BY (notes IS NULL OR notes = '') DESC, id ASC LIMIT ?
`);
const oldestInstanceDamageRow = db.prepare(`
  SELECT id, notes FROM instance_accessory_damage WHERE instance_id = ? AND accessory_id = ? ORDER BY id ASC LIMIT 1
`);

function trimInstanceDamage(instanceId, accId, maxAllowed) {
  const n = countInstanceDamage.get(instanceId, accId).n;
  if (n <= maxAllowed) return;
  for (const r of pickInstanceDamageRowsToTrim.all(instanceId, accId, n - maxAllowed)) deleteInstanceDamageRow.run(r.id);
}

// Sets the TARGET damaged count for this instance's accessory — clamped to
// [0, units_owned] since you can't damage a part you don't have. Growing the
// count inserts blank-note rows; shrinking it trims via trimInstanceDamage.
export function setInstanceAccessoryDamage(instanceId, name, units) {
  const row = getInstanceFigure.get(instanceId);
  if (!row) return false;
  const accId = accessoryIdForName(row.figure_id, name);
  if (!accId) return false;
  const cur = db.prepare('SELECT units_owned FROM instance_accessories WHERE instance_id = ? AND accessory_id = ?').get(instanceId, accId);
  const owned = cur ? cur.units_owned : 0;
  if (!owned) return false;
  const clamped = Math.max(0, Math.min(units, owned));
  const curDamaged = countInstanceDamage.get(instanceId, accId).n;
  if (clamped > curDamaged) { for (let i = 0; i < clamped - curDamaged; i++) insertInstanceDamage.run(instanceId, accId, null); }
  else if (clamped < curDamaged) trimInstanceDamage(instanceId, accId, clamped);
  return true;
}

// Sets the note on ONE specific damaged unit — replaces the old
// setInstanceAccessoryDamageNotes (a single string shared by however many
// units happened to be damaged; see migration 021's header comment).
export function setInstanceAccessoryDamageUnitNotes(instanceId, unitId, notes) {
  const row = db.prepare('SELECT id FROM instance_accessory_damage WHERE id = ? AND instance_id = ?').get(unitId, instanceId);
  if (!row) return false;
  db.prepare('UPDATE instance_accessory_damage SET notes = ? WHERE id = ?').run((notes || '').trim() || null, unitId);
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
const getBinRow = db.prepare('SELECT quantity_owned FROM accessory_inventory WHERE accessory_id = ?');

// One row per damaged LOOSE unit (migration 021, same idea as
// instance_accessory_damage above) — clean loose units stay a plain count
// (quantity_owned) since they're fully interchangeable; only damaged ones
// need individual identity to carry a distinct note.
const insertBinDamage = db.prepare('INSERT INTO bin_damage (accessory_id, notes) VALUES (?, ?)');
const countBinDamage = db.prepare('SELECT COUNT(*) AS n FROM bin_damage WHERE accessory_id = ?');
const deleteBinDamageRow = db.prepare('DELETE FROM bin_damage WHERE id = ?');
const pickBinDamageRowsToTrim = db.prepare(`
  SELECT id FROM bin_damage WHERE accessory_id = ? ORDER BY (notes IS NULL OR notes = '') DESC, id ASC LIMIT ?
`);
const oldestBinDamageRow = db.prepare('SELECT id, notes FROM bin_damage WHERE accessory_id = ? ORDER BY id ASC LIMIT 1');

function trimBinDamage(accessoryId, maxAllowed) {
  const n = countBinDamage.get(accessoryId).n;
  if (n <= maxAllowed) return;
  for (const r of pickBinDamageRowsToTrim.all(accessoryId, n - maxAllowed)) deleteBinDamageRow.run(r.id);
}

// damaged/damageNotes let a part be logged as already-damaged at import time
// (e.g. sorting a parts lot) instead of requiring a second trip to find the
// row again in the bin list and mark it via setPartDamage/setPartDamageUnitNotes.
// damageNotes is one entry per damaged unit (array, e.g. 3 backpacks each
// damaged a different way) — a bare string is also accepted and applies to
// every damaged unit in the batch alike, for a caller that doesn't distinguish.
export const addPart = db.transaction(({ catalogId, accessory, qty = 1, notes = '', damaged = 0, damageNotes = [] }) => {
  const accId = accessoryIdForName(catalogId, accessory);
  if (!accId) return false;
  upsertBin.run(accId, qty, notes || null);
  const dmg = Math.max(0, Math.min(damaged, qty));
  const notesArr = Array.isArray(damageNotes) ? damageNotes : Array.from({ length: dmg }, () => damageNotes);
  for (let i = 0; i < dmg; i++) insertBinDamage.run(accId, (notesArr[i] || '').trim() || null);
  return true;
});

export function depositParts(catalogId, parts) {
  for (const { accessory, qty } of parts) {
    if (!qty) continue;
    addPart({ catalogId, accessory, qty });
  }
}

// damaged-unit count is app-clamped to [0, quantity_owned] (migration 006) —
// shrinking quantity_owned below the current damaged count trims damage rows
// down with it (blank-note ones first — see trimBinDamage).
export function adjustPart(accessoryId, delta) {
  const row = getBinRow.get(accessoryId);
  const curQty = row ? row.quantity_owned : 0;
  const nextQty = curQty + delta;
  if (nextQty <= 0) {
    db.prepare('DELETE FROM accessory_inventory WHERE accessory_id = ?').run(accessoryId);
    db.prepare('DELETE FROM bin_damage WHERE accessory_id = ?').run(accessoryId); // no FK cascade — bin_damage keys off accessories, not accessory_inventory
    return;
  }
  upsertBin.run(accessoryId, nextQty - curQty, null);
  trimBinDamage(accessoryId, nextQty);
}

export function removePart(accessoryId) {
  db.prepare('DELETE FROM accessory_inventory WHERE accessory_id = ?').run(accessoryId);
  db.prepare('DELETE FROM bin_damage WHERE accessory_id = ?').run(accessoryId);
}

// Direct write for loose-stock damage — e.g. sorting the bin turns up a
// broken part, with no instance/swap involved. Same [0, quantity_owned]
// clamp as everywhere else damaged count is set; growing it inserts
// blank-note rows, shrinking it trims via trimBinDamage.
export function setPartDamage(accessoryId, units) {
  const row = getBinRow.get(accessoryId);
  if (!row) return false;
  const clamped = Math.max(0, Math.min(units, row.quantity_owned));
  const cur = countBinDamage.get(accessoryId).n;
  if (clamped > cur) { for (let i = 0; i < clamped - cur; i++) insertBinDamage.run(accessoryId, null); }
  else if (clamped < cur) trimBinDamage(accessoryId, clamped);
  return true;
}

// Sets the note on ONE specific damaged loose unit — replaces the old
// setPartDamageNotes (a single string shared by however many loose units of
// that accessory happened to be damaged; see migration 021's header comment).
export function setPartDamageUnitNotes(unitId, notes) {
  const row = db.prepare('SELECT id FROM bin_damage WHERE id = ?').get(unitId);
  if (!row) return false;
  db.prepare('UPDATE bin_damage SET notes = ? WHERE id = ?').run((notes || '').trim() || null, unitId);
  return true;
}

// Pulls one loose unit from the bin onto an instance. Prefers clean stock;
// only reaches for damaged stock if that's all the bin has, in which case
// the damaged unit's own row — note included — re-targets onto the instance
// rather than silently laundering a broken part as clean (or dropping the
// note describing what's wrong with it). adjustPart's own trim keeps the
// bin side's remaining damage rows consistent once quantity_owned drops.
export const pullPart = db.transaction((accessoryId, instanceId) => {
  const row = getBinRow.get(accessoryId);
  if (!row || row.quantity_owned <= 0) return false;
  const damagedCount = countBinDamage.get(accessoryId).n;
  const pullingDamaged = damagedCount >= row.quantity_owned; // no clean stock left

  const cur = db.prepare('SELECT units_owned FROM instance_accessories WHERE instance_id = ? AND accessory_id = ?').get(instanceId, accessoryId);
  const ownedNow = cur ? cur.units_owned : 0;
  upsertInstanceAcc.run(instanceId, accessoryId, ownedNow + 1);
  if (pullingDamaged) {
    const leaving = oldestBinDamageRow.get(accessoryId);
    deleteBinDamageRow.run(leaving.id);
    insertInstanceDamage.run(instanceId, accessoryId, leaving.notes);
  }

  adjustPart(accessoryId, -1);
  return true;
});

// ---------------------------------------------------------------------------
// Splittable accessories (migration 022) — a parent sheet (e.g. A0328 "Rank
// and Stripes (decal)") whose piece rows carry accessories.split_of. Split is
// per copy: instance_accessory_splits records which copies show the pieces
// instead of the sheet (completeness.js bpForVariant does the hiding).
// Splitting a copy that owns the sheet cuts it: each owned sheet becomes one
// of every piece, and a damaged sheet's note follows onto each piece.
// ---------------------------------------------------------------------------
const splitChildrenStmt = db.prepare('SELECT id FROM accessories WHERE split_of = ? ORDER BY id');
const isSplitStmt = db.prepare('SELECT 1 FROM instance_accessory_splits WHERE instance_id = ? AND accessory_id = ?');
const instanceSplitsStmt = db.prepare('SELECT instance_id, accessory_id FROM instance_accessory_splits');
const unitsOwnedStmt = db.prepare('SELECT units_owned FROM instance_accessories WHERE instance_id = ? AND accessory_id = ?');
const instanceDamageRowsStmt = db.prepare('SELECT id, notes FROM instance_accessory_damage WHERE instance_id = ? AND accessory_id = ? ORDER BY id');
const unitsOf = (instanceId, accId) => { const r = unitsOwnedStmt.get(instanceId, accId); return r ? r.units_owned : 0; };
// Zero means no row — don't leave units_owned = 0 rows behind (see the 2026-10-30 data audit).
const deleteInstanceAccStmt = db.prepare('DELETE FROM instance_accessories WHERE instance_id = ? AND accessory_id = ?');
const setUnits = (instanceId, accId, n) => n > 0 ? upsertInstanceAcc.run(instanceId, accId, n) : deleteInstanceAccStmt.run(instanceId, accId);
const onBlueprint = (figureId, accId) => blueprintIdNameMap(figureId).has(accId);

export const splitInstanceAccessory = db.transaction((instanceId, parentId) => {
  const row = getInstanceFigure.get(instanceId);
  if (!row || !onBlueprint(row.figure_id, parentId)) return false;
  const children = splitChildrenStmt.all(parentId).map((c) => c.id);
  if (!children.length || isSplitStmt.get(instanceId, parentId)) return false;
  const sheets = unitsOf(instanceId, parentId);
  const dmg = instanceDamageRowsStmt.all(instanceId, parentId);
  for (const c of children) {
    setUnits(instanceId, c, unitsOf(instanceId, c) + sheets);
    for (const d of dmg) insertInstanceDamage.run(instanceId, c, d.notes);
  }
  for (const d of dmg) deleteInstanceDamageRow.run(d.id);
  setUnits(instanceId, parentId, 0);
  db.prepare('INSERT INTO instance_accessory_splits (instance_id, accessory_id) VALUES (?, ?)').run(instanceId, parentId);
  return true;
});

// Undo for a mis-click: only when every piece is held in the same count (none,
// or a matched set per sheet) — a lone leftover piece can't become a sheet.
// A damaged piece makes the rebuilt sheet damaged, notes combined.
export const unsplitInstanceAccessory = db.transaction((instanceId, parentId) => {
  const row = getInstanceFigure.get(instanceId);
  if (!row || !isSplitStmt.get(instanceId, parentId)) return false;
  const children = splitChildrenStmt.all(parentId).map((c) => c.id);
  const counts = children.map((c) => unitsOf(instanceId, c));
  if (counts.some((n) => n !== counts[0])) return false;
  const dmgByChild = children.map((c) => instanceDamageRowsStmt.all(instanceId, c));
  const damagedSheets = Math.max(0, ...dmgByChild.map((r) => r.length));
  // sheet row first — instance_accessory_damage references it
  setUnits(instanceId, parentId, unitsOf(instanceId, parentId) + counts[0]);
  for (let k = 0; k < damagedSheets; k++) {
    const notes = [...new Set(dmgByChild.map((r) => r[k] && r[k].notes).filter(Boolean))].join('; ');
    insertInstanceDamage.run(instanceId, parentId, notes || null);
  }
  for (const rows of dmgByChild) for (const d of rows) deleteInstanceDamageRow.run(d.id);
  for (const c of children) setUnits(instanceId, c, 0);
  db.prepare('DELETE FROM instance_accessory_splits WHERE instance_id = ? AND accessory_id = ?').run(instanceId, parentId);
  return true;
});

// Parts Bin: cut one loose sheet into its pieces. Clean stock first; if only
// damaged sheets are left, that unit's note follows onto each piece.
export const splitBinPart = db.transaction((parentId) => {
  const row = getBinRow.get(parentId);
  const children = splitChildrenStmt.all(parentId).map((c) => c.id);
  if (!row || row.quantity_owned <= 0 || !children.length) return false;
  const damaged = countBinDamage.get(parentId).n >= row.quantity_owned;
  let note = null;
  if (damaged) {
    const leaving = oldestBinDamageRow.get(parentId);
    note = leaving.notes;
    deleteBinDamageRow.run(leaving.id);
  }
  adjustPart(parentId, -1);
  for (const c of children) {
    upsertBin.run(c, 1, null);
    if (damaged) insertBinDamage.run(c, note);
  }
  return true;
});

// Trades a damaged unit on an instance for a clean one from the bin. A
// symmetric swap, not a quantity change: the instance's units_owned and the
// bin's quantity_owned are untouched — only which unit is flagged damaged
// moves. The damaged unit physically leaves the instance for the bin, so its
// row (and note) re-targets there rather than being dropped and recreated
// blank. Fails if the instance has no damaged unit of this accessory, or the
// bin has no clean stock to trade for.
export const swapAccessoryForClean = db.transaction((instanceId, name) => {
  const row = getInstanceFigure.get(instanceId);
  if (!row) return false;
  const accId = accessoryIdForName(row.figure_id, name);
  if (!accId) return false;

  const instDamagedCount = countInstanceDamage.get(instanceId, accId).n;
  if (instDamagedCount <= 0) return false;

  const binRow = getBinRow.get(accId);
  const binDamagedCount = countBinDamage.get(accId).n;
  const cleanInBin = binRow ? binRow.quantity_owned - binDamagedCount : 0;
  if (cleanInBin <= 0) return false;

  const leaving = oldestInstanceDamageRow.get(instanceId, accId);
  deleteInstanceDamageRow.run(leaving.id);
  insertBinDamage.run(accId, leaving.notes);
  return true;
});

// Moves 1 unit of an accessory off an instance and into the Parts Bin —
// the "nowhere left to move it to" complement to moveInstanceAccessory
// (copy → copy). Prefers taking a damaged unit (its row, note included,
// re-targets into the bin) over a clean one — the opposite preference from
// moveInstanceAccessory/pullPart — because the primary reason to swap an
// accessory out this way is that it's damaged.
export const swapAccessoryToBin = db.transaction((instanceId, name) => {
  const row = getInstanceFigure.get(instanceId);
  if (!row) return false;
  const accId = accessoryIdForName(row.figure_id, name);
  if (!accId) return false;

  const src = db.prepare('SELECT units_owned FROM instance_accessories WHERE instance_id = ? AND accessory_id = ?').get(instanceId, accId);
  if (!src || src.units_owned <= 0) return false;

  const instDamagedCount = countInstanceDamage.get(instanceId, accId).n;
  const movingDamaged = instDamagedCount > 0;
  let carriedNotes = null;
  if (movingDamaged) {
    const leaving = oldestInstanceDamageRow.get(instanceId, accId);
    deleteInstanceDamageRow.run(leaving.id);
    carriedNotes = leaving.notes;
  }
  upsertInstanceAcc.run(instanceId, accId, src.units_owned - 1);

  upsertBin.run(accId, 1, null);
  if (movingDamaged) insertBinDamage.run(accId, carriedNotes);
  return true;
});

const getInstanceFigureAndVariant = db.prepare('SELECT figure_id, variant_id FROM instances WHERE id = ?');
const getFigureAccessoryVariant = db.prepare('SELECT variant_id, quantity_required FROM figure_accessories WHERE figure_id = ? AND accessory_id = ?');
const oldestInstanceDamageRowsToMove = db.prepare(`
  SELECT id FROM instance_accessory_damage WHERE instance_id = ? AND accessory_id = ? ORDER BY id ASC LIMIT ?
`);
const retargetInstanceDamage = db.prepare('UPDATE instance_accessory_damage SET instance_id = ? WHERE id = ?');

// Moves `count` units of an accessory from one owned copy to another (e.g.
// give spare missiles from a beat-up copy to a mint one the owner wants
// complete instead) — the manual counterpart to the ⚖ rebalance engine,
// which only optimizes for whole-copy count and knows nothing about
// condition. Prefers moving clean units first; only reaches into damaged
// stock once the source's clean units run out, in which case those units'
// own rows re-target onto the destination — each keeps its own distinct
// note (migration 021; the old scalar-column version had to merge multiple
// units' notes into one string here, since it had nowhere else to put them).
// Rejects moves across different figures, moves for more units than the
// source owns, onto a copy of the wrong production variant for a
// variant-scoped accessory (see ACCESSORY_GROUPS.md "variant_id"), or onto a
// destination that already holds its full blueprint quantity for this
// accessory — the UI's moveTargetsFor() already hides a full destination as
// a target, this is the belt-and-suspenders check so the API can't be used
// to silently over-fill one copy (e.g. 2/1) while starving another (0/1).
export const moveInstanceAccessory = db.transaction((fromInstanceId, toInstanceId, name, count = 1) => {
  if (!(count >= 1)) return false;
  const from = getInstanceFigureAndVariant.get(fromInstanceId);
  const to = getInstanceFigureAndVariant.get(toInstanceId);
  if (!from || !to || from.figure_id !== to.figure_id) return false;

  const accId = accessoryIdForName(from.figure_id, name);
  if (!accId) return false;

  const scoped = getFigureAccessoryVariant.get(from.figure_id, accId);
  if (scoped && scoped.variant_id != null && scoped.variant_id !== to.variant_id) return false;

  const src = db.prepare('SELECT units_owned FROM instance_accessories WHERE instance_id = ? AND accessory_id = ?').get(fromInstanceId, accId);
  if (!src || src.units_owned < count) return false;

  const req = (scoped && scoped.quantity_required) || 1;
  const dstBefore = db.prepare('SELECT units_owned FROM instance_accessories WHERE instance_id = ? AND accessory_id = ?').get(toInstanceId, accId);
  const dstOwnedNow = (dstBefore && dstBefore.units_owned) || 0;
  if (dstOwnedNow + count > req) return false;

  const srcDamagedCount = countInstanceDamage.get(fromInstanceId, accId).n;
  const clean = src.units_owned - srcDamagedCount;
  const movingDamagedN = Math.max(0, count - clean);

  upsertInstanceAcc.run(fromInstanceId, accId, src.units_owned - count);
  // Destination row must exist before damage rows re-target onto it — the FK
  // is on (instance_id, accessory_id), validated against instance_accessories.
  upsertInstanceAcc.run(toInstanceId, accId, dstOwnedNow + count);

  if (movingDamagedN > 0) {
    const moving = oldestInstanceDamageRowsToMove.all(fromInstanceId, accId, movingDamagedN);
    for (const r of moving) retargetInstanceDamage.run(toInstanceId, r.id);
  }
  return true;
});

export function clearAll() {
  db.exec('DELETE FROM instances; DELETE FROM accessory_inventory; DELETE FROM bin_damage;');
}
