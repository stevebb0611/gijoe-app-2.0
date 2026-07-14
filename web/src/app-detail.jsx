// app-detail.jsx — adapter (catalog ⋈ live store) + shared widgets + the
// flip-card detail modal (FIGURE front / CONDITION back), all wired to JoeStore
// so every tick, grade, MOC flag, note, file-card and rebalance PERSISTS.
import React from 'react';
import { JoeStore, JoeData } from './store.js';
import { clusterBlueprint, matchedSetSatisfied, bpReq, bpForVariant } from '../../shared/completeness.js';
import { physicalGrade, paintGrade, dmEmpty, DamageMap, GradeBadge } from './damage-map.jsx';
import { AccessoryList, orderedBlueprint } from './accessory-groups.jsx';
import { AccSwatch } from './acc-colors.jsx';
import { VersionChip, VariantBadge, VehicleTag } from './fig-identity.jsx';
import { formatYear } from './fig-identity.js';
import { FileCardRow, FileCardTell } from './filecards.jsx';

const INV_CAT = JoeData.CAT || [];
const INV_ERAS = {}; // was window.JOE_ERAS from the retired catalog-data.js — always {}
const INV_CAT_BY_ID = new Map(INV_CAT.map(f => [f.id, f]));

// ---------------------------------------------------------------------------
// View-model: merge a catalog entry with its current ownership.
// Exposes the fields the rich row/card/modal components read.
// ---------------------------------------------------------------------------
function fvm(cf) {
  const sum = JoeData.figureSummary(cf.id);
  const owned = sum ? sum.owned : 0;
  const bp = cf.blueprint || [];
  const agg = {};
  if (sum) sum.copies.forEach(c => { for (const k in c.acc) agg[k] = (agg[k] || 0) + (c.acc[k] || 0); });
  // acc = [name, required, owned-capped-at-required] (the best achievable copy)
  const acc = bp.map(([n, q]) => [n, q, Math.min(agg[n] || 0, q)]);
  return {
    id: cf.id, name: cf.name, year: cf.year, faction: cf.faction,
    version: cf.ver ? 'v' + cf.ver : '',
    variants: (cf.variants || []).length,
    coo: cf.coo || [],
    fileCards: cf.fileCards || [],
    specialty: cf.role || '', variant: cf.role || '', vehicle: cf.vehicle || null,
    image: cf.image || null,
    owned, acc, blueprint: bp,
    _cf: cf, _sum: sum,
  };
}

// best single-copy parts (drives single-row bars + ghost need)
function figParts(fig) {
  let req = 0, own = 0;
  fig.acc.forEach(([, r, o]) => { req += r; own += Math.min(o, r); });
  return { req, own, pct: req ? Math.round(own / req * 100) : 100 };
}

