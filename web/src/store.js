// store.js — REAL data layer for the working app.
// Backed by the local Express/SQLite API (server/) instead of localStorage or the
// static catalog-data.js (17a). Deliberately uses SYNCHRONOUS XHR: this is a
// personal, single-user, localhost-only tool, so a same-machine round trip is
// effectively instant, and keeping every JoeStore call synchronous means
// app-inventory.jsx / app-add-figure.jsx / app-detail.jsx need zero changes —
// they still just call JoeStore.* and read the result immediately.
//
// Instance shape (one owned physical copy) — unchanged from before:
//   { id, catalogId, variant, coo, moc, acc:{[name]:units}, accDamage:{[name]:units},
//     phys, paint, marks:{gender,condition,paint}, filecard:{onFile,printing},
//     loc, notes, masterCollection, addedAt }
//   masterCollection: true = this copy is starred as a Master Collection keeper
//   (migration 009) — counts toward its figure/variant's target quantity. Free
//   to set regardless of completeness/file-card status, not a gate.
//   accDamage: how many of acc[name]'s owned units are damaged (<= acc[name]).
//   A condition notation, not a completeness input — see accDamagePct().
//   variant: '' (single-variant figure) | 'A'|'B'… (a production variant)
//   coo: '' (unset) | 'China'|'Hong Kong'|'Indonesia' — country of origin, a
//   notation like filecard, not a completeness input (see catalog `coo[]`).
//   moc: true = Mint-on-Card (sealed) — counts 100% complete regardless of acc
//   phys/paint: grade string ('Mint'…'Poor') or null when ungraded — derived live
//   from `marks` (not stored), same as the DB's own damage JSON design.
import { physicalGrade, paintGrade } from './damage-map.jsx';
import {
  clusterBlueprint, matchedSetSatisfied, bpReq, instOwn, instPct, instWhole,
  groupLabel, optLabel, accDamagePct, missingList, bpForVariant,
} from '../../shared/completeness.js';

function api(method, url, body) {
  const xhr = new XMLHttpRequest();
  xhr.open(method, url, false); // synchronous — see file header
  if (body !== undefined) xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(body !== undefined ? JSON.stringify(body) : null);
  if (xhr.status >= 200 && xhr.status < 300) {
    return xhr.responseText ? JSON.parse(xhr.responseText) : null;
  }
  console.error('API error', method, url, xhr.status, xhr.responseText);
  return null;
}

// ---- catalog (was catalog-data.js) ----
const CAT = api('GET', '/api/catalog') || [];
const CAT_BY_ID = new Map(CAT.map(f => [f.id, f]));

// Figure sets (migration 015) — a set's other members aren't on the current
// figure's own catalog row, so this is a reverse index (setId -> members),
// built once from every figure's own sets[] array, not a per-figure lookup
// like variants/coo/fileCards.
const SET_MEMBERS = new Map(); // setId -> [{figureId, quantityRequired}]
// Global set metadata (name/year/description), deduped across every figure's own
// sets[] entries — no separate API endpoint needed, every set has at least one
// member figure carrying its own metadata already.
const ALL_SETS = new Map(); // setId -> {setId, name, year, description}
CAT.forEach(fig => (fig.sets || []).forEach(s => {
  if (!SET_MEMBERS.has(s.setId)) SET_MEMBERS.set(s.setId, []);
  SET_MEMBERS.get(s.setId).push({ figureId: fig.id, quantityRequired: s.quantityRequired });
  if (!ALL_SETS.has(s.setId)) ALL_SETS.set(s.setId, { setId: s.setId, name: s.name, year: s.year, description: s.description });
}));

// ---- accessory catalog (Parts Bin: category + shared-vs-single-use + home figure) ----
const ACC = api('GET', '/api/accessories') || [];
const ACC_BY_ID = new Map(ACC.map(a => [a.id, a]));

// ---- completeness math ----
// Moved to shared/completeness.js (2026-07-11) so the server-side Excel export
// can reuse the exact same logic instead of reimplementing it — see that file
// for the group_id/match_key/release_context rules.

// ---- live state, loaded from the db ----
let state = api('GET', '/api/state') || { instances: [], bin: [] };
const subs = new Set();
function refresh() { state = api('GET', '/api/state') || state; }
function emit() { subs.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } }); }

// Grades are derived from `marks` at read time. Zero zones reads as "ungraded"
// (not yet mapped) unless the copy carries an explicit marks.clean confirmation.
function gradeOf(inst) {
  if (inst.moc) return { phys: null, paint: null };
  const p = physicalGrade(inst.marks);
  const t = paintGrade(inst.marks);
  const clean = !!(inst.marks && inst.marks.clean);
  const ungraded = (p.zones + t.zones) === 0 && !clean;
  return { phys: ungraded ? null : p.grade, paint: ungraded ? null : t.grade };
}

