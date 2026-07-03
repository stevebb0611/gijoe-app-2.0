// app-detail.jsx — adapter (catalog ⋈ live store) + shared widgets + the
// flip-card detail modal (FIGURE front / CONDITION back), all wired to JoeStore
// so every tick, grade, MOC flag, note, file-card and rebalance PERSISTS.
import React from 'react';
import { JoeStore, JoeData } from './store.js';
import { physicalGrade, paintGrade, dmEmpty, DamageMap, GradeBadge } from './damage-map.jsx';
import { VariantGroup, ContextGroup, clusterContexts } from './accessory-groups.jsx';

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
    specialty: cf.role || '', variant: cf.role || '',
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

function yearParts(yearNum) {
  const roster = INV_CAT.filter(f => f.year === yearNum);
  const figs = roster.length;
  let owned = 0, completeNow = 0;
  roster.forEach(cf => { const s = JoeData.figureSummary(cf.id); if (s && s.owned > 0) { owned++; if (s.whole > 0) completeNow++; } });
  return { figs, owned, completeNow, coverage: figs ? Math.round(owned / figs * 100) : 0, completion: owned ? Math.round(completeNow / owned * 100) : 0 };
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
function CompRing({ pct, size = 46, neutral }) {
  const done = pct === 100;
  const col = done ? "var(--ok)" : (neutral ? "var(--ink-soft)" : "var(--accent)");
  return (
    <div className="wf-ring" style={{ width: size, height: size, background: `conic-gradient(${col} ${pct * 3.6}deg, var(--ring-track) 0)` }}>
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
function AccItem({ name, req, checked, onSet }) {
  const { rows, cols, empty } = boxLayout(req);
  const own = checked.reduce((s, c) => s + (c ? 1 : 0), 0);
  const done = own >= req;
  const live = typeof onSet === 'function';
  const cells = [];
  for (let i = 0; i < empty; i++) cells.push(<span key={"sp" + i} className="acc__box is-spacer" aria-hidden="true"></span>);
  for (let i = 0; i < req; i++) {
    const on = i < own;
    cells.push(
      <button key={i} type="button" className={"acc__box" + (on ? " is-on" : "")} disabled={!live}
              title={req > 1 ? name + " · unit " + (i + 1) + " of " + req : name}
              onClick={live ? () => onSet(i + 1 === own ? i : i + 1) : undefined}>✓</button>
    );
  }
  return (
    <div className={"acc" + (rows === 2 ? " is-stack" : "") + (done ? " is-done" : "")}>
      <span className="acc__name">{name}</span>
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
  const clusterBp = JoeData.clusterBlueprint(bp);
  const ctxGroups = clusterContexts(bp);

  const setUnit = (name, n) => JoeStore.setAcc(cur.id, name, n);
  const setMoc = (v) => JoeStore.updateInstance(cur.id, { moc: v });
  const setCard = (patch) => JoeStore.updateInstance(cur.id, { filecard: { ...filecard, ...patch } });
  const setNotes = (v) => JoeStore.updateInstance(cur.id, { notes: v });
  const setLoc = (v) => JoeStore.updateInstance(cur.id, { loc: v });
  const setMarks = (val) => {
    const pg = physicalGrade(val), pt = paintGrade(val);
    JoeStore.updateInstance(cur.id, { marks: val, phys: pg.zones ? pg.grade : null, paint: pt.zones ? pt.grade : null });
  };
  const removeCopy = () => {
    if (!window.confirm(`Remove ${fig.name} · No. ${cur.no} from your collection?`)) return;
    // two-way B: offer to keep this copy's accessories as loose parts in the Parts Bin
    const kept = bp.map(([n, q]) => [n, Math.min((raw.acc && raw.acc[n]) || 0, q)]).filter(([, o]) => o > 0);
    if (kept.length) {
      const total = kept.reduce((s, [, o]) => s + o, 0);
      const keep = window.confirm(`This copy has ${total} accessor${total !== 1 ? 'ies' : 'y'}. Keep them as loose parts in your Parts Bin?\n\nOK = keep in Parts Bin · Cancel = discard with the figure`);
      if (keep) JoeStore.depositParts(catalogId, kept.map(([accessory, qty]) => ({ accessory, qty })));
    }
    JoeStore.removeInstance(cur.id);
    const rest = copies.filter(c => c.id !== cur.id);
    if (rest.length) setCurId(rest[0].id); else onClose();
  };

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
              <div className="inv-modal__name">{fig.name}{fig.version ? <em className="idver idver--lg">{fig.version}</em> : null}</div>
              <div className="inv-modal__var">{fig.specialty} · {fig.year}</div>
              {fig.variants > 1 ? <div className="inv-modal__variants"><span className="lyr"><b></b></span>{fig.variants} variants</div> : null}
            </div>
            <div className="inv-modal__notin">NOT IN<br/>INVENTORY</div>
          </div>
          <div className="inv-modal__r">
            <div className="inv-modal__sec">CATALOG ENTRY · you don't own this yet</div>
            {bp.length === 0
              ? <p className="inv-modal__blurb">No accessory blueprint on file for this figure.</p>
              : <React.Fragment>
                  <p className="inv-modal__blurb">Adding it creates your first owned copy and a blank accessory checklist from the blueprint below ({bp.length} piece{bp.length !== 1 ? "s" : ""} to track).</p>
                  <div className="inv-bprint">BLUEPRINT</div>
                  <div className="acc-list">
                    <div className="acc-list__cap"><span>ACCESSORIES</span><span><b>0</b>/{bp.reduce((s, a) => s + a[1], 0)}</span></div>
                    {bp.map((a, i) => <AccItem key={i} name={a[0]} req={a[1]} checked={Array.from({ length: a[1] }, () => false)} />)}
                  </div>
                </React.Fragment>}
            <div className="inv-modal__btns"><button className="invbtn invbtn--go" onClick={() => onAddInstance(fig.id, null)}>＋ ADD TO INVENTORY</button></div>
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
        <button className="inv-modal__x" onClick={onClose}>✕</button>
        <div className={"inv-tabs-rail" + (tucked ? " is-tucked" : "")}>
          {copies.map((c) => (
            <button key={c.id} className={"inv-tab" + (cur.id === c.id ? " is-active" : "")} onClick={() => setCurId(c.id)}>No. {c.no}{c.whole ? " ✓" : ""}</button>
          ))}
          <button className="inv-tab inv-tab--add" title="Add a copy" onClick={() => onAddInstance(fig.id, cur.variant)}>＋</button>
        </div>

        <div className="inv-flip">
          <div className="inv-face inv-face--front">
            {cardHeader}
            <div className="inv-front-body">
              <div className="inv-modal__l">
                <PhotoSlot className="inv-modal__photo" />
                <FactionTag faction={fig.faction} />
                <div className="inv-modal__id">
                  <div className="inv-modal__name">{fig.name}{fig.version ? <em className="idver idver--lg">{fig.version}</em> : null}</div>
                  <div className="inv-modal__var">{fig.specialty} · {fig.year}{cur.variant ? " · var " + cur.variant : ""}</div>
                  {fig.variants > 1 ? <div className="inv-modal__variants"><span className="lyr"><b></b></span>{fig.variants} variants</div> : null}
                </div>
                <CompRing pct={ringPct} size={84} neutral />
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
                    <div className="acc-list__cap"><span>ACCESSORIES</span><span><b>{liveOwn}</b>/{cur.req}</span></div>
                    {clusterBp.solo.map((a, i) => (
                      <AccItem key={i} name={a[0]} req={a[1]}
                               checked={Array.from({ length: a[1] }, (_, k) => k < (raw.acc && raw.acc[a[0]] || 0))}
                               onSet={(n) => setUnit(a[0], n)} />
                    ))}
                    {clusterBp.groups.map((items, i) => (
                      <VariantGroup key={i} items={items} acc={raw.acc || {}} live onSet={setUnit} />
                    ))}
                    {ctxGroups.map((cg) => (
                      <ContextGroup key={cg.context} context={cg.context} items={cg.items}
                                    renderRow={(a) => (
                                      <AccItem key={a[0]} name={a[0]} req={a[1]}
                                               checked={Array.from({ length: a[1] }, (_, k) => k < (raw.acc && raw.acc[a[0]] || 0))}
                                               onSet={(n) => setUnit(a[0], n)} />
                                    )} />
                    ))}
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

                <div className="inv-modal__btns inv-modal__btns--foot">
                  <button className="invbtn-trash" title="Remove this copy" aria-label="Remove this copy" onClick={removeCopy}>
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
    </React.Fragment>
  );
}

export {
  INV_CAT, INV_ERAS, INV_CAT_BY_ID,
  fvm, figParts, figState, applyRebalance, yearParts, invTotals,
  FactionTag, CompRing, CompBar, PhotoSlot, StockBar, AccItem, boxLayout,
  InvDetailModal,
};