// ---- rebalance engine (REAL, against live per-copy data) ----
// Built on the same clusterBlueprint() slots store.js already uses to decide
// what counts as "whole" (shared/completeness.js) — a group_id is "own any one
// member satisfies the slot" and a match_key set is ONE combined requirement
// across 2+ group_id slots. The old version pooled every raw blueprint row
// independently, so a production-variant option nobody owns (e.g. Duke's
// "Helmet (with holes)") zeroed out the whole rebalance calc for that figure —
// see the PartsBin "Rebalance" chip fix, 2026-07-12.
function buildSlots(bp) {
  const { solo, plain, matched } = clusterBlueprint(bp);
  const slots = solo.map(([n, q]) => ({ kind: 'solo', names: [n], qty: q }));
  plain.forEach((members) => slots.push({ kind: 'plain', names: [...new Set(members.map((m) => m[0]))] }));
  if (matched.length) slots.push({ kind: 'matched', groups: matched });
  return slots;
}
function poolOf(names, copies) {
  const pool = {}; names.forEach((n) => { pool[n] = copies.reduce((s, c) => s + (c.acc[n] || 0), 0); });
  return pool;
}
// every match_key value shared across the matched slot's groups, ranked by how
// many copies it could complete (bounded by whichever group has the least of it)
function matchedCapacities(slot, pool) {
  const keys = new Set();
  slot.groups.forEach((g) => g.forEach((m) => { if (m[5] != null) keys.add(m[5]); }));
  const caps = [];
  keys.forEach((k) => {
    let min = Infinity;
    slot.groups.forEach((g) => {
      const have = g.filter((m) => m[5] === k).reduce((s, m) => s + (pool[m[0]] || 0), 0);
      min = Math.min(min, have);
    });
    if (min !== Infinity) caps.push({ key: k, cap: min });
  });
  caps.sort((a, b) => b.cap - a.cap);
  return caps;
}
// how many additional whole copies this one slot alone could supply, capped at `cap`
function slotCapacity(slot, pool, cap) {
  if (slot.kind === 'solo') return Math.min(cap, Math.floor((pool[slot.names[0]] || 0) / slot.qty));
  if (slot.kind === 'plain') return Math.min(cap, slot.names.reduce((s, n) => s + (pool[n] || 0), 0));
  const caps = matchedCapacities(slot, pool);
  return Math.min(cap, caps.length ? caps[0].cap : 0);
}
function slotSatisfiedOnCopy(slot, acc) {
  if (slot.kind === 'solo') return (acc[slot.names[0]] || 0) >= slot.qty;
  if (slot.kind === 'plain') return slot.names.some((n) => (acc[n] || 0) > 0);
  return matchedSetSatisfied(slot.groups, acc);
}
// classic per-name redistribution for a solo slot: the first `maxWhole` copies
// get up to `qty` units each, everyone else donates surplus, any leftover
// conserves onto the last copy.
function applySoloTarget(name, qty, copies, maxWhole, pool, target) {
  let left = pool[name] || 0;
  copies.forEach((c, i) => { const give = i < maxWhole ? Math.min(qty, left) : 0; target[i][name] = give; left -= give; });
  for (let i = maxWhole; i < copies.length && left > 0; i++) { const give = Math.min(qty, left); target[i][name] = (target[i][name] || 0) + give; left -= give; }
  if (left > 0 && copies.length) target[copies.length - 1][name] = (target[copies.length - 1][name] || 0) + left;
}
// "own any one of these names" redistribution: any copy in `receivers` lacking
// a member gets one donated from wherever there's a spare unit. Copies in
// `keepSet` that already have a member keep exactly one; every other copy can
// be stripped bare (it isn't being targeted to end up whole via this slot).
function applyPoolTarget(names, copies, keepSet, receivers, target) {
  copies.forEach((c, i) => names.forEach((n) => { if (target[i][n] == null) target[i][n] = c.acc[n] || 0; }));
  const has = (i) => names.some((n) => target[i][n] > 0);
  const donors = [];
  copies.forEach((c, j) => {
    let keepOne = keepSet.has(j) && has(j);
    names.forEach((n) => {
      let qty = target[j][n];
      while (qty > 0) { if (keepOne) { keepOne = false; qty--; continue; } donors.push({ j, n }); qty--; }
    });
  });
  receivers.forEach((i) => {
    if (has(i)) return;
    const d = donors.shift(); if (!d) return;
    target[d.j][d.n] -= 1; target[i][d.n] = (target[i][d.n] || 0) + 1;
  });
}
function diffMoves(names, copies, target) {
  const moves = [];
  names.forEach((n) => {
    const donors = [], receivers = [];
    copies.forEach((c, i) => {
      const cur = c.acc[n] || 0, tgt = target[i][n] || 0;
      if (cur > tgt) donors.push({ i, qty: cur - tgt });
      else if (tgt > cur) receivers.push({ i, qty: tgt - cur });
    });
    let di = 0;
    receivers.forEach(r => {
      let need = r.qty;
      while (need > 0 && di < donors.length) {
        const d = donors[di]; const take = Math.min(need, d.qty);
        moves.push({ part: n, qty: take, from: copies[d.i].no, to: copies[r.i].no });
        need -= take; d.qty -= take; if (d.qty === 0) di++;
      }
    });
  });
  return moves;
}
function figState(fig) {
  const sum = fig._sum || JoeData.figureSummary(fig.id);
  const bp = fig.blueprint || (fig._cf && fig._cf.blueprint) || [];
  // The rebalance/pooling machinery below assumes every loose copy owes the
  // SAME blueprint — true for group_id/match_key/release_context, but not for
  // a variant-scoped row (ACCESSORY_GROUPS.md "variant_id"): a v1 B-only Visor
  // can't be "moved onto" a v1 A copy, and pooling it in would corrupt the
  // optimal-whole-copy math the same way a shared item across mixed variants
  // would. Simplest correct fix: variant-scoped rows sit out of rebalance
  // entirely (per-copy completeness above still requires/shows them correctly
  // via bpForVariant — this only affects the ⚖ suggestion engine).
  const rebalanceBp = bp.filter((row) => !row[7]);
  const copies = sum ? sum.copies : [];
  const owned = copies.length;
  const reqPer = bpReq(bp);
  const instances = copies.map(c => {
    const bpv = bpForVariant(bp, c.variant);
    return {
      id: c.id, no: c.no, own: c.own, req: c.req, pct: c.pct, whole: c.whole, missing: c.missing, moc: !!c.moc,
      have: c.moc ? bpv.map(([, q]) => q) : bpv.map(([n, q]) => Math.min(c.acc[n] || 0, q)),
    };
  });
  const currentWhole = instances.filter(i => i.whole).length;

  // ---- rebalance runs ONLY over loose (non-MOC) copies — sealed parts can't move,
  // and a MOC copy is already whole. MOC copies still count toward currentWhole above. ----
  const loose = copies.filter(c => !c.moc);
  const mocWhole = owned - loose.length;
  const looseWhole = loose.filter(c => c.whole).length;

  const slots = buildSlots(rebalanceBp);
  const allNames = [...new Set(rebalanceBp.map(([n]) => n))]; // every row, incl. non-retail + unused group members — for pooling + the write-back below
  const pool = poolOf(allNames, loose);
  const optimalLoose = slots.length === 0 ? loose.length
    : (loose.length ? Math.min(loose.length, ...slots.map((s) => slotCapacity(s, pool, loose.length))) : 0);
  const optimalWhole = optimalLoose + mocWhole;

  const target = loose.map(() => ({}));
  if (loose.length) {
    const keep = new Set(); const receivers = [];
    for (let i = 0; i < optimalLoose && i < loose.length; i++) { keep.add(i); receivers.push(i); }
    slots.forEach((s) => {
      if (s.kind === 'solo') applySoloTarget(s.names[0], s.qty, loose, optimalLoose, pool, target);
      else if (s.kind === 'plain') applyPoolTarget(s.names, loose, keep, receivers, target);
      else {
        const best = matchedCapacities(s, pool)[0];
        if (best) s.groups.forEach((g) => {
          const names = g.filter((m) => m[5] === best.key).map((m) => m[0]);
          applyPoolTarget(names, loose, keep, receivers, target);
        });
      }
    });
    // non-retail rows and any group member that wasn't this figure's chosen
    // colorway/variant never move — carry them over untouched so applyRebalance's
    // write-back below doesn't wipe ownership it never meant to touch
    allNames.forEach((n) => loose.forEach((c, i) => { if (target[i][n] == null) target[i][n] = c.acc[n] || 0; }));
  }
  const moves = optimalLoose > looseWhole ? diffMoves(allNames, loose, target) : [];

  // ---- best-partial: when NO new whole copy is possible, consolidate scattered
  // parts onto one loose copy to make it as complete as it can be (e.g. 3/6 → 5/6).
  // Only offered when whole-copy `moves` is empty — completing a copy always wins. ----
  let partial = null;
  if (moves.length === 0 && loose.length > 1 && slots.length) {
    const includable = slots.filter((s) => slotCapacity(s, pool, 1) >= 1); // slots that fit FULLY on one copy
    const maxPartial = includable.length;
    const partsHad = (c) => includable.filter((s) => slotSatisfiedOnCopy(s, c.acc)).length;
    let targetIdx = 0, best = -1;
    loose.forEach((c, i) => { const n = partsHad(c); if (n > best) { best = n; targetIdx = i; } }); // fewest moves
    if (maxPartial > best) {
      const ptarget = loose.map(c => ({ ...c.acc }));
      const vcopies = ptarget.map((acc) => ({ acc }));
      includable.forEach((s) => {
        if (slotSatisfiedOnCopy(s, ptarget[targetIdx])) return;
        if (s.kind === 'solo') {
          const [n] = s.names, q = s.qty;
          let need = q - (ptarget[targetIdx][n] || 0);
          for (let i = 0; i < loose.length && need > 0; i++) {
            if (i === targetIdx) continue;
            const give = Math.min(need, ptarget[i][n] || 0);
            ptarget[i][n] -= give; ptarget[targetIdx][n] = (ptarget[targetIdx][n] || 0) + give; need -= give;
          }
        } else if (s.kind === 'plain') {
          applyPoolTarget(s.names, vcopies, new Set(), [targetIdx], ptarget);
        } else {
          const bestKey = matchedCapacities(s, pool)[0];
          if (bestKey) s.groups.forEach((g) => {
            const names = g.filter((m) => m[5] === bestKey.key).map((m) => m[0]);
            applyPoolTarget(names, vcopies, new Set(), [targetIdx], ptarget);
          });
        }
      });
      const pmoves = diffMoves(allNames, loose, ptarget);
      if (pmoves.length) partial = { moves: pmoves, target: ptarget, from: best, to: maxPartial, reqCount: slots.length, targetNo: loose[targetIdx].no };
    }
  }

  return { owned, reqPer, instances, currentWhole, optimalWhole,
    completeNow: currentWhole > 0, completable: optimalWhole > 0, moves, target, partial, _copies: loose, _bp: rebalanceBp };
}
function applyRebalance(catalogId, mode) {
  const cf = INV_CAT_BY_ID.get(catalogId); if (!cf) return;
  const st = figState({ id: catalogId, _cf: cf });
  const plan = mode === 'partial' ? st.partial : { target: st.target, moves: st.moves };
  if (!plan || !plan.moves || !plan.moves.length) return;
  st._copies.forEach((c, i) => {
    const accMap = {}; st._bp.forEach(([n]) => { accMap[n] = plan.target[i][n] || 0; });
    JoeStore.updateInstance(c.id, { acc: accMap });
  });
}

