// store.js — REAL data layer for the working app. Plain JS (loads before Babel).
// Owned inventory lives here, persisted to localStorage. The catalog
// (catalog-data.js → window.JOE_CATALOG) is reference data and is never mutated.
//
// Instance shape (one owned physical copy):
//   { id, catalogId, variant, moc, acc:{[name]:units}, phys, paint,
//     marks:{physMarks,paintMarks,body,side}, filecard:{onFile,printing}, loc, notes, addedAt }
//   variant: '' (single-variant figure) | 'A'|'B'… (a production variant)
//   moc: true = Mint-on-Card (sealed) — counts 100% complete regardless of acc
//   phys/paint: grade string ('Mint'…'Poor') or null when ungraded
(function () {
  const KEY = 'gi_joe_collection_v1';

  // ---- catalog index (built once) ----
  const CAT = window.JOE_CATALOG || [];
  const CAT_BY_ID = new Map(CAT.map(f => [f.id, f]));

  // ---- completeness math (real model) ----
  function bpReq(bp) { return (bp || []).reduce((s, a) => s + a[1], 0); }
  function instOwn(bp, acc) { return (bp || []).reduce((s, [n, q]) => s + Math.min(acc[n] || 0, q), 0); }
  function instPct(bp, acc) { const r = bpReq(bp); return r ? Math.round(instOwn(bp, acc) / r * 100) : 100; }
  function instWhole(bp, acc) { return (bp || []).every(([n, q]) => (acc[n] || 0) >= q); }

  // ---- persistence ----
  function load() {
    try { const o = JSON.parse(localStorage.getItem(KEY)); if (o && Array.isArray(o.instances)) { if (!Array.isArray(o.bin)) o.bin = []; return o; } } catch (e) {}
    return { instances: [], bin: [] };
  }
  let state = load();
  const subs = new Set();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function emit() { save(); subs.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } }); }
  const uid = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

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
      return {
        id: i.id, variant: i.variant, loc: i.loc, notes: i.notes, moc,
        phys: i.phys, paint: i.paint, acc, cardOnFile: card,
        own: moc ? req : instOwn(bp, acc), req,
        pct: moc ? 100 : instPct(bp, acc), whole: moc ? true : instWhole(bp, acc),
        missing: moc ? [] : bp.filter(([n, q]) => (acc[n] || 0) < q).map(([n, q]) => q > 1 ? `${n} ${acc[n] || 0}/${q}` : n),
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

  window.JoeStore = {
    get: () => state,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    addInstance(inst) {
      state.instances.push(Object.assign({ id: uid(), addedAt: Date.now(), acc: {}, variant: '' }, inst));
      emit();
    },
    updateInstance(id, patch) { const i = state.instances.find(x => x.id === id); if (i) Object.assign(i, patch); emit(); },
    setAcc(id, name, units) {
      const i = state.instances.find(x => x.id === id); if (!i) return;
      i.acc = Object.assign({}, i.acc, { [name]: units }); emit();
    },
    removeInstance(id) { state.instances = state.instances.filter(x => x.id !== id); emit(); },

    // ---- Parts Bin: loose accessories, each scoped to a catalog figure ----
    // entry: { id, catalogId, accessory, qty, notes, addedAt }
    binEntries() { return state.bin; },
    addPart({ catalogId, accessory, qty = 1, notes = '' }) {
      const e = state.bin.find(x => x.catalogId === catalogId && x.accessory === accessory);
      if (e) { e.qty += qty; if (notes) e.notes = notes; }
      else state.bin.push({ id: uid(), catalogId, accessory, qty, notes, addedAt: Date.now() });
      emit();
    },
    adjustPart(id, delta) {
      const e = state.bin.find(x => x.id === id); if (!e) return;
      e.qty += delta; if (e.qty <= 0) state.bin = state.bin.filter(x => x.id !== id);
      emit();
    },
    removePart(id) { state.bin = state.bin.filter(x => x.id !== id); emit(); },
    // pull one loose unit onto an owned instance's accessory checklist (two-way A)
    pullPart(partId, instanceId, accessory) {
      const e = state.bin.find(x => x.id === partId);
      const inst = state.instances.find(x => x.id === instanceId);
      if (!e || !inst) return;
      const fig = CAT_BY_ID.get(inst.catalogId); const bp = fig && fig.blueprint || [];
      const req = (bp.find(a => a[0] === accessory) || [])[1] || 1;
      const cur = (inst.acc && inst.acc[accessory]) || 0;
      if (cur >= req) return;
      inst.acc = Object.assign({}, inst.acc, { [accessory]: cur + 1 });
      e.qty -= 1; if (e.qty <= 0) state.bin = state.bin.filter(x => x.id !== partId);
      emit();
    },
    // deposit accessories into the bin (two-way B — kept parts from a removed copy)
    depositParts(catalogId, parts) { // parts: [{accessory, qty}]
      parts.forEach(({ accessory, qty }) => {
        if (!qty) return;
        const e = state.bin.find(x => x.catalogId === catalogId && x.accessory === accessory);
        if (e) e.qty += qty; else state.bin.push({ id: uid(), catalogId, accessory, qty, notes: '', addedAt: Date.now() });
      });
      emit();
    },
    clearAll() { state = { instances: [], bin: [] }; emit(); },
    exportJSON() { return JSON.stringify(state, null, 2); },
    importJSON(text) { try { const o = JSON.parse(text); if (o && Array.isArray(o.instances)) { if (!Array.isArray(o.bin)) o.bin = []; state = o; emit(); return true; } } catch (e) {} return false; },
  };
  window.JoeData = { CAT, CAT_BY_ID, bpReq, instOwn, instPct, instWhole, instancesOf, ownedCount, figureSummary, totals };
})();
