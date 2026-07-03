// store.js — REAL data layer for the working app.
// Backed by the local Express/SQLite API (server/) instead of localStorage or the
// static catalog-data.js (17a). Deliberately uses SYNCHRONOUS XHR: this is a
// personal, single-user, localhost-only tool, so a same-machine round trip is
// effectively instant, and keeping every JoeStore call synchronous means
// app-inventory.jsx / app-add-figure.jsx / app-detail.jsx need zero changes —
// they still just call JoeStore.* and read the result immediately.
//
// Instance shape (one owned physical copy) — unchanged from before:
//   { id, catalogId, variant, moc, acc:{[name]:units}, accDamage:{[name]:units},
//     phys, paint, marks:{gender,condition,paint}, filecard:{onFile,printing},
//     loc, notes, addedAt }
//   accDamage: how many of acc[name]'s owned units are damaged (<= acc[name]).
//   A condition notation, not a completeness input — see accDamagePct().
//   variant: '' (single-variant figure) | 'A'|'B'… (a production variant)
//   moc: true = Mint-on-Card (sealed) — counts 100% complete regardless of acc
//   phys/paint: grade string ('Mint'…'Poor') or null when ungraded — derived live
//   from `marks` (not stored), same as the DB's own damage JSON design.
import { physicalGrade, paintGrade } from './damage-map.jsx';

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

// ---- accessory catalog (Parts Bin: category + shared-vs-single-use + home figure) ----
const ACC = api('GET', '/api/accessories') || [];
const ACC_BY_ID = new Map(ACC.map(a => [a.id, a]));

// ---- completeness math ----
// Blueprint items are [name, quantity_required, accessory_id, group_id, release_context, match_key].
// Three axes restructure the flat list (see PARTS_BIN.md "Accessory completeness model" + match_key.md):
//   group_id    — interchangeable variants ("own any one" satisfies the slot)
//   match_key   — when 2+ group_id slots have members sharing a match_key, those
//                 slots must resolve to the SAME key together (e.g. Firefly's
//                 light-green gun only counts alongside the light-green radio)
//   release_context — only 'retail' counts toward completion; convention/mail_in/
//                      bonus items are tracked but never block Complete
function clusterBlueprint(bp) {
  const retail = (bp || []).filter((a) => !a[4] || a[4] === 'retail');
  const groupMap = new Map(); // group_id -> items[]
  const solo = [];
  for (const a of retail) {
    if (a[3] != null) {
      if (!groupMap.has(a[3])) groupMap.set(a[3], []);
      groupMap.get(a[3]).push(a);
    } else solo.push(a);
  }
  const groups = [...groupMap.values()];
  const matched = groups.filter((members) => members.some((m) => m[5] != null));
  const plain = groups.filter((members) => !members.some((m) => m[5] != null));
  return { solo, groups, matched, plain };
}
// Is there one match_key value K such that every matched slot's K-tagged member is owned?
function matchedSetSatisfied(matched, acc) {
  if (matched.length === 0) return true;
  const keys = new Set();
  matched.forEach((members) => members.forEach((m) => { if (m[5] != null) keys.add(m[5]); }));
  for (const k of keys) {
    if (matched.every((members) => members.some((m) => m[5] === k && (acc[m[0]] || 0) > 0))) return true;
  }
  return false;
}
function bpReq(bp) {
  const { solo, plain, matched } = clusterBlueprint(bp);
  return solo.reduce((s, a) => s + a[1], 0) + plain.length + (matched.length > 0 ? 1 : 0);
}
function instOwn(bp, acc) {
  const { solo, plain, matched } = clusterBlueprint(bp);
  const soloOwn = solo.reduce((s, [n, q]) => s + Math.min(acc[n] || 0, q), 0);
  const plainOwn = plain.reduce((s, members) => s + (members.some(([n]) => (acc[n] || 0) > 0) ? 1 : 0), 0);
  return soloOwn + plainOwn + (matched.length > 0 && matchedSetSatisfied(matched, acc) ? 1 : 0);
}
function instPct(bp, acc) { const r = bpReq(bp); return r ? Math.round(instOwn(bp, acc) / r * 100) : 100; }
function instWhole(bp, acc) {
  const { solo, plain, matched } = clusterBlueprint(bp);
  return solo.every(([n, q]) => (acc[n] || 0) >= q)
    && plain.every((members) => members.some(([n]) => (acc[n] || 0) > 0))
    && matchedSetSatisfied(matched, acc);
}
// Shared label rule (matches the locked reference subgroup-wire-v2.jsx):
// text before the first "(" is the slot label, text inside "(...)" is the option label.
function groupLabel(items) { const m = items[0][0].match(/^(.*?)\s*\(/); return m ? m[1].trim() : items[0][0]; }
function optLabel(name) { const m = name.match(/\(([^)]+)\)/); return m ? m[1] : name; }
// Damaged share across the FULL blueprint (retail + group + non-retail alike) —
// condition is orthogonal to what counts toward Complete, so it isn't run
// through clusterBlueprint. 0 when nothing's owned yet.
function accDamagePct(bp, acc, accDamage) {
  let owned = 0, damaged = 0;
  (bp || []).forEach(([n]) => { owned += acc[n] || 0; damaged += (accDamage && accDamage[n]) || 0; });
  return owned ? damaged / owned : 0;
}
function missingList(bp, acc) {
  const { solo, plain, matched } = clusterBlueprint(bp);
  const soloMissing = solo.filter(([n, q]) => (acc[n] || 0) < q).map(([n, q]) => q > 1 ? `${n} ${acc[n] || 0}/${q}` : n);
  const plainMissing = plain.filter((members) => !members.some(([n]) => (acc[n] || 0) > 0))
    .map((members) => members.map((m) => optLabel(m[0])).join(' or '));
  const matchedMissing = (matched.length > 0 && !matchedSetSatisfied(matched, acc))
    ? [matched.map((members) => groupLabel(members)).join(' & ') + ' (matching color)']
    : [];
  return [...soloMissing, ...plainMissing, ...matchedMissing];
}

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
    const acc = i.acc || {}, moc = !!i.moc, req = bpReq(bp);
    // The file card does NOT gate completeness — it's a separate notation.
    // (A sealed/MOC copy carries its card on the backer, so it reads as on file.)
    const card = moc || !!(i.filecard && i.filecard.onFile);
    const { phys, paint } = gradeOf(i);
    return {
      id: i.id, variant: i.variant, loc: i.loc, notes: i.notes, moc,
      phys, paint, acc, cardOnFile: card,
      own: moc ? req : instOwn(bp, acc), req,
      pct: moc ? 100 : instPct(bp, acc), whole: moc ? true : instWhole(bp, acc),
      missing: moc ? [] : missingList(bp, acc),
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
    removeInstance(id) {
      api('DELETE', '/api/instances/' + id);
      refresh(); emit();
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
export const JoeData = { CAT, CAT_BY_ID, ACC, ACC_BY_ID, bpReq, instOwn, instPct, instWhole, accDamagePct, clusterBlueprint, groupLabel, optLabel, instancesOf, ownedCount, figureSummary, totals };