// Roster counts by PRODUCTION VARIANT, not by catalog figure — a true complete
// year means owning every variant, not just one copy of each code name (e.g.
// 1982's 16 code names carry 43 variants between them). Every figure carries
// >=1 variants[] entry (single-variant figures get one with letter '' — see
// server/catalog.js), so this generalizes cleanly to figures with no variant
// data authored yet (they just count as a single slot, same as before).
function yearParts(yearNum) {
  const roster = INV_CAT.filter(f => f.year === yearNum);
  let figs = 0, owned = 0, completeNow = 0, ownedInstances = 0;
  roster.forEach(cf => {
    const s = JoeData.figureSummary(cf.id);
    ownedInstances += s ? s.owned : 0; // raw physical-copy count, duplicates included
    const slots = (cf.variants && cf.variants.length) ? cf.variants : [{ letter: '' }];
    figs += slots.length;
    slots.forEach(({ letter }) => {
      const copiesOfVariant = s ? s.copies.filter(c => (c.variant || '') === (letter || '')) : [];
      if (copiesOfVariant.length > 0) {
        owned++;
        if (copiesOfVariant.some(c => c.whole)) completeNow++;
      }
    });
  });
  // Both meters are anchored to the SAME denominator (the full series roster,
  // e.g. 43 for 1982) per owner request — "Figures" is how much of the whole
  // series you own, "Complete" is how much of the whole series is whole, not
  // how much of what you've collected so far is whole. ownedInstances is a
  // separate, third metric — how many physical copies you actually have from
  // this year (duplicates count), independent of roster coverage.
  return { figs, owned, completeNow, ownedInstances, coverage: figs ? Math.round(owned / figs * 100) : 0, completion: figs ? Math.round(completeNow / figs * 100) : 0 };
}
function invTotals() {
  const t = JoeData.totals();
  return { inInventory: t.unique, instances: t.instances, complete: t.complete };
}

// ---------------------------------------------------------------------------
// Shared low-fi widgets
// ---------------------------------------------------------------------------
function FactionTag({ faction, mini }) {
  return <span className={"wf-fac wf-fac--" + faction.toLowerCase() + (mini ? " wf-fac--mini" : "")}>{faction}</span>;
}
function CompRing({ pct, size = 46, neutral, damagedPct = 0 }) {
  const done = pct === 100;
  const col = done ? "var(--ok)" : (neutral ? "var(--ink-soft)" : "var(--accent)");
  const dmgEnd = pct * 3.6 * Math.min(Math.max(damagedPct, 0), 1);
  return (
    <div className="wf-ring" style={{ width: size, height: size, background: `conic-gradient(${col} ${pct * 3.6}deg, var(--ring-track) 0)` }}>
      {dmgEnd > 0 && <div className="wf-ring__dmg" style={{ "--dmg-end": dmgEnd + "deg" }} title="Some owned accessories are marked damaged"></div>}
      <div className="wf-ring__hole"><span className="wf-ring__pct">{pct}<small>%</small></span></div>
    </div>
  );
}
function CompBar({ pct, height = 8 }) {
  const done = pct === 100;
  return <div className="wf-bar" style={{ height }}><div className={"wf-bar__fill" + (done ? " is-done" : "")} style={{ width: Math.max(pct, 2) + "%" }}></div></div>;
}
function PhotoSlot({ className, src }) {
  const [failed, setFailed] = React.useState(false);
  if (src && !failed) {
    return (
      <div className={"wf-photo " + (className || "")}>
        <img className="wf-photo__img" src={src} alt="" onError={() => setFailed(true)} />
      </div>
    );
  }
  return <div className={"wf-photo " + (className || "")}><span className="wf-photo__tag">FIG. PHOTO</span></div>;
}
function StockBar({ pct }) {
  const done = pct === 100;
  return <div className="inv-bar"><div className={"inv-bar__fill" + (done ? " is-done" : "")} style={{ width: Math.max(pct, 2) + "%" }}></div></div>;
}

