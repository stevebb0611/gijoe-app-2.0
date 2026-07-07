// app-detail.jsx — adapter (catalog ⋈ live store) + shared widgets + the
// flip-card detail modal (FIGURE front / CONDITION back), all wired to JoeStore
// so every tick, grade, MOC flag, note, file-card and rebalance PERSISTS.
import React from 'react';
import { JoeStore, JoeData } from './store.js';
import { physicalGrade, paintGrade, dmEmpty, DamageMap, GradeBadge } from './damage-map.jsx';
import { AccessoryList, orderedBlueprint } from './accessory-groups.jsx';
import { AccSwatch } from './acc-colors.jsx';
import { VersionChip, VariantBadge, VehicleTag } from './fig-identity.jsx';

const INV_CAT = JoeData.CAT || [];
const INV_ERAS = {}; // was window.JOE_ERAS from the retired catalog-data.js — always {}
const INV_CAT_BY_ID = new Map(INV_CAT.map(f => [f.id, f]));

// File-card printings. On-file status is shown as a notation, not a completeness
// requirement; the letter below is just which printing it is.
const FILECARDS = [
  { letter: 'A', name: 'First print' },
  { letter: 'B', name: "Reissue '85" },
  { letter: 'C', name: 'Mail-away' },
];

// Delete-copy dialog layout — trying a 4th button ("...Selected Accessories")
// alongside the original 3. Flip to 3 to revert to [Remove Figure Only] /
// [Remove Figure and All Accessories] / [Cancel] if the 4-button version
// doesn't earn its place; every handler below already supports both.
const DELETE_DIALOG_BUTTONS = 4; // 3 | 4

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
    specialty: cf.role || '', variant: cf.role || '', vehicle: cf.vehicle || null,
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
function poolOf(bp, copies) {
  const pool = {}; bp.forEach(([n]) => { pool[n] = copies.reduce((s, c) => s + (c.acc[n] || 0), 0); });
  return pool;
}
function computeTarget(bp, copies, maxWhole, pool) {
  const target = copies.map(() => ({}));
  bp.forEach(([n, q]) => {
    let left = pool[n];
    copies.forEach((c, i) => { const give = i < maxWhole ? Math.min(q, left) : 0; target[i][n] = give; left -= give; });
    for (let i = maxWhole; i < copies.length && left > 0; i++) { const give = Math.min(q, left); target[i][n] += give; left -= give; }
    if (left > 0 && copies.length) target[copies.length - 1][n] += left; // conserve any surplus
  });
  return target;
}
function diffMoves(bp, copies, target) {
  const moves = [];
  bp.forEach(([n]) => {
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
  const copies = sum ? sum.copies : [];
  const owned = copies.length;
  const reqPer = bp.reduce((s, a) => s + a[1], 0);
  const instances = copies.map(c => ({
    id: c.id, no: c.no, own: c.own, req: c.req, pct: c.pct, whole: c.whole, missing: c.missing, moc: !!c.moc,
    have: c.moc ? bp.map(([, q]) => q) : bp.map(([n, q]) => Math.min(c.acc[n] || 0, q)),
  }));
  const currentWhole = instances.filter(i => i.whole).length;

  // ---- rebalance runs ONLY over loose (non-MOC) copies — sealed parts can't move,
  // and a MOC copy is already whole. MOC copies still count toward currentWhole above. ----
  const loose = copies.filter(c => !c.moc);
  const mocWhole = owned - loose.length;
  const looseWhole = loose.filter(c => c.whole).length;
  const pool = poolOf(bp, loose);
  const optimalLoose = bp.length === 0 ? loose.length
    : (loose.length ? Math.min(loose.length, ...bp.map(([n, q]) => Math.floor(pool[n] / q))) : 0);
  const optimalWhole = optimalLoose + mocWhole;
  const target = computeTarget(bp, loose, optimalLoose, pool);
  const moves = optimalLoose > looseWhole ? diffMoves(bp, loose, target) : [];

  // ---- best-partial: when NO new whole copy is possible, consolidate scattered
  // parts onto one loose copy to make it as complete as it can be (e.g. 3/6 → 5/6).
  // Only offered when whole-copy `moves` is empty — completing a copy always wins. ----
  let partial = null;
  if (moves.length === 0 && loose.length > 1 && bp.length) {
    const qOf = Object.fromEntries(bp);
    const includable = bp.filter(([n, q]) => pool[n] >= q).map(([n]) => n); // parts that fit FULLY on one copy
    const maxPartial = includable.length;
    const partsHad = (c) => includable.filter(n => (c.acc[n] || 0) >= qOf[n]).length;
    let targetIdx = 0, best = -1;
    loose.forEach((c, i) => { const s = partsHad(c); if (s > best) { best = s; targetIdx = i; } }); // fewest moves
    if (maxPartial > best) {
      const ptarget = loose.map(c => { const o = {}; bp.forEach(([n]) => o[n] = c.acc[n] || 0); return o; });
      includable.forEach(n => {
        let need = qOf[n] - (ptarget[targetIdx][n] || 0);
        for (let i = 0; i < loose.length && need > 0; i++) {
          if (i === targetIdx) continue;
          const give = Math.min(need, ptarget[i][n] || 0);
          ptarget[i][n] -= give; ptarget[targetIdx][n] += give; need -= give;
        }
      });
      const pmoves = diffMoves(bp, loose, ptarget);
      if (pmoves.length) partial = { moves: pmoves, target: ptarget, from: best, to: maxPartial, reqCount: bp.length, targetNo: loose[targetIdx].no };
    }
  }

  return { owned, reqPer, instances, currentWhole, optimalWhole,
    completeNow: currentWhole > 0, completable: optimalWhole > 0, moves, target, partial, _copies: loose, _bp: bp };
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
function PhotoSlot({ className }) {
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
  const [damageMode, setDamageMode] = React.useState(false);
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
  const filecard = raw.filecard || { onFile: false, printing: 'A' };
  const marks = (raw.marks && raw.marks.condition) ? raw.marks : dmEmpty(fig.body || 'male');
  const bp = fig.blueprint;
  const ordered = orderedBlueprint(bp);
  const accDamage = raw.accDamage || {};
  const ownedAcc = bp.filter(([n]) => ((raw.acc && raw.acc[n]) || 0) > 0);
  const dmgOwned = ownedAcc.reduce((s, [n]) => s + ((raw.acc && raw.acc[n]) || 0), 0);
  const dmgDamaged = ownedAcc.reduce((s, [n]) => s + (accDamage[n] || 0), 0);
  const dmgShare = moc ? 0 : JoeData.accDamagePct(bp, raw.acc || {}, accDamage);

  const setUnit = (name, n) => JoeStore.setAcc(cur.id, name, n);
  const setDamage = (name, n) => JoeStore.setAccDamage(cur.id, name, n);
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
  // ---- delete sequence (see DELETE_DIALOG_BUTTONS) ----
  // 3-button: [Remove Figure Only] [Remove Figure and All Accessories] [Cancel].
  // "Remove Figure Only" opens a secondary checklist (only when the copy has
  // accessories on file) so the owner can choose which pieces move to the
  // Parts Bin vs. get discarded, instead of an all-or-nothing pick.
  // 4-button: adds [Remove Figure and Selected Accessories] between them —
  // "Remove Figure Only" becomes a one-click keep-everything action, and the
  // checklist (same component, opposite default) moves to the new button,
  // framed as picking which pieces to *discard* rather than which to *keep*.
  const [delStep, setDelStep] = React.useState(null); // null | 'confirm' | 'pick'
  const [keepSel, setKeepSel] = React.useState({}); // name -> keep-in-Parts-Bin (true) regardless of which button opened the picker
  const [pickMode, setPickMode] = React.useState('keep'); // 'keep' | 'discard' — only affects the checklist's labels/checkbox polarity
  const keepable = bp.map(([n, q]) => [n, Math.min((raw.acc && raw.acc[n]) || 0, q)]).filter(([, o]) => o > 0);

  const finishRemove = (deposit) => {
    if (deposit.length) JoeStore.depositParts(catalogId, deposit.map(([accessory, qty]) => ({ accessory, qty })));
    JoeStore.removeInstance(cur.id);
    setDelStep(null);
    const rest = copies.filter(c => c.id !== cur.id);
    if (rest.length) setCurId(rest[0].id); else onClose();
  };
  const openPicker = (mode) => {
    setKeepSel(Object.fromEntries(keepable.map(([n]) => [n, true]))); // default: keep everything either way
    setPickMode(mode);
    setDelStep('pick');
  };
  const removeAll = () => finishRemove([]);
  const removeKeepAll = () => finishRemove(keepable); // 4-button "Remove Figure Only" — no picker, keeps every piece
  const removeOnly = () => { // 3-button "Remove Figure Only"
    if (!keepable.length) { finishRemove([]); return; }
    openPicker('keep');
  };
  const removeSelected = () => { // 4-button "Remove Figure and Selected Accessories"
    if (!keepable.length) { finishRemove([]); return; }
    openPicker('discard');
  };
  const confirmPick = () => finishRemove(keepable.filter(([n]) => keepSel[n]));
  const toggleKeep = (n) => setKeepSel(s => ({ ...s, [n]: !s[n] }));

  const DMap = DamageMap, DGrade = GradeBadge;
  const dmgPhys = !ghost && !moc ? physicalGrade(marks) : null;
  const dmgPaint = !ghost && !moc ? paintGrade(marks) : null;
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
            <PhotoSlot className="inv-modal__photo" />
            <FactionTag faction={fig.faction} />
            <div className="inv-modal__id">
              <div className="inv-modal__name">{fig.name}<VersionChip version={fig.version} lg /></div>
              <div className="inv-modal__var">{fig.specialty} · {fig.year}</div>
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
                <PhotoSlot className="inv-modal__photo" />
                <FactionTag faction={fig.faction} />
                <div className="inv-modal__id">
                  <div className="inv-modal__name">{fig.name}<VersionChip version={fig.version} lg /></div>
                  <div className="inv-modal__var">{cur.variant ? <React.Fragment><VariantBadge letter={cur.variant} /> · </React.Fragment> : null}{fig.specialty} · {fig.year}</div>
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
                    <button type="button" className={"acc-dmgtoggle" + (damageMode ? " is-on" : "") + (dmgDamaged > 0 ? " has-damage" : "")}
                            onClick={() => setDamageMode(v => !v)}>
                      {damageMode ? "✕ done marking damage" : "⚠ mark as damaged"}
                    </button>
                    {damageMode && (
                      <div className="acc-list acc-list--dmg">
                        <div className="acc-list__cap"><span>DAMAGED ACCESSORIES</span><span><b>{dmgDamaged}</b>/{dmgOwned}</span></div>
                        {ownedAcc.length === 0
                          ? <div className="acc acc--note">No accessories owned yet on this copy.</div>
                          : ownedAcc.map((a) => (
                              <AccItem key={a[0]} name={a[0]} req={(raw.acc && raw.acc[a[0]]) || 0} tone="damage" color={a[6]}
                                       checked={Array.from({ length: (raw.acc && raw.acc[a[0]]) || 0 }, (_, k) => k < (accDamage[a[0]] || 0))}
                                       onSet={(k) => setDamage(a[0], k)} />
                            ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="acc-list fc-list">
                  <div className="acc-list__cap"><span>FILE CARD</span><span>{filecard.onFile && <b>ON FILE</b>}</span></div>
                  <div className="acc fc-row">
                    <span className="acc__name">Card on file</span>
                    {filecard.onFile &&
                      <span className="fc-selwrap"><select className="fc-sel" value={filecard.printing} onChange={e => setCard({ printing: e.target.value })}>{FILECARDS.map(c => <option key={c.letter} value={c.letter}>{c.letter} · {c.name}</option>)}</select><span className="fc-caret">▾</span></span>}
                    <button className={"acc__box fc-box" + (filecard.onFile ? " is-on" : "")} onClick={() => setCard({ onFile: !filecard.onFile })} title={filecard.onFile ? "Mark card not on file" : "Mark file card on file"}>{filecard.onFile ? "✓" : ""}</button>
                  </div>
                </div>

                <div className="inv-copymeta">
                  <div className="inv-notes">
                    <div className="inv-notes__cap">NOTES</div>
                    <textarea className="inv-notes__in" rows={2} defaultValue={raw.notes || ""} placeholder="Notes on this copy…"
                              onBlur={e => setNotes(e.target.value)} key={cur.id}></textarea>
                  </div>
                  <div className="inv-notes inv-loc">
                    <div className="inv-notes__cap">BIN / BOX LOCATION</div>
                    <input className="inv-notes__in inv-loc__in" defaultValue={raw.loc || ""} placeholder="e.g. BIN C-04 · long-box"
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
                  <div className="panel__hd">CONDITION <em>· {moc ? "mint on card" : "derived from damage"}</em></div>
                  {moc ? (
                    <div className="id-mocgrade"><span className="id-mocgrade__badge">MOC</span><div className="id-mocgrade__txt"><b>Factory mint · sealed</b><i>100% complete — not graded on the loose scale while carded.</i></div></div>
                  ) : (
                    <React.Fragment>
                      <div className="grades"><DGrade kind="PHYSICAL" result={dmgPhys} /><DGrade kind="PAINT" result={dmgPaint} /></div>
                      <div className="panel__note">Grades update live from the map. Click a zone to cycle its severity; use the Condition / Paint tabs to grade each.</div>
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
                {DELETE_DIALOG_BUTTONS === 4 ? (
                  <React.Fragment>
                    <button className="inv-confirm__btn" onClick={removeKeepAll}>
                      REMOVE FIGURE ONLY
                      {keepable.length ? <i>all accessories move to the Parts Bin</i> : null}
                    </button>
                    <button className="inv-confirm__btn inv-confirm__btn--warn" onClick={removeSelected}>
                      REMOVE FIGURE AND SELECTED ACCESSORIES
                      {keepable.length ? <i>choose which accessories to discard</i> : null}
                    </button>
                  </React.Fragment>
                ) : (
                  <button className="inv-confirm__btn" onClick={removeOnly}>
                    REMOVE FIGURE ONLY
                    {keepable.length ? <i>accessories move to the Parts Bin</i> : null}
                  </button>
                )}
                <button className="inv-confirm__btn inv-confirm__btn--danger" onClick={removeAll}>
                  REMOVE FIGURE AND ALL ACCESSORIES
                  {keepable.length ? <i>everything is discarded</i> : null}
                </button>
                <button className="inv-confirm__btn inv-confirm__btn--cancel" onClick={() => setDelStep(null)}>CANCEL</button>
              </div>
            </div>
          ) : (
            <div className="inv-confirm">
              <div className="inv-confirm__hd">{pickMode === 'discard' ? 'Discard which accessories?' : 'Keep which accessories?'}</div>
              <div className="inv-confirm__sub">
                {pickMode === 'discard'
                  ? 'Checked pieces are discarded with the figure; unchecked pieces move to the Parts Bin as loose parts.'
                  : 'Checked pieces move to the Parts Bin as loose parts; unchecked pieces are discarded with the figure.'}
              </div>
              <div className="inv-confirm__list">
                {keepable.map(([name, qty]) => {
                  const on = pickMode === 'discard' ? !keepSel[name] : keepSel[name];
                  return (
                    <div key={name} className="inv-confirm__row">
                      <span className="acc__name">{name}{qty > 1 ? <i> ×{qty}</i> : null}</span>
                      <button type="button" className={"acc__box" + (on ? " is-on" : "")}
                              onClick={() => toggleKeep(name)}
                              title={on
                                ? (pickMode === 'discard' ? "Discard with figure" : "Keep in Parts Bin")
                                : (pickMode === 'discard' ? "Keep in Parts Bin" : "Discard with figure")}>
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
  InvDetailModal,
};