// ---- derived views ----
function instancesOf(catalogId) { return state.instances.filter(i => i.catalogId === catalogId); }
function ownedCount(catalogId, variant) {
  return state.instances.filter(i => i.catalogId === catalogId && (variant == null || i.variant === variant)).length;
}
// per-figure summary used by the inventory rows
function figureSummary(catalogId) {
  const fig = CAT_BY_ID.get(catalogId); if (!fig) return null;
  const insts = instancesOf(catalogId);
  const bp = fig.blueprint || [];
  const copies = insts.map(i => {
    const acc = i.acc || {}, moc = !!i.moc;
    // A copy's own production variant only owes the accessories scoped to it
    // (e.g. Blocker v1 B's Visor doesn't apply to a v1 A copy) — see
    // bpForVariant (shared/completeness.js) and ACCESSORY_GROUPS.md "variant_id".
    const bpv = bpForVariant(bp, i.variant);
    const req = bpReq(bpv);
    // The file card does NOT gate completeness — it's a separate notation.
    // (A sealed/MOC copy carries its card on the backer, so it reads as on file.)
    const card = moc || !!(i.filecard && i.filecard.onFile);
    const { phys, paint } = gradeOf(i);
    return {
      id: i.id, variant: i.variant, coo: i.coo, loc: i.loc, notes: i.notes, moc,
      phys, paint, acc, cardOnFile: card, masterCollection: !!i.masterCollection,
      own: moc ? req : instOwn(bpv, acc), req,
      pct: moc ? 100 : instPct(bpv, acc), whole: moc ? true : instWhole(bpv, acc),
      missing: moc ? [] : missingList(bpv, acc),
    };
  });
  // best copy first
  copies.sort((a, b) => (b.whole - a.whole) || (b.pct - a.pct));
  copies.forEach((c, idx) => { c.no = idx + 1; });
  const whole = copies.filter(c => c.whole).length;
  return { fig, owned: copies.length, whole, copies, bestPct: copies.length ? copies[0].pct : 0, req: bpReq(bp) };
}
function totals() {
  const owned = new Set(state.instances.map(i => i.catalogId));
  let complete = 0;
  owned.forEach(id => { const s = figureSummary(id); if (s && s.whole > 0) complete++; });
  return { unique: owned.size, instances: state.instances.length, complete };
}
// Master Collection aggregate (migration 009) — walks every figure/variant
// slot in the catalog (not just owned ones, since target defaults to 1
// everywhere) tallying starred copies against target. metSum/targetSum caps
// each slot's contribution at its target, so over-starring past a troop-
// builder's target doesn't inflate the overall completion fraction.
function masterTotals() {
  let figuresIn = 0, starredCopies = 0, targetSum = 0, metSum = 0;
  CAT.forEach((fig) => {
    const copies = instancesOf(fig.id);
    if (copies.some((c) => c.masterCollection)) figuresIn++;
    (fig.variants || []).forEach((v) => {
      const letter = v.letter || '';
      const count = copies.filter((c) => (c.variant || '') === letter && c.masterCollection).length;
      const target = v.masterTarget || 0;
      targetSum += target;
      metSum += Math.min(count, target);
      starredCopies += count;
    });
  });
  return { figuresIn, starredCopies, targetSum, metSum };
}
// Per-set progress (migration 016) — same "cap each member's contribution at
// its own required quantity" idiom as masterTotals(), but counts only
// instances explicitly tagged to this set (instances.set_id), not just any
// owned copy of the member figure — v1 used a blanket ownedCount() here,
// which couldn't tell which specific copies actually came from the pack.
function ownedCountInSet(figureId, setId) {
  return state.instances.filter(i => i.catalogId === figureId && i.setId === setId).length;
}
function setProgress(setId) {
  const members = SET_MEMBERS.get(setId) || [];
  let required = 0, owned = 0;
  members.forEach(m => { required += m.quantityRequired; owned += Math.min(ownedCountInSet(m.figureId, setId), m.quantityRequired); });
  return { owned, required, complete: required > 0 && owned >= required };
}
// Per-member slot list for the Set Card — each member figure's slots array is
// length quantityRequired, each entry either a real tagged instance or null
// (empty slot, not yet owned/tagged). Sorted by instance id so over-tagging
// (more instances tagged than required) is a deterministic "first-tagged
// wins the slot" instead of reordering on every render.
function setSlots(setId) {
  const members = SET_MEMBERS.get(setId) || [];
  return members.map(m => {
    const fig = CAT_BY_ID.get(m.figureId);
    const tagged = state.instances.filter(i => i.catalogId === m.figureId && i.setId === setId)
      .sort((a, b) => a.id - b.id);
    const slots = Array.from({ length: m.quantityRequired }, (_, i) => tagged[i] || null);
    return { figureId: m.figureId, name: fig ? fig.name : '?', version: fig ? fig.ver : null, slots };
  });
}