// Accessory checklist — one box per required unit. 1 row for 1–3, two rows for 4+.
function boxLayout(req) {
  const rows = req <= 3 ? 1 : 2;
  const cols = rows === 1 ? req : Math.ceil(req / 2);
  return { rows, cols, empty: cols * rows - req };
}
// color (added 2026-07-03, see acc-colors.jsx) renders as an AccSwatch beside
// the name — decoration only, never gates the checkbox fill (see rule #5 in
// acc-colors.jsx's header).
function AccItem({ name, req, checked, onSet, tone, color, tag, damaged }) {
  const { rows, cols, empty } = boxLayout(req);
  const own = checked.reduce((s, c) => s + (c ? 1 : 0), 0);
  const done = own >= req;
  const live = typeof onSet === 'function';
  const dmg = tone === 'damage';
  const cells = [];
  for (let i = 0; i < empty; i++) cells.push(<span key={"sp" + i} className="acc__box is-spacer" aria-hidden="true"></span>);
  for (let i = 0; i < req; i++) {
    const on = i < own;
    cells.push(
      <button key={i} type="button" className={"acc__box" + (on ? " is-on" : "")} disabled={!live}
              title={dmg ? name + " · unit " + (i + 1) + (on ? " · damaged" : " · not damaged") : (req > 1 ? name + " · unit " + (i + 1) + " of " + req : name)}
              onClick={live ? () => onSet(i + 1 === own ? i : i + 1) : undefined}>✓</button>
    );
  }
  return (
    <div className={"acc" + (rows === 2 ? " is-stack" : "") + (done ? " is-done" : "") + (dmg ? " is-damage-tone" : "")}>
      <span className="acc__namewrap">
        <span className="acc__dmgflag" title={damaged ? name + " · has damaged units" : undefined} aria-hidden={!damaged}>{damaged ? "⚠" : ""}</span>
        {tag != null && <span className="acc__tag">{tag}</span>}{color && <AccSwatch color={color} />}<span className="acc__name">{name}</span>
      </span>
      <div className="acc__boxes" style={{ gridTemplateColumns: "repeat(" + cols + ", 22px)" }}>{cells}</div>
      <span className="acc__count">{own}/{req}</span>
    </div>
  );
}

// Per-accessory damage marking — toggle + checklist, shared between the
// Detail modal (live PATCH per click, via onSetDamage) and Add Figure's
// CONDITION step (local state accumulated into the create payload). `extra`
// is an optional per-row render prop for damaged-row-only actions (Detail
// uses it for "swap for clean"; Add Figure omits it — nothing to swap into
// yet on a copy that doesn't exist).
function DamageModePanel({ ownedAcc, rawAcc, accDamage, onSetDamage, extra }) {
  const [damageMode, setDamageMode] = React.useState(false);
  const owned = ownedAcc.reduce((s, [n]) => s + (rawAcc[n] || 0), 0);
  const damaged = ownedAcc.reduce((s, [n]) => s + (accDamage[n] || 0), 0);
  return (
    <React.Fragment>
      <button type="button" className={"acc-dmgtoggle" + (damageMode ? " is-on" : "") + (damaged > 0 ? " has-damage" : "")}
              onClick={() => setDamageMode(v => !v)}>
        {damageMode ? "✕ done marking damage" : "⚠ mark as damaged"}
      </button>
      {damageMode && (
        <div className="acc-list acc-list--dmg">
          <div className="acc-list__cap"><span>DAMAGED ACCESSORIES</span><span><b>{damaged}</b>/{owned}</span></div>
          {ownedAcc.length === 0
            ? <div className="acc acc--note">No accessories owned yet on this copy.</div>
            : ownedAcc.map((a) => (
                <div key={a[0]} className="acc-dmgrow">
                  <AccItem name={a[0]} req={rawAcc[a[0]] || 0} tone="damage" color={a[6]}
                           checked={Array.from({ length: rawAcc[a[0]] || 0 }, (_, k) => k < (accDamage[a[0]] || 0))}
                           onSet={(k) => onSetDamage(a[0], k)} />
                  {extra && (accDamage[a[0]] || 0) > 0 && extra(a[0])}
                </div>
              ))}
        </div>
      )}
    </React.Fragment>
  );
}

