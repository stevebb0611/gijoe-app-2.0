// store.js — REAL data layer for the working app. Plain JS (loads before Babel).
// Backed by the local Express/SQLite API (server/) instead of localStorage or the
// static catalog-data.js (17a). Deliberately uses SYNCHRONOUS XHR: this is a
// personal, single-user, localhost-only tool, so a same-machine round trip is
// effectively instant, and keeping every JoeStore call synchronous means
// app-inventory.jsx / app-add-figure.jsx / app-detail.jsx need zero changes —
// they still just call window.JoeStore.* and read the result immediately.
//
// Instance shape (one owned physical copy) — unchanged from before:
//   { id, catalogId, variant, moc, acc:{[name]:units}, phys, paint,
//     marks:{gender,condition,paint}, filecard:{onFile,printing}, loc, notes, addedAt }
//   variant: '' (single-variant figure) | 'A'|'B'… (a production variant)
//   moc: true = Mint-on-Card (sealed) — counts 100% complete regardless of acc
//   phys/paint: grade string ('Mint'…'Poor') or null when ungraded — derived live
//   from `marks` (not stored), same as the DB's own damage JSON design.
(function () {
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
  window.JOE_CATALOG = CAT;
  const CAT_BY_ID = new Map(CAT.map(f => [f.id, f]));

  // ---- completeness math (unchanged) ----
  function bpReq(bp) { return (bp || []).reduce((s, a) => s + a[1], 0); }
  function instOwn(bp, acc) { return (bp || []).reduce((s, [n, q]) => s + Math.min(acc[n] || 0, q), 0); }
  function instPct(bp, acc) { const r = bpReq(bp); return r ? Math.round(instOwn(bp, acc) / r * 100) : 100; }
  function instWhole(bp, acc) { return (bp || []).every(([n, q]) => (acc[n] || 0) >= q); }

  // ---- live state, loaded from the db ----
  let state = api('GET', '/api/state') || { instances: [], bin: [] };
  const subs = new Set();
  function refresh() { state = api('GET', '/api/state') || state; }
  function emit() { subs.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } }); }

  // Grades are derived from `marks` at read time (damage-map.jsx loads after this
  // file, but this only runs later, well after mount — see window.physicalGrade).
  function gradeOf(inst) {
    if (inst.moc) return { phys: null, paint: null };
    const p = window.physicalGrade(inst.marks);
    const t = window.paintGrade(inst.marks);
    const ungraded = (p.zones + t.zones) === 0;
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
  window.JoeData = { CAT, CAT_BY_ID, bpReq, instOwn, instPct, instWhole, instancesOf, ownedCount, figureSummary, totals };
})();