export const JoeStore = {
    get: () => state,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    addInstance(inst) {
      api('POST', '/api/instances', inst);
      refresh(); emit();
    },
    updateInstance(id, patch) {
      api('PATCH', '/api/instances/' + id, patch);
      refresh(); emit();
    },
    setAcc(id, name, units) {
      api('PATCH', '/api/instances/' + id + '/accessory', { name, units });
      refresh(); emit();
    },
    setAccDamage(id, name, units) {
      api('PATCH', '/api/instances/' + id + '/accessory-damage', { name, units });
      refresh(); emit();
    },
    setAccDamageNotes(id, name, notes) {
      api('PATCH', '/api/instances/' + id + '/accessory-damage-notes', { name, notes });
      refresh(); emit();
    },
    // trades a damaged unit on this instance for a clean one from the Parts Bin
    swapAccessoryForClean(id, name) {
      api('POST', '/api/instances/' + id + '/accessory/swap-clean', { name });
      refresh(); emit();
    },
    removeInstance(id) {
      api('DELETE', '/api/instances/' + id);
      refresh(); emit();
    },
    // Master Collection target quantities (migration 009) — id is either a
    // figures.id (single-variant figure) or a variant_lookup.id (a specific
    // production variant); see catalog `variants[].id` (null = figure-level).
    // The catalog (CAT/CAT_BY_ID) is otherwise pure read-only reference data
    // fetched once at load, so unlike updateInstance there's no /api/catalog
    // refetch to reflect this write — instead patch the cached figure object
    // in place (same references app-detail.jsx's INV_CAT_BY_ID holds) so the
    // change shows up on the next render without a full page reload.
    setFigureMasterTarget(id, target) {
      api('PATCH', '/api/figures/' + id, { masterTarget: target });
      const fig = CAT_BY_ID.get(id);
      if (fig) {
        fig.masterTarget = target;
        const placeholder = (fig.variants || []).find(v => v.id == null);
        if (placeholder) placeholder.masterTarget = target;
      }
      emit();
    },
    setVariantMasterTarget(id, target) {
      api('PATCH', '/api/variants/' + id, { masterTarget: target });
      for (const fig of CAT) {
        const v = (fig.variants || []).find(v => v.id === id);
        if (v) { v.masterTarget = target; break; }
      }
      emit();
    },
    // Master Collection note (migration 013) — figure-level free text (e.g.
    // "yellowing, look for upgrade"), shown in the Master Collection card
    // header. Same fetch-once-catalog-cache patch as setFigureMasterTarget.
    setFigureMasterNotes(id, notes) {
      api('PATCH', '/api/figures/' + id, { masterNotes: notes });
      const fig = CAT_BY_ID.get(id);
      if (fig) fig.masterNotes = notes;
      emit();
    },

    // ---- Parts Bin: loose accessories (global stock — see server/instances.js) ----
    // entry: { id, catalogId, accessory, qty, notes, addedAt }
    binEntries() { return state.bin; },
    addPart({ catalogId, accessory, qty = 1, notes = '' }) {
      api('POST', '/api/parts-bin', { catalogId, accessory, qty, notes });
      refresh(); emit();
    },
    adjustPart(id, delta) {
      api('PATCH', '/api/parts-bin/' + id, { delta });
      refresh(); emit();
    },
    setPartDamage(id, units) {
      api('PATCH', '/api/parts-bin/' + id + '/damage', { units });
      refresh(); emit();
    },
    setPartDamageNotes(id, notes) {
      api('PATCH', '/api/parts-bin/' + id + '/damage-notes', { notes });
      refresh(); emit();
    },
    removePart(id) {
      api('DELETE', '/api/parts-bin/' + id);
      refresh(); emit();
    },
    // pull one loose unit onto an owned instance's accessory checklist (two-way A)
    pullPart(partId, instanceId, accessory) {
      api('POST', '/api/parts-bin/' + partId + '/pull', { instanceId, accessory });
      refresh(); emit();
    },
    // deposit accessories into the bin (two-way B — kept parts from a removed copy)
    depositParts(catalogId, parts) { // parts: [{accessory, qty}]
      api('POST', '/api/parts-bin/deposit', { catalogId, parts });
      refresh(); emit();
    },
    clearAll() {
      api('POST', '/api/clear');
      refresh(); emit();
    },
    exportJSON() { return JSON.stringify(state, null, 2); },
    importJSON(text) {
      try {
        const o = JSON.parse(text);
        if (o && Array.isArray(o.instances)) {
          if (!Array.isArray(o.bin)) o.bin = [];
          api('POST', '/api/import', o);
          refresh(); emit();
          return true;
        }
      } catch (e) {}
      return false;
    },
  };
export const JoeData = { CAT, CAT_BY_ID, ACC, ACC_BY_ID, bpReq, instOwn, instPct, instWhole, accDamagePct, clusterBlueprint, bpForVariant, groupLabel, optLabel, instancesOf, ownedCount, figureSummary, totals, masterTotals, setProgress, setSlots, ALL_SETS };