// ---------------------------------------------------------------------------
// Flip-card detail modal — figure front + condition back, persisted to store
// ---------------------------------------------------------------------------
function InvDetailModal({ catalogId, instId, onClose, onAddInstance }) {
  const cf = INV_CAT_BY_ID.get(catalogId);
  const fig = fvm(cf);
  const sum = fig._sum;
  const ghost = !sum || sum.owned === 0;
  const copies = sum ? sum.copies : [];
  const st = ghost ? null : figState(fig);

  const [curId, setCurId] = React.useState(instId || (copies[0] && copies[0].id));
  const cur = copies.find(c => c.id === curId) || copies[0] || null;
  const [flipped, setFlipped] = React.useState(false);
  const [varEdit, setVarEdit] = React.useState(false);
  React.useEffect(() => setVarEdit(false), [curId]);
  // ghost-only: accessories ticked before the figure is owned — carried into
  // the Add Figure flow's DETAILS step as a starting point, not persisted here.
  const [preAcc, setPreAcc] = React.useState({});
  const setPreUnit = (name, n) => setPreAcc(o => ({ ...o, [name]: n }));
  // binder tabs retract while the card flips, then spring back once it lands
  const [tucked, setTucked] = React.useState(false);
  const tuckTimer = React.useRef(null);
  const flipTo = (v) => {
    if (v === flipped) return;
    setTucked(true);
    setFlipped(v);
    clearTimeout(tuckTimer.current);
    tuckTimer.current = setTimeout(() => setTucked(false), 590);
  };
  React.useEffect(() => () => clearTimeout(tuckTimer.current), []);

  React.useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  // ---- live per-copy reads + writes ----
  const raw = cur ? (JoeStore.get().instances.find(i => i.id === cur.id) || {}) : {};
  const moc = !!raw.moc;
  const filecard = raw.filecard || { onFile: false, fileCardId: null };
  const marks = (raw.marks && raw.marks.condition) ? raw.marks : dmEmpty(fig.body || 'male');
  // Scope the checklist to this copy's own production variant — a v1 A copy
  // shouldn't be asked (or able) to check off a v1 B-only accessory. See
  // bpForVariant (shared/completeness.js) + ACCESSORY_GROUPS.md "variant_id".
  const bp = bpForVariant(fig.blueprint, cur ? cur.variant : null);
  const ordered = orderedBlueprint(bp);
  const accDamage = raw.accDamage || {};
  const ownedAcc = bp.filter(([n]) => ((raw.acc && raw.acc[n]) || 0) > 0);
  const dmgDamaged = ownedAcc.reduce((s, [n]) => s + (accDamage[n] || 0), 0);
  const dmgShare = moc ? 0 : JoeData.accDamagePct(bp, raw.acc || {}, accDamage);
  // Parts Bin lookup, by accessory name, for the swap-for-clean action below —
  // a damaged unit can only trade for a unit the bin actually has clean.
  const binByName = new Map(JoeStore.binEntries().map(e => [e.accessory, e]));
  const cleanInBin = (name) => { const e = binByName.get(name); return e ? e.qty - (e.damaged || 0) : 0; };

  const setUnit = (name, n) => JoeStore.setAcc(cur.id, name, n);
  const setDamage = (name, n) => JoeStore.setAccDamage(cur.id, name, n);
  const swapForClean = (name) => JoeStore.swapAccessoryForClean(cur.id, name);
  const setMoc = (v) => JoeStore.updateInstance(cur.id, { moc: v });
  const setCard = (patch) => JoeStore.updateInstance(cur.id, { filecard: { ...filecard, ...patch } });
  const setNotes = (v) => JoeStore.updateInstance(cur.id, { notes: v });
  const setLoc = (v) => JoeStore.updateInstance(cur.id, { loc: v });
  const setVariant = (letter) => { JoeStore.updateInstance(cur.id, { variant: letter }); setVarEdit(false); };
  const setCoo = (country) => JoeStore.updateInstance(cur.id, { coo: country });
  const setMarks = (val) => {
    const pg = physicalGrade(val), pt = paintGrade(val);
    JoeStore.updateInstance(cur.id, { marks: val, phys: pg.zones ? pg.grade : null, paint: pt.zones ? pt.grade : null });
  };
  // ---- delete sequence ----
  // [Remove Figure Only] [Remove Figure and Selected Accessories] [Remove Figure
  // and All Accessories] [Cancel]. "Remove Figure Only" is a one-click
  // keep-everything action; "...Selected Accessories" opens a checklist
  // (only when the copy has accessories on file) framed as picking which
  // pieces to *discard* — unchecked pieces move to the Parts Bin.
  const [delStep, setDelStep] = React.useState(null); // null | 'confirm' | 'pick'
  const [keepSel, setKeepSel] = React.useState({}); // name -> keep-in-Parts-Bin (true)
  const keepable = bp.map(([n, q]) => [n, Math.min((raw.acc && raw.acc[n]) || 0, q)]).filter(([, o]) => o > 0);

  const finishRemove = (deposit) => {
    if (deposit.length) JoeStore.depositParts(catalogId, deposit.map(([accessory, qty]) => ({ accessory, qty })));
    JoeStore.removeInstance(cur.id);
    setDelStep(null);
    const rest = copies.filter(c => c.id !== cur.id);
    if (rest.length) setCurId(rest[0].id); else onClose();
  };
  const removeAll = () => finishRemove([]);
  const removeKeepAll = () => finishRemove(keepable); // "Remove Figure Only" — no picker, keeps every piece
  const removeSelected = () => { // "Remove Figure and Selected Accessories"
    if (!keepable.length) { finishRemove([]); return; }
    setKeepSel(Object.fromEntries(keepable.map(([n]) => [n, true]))); // default: keep everything
    setDelStep('pick');
  };
  const confirmPick = () => finishRemove(keepable.filter(([n]) => keepSel[n]));
  const toggleKeep = (n) => setKeepSel(s => ({ ...s, [n]: !s[n] }));

  const DMap = DamageMap, DGrade = GradeBadge;
  const dmgPhys = !ghost && !moc ? physicalGrade(marks) : null;
  const dmgPaint = !ghost && !moc ? paintGrade(marks) : null;
  // Zero zones marked reads as "ungraded" (not yet mapped) on the dashboard
  // (see gradeOf, store.js) unless this copy carries an explicit marks.clean
  // confirmation — mirrors the Add Figure CONDITION step's "mark clean" flow.
  const marksCount = (dmgPhys ? dmgPhys.zones : 0) + (dmgPaint ? dmgPaint.zones : 0);
  const clean = !!marks.clean;
  const ungraded = marksCount === 0 && !clean;
  const setClean = (v) => setMarks({ ...marks, clean: v });
  const ringPct = ghost ? 0 : moc ? 100 : cur.pct;

  // ---- ghost / catalog-gap acquire modal (simple, non-flip) ----
  if (ghost) {
    const p = figParts(fig);
    return (
      <React.Fragment>
        <div className="inv-scrim" onClick={onClose}></div>
        <div className="inv-modal">
          <button className="inv-modal__x" onClick={onClose}>✕</button>
          <div className="inv-modal__l">
            <PhotoSlot className="inv-modal__photo" src={fig.image} />
            <FactionTag faction={fig.faction} />
            <div className="inv-modal__id">
              <div className="inv-modal__name">{fig.name}<VersionChip version={fig.version} lg /></div>
              <div className="inv-modal__var">{fig.specialty} · {formatYear(fig.year)}</div>
              {fig.variants > 1 ? <div className="inv-modal__variants"><span className="lyr"><b></b></span>{fig.variants} variants</div> : null}
              <VehicleTag vehicle={fig.vehicle} modal />
              {fig.coo.length > 0 && <div className="inv-modal__coo">Known origins: {fig.coo.join(', ')}</div>}
            </div>
            <div className="inv-modal__notin">NOT IN<br/>INVENTORY</div>
          </div>
          <div className="inv-modal__r">
            {bp.length === 0
              ? <p className="inv-modal__blurb">No accessory blueprint on file for this figure.</p>
              : <div className="acc-list">
                  <div className="acc-list__cap"><span>ACCESSORIES</span><span><b>{JoeData.instOwn(bp, preAcc)}</b>/{JoeData.bpReq(bp)}</span></div>
                  <AccessoryList ordered={ordered}
                                 renderSolo={(a, key) => (
                                   <AccItem key={key} name={a[0]} req={a[1]} color={a[6]}
                                            checked={Array.from({ length: a[1] }, (_, k) => k < (preAcc[a[0]] || 0))}
                                            onSet={(n) => setPreUnit(a[0], n)} />
                                 )}
                                 renderOption={(a) => (
                                   <AccItem key={a[0]} name={JoeData.optLabel(a[0])} req={a[1]} color={a[6]} tag={a[5]}
                                            checked={Array.from({ length: a[1] }, (_, k) => k < (preAcc[a[0]] || 0))}
                                            onSet={(n) => setPreUnit(a[0], n)} />
                                 )} />
                </div>}
            <div className="inv-modal__btns"><button className="invbtn invbtn--go" onClick={() => { onAddInstance(fig.id, null, preAcc); onClose(); }}>＋ ADD TO INVENTORY</button></div>
          </div>
        </div>
      </React.Fragment>
    );
  }

  const liveOwn = cur.own;
  const liveWhole = cur.whole;

  const cardHeader = (
    <div className="inv-cardhd">
      <div className="inv-cardhd__id"><b>{fig.name}</b><span className="inv-cardhd__no">No. {cur.no}</span></div>
      <div className="inv-cardhd__ctrls">
        <label className={"inv-cardhd__moc" + (moc ? " is-on" : "")} title="Mint on Card — sealed & unopened; locks this copy 100% complete">
          <input type="checkbox" checked={moc} onChange={e => setMoc(e.target.checked)} />
          <span className="inv-cardhd__mocbox">{moc ? "\u2713" : ""}</span>
          <span className="inv-cardhd__moclab">MOC</span>
        </label>
        <div className="inv-cardhd__seg">
          <button className={!flipped ? "is-on" : ""} onClick={() => flipTo(false)}>FIGURE</button>
          <button className={flipped ? "is-on" : ""} onClick={() => flipTo(true)}>CONDITION</button>
        </div>
      </div>
    </div>
  );

  return (
    <React.Fragment>
      <div className="inv-scrim" onClick={onClose}></div>
      <div className={"inv-cardwrap" + (flipped ? " is-flipped" : "")}>
        <button className="inv-modal__x" title="Save & close" aria-label="Save & close" onClick={onClose}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 2h9l3 3v9H2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"></path>
            <path d="M4.6 2v4.4h5.2V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"></path>
            <path d="M4.6 14v-5h6.8v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"></path>
          </svg>
        </button>
        <div className={"inv-tabs-rail" + (tucked ? " is-tucked" : "")}>
          {copies.map((c) => (
            <button key={c.id} className={"inv-tab" + (cur.id === c.id ? " is-active" : "")} onClick={() => setCurId(c.id)}>No. {c.no}{c.whole ? " ✓" : ""}</button>
          ))}
          <button className="inv-tab inv-tab--add" title="Add a copy" onClick={() => { onAddInstance(fig.id, cur.variant); onClose(); }}>＋</button>
        </div>

        <div className="inv-flip">
          <div className="inv-face inv-face--front">
            {cardHeader}
            <div className="inv-front-body">
              <div className="inv-modal__l">
                <PhotoSlot className="inv-modal__photo" src={fig.image} />
                <FactionTag faction={fig.faction} />
                <div className="inv-modal__id">
                  <div className="inv-modal__name">{fig.name}<VersionChip version={fig.version} lg /></div>
                  <div className="inv-modal__var">{cur.variant ? <React.Fragment><VariantBadge letter={cur.variant} /> · </React.Fragment> : null}{fig.specialty} · {formatYear(fig.year)}</div>
                  {fig.variants > 1 ? (
                    <button type="button" className="inv-modal__variants inv-modal__variants--btn" title="Change production variant"
                            aria-expanded={varEdit} onClick={() => setVarEdit(v => !v)}>
                      <span className="lyr"><b></b></span>{fig.variants} variants
                    </button>
                  ) : null}
                  {varEdit && (
                    <div className="inv-varpick">
                      {cf.variants.map(v => (
                        <button key={v.letter} type="button" className={"inv-var" + (cur.variant === v.letter ? " is-sel" : "")} onClick={() => setVariant(v.letter)}>
                          <span className="inv-var__radio"></span>
                          <span className="inv-var__lab">{v.letter || "—"}</span>
                          <span className="inv-var__tell">{v.tell || "no distinguishing notes"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {fig.vehicle && <span className="idveh idveh--modal" title={"Vehicle driver — packaged with the " + fig.vehicle}><b>VEHICLE</b> {fig.vehicle}</span>}
                </div>
                <CompRing pct={ringPct} size={84} neutral damagedPct={dmgShare} />
                {!moc && !liveWhole && <div className="inv-modal__ringlab">COMPLETENESS</div>}
                {moc && <div className="inv-modal__ringlab">MINT ON CARD</div>}
              </div>

              <div className="inv-modal__r">
                {st.moves.length > 0 && (
                  <div className="inv-rebalbox inv-rebalbox--modal">
                    <span className="inv-rebalbox__hd">Rebalance — your loose parts can complete {st.optimalWhole} cop{st.optimalWhole > 1 ? "ies" : "y"}:</span>
                    {st.moves.slice(0, 5).map((m, i) => (
                      <span key={i} className="inv-move">Move <b>{m.qty > 1 ? m.qty + "× " : ""}{m.part}</b> from <b>No. {m.from}</b> → <b>No. {m.to}</b></span>
                    ))}
                    <button className="invbtn invbtn--rebal" onClick={() => applyRebalance(fig.id)}>APPLY MOVES</button>
                  </div>
                )}

                {moc ? (
                  <div className="acc-list">
                    <div className="acc-list__cap"><span>ACCESSORY · SEALED ON CARD</span><span><b>MOC</b></span></div>
                    <div className="acc acc--note">Sealed &amp; unopened — accessories assumed complete on card; not tracked individually while MOC.</div>
                  </div>
                ) : bp.length === 0 ? (
                  <div className="acc-list">
                    <div className="acc-list__cap"><span>ACCESSORIES</span></div>
                    <div className="acc acc--note">No accessories on file for this figure.</div>
                  </div>
                ) : (
                  <div className="acc-list">
                    <div className="acc-list__cap">
                      <span>ACCESSORIES{dmgDamaged > 0 && <span className="acc-list__dmgflag">⚠ {dmgDamaged} damaged</span>}</span>
                      <span><b>{liveOwn}</b>/{cur.req}</span>
                    </div>
                    <AccessoryList ordered={ordered}
                                   renderSolo={(a, key) => (
                                     <AccItem key={key} name={a[0]} req={a[1]} color={a[6]} damaged={(accDamage[a[0]] || 0) > 0}
                                              checked={Array.from({ length: a[1] }, (_, k) => k < (raw.acc && raw.acc[a[0]] || 0))}
                                              onSet={(n) => setUnit(a[0], n)} />
                                   )}
                                   renderOption={(a) => (
                                     <AccItem key={a[0]} name={JoeData.optLabel(a[0])} req={a[1]} color={a[6]} tag={a[5]} damaged={(accDamage[a[0]] || 0) > 0}
                                              checked={Array.from({ length: a[1] }, (_, k) => k < (raw.acc && raw.acc[a[0]] || 0))}
                                              onSet={(n) => setUnit(a[0], n)} />
                                   )} />
                    <DamageModePanel ownedAcc={ownedAcc} rawAcc={raw.acc || {}} accDamage={accDamage} onSetDamage={setDamage}
                      extra={(name) => {
                        const canSwap = cleanInBin(name) > 0;
                        return (
                          <button type="button" className="acc-swap" disabled={!canSwap}
                                  title={canSwap ? "Trade this damaged unit for a clean one from the Parts Bin" : "No clean units of this accessory in the Parts Bin"}
                                  onClick={() => swapForClean(name)}>
                            {canSwap ? "swap for clean ›" : "no clean stock in bin"}
                          </button>
                        );
                      }} />
                  </div>
                )}

                <div className="acc-list fc-list">
                  <div className="acc-list__cap"><span>FILE CARD</span><span>{filecard.onFile && <b>ON FILE</b>}</span></div>
                  <div className="acc fc-row">
                    <span className="acc__name">Card on file</span>
                    {filecard.onFile && <FileCardRow fig={fig} printing={filecard.fileCardId} onChange={fileCardId => setCard({ fileCardId })} />}
                    <button className={"acc__box fc-box" + (filecard.onFile ? " is-on" : "")} onClick={() => setCard({ onFile: !filecard.onFile })} title={filecard.onFile ? "Mark card not on file" : "Mark file card on file"}>{filecard.onFile ? "✓" : ""}</button>
                  </div>
                  {filecard.onFile && <FileCardTell fig={fig} printing={filecard.fileCardId} />}
                </div>

                <div className="inv-copymeta">
                  <div className="inv-notes">
                    <div className="inv-notes__cap">NOTES</div>
                    <textarea className="inv-notes__in" rows={2} defaultValue={raw.notes || ""} placeholder="damage notes — figure/accessory, damage…"
                              onBlur={e => setNotes(e.target.value)} key={cur.id}></textarea>
                  </div>
                  <div className="inv-notes inv-loc">
                    <div className="inv-notes__cap">BIN / BOX LOCATION</div>
                    <input className="inv-notes__in inv-loc__in" defaultValue={raw.loc || ""} placeholder="box 1, box 2, small tote"
                           onBlur={e => setLoc(e.target.value)} key={cur.id} />
                  </div>
                </div>

                {fig.coo.length > 0 && (
                  <div className="acc-list fc-list coo-list">
                    <div className="acc-list__cap"><span>COUNTRY OF ORIGIN</span><span>{cur.coo && <b>{cur.coo}</b>}</span></div>
                    <div className="acc fc-coorow">
                      {fig.coo.map(country => (
                        <span key={country} className="fc-coo__opt">
                          <span className="acc__name">{country}</span>
                          <button type="button" className={"acc__box fc-box" + (cur.coo === country ? " is-on" : "")}
                                  onClick={() => setCoo(cur.coo === country ? '' : country)}
                                  title={cur.coo === country ? "Clear country of origin" : "Set as country of origin"}>
                            {cur.coo === country ? "✓" : ""}
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="inv-modal__btns inv-modal__btns--foot">
                  <button className="invbtn-trash" title="Remove this copy" aria-label="Remove this copy" onClick={() => setDelStep('confirm')}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M2.5 4h11M6 4V2.6h4V4M3.9 4l.7 9.4h6.8l.7-9.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"></path>
                      <path d="M6.6 6.4v5M9.4 6.4v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="inv-face inv-face--back inv-cardback">
            {cardHeader}
            <div className="inv-cardback__body">
              <div className="inv-cardback__map">
                {moc ? (
                  <div className="id-sealed">
                    <div className="id-sealed__card"><div className="id-sealed__tag">MINT ON CARD</div><div className="id-sealed__sub">SEALED · UNOPENED</div></div>
                    <p>The loose-figure condition diagram doesn't apply to a carded copy. Note any card or bubble flaws in the copy's notes.</p>
                  </div>
                ) : (
                  <DMap value={marks} onChange={setMarks} genderLocked={true} />
                )}
              </div>
              <div className="inv-cardback__side">
                <section className="panel">
                  <div className="panel__hd">CONDITION <em>· {moc ? "mint on card" : ungraded ? "ungraded" : marksCount === 0 ? "clean · confirmed" : "derived from damage"}</em></div>
                  {moc ? (
                    <div className="id-mocgrade"><span className="id-mocgrade__badge">MOC</span><div className="id-mocgrade__txt"><b>Factory mint · sealed</b><i>100% complete — not graded on the loose scale while carded.</i></div></div>
                  ) : ungraded ? (
                    <div className="panel__note">
                      <div>Tag the diagram to record condition, or mark it clean.</div>
                      <button className="af-markall" onClick={() => setClean(true)}>✓ MARK CLEAN — NO DAMAGE</button>
                    </div>
                  ) : (
                    <React.Fragment>
                      <div className="grades"><DGrade kind="PHYSICAL" result={dmgPhys} /><DGrade kind="PAINT" result={dmgPaint} /></div>
                      {clean && marksCount === 0 ? (
                        <div className="panel__note">Confirmed clean — no damage mapped. <button className="af-clear" onClick={() => setClean(false)}>undo</button></div>
                      ) : (
                        <div className="panel__note">Grades update live from the map. Click a zone to cycle its severity; use the Condition / Paint tabs to grade each.</div>
                      )}
                    </React.Fragment>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>

      {delStep && (
        <React.Fragment>
          <div className="inv-scrim inv-scrim--top" onClick={() => setDelStep(null)}></div>
          {delStep === 'confirm' ? (
            <div className="inv-confirm">
              <div className="inv-confirm__hd">Remove {fig.name} · No. {cur.no}?</div>
              <div className="inv-confirm__sub">
                {keepable.length
                  ? `This copy has ${keepable.reduce((s, [, o]) => s + o, 0)} accessor${keepable.reduce((s, [, o]) => s + o, 0) !== 1 ? 'ies' : 'y'} on file.`
                  : 'This copy has no accessories on file.'}
              </div>
              <div className="inv-confirm__btns">
                <button className="inv-confirm__btn" onClick={removeKeepAll}>
                  REMOVE FIGURE ONLY
                  {keepable.length ? <i>all accessories move to the Parts Bin</i> : null}
                </button>
                <button className="inv-confirm__btn inv-confirm__btn--warn" onClick={removeSelected}>
                  REMOVE FIGURE AND SELECTED ACCESSORIES
                  {keepable.length ? <i>choose which accessories to discard</i> : null}
                </button>
                <button className="inv-confirm__btn inv-confirm__btn--danger" onClick={removeAll}>
                  REMOVE FIGURE AND ALL ACCESSORIES
                  {keepable.length ? <i>everything is discarded</i> : null}
                </button>
                <button className="inv-confirm__btn inv-confirm__btn--cancel" onClick={() => setDelStep(null)}>CANCEL</button>
              </div>
            </div>
          ) : (
            <div className="inv-confirm">
              <div className="inv-confirm__hd">Discard which accessories?</div>
              <div className="inv-confirm__sub">
                Checked pieces are discarded with the figure; unchecked pieces move to the Parts Bin as loose parts.
              </div>
              <div className="inv-confirm__list">
                {keepable.map(([name, qty]) => {
                  const on = !keepSel[name];
                  return (
                    <div key={name} className="inv-confirm__row">
                      <span className="acc__name">{name}{qty > 1 ? <i> ×{qty}</i> : null}</span>
                      <button type="button" className={"acc__box" + (on ? " is-on" : "")}
                              onClick={() => toggleKeep(name)}
                              title={on ? "Discard with figure" : "Keep in Parts Bin"}>
                        {on ? "✓" : ""}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="inv-confirm__foot">
                <button className="inv-confirm__btn inv-confirm__btn--cancel" onClick={() => setDelStep('confirm')}>‹ BACK</button>
                <button className="inv-confirm__btn inv-confirm__btn--danger" onClick={confirmPick}>REMOVE FIGURE</button>
              </div>
            </div>
          )}
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

export {
  INV_CAT, INV_ERAS, INV_CAT_BY_ID,
  fvm, figParts, figState, applyRebalance, yearParts, invTotals,
  FactionTag, CompRing, CompBar, PhotoSlot, StockBar, AccItem, boxLayout,
  DamageModePanel,
  InvDetailModal,
};
