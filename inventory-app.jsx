// inventory-app.jsx — full-page inventory: All grouped into collapsible year
// sections w/ sticky headers, sticky toolbar (search · filter chips · view ·
// expand-all), list (with inline multi-instance accordion) + gallery views,
// and the figure detail modal. Reuses the shared widgets from wf-data.jsx.
const { DATA, figParts, figState, figComplete, yearParts, totals, FactionTag, CompRing, CompBar, PhotoSlot } = window;

// per-instance state now comes from figState(fig).instances (wf-data.jsx) — a
// derived per-copy allocation (scattered "as-stored" + greedy "optimal") that
// powers complete-now vs. completable and the rebalance recommender.
const INST_NOTES = ["loose · tight joints", "on display", "MOC · sealed", "spare · for parts", "repaint · custom"];
const INST_LOC = ["BIN C-04 · long-box", "Display shelf 2", "BIN A-11 · loose", "Tote 7 · spares", "BIN C-04 · long-box"];

// File-card printings known for a figure (sample stand-in for a real filecard_lookup
// table keyed to the figure). Tracked per copy: present? + which printing. A SEPARATE
// collecting axis — never feeds accessory completeness.
const FILECARDS = [
  { letter: 'A', name: 'First print', tell: '“© 1983 Hasbro” footer · deep-olive border · glossy stock' },
  { letter: 'B', name: 'Reissue ’85', tell: '“© 1984 Hasbro” footer · brighter green border · same art' },
  { letter: 'C', name: 'Mail-away', tell: 'flat matte stock · no border rule · catalog-printed back' },
];

function StockBar({ pct }) {
  const done = pct === 100;
  return <div className="inv-bar"><div className={"inv-bar__fill" + (done ? " is-done" : "")} style={{ width: Math.max(pct, 2) + "%" }}></div></div>;
}

// ---------------------------------------------------------------------------
// Accessory checklist — one checkbox per required unit, in CSV order.
// Layout standard: 1 row for 1–3 units; 4+ split across two rows with the TOP
// row right-aligned (cols = ceil(n/2)). So 4 → 2×2, 5 → 2 over 3, 6 → 3×3.
// ---------------------------------------------------------------------------
function boxLayout(req) {
  const rows = req <= 3 ? 1 : 2;
  const cols = rows === 1 ? req : Math.ceil(req / 2);
  return { rows, cols, empty: cols * rows - req };
}

// Parts Bin (loose spares by part type) — a part here can be pulled onto any copy
// that's missing it. Matches the seed used by Add Figure / Instance Detail.
const INV_BIN0 = { "Backpack": 3, "Rifle": 2, "AK Rifle": 2, "Pistol": 2, "Helmet": 1, "Ammo Box": 1 };

function AccItem({ name, req, checked, onSet, binCount = 0, onPull }) {
  const { rows, cols, empty } = boxLayout(req);
  const own = checked.reduce((s, c) => s + (c ? 1 : 0), 0);
  const done = own >= req;
  const live = typeof onSet === 'function';
  const canPull = live && !done && binCount > 0 && typeof onPull === 'function';
  const cells = [];
  for (let i = 0; i < empty; i++) cells.push(<span key={"sp" + i} className="acc__box is-spacer" aria-hidden="true"></span>);
  for (let i = 0; i < req; i++) {
    const on = i < own; // units fill contiguously: ticking #4 implies #1–#3
    cells.push(
      <button key={i} type="button" className={"acc__box" + (on ? " is-on" : "")}
              disabled={!live} title={req > 1 ? name + " · unit " + (i + 1) + " of " + req : name}
              onClick={live ? () => onSet(i + 1 === own ? i : i + 1) : undefined}>✓</button>
    );
  }
  return (
    <div className={"acc" + (rows === 2 ? " is-stack" : "") + (done ? " is-done" : "")}>
      <span className="acc__name">{name}{canPull && <button type="button" className="acc__pullbin" onClick={onPull} title={"Pull a " + name + " from your Parts Bin (" + binCount + " loose)"}>+bin {binCount}</button>}</span>
      <div className="acc__boxes" style={{ gridTemplateColumns: "repeat(" + cols + ", 22px)" }}>{cells}</div>
      <span className="acc__count">{own}/{req}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roster row (list view) + its inline instance accordion
// ---------------------------------------------------------------------------
function Row({ fig, isAll, selId, selInst, openIds, onToggle, onOpen }) {
  const p = figParts(fig);
  const ghost = fig.owned === 0;
  const need = p.req - p.own;
  const missing = fig.acc.filter(a => a[2] < a[1]).map(a => a[1] > 1 ? a[0] + " " + a[2] + "/" + a[1] : a[0]);
  const multi = fig.owned > 1;
  const isOpen = openIds.has(fig.id);
  const st = figState(fig);
  const insts = multi ? st.instances : null;
  const whole = st.currentWhole;
  const canRebalance = st.moves.length > 0; // completable but not whole now
  const active = fig.id === selId;

  return (
    <React.Fragment>
      <button className={"inv-row" + (ghost ? " is-ghost" : "") + (active && !multi ? " is-active" : "") + (multi && isOpen ? " is-open" : "")}
              onClick={() => multi ? onToggle(fig.id) : onOpen(fig.id)}>
        <span className="inv-thumb" data-tag={ghost ? "—" : ""}></span>
        <span className="inv-name">
          <b>{fig.name}{fig.version ? <em className="idver">{fig.version}</em> : null}{fig.variants > 1 ? <span className="idvar" title={fig.variants + " production variants"}><span className="lyr"><b></b></span>{fig.variants} variants</span> : null}{fig.subteam ? <span className="idsub" title={"Sub-team · " + fig.subteam}>{fig.subteam}</span> : null}</b>
          {fig.fullName ? <span className="idfull">{fig.fullName}</span> : null}
          <i>{isAll ? fig.year + " · " : ""}{fig.specialty || fig.variant}</i>
          {fig.vehicle ? <span className="idveh"><b>Drives</b>{fig.vehicle}</span> : null}
        </span>
        <FactionTag faction={fig.faction} mini />
        <span className="inv-owned">{ghost ? "—" : "×" + fig.owned}</span>
        <span className="inv-stock">
          {ghost
            ? <span className="inv-ghosttag">not yet owned</span>
            : multi
              ? <span className="inv-stock__multi">
                  {fig.owned} copies · {whole} complete
                  {canRebalance && <span className="inv-rebal" title={"Parts owned could complete a copy — " + st.moves.length + " move" + (st.moves.length > 1 ? "s" : "")}>Rebalance</span>}
                </span>
              : <StockBar pct={p.pct} />}
        </span>
        <span className={"inv-need" + ((multi ? whole > 0 : need === 0) ? " is-zero" : "") + (ghost ? " is-ghost" : "") + (!ghost && !multi && canRebalance ? " is-rebal" : "")}>
          {ghost ? "＋ Add" : multi ? (whole === fig.owned ? "✓ Complete" : whole + "/" + fig.owned) : need === 0 ? "✓ Complete" : "Missing " + need}
        </span>
        <span className="inv-go">{multi ? (isOpen ? "▾" : "▸") : "▸"}</span>
      </button>

      {multi && isOpen && (
        <div className="inv-insts">
          {canRebalance && (
            <div className="inv-rebalbox">
              <span className="inv-rebalbox__hd">Rebalance — you own enough parts to complete {st.optimalWhole} cop{st.optimalWhole > 1 ? "ies" : "y"}:</span>
              {st.moves.slice(0, 4).map((m, i) => (
                <span key={i} className="inv-move">Move <b>{m.part}</b> from <b>No. {m.from}</b> → <b>No. {m.to}</b></span>
              ))}
            </div>
          )}
          {insts.map((ins, i) => (
            <button key={i} className={"inv-inst" + (fig.id === selId && selInst === i + 1 ? " is-active" : "")}
                    onClick={() => onOpen(fig.id, i + 1)}>
              <span className="inv-inst__tab">↳</span>
              <span className="inv-inst__id"><span>No. {ins.no}</span><i>{INST_NOTES[(fig.id + i) % INST_NOTES.length]}</i></span>
              <span className="inv-stock">
                <StockBar pct={ins.pct} />
              </span>
              <span className={"inv-need" + (ins.pct === 100 ? " is-zero" : "")}>
                {ins.pct === 100 ? "✓ Complete" : "Missing " + (ins.req - ins.own)}
              </span>
              <span className="inv-go">▸</span>
            </button>
          ))}
        </div>
      )}
    </React.Fragment>
  );
}

function GalleryCard({ fig, isAll, onOpen }) {
  const p = figParts(fig);
  const ghost = fig.owned === 0;
  const multi = fig.owned > 1;
  const st = figState(fig);
  return (
    <button className={"card inv-card" + (ghost ? " is-ghostcard" : "")} onClick={() => onOpen(fig.id)}>
      <div className="card__corner"><FactionTag faction={fig.faction} mini /></div>
      <PhotoSlot className="card__photo" />
      <div className="card__name">{fig.name}{fig.version ? <em className="idver">{fig.version}</em> : null}{fig.variants > 1 ? <span className="idvar" title={fig.variants + " production variants"}><span className="lyr"><b></b></span>{fig.variants} variants</span> : null}{fig.subteam ? <span className="idsub" title={"Sub-team · " + fig.subteam}>{fig.subteam}</span> : null}</div>
      {fig.fullName ? <div className="card__full">{fig.fullName}</div> : null}
      <div className="card__var">{isAll ? fig.year + " · " : ""}{fig.specialty || fig.variant}</div>
      {fig.vehicle ? <div className="idveh"><b>Drives</b>{fig.vehicle}</div> : null}
      {!ghost && multi && st.moves.length > 0 && <div className="card__rebal">Rebalance</div>}
      <div className="card__foot">
        <span className="card__own">{ghost ? "Not owned" : "Owned ×" + fig.owned}</span>
        {ghost
          ? <span className="card__add">＋ Add</span>
          : multi
            ? <span className={"card__multi" + (st.currentWhole > 0 ? " is-whole" : "")}>{st.currentWhole}/{fig.owned} ✓</span>
            : <CompRing pct={p.pct} size={46} neutral />}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Collapsible year section
// ---------------------------------------------------------------------------
function YearSection({ year, figs, view, open, onToggleYear, rowProps }) {
  const yp = yearParts(year);
  return (
    <section className={"ysec" + (open ? " is-open" : "")}>
      <button className="ysec__hd" onClick={() => onToggleYear(year.year)}>
        <span className="ysec__yr">{year.year}</span>
        <span className="ysec__title">
          <span className="ysec__meta">{yp.owned}/{yp.figs} owned · {yp.completeNow} complete</span>
        </span>
        <span className="ysec__meters">
          <span className="ysec__meter">
            <span className="ysec__meterlab">Coverage</span>
            <span className="ysec__bar"><CompBar pct={yp.coverage} height={8} /></span>
            <span className="ysec__metern">{yp.owned}/{yp.figs}</span>
          </span>
          <span className="ysec__meter">
            <span className="ysec__meterlab">Complete</span>
            <span className="ysec__bar"><CompBar pct={yp.completion} height={8} /></span>
            <span className="ysec__metern">{yp.completeNow}/{yp.owned}</span>
          </span>
        </span>
        <span className="ysec__pct">{yp.completion}%</span>
        <span className="ysec__chev">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        view === 'list' ? (
          <div className="ysec__body">
            <div className="inv-cols">
              <span></span><span>Code Name</span><span>Faction</span><span>Owned</span><span>Stock</span><span>Missing</span><span></span>
            </div>
            {figs.map(f => <Row key={f.id} fig={f} {...rowProps} />)}
          </div>
        ) : (
          <div className="ysec__body">
            <div className="inv-galgrid">
              {figs.map(f => <GalleryCard key={f.id} fig={f} isAll={rowProps.isAll} onOpen={rowProps.onOpen} />)}
            </div>
          </div>
        )
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Detail modal (instances · blueprint · acquire)
// ---------------------------------------------------------------------------
function InvModal({ fig, onClose, initialInst = 1, onEdit }) {
  const p = figParts(fig);
  const ghost = fig.owned === 0;
  const need = p.req - p.own;
  const st = figState(fig);
  const [inst, setInst] = React.useState(initialInst);
  // live, per-copy checkbox state — seeded from the derived "as-stored"
  // allocation, then editable so ticking a unit updates the ring + counts.
  const [boxes, setBoxes] = React.useState(() =>
    ghost ? [] : st.instances.map(ins => fig.acc.map(([n, r], k) =>
      Array.from({ length: r }, (_, j) => j < ins.have[k])
    ))
  );
  const [cardState, setCardState] = React.useState(() =>
    ghost ? [] : st.instances.map((_, i) => ({ onFile: i === 0, printing: 'A' }))
  );
  const setCard = (patch) => setCardState(prev => prev.map((c, i) => i === inst - 1 ? { ...c, ...patch } : c));
  const [mocState, setMocState] = React.useState(() => ghost ? [] : st.instances.map(() => false));
  const setMoc = (v) => setMocState(prev => prev.map((m, i) => i === inst - 1 ? v : m));
  // flip-to-condition + per-copy damage state (uses the shared window.DamageMap module)
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
  const [dmgState, setDmgState] = React.useState(() =>
    ghost ? [] : st.instances.map((_, i) => {
      const v = window.dmEmpty(fig.body || 'male');
      if (i === 0) v.condition.front = { waist: 1 };   // sample: hairline at the o-ring
      return v;
    })
  );
  const dmg = !ghost ? dmgState[inst - 1] : null;
  const setDmg = (val) => setDmgState(prev => prev.map((d, i) => i === inst - 1 ? val : d));
  const DMap = window.DamageMap, DGrade = window.GradeBadge;
  const dmgPhys = !ghost && dmg ? window.physicalGrade(dmg) : null;
  const dmgPaint = !ghost && dmg ? window.paintGrade(dmg) : null;
  const setCount = (accIdx, n) => setBoxes(prev => {
    const next = prev.map(c => c.map(arr => arr.slice()));
    const arr = next[inst - 1][accIdx];
    for (let j = 0; j < arr.length; j++) arr[j] = j < n;
    return next;
  });
  const instOwn = (i) => boxes[i] ? boxes[i].reduce((s, arr) => s + arr.filter(Boolean).length, 0) : 0;
  const instWhole = (i) => boxes[i] ? boxes[i].every((arr, k) => arr.filter(Boolean).length >= fig.acc[k][1]) : false;
  // pull-from-bin: a loose spare of this part type ticks the next unit on this copy.
  const [bin, setBin] = React.useState(INV_BIN0);
  const pullBin = (accIdx, name) => {
    if (!(bin[name] > 0)) return;
    const have = boxes[inst - 1][accIdx].filter(Boolean).length;
    if (have >= fig.acc[accIdx][1]) return;
    setBin(b => ({ ...b, [name]: b[name] - 1 }));
    setCount(accIdx, have + 1);
  };
  // inline click-to-edit per-copy notes (autosave on blur)
  const [notes, setNotes] = React.useState(() => ghost ? [] : st.instances.map((_, i) => INST_NOTES[(fig.id + i) % INST_NOTES.length]));
  const [editNote, setEditNote] = React.useState(false);
  // bin/box location — grouped with notes as this-copy metadata (click-to-edit, autosave on blur)
  const [loc, setLoc] = React.useState(() => ghost ? [] : st.instances.map((_, i) => INST_LOC[(fig.id + i) % INST_LOC.length]));
  const [editLoc, setEditLoc] = React.useState(false);
  React.useEffect(() => { setEditNote(false); setEditLoc(false); }, [inst]);
  // country of origin — per-copy mold stamp(s); only present for figures the catalog identifies.
  // seeded as a mock so each copy shows a representative stamp (No.1 → first listed, etc.).
  const [coo, setCoo] = React.useState(() => ghost ? [] : st.instances.map((_, i) => fig.coo ? { [fig.coo[i % fig.coo.length]]: true } : {}));
  const toggleCoo = (c) => setCoo(prev => prev.map((m, i) => i === inst - 1 ? { ...m, [c]: !m[c] } : m));
  const [extra, setExtra] = React.useState(0);  // copies added via the + tab this session
  // OPTIMISTIC ROLLUP: report ticked-units-per-accessory up to InventoryApp so the row,
  // year meters and KPIs recompute live. Surplus loose parts are preserved app-side.
  React.useEffect(() => {
    if (ghost || typeof onEdit !== 'function') return;
    const ticked = fig.acc.map((_, k) => boxes.reduce((s, c) => s + c[k].filter(Boolean).length, 0));
    onEdit(fig.id, ticked);
  }, [boxes]);
  React.useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  // copies added live via the + tab — appended to the derived list with empty per-copy state
  const addedInsts = ghost ? [] : Array.from({ length: extra }, (_, i) => ({
    no: st.instances.length + i + 1,
    have: fig.acc.map(() => 0),
    missing: fig.acc.flatMap(([n, r]) => Array.from({ length: r }, () => n)),
    whole: false,
  }));
  const allInsts = ghost ? [] : [...st.instances, ...addedInsts];
  const addCopy = () => {
    setBoxes(prev => [...prev, fig.acc.map(([n, r]) => Array.from({ length: r }, () => false))]);
    setCardState(prev => [...prev, { onFile: false, printing: 'A' }]);
    setMocState(prev => [...prev, false]);
    setDmgState(prev => [...prev, { side: 'front', body: 'male', phys: [], paint: [] }]);
    setNotes(prev => [...prev, ""]);
    setLoc(prev => [...prev, ""]);
    setCoo(prev => [...prev, {}]);
    setExtra(e => e + 1);
    setInst(allInsts.length + 1);
  };
  const curInst = !ghost ? allInsts[inst - 1] : null;
  const curBoxes = !ghost ? boxes[inst - 1] : null;
  const curCard = !ghost ? cardState[inst - 1] : null;
  const curMoc = !ghost ? mocState[inst - 1] : false;
  const liveOwn = !ghost ? instOwn(inst - 1) : 0;
  const liveWhole = !ghost ? instWhole(inst - 1) : false;
  const ringPct = ghost ? 0 : curMoc ? 100 : (curInst ? (curInst.req ? Math.round((liveOwn / curInst.req) * 100) : 100) : 0);

  // one persistent header for BOTH faces: identical chrome + the MOC flag + a single
  // FIGURE|CONDITION toggle. MOC sits left of the toggle so it reads before the flip control.
  const cardHeader = !ghost ? (
    <div className="inv-cardhd">
      <div className="inv-cardhd__id"><b>{fig.name}</b><span className="inv-cardhd__no">No. {curInst ? curInst.no : 1}</span></div>
      <div className="inv-cardhd__ctrls">
        <label className={"inv-cardhd__moc" + (curMoc ? " is-on" : "")} title="Mint on Card — sealed & unopened; locks this copy 100% complete">
          <input type="checkbox" checked={curMoc} onChange={e => setMoc(e.target.checked)} />
          <span className="inv-cardhd__mocbox">{curMoc ? "\u2713" : ""}</span>
          <span className="inv-cardhd__moclab">MOC</span>
        </label>
        <div className="inv-cardhd__seg">
          <button className={!flipped ? "is-on" : ""} onClick={() => flipTo(false)}>FIGURE</button>
          <button className={flipped ? "is-on" : ""} onClick={() => flipTo(true)}>CONDITION</button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <React.Fragment>
      <div className="inv-scrim" onClick={onClose}></div>
      <div className={"inv-cardwrap" + (flipped ? " is-flipped" : "")}>
        <button className="inv-modal__x" onClick={onClose}>✕</button>
        {!ghost && (
          <div className={"inv-tabs-rail" + (tucked ? " is-tucked" : "")}>
            {allInsts.map((ins, i) => (
              <button key={i} className={"inv-tab" + (inst === i + 1 ? " is-active" : "")} onClick={() => setInst(i + 1)}>No. {ins.no}</button>
            ))}
            <button className="inv-tab inv-tab--add" title="Add a copy" onClick={addCopy}>＋</button>
          </div>
        )}
        <div className="inv-flip">
        <div className="inv-face inv-face--front">
        {cardHeader}
        <div className="inv-front-body">
        <div className="inv-modal__l">
          <div className="inv-modal__photo wf-photo"><span className="wf-photo__tag">FIG. PHOTO</span></div>
          <FactionTag faction={fig.faction} />
          <div className="inv-modal__id">
            <div className="inv-modal__name">{fig.name}{fig.version ? <em className="idver idver--lg">{fig.version}</em> : null}</div>
            {fig.fullName ? <div className="inv-modal__full">{fig.fullName}</div> : null}
            <div className="inv-modal__var">{fig.specialty || fig.variant} · {fig.year}</div>
            {fig.vehicle ? <div className="idveh idveh--modal"><b>Drives</b>{fig.vehicle}</div> : null}
            {fig.variants > 1 ? <div className="inv-modal__variants"><span className="lyr"><b></b></span>{fig.variants} variants</div> : null}
          </div>
          {ghost
            ? <div className="inv-modal__notin">NOT IN<br/>INVENTORY</div>
            : <CompRing pct={ringPct} size={84} neutral />}
          {!ghost && !curMoc && !liveWhole && <div className="inv-modal__ringlab">COMPLETENESS</div>}
        </div>

        <div className="inv-modal__r">
          {ghost ? (
            <div className="inv-modal__acquire">
              <div className="inv-modal__sec">CATALOG ENTRY · you don't own this yet</div>
              {fig.acc.length === 0 ? (
                <React.Fragment>
                  <p className="inv-modal__blurb">{fig.vehicle ? "A vehicle driver — packed in with the " + fig.vehicle + ", with no separate figure accessories to track." : "No accessory blueprint on file for this figure."}</p>
                  {fig.vehicle ? <div className="acc-list"><div className="acc-list__cap"><span>VEHICLE</span><span><b>{fig.vehicle}</b></span></div><div className="acc acc--note">Driver figure · completeness is tracked on the vehicle, not loose parts.</div></div> : null}
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <p className="inv-modal__blurb">Adding it creates your first owned instance and a blank accessory checklist from the blueprint below ({fig.acc.length} pieces to track).</p>
                  <div className="inv-bprint">BLUEPRINT</div>
                  <div className="acc-list">
                    <div className="acc-list__cap"><span>ACCESSORY · CHECK PER UNIT</span><span><b>0</b>/{fig.acc.reduce((s, a) => s + a[1], 0)}</span></div>
                    {fig.acc.map((a, i) => (
                      <AccItem key={i} name={a[0]} req={a[1]} checked={Array.from({ length: a[1] }, () => false)} />
                    ))}
                  </div>
                </React.Fragment>
              )}
              <div className="inv-modal__btns"><button className="invbtn invbtn--go">＋ ADD TO INVENTORY</button></div>
            </div>
          ) : (
            <React.Fragment>
              {st.moves.length > 0 && (
                <div className="inv-rebalbox inv-rebalbox--modal">
                  <span className="inv-rebalbox__hd">Rebalance — your loose parts can complete {st.optimalWhole} cop{st.optimalWhole > 1 ? "ies" : "y"}:</span>
                  {st.moves.slice(0, 5).map((m, i) => (
                    <span key={i} className="inv-move">Move <b>{m.part}</b> from <b>No. {m.from}</b> → <b>No. {m.to}</b></span>
                  ))}
                  <button className="invbtn invbtn--rebal">APPLY MOVES</button>
                </div>
              )}

              {curMoc ? (
                <div className="acc-list">
                  <div className="acc-list__cap"><span>ACCESSORY · SEALED ON CARD</span><span><b>MOC</b></span></div>
                  <div className="acc acc--note">Sealed &amp; unopened — accessories assumed complete on card; not tracked individually while MOC.</div>
                </div>
              ) : fig.acc.length === 0 ? (
                <div className="acc-list">
                  <div className="acc-list__cap"><span>{fig.vehicle ? "VEHICLE" : "ACCESSORIES"}</span>{fig.vehicle ? <span><b>{fig.vehicle}</b></span> : null}</div>
                  <div className="acc acc--note">{fig.vehicle ? "No accessories released with figure. " : "No accessories on file for this figure."}</div>
                </div>
              ) : (
                <div className="acc-list">
                  <div className="acc-list__cap"><span>ACCESSORY · CHECK PER UNIT</span><span><b>{liveOwn}</b>/{curInst.req}</span></div>
                  {fig.acc.map((a, i) => (
                    <AccItem key={i} name={a[0]} req={a[1]} checked={curBoxes[i]} onSet={(n) => setCount(i, n)} binCount={bin[a[0]] || 0} onPull={() => pullBin(i, a[0])} />
                  ))}
                </div>
              )}
              <div className="acc-list fc-list">
                <div className="acc-list__cap"><span>FILE CARD · THIS COPY</span><span>{curCard.onFile ? <b>ON FILE</b> : "NOT ON FILE"}</span></div>
                <div className="acc fc-row">
                  <span className="acc__name">Card on file</span>
                  {curCard.onFile
                    ? <span className="fc-selwrap"><select className="fc-sel" value={curCard.printing} onChange={e => setCard({ printing: e.target.value })}>{FILECARDS.map(c => <option key={c.letter} value={c.letter}>{c.letter} · {c.name}</option>)}</select><span className="fc-caret">▾</span></span>
                    : <span className="fc-hint">tracked separately · not a completeness requirement</span>}
                  <button className={"acc__box fc-box" + (curCard.onFile ? " is-on" : "")} onClick={() => setCard({ onFile: !curCard.onFile })} title={curCard.onFile ? "Mark card not on file" : "Mark file card on file"}>{curCard.onFile ? "✓" : ""}</button>
                </div>
                {curCard.onFile && <div className="fc-tellrow"><span>{"\n"}</span><span className="fc-cat">{"\n\n"}</span></div>}
              </div>
              <div className="inv-copymeta">
              <div className="inv-copymeta__cap">THIS COPY</div>
              <div className="inv-notes">
                <div className="inv-notes__cap">NOTES</div>
                {editNote ? (
                  <textarea className="inv-notes__in" rows={2} autoFocus defaultValue={notes[inst - 1]} placeholder="Notes on this copy…"
                            onBlur={(e) => { const v = e.target.value; setNotes(prev => prev.map((n, i) => i === inst - 1 ? v : n)); setEditNote(false); }}></textarea>
                ) : (
                  <div className={"inv-notes__txt" + (notes[inst - 1] ? "" : " is-empty")} onClick={() => setEditNote(true)} title="Click to edit">{notes[inst - 1] || "Click to add notes on this copy…"}</div>
                )}
              </div>
              <div className="inv-notes inv-loc">
                <div className="inv-notes__cap">BIN / BOX LOCATION</div>
                {editLoc ? (
                  <input className="inv-notes__in inv-loc__in" autoFocus defaultValue={loc[inst - 1]} placeholder="e.g. BIN C-04 · long-box"
                         onBlur={(e) => { const v = e.target.value; setLoc(prev => prev.map((x, i) => i === inst - 1 ? v : x)); setEditLoc(false); }} />
                ) : (
                  <div className={"inv-notes__txt inv-loc__txt" + (loc[inst - 1] ? "" : " is-empty")} onClick={() => setEditLoc(true)} title="Click to edit">{loc[inst - 1] || "Click to add this copy's bin / box location…"}</div>
                )}
              </div>
              {fig.coo && fig.coo.length > 0 && (
                <div className="inv-notes inv-coo">
                  <div className="inv-notes__cap">COUNTRY OF ORIGIN <span className="inv-coo__hint">· mold stamp on this copy</span></div>
                  <div className="inv-coo__opts">
                    {fig.coo.map(c => {
                      const on = !!(coo[inst - 1] && coo[inst - 1][c]);
                      return (
                        <label key={c} className={"af-coo__opt" + (on ? " is-on" : "")}>
                          <input type="checkbox" checked={on} onChange={() => toggleCoo(c)} />
                          <span className="af-coo__box">{on ? "✓" : ""}</span>
                          <span className="af-coo__lab">{c}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              </div>
              <div className="inv-modal__btns inv-modal__btns--foot">
                <button className="invbtn-trash" title="Remove this copy" aria-label="Remove this copy">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M2.5 4h11M6 4V2.6h4V4M3.9 4l.7 9.4h6.8l.7-9.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M6.6 6.4v5M9.4 6.4v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"></path>
                  </svg>
                </button>
              </div>
            </React.Fragment>
          )}
        </div>
        </div>
        </div>
        {!ghost && (
          <div className="inv-face inv-face--back inv-cardback">
            {cardHeader}
            <div className="inv-cardback__body">
              <div className="inv-cardback__map">
                {curMoc ? (
                  <div className="id-sealed">
                    <div className="id-sealed__card"><div className="id-sealed__tag">MINT ON CARD</div><div className="id-sealed__sub">SEALED · UNOPENED</div></div>
                    <p>The loose-figure condition diagram doesn't apply to a carded copy. Note any card or bubble flaws in the copy's notes.</p>
                  </div>
                ) : (
                  <DMap value={dmg} onChange={setDmg} genderLocked={true} />
                )}
              </div>
              <div className="inv-cardback__side">
                <section className="panel">
                  <div className="panel__hd">CONDITION <em>· {curMoc ? "mint on card" : "derived from damage"}</em></div>
                  {curMoc ? (
                    <div className="id-mocgrade"><span className="id-mocgrade__badge">MOC</span><div className="id-mocgrade__txt"><b>Factory mint · sealed</b><i>100% complete — not graded on the loose scale while carded.</i></div></div>
                  ) : (
                    <React.Fragment>
                      <div className="grades"><DGrade kind="PHYSICAL" result={dmgPhys} /><DGrade kind="PAINT" result={dmgPaint} /></div>
                      <div className="panel__note">Grades update live from the map. Click a zone to cycle its severity; switch the Condition / Paint tabs to grade each.</div>
                    </React.Fragment>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </React.Fragment>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
const FILTER_GROUPS = [
  [ { key: 'all', label: 'All' }, { key: 'complete', label: 'Complete' }, { key: 'incomplete', label: 'Incomplete' } ],
  [ { key: 'dupes', label: 'Show Duplicates' }, { key: 'gaps', label: 'Show Collection Gaps' } ],
];

// ── faceted "More Filters" config (OPEN_QUESTIONS #7 / TAXONOMY.md) ──────────
// Combination rule: OR within a facet, AND across facets.
const FACTION_OPTS = [
  { key: 'JOE', label: 'G.I. Joe' }, { key: 'COBRA', label: 'Cobra' },
  { key: 'OKTOBER', label: 'Oktober Guard' }, { key: 'DREADNOK', label: 'Dreadnoks' },
];
const FAC_LABEL = Object.fromEntries(FACTION_OPTS.map(o => [o.key, o.label]));
// Sub-team is sparse (71% blank in the real catalog) — derive the option list
// from whatever the data actually carries so the facet only offers real filters.
const SUBTEAM_OPTS = [...new Set(DATA.flatMap(y => y.figures).map(f => f.subteam).filter(Boolean))].sort();
const STATUS_LABEL = { complete: 'Complete', incomplete: 'Incomplete', dupes: 'Duplicates', gaps: 'Collection gaps' };

// Completeness band — finer cut of "Incomplete", derived live from figState's
// best-copy missing-parts count. (Complete here == has at least one whole copy.)
const COMPLETE_OPTS = [
  { key: 'complete', label: 'Complete' }, { key: 'oneaway', label: '1 part away' },
  { key: 'few', label: 'A few parts' }, { key: 'bare', label: 'Figure only' },
];
const COMPLETE_LABEL = Object.fromEntries(COMPLETE_OPTS.map(o => [o.key, o.label]));
// Duplicate depth — finer cut of "Show Duplicates", keyed off owned count.
const DUPE_OPTS = [ { key: 'single', label: 'Single' }, { key: 'pair', label: '2 owned' }, { key: 'trio', label: '3+ owned' } ];
const DUPE_LABEL = Object.fromEntries(DUPE_OPTS.map(o => [o.key, o.label]));
// Condition — NOT in the data yet (needs a per-instance grade field). Mocked
// disabled, same treatment as Release. NOTE: no "Complete" value here — that's a
// completeness concept, not a condition. MOC interacts with completeness (see
// the modal MOC flag): a sealed/carded copy is assumed factory-complete.
const CONDITION_OPTS = ['Loose', 'MOC', 'MISB', 'AFA Graded'];
// Release context — disabled mock (retail / mail-away / convention / exclusive).
const RELEASE_OPTS = ['Retail', 'Mail-away', 'Convention', 'Store exclusive'];
// year bounds for the range facet
const ALL_YEARS = DATA.map(y => y.year).sort((a, b) => a - b);
const YR_MIN = ALL_YEARS[0], YR_MAX = ALL_YEARS[ALL_YEARS.length - 1];

// ── sort axes (apply WITHIN each year section — grouping stays by year) ──────
const SORTS = [
  { key: 'name',     label: 'Code Name',        dir: 'asc'  },
  { key: 'pct',      label: '% Complete',        dir: 'desc' },
  { key: 'closest',  label: 'Closest to done',   dir: 'asc'  },
  { key: 'copies',   label: 'Copies owned',      dir: 'desc' },
  { key: 'added',    label: 'Recently added',    dir: 'desc' },
  { key: 'modified', label: 'Recently modified', dir: 'desc' },
];
const SORT_LABEL = Object.fromEntries(SORTS.map(s => [s.key, s.label]));
const SORT_DEFDIR = Object.fromEntries(SORTS.map(s => [s.key, s.dir]));
// PROTOTYPE-ONLY synthesized timestamps. Production reads real added_at /
// modified_at columns on owned_figures (see BACKEND_AND_SCALE.md); here we hash
// the id to a stable, plausible date so the two recency sorts are demonstrable.
const _TS_BASE = Date.UTC(2026, 5, 1);
const _TS_DAY = 86400000;
function _hash01(n) { const x = Math.sin(n * 999.13) * 10000; return x - Math.floor(x); }
function figMeta(f) {
  const addedAgo = Math.floor(_hash01(f.id * 1.7) * 690) + 5;
  const modAgo = Math.floor(_hash01(f.id * 2.3) * addedAgo);
  return { addedAt: _TS_BASE - addedAgo * _TS_DAY, modifiedAt: _TS_BASE - modAgo * _TS_DAY };
}
function sortKey(f, key) {
  if (key === 'pct') return figParts(f).pct;
  if (key === 'closest') { const p = figParts(f); const miss = p.req - p.own; return miss === 0 ? Infinity : miss; }
  if (key === 'copies') return f.owned;
  if (key === 'added') return figMeta(f).addedAt;
  if (key === 'modified') return figMeta(f).modifiedAt;
  return f.name;
}
function cmpFigs(a, b, key, dir) {
  const ka = sortKey(a, key), kb = sortKey(b, key);
  let c = (typeof ka === 'string') ? ka.localeCompare(kb) : ka - kb;
  c = dir === 'asc' ? c : -c;
  if (c === 0) c = a.name.localeCompare(b.name); // stable name tiebreak
  return c;
}

// ── user-saved views: capture the FULL filter state (chips + facets) + sort ──
// (query is transient, not part of a saved view.) Persisted to localStorage.
function viewSig(v) {
  return JSON.stringify([
    v.status, [...v.factions].sort(), [...v.subteams].sort(), [...v.complete].sort(),
    [...v.dupes].sort(), v.vehicle, v.yrMin, v.yrMax, v.sortBy, v.sortDir,
  ]);
}
const SAVED_KEY = 'gijoe.savedViews.v3';
function loadSaved() { try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch (e) { return []; } }
function persistSaved(v) { try { localStorage.setItem(SAVED_KEY, JSON.stringify(v)); } catch (e) {} }

// completeness band for one figure (only meaningful when owned > 0)
function compBand(f) {
  const st = figState(f);
  if (!st.owned) return null;
  if (st.completeNow) return 'complete';
  const miss = st.instances.length ? st.instances[0].missing.length : st.reqPer;
  if (miss <= 1) return 'oneaway';
  if (miss <= 3) return 'few';
  return 'bare';
}

// one multi-select facet row (label + wrap-able chips). `facColors` tints active
// chips with their faction color; `off` renders the whole row disabled.
function FacetRow({ label, sub, options, selected, onToggle, facColors, off, note }) {
  return (
    <div className={"facet" + (off ? " is-off" : "")}>
      <span className="facet__lab"><b>{label}</b>{sub ? <small>{sub}</small> : null}</span>
      <div className="facet__chips">
        {options.map(o => {
          const key = typeof o === 'string' ? o : o.key;
          const lab = typeof o === 'string' ? o : o.label;
          const on = !off && selected.has(key);
          const cls = "chip" + (facColors ? " chip--fac chip--" + key.toLowerCase() : "") + (on ? " is-on" : "");
          return (
            <button key={key} className={cls} disabled={off} onClick={off ? undefined : () => onToggle(key)}>
              {lab}{on ? <span className="chip__x">✕</span> : null}
            </button>
          );
        })}
        {note ? <span className="facet__note">{note}</span> : null}
      </div>
    </div>
  );
}

function InventoryApp() {
  const [edits, setEdits] = React.useState({}); // optimistic per-figure accessory edits {figId: [tickedPerAcc]}
  const onFigEdit = React.useCallback((figId, ticked) => setEdits(e => {
    const prev = e[figId];
    if (prev && prev.length === ticked.length && prev.every((v, i) => v === ticked[i])) return e;
    return { ...e, [figId]: ticked };
  }), []);
  const [view, setView] = React.useState('list');
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState('all'); // all|incomplete|complete|dupes|gaps
  const [open, setOpen] = React.useState(() => new Set());     // expanded years
  const [openIds, setOpenIds] = React.useState(() => new Set()); // figures w/ instance accordion open
  const [selId, setSelId] = React.useState(null);
  const [selInst, setSelInst] = React.useState(1);
  const [yrAsc, setYrAsc] = React.useState(true);
  const [addOpen, setAddOpen] = React.useState(false);
  const [showMore, setShowMore] = React.useState(false);
  const [facFactions, setFacFactions] = React.useState(() => new Set()); // multi
  const [facSubteams, setFacSubteams] = React.useState(() => new Set()); // multi
  const [facComplete, setFacComplete] = React.useState(() => new Set()); // multi (completeness band)
  const [facDupes, setFacDupes] = React.useState(() => new Set());       // multi (duplicate depth)
  const [facVehicle, setFacVehicle] = React.useState(false);             // flag
  const [facYrMin, setFacYrMin] = React.useState(YR_MIN);
  const [facYrMax, setFacYrMax] = React.useState(YR_MAX);
  // ── V3: sort + user-saved views ──
  const [sortBy, setSortBy] = React.useState('name');
  const [sortDir, setSortDir] = React.useState('asc');
  const [sortOpen, setSortOpen] = React.useState(false);
  const [saved, setSaved] = React.useState(loadSaved);
  const [saving, setSaving] = React.useState(false);
  const [saveName, setSaveName] = React.useState('');

  const chromeRef = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = chromeRef.current; if (!el) return;
    const setH = () => document.documentElement.style.setProperty('--chrome-h', el.offsetHeight + 'px');
    setH();
    const ro = new ResizeObserver(setH);   // recalc when the facet panel / summary line / views row open & close
    ro.observe(el);
    window.addEventListener('resize', setH);
    return () => { ro.disconnect(); window.removeEventListener('resize', setH); };
  }, []);

  const q = query.trim().toLowerCase();
  const yrNarrowed = facYrMin > YR_MIN || facYrMax < YR_MAX;
  const facetCount = facFactions.size + facSubteams.size + facComplete.size + facDupes.size + (facVehicle ? 1 : 0) + (yrNarrowed ? 1 : 0);
  const filtering = !!q || status !== 'all' || facetCount > 0;

  const toggleYear = (y) => setOpen(s => { const n = new Set(s); n.has(y) ? n.delete(y) : n.add(y); return n; });
  const toggleFig = (id) => setOpenIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const openFig = (id, inst = 1) => { setSelInst(inst); setSelId(id); };
  const setChip = (k) => setStatus(cur => cur === k ? 'all' : k);
  const toggleSet = (setter) => (key) => setter(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const clearFacets = () => { setStatus('all'); setFacFactions(new Set()); setFacSubteams(new Set()); setFacComplete(new Set()); setFacDupes(new Set()); setFacVehicle(false); setFacYrMin(YR_MIN); setFacYrMax(YR_MAX); };

  // ── V3: sort + saved-view handlers ──
  const pickSort = (key) => { setSortBy(key); setSortDir(SORT_DEFDIR[key]); setSortOpen(false); };
  const flipDir = () => setSortDir(d => d === 'asc' ? 'desc' : 'asc');
  const captureView = () => ({
    status, factions: [...facFactions], subteams: [...facSubteams], complete: [...facComplete],
    dupes: [...facDupes], vehicle: facVehicle, yrMin: facYrMin, yrMax: facYrMax, sortBy, sortDir,
  });
  const applyView = (v) => {
    setStatus(v.status || 'all');
    setFacFactions(new Set(v.factions || [])); setFacSubteams(new Set(v.subteams || []));
    setFacComplete(new Set(v.complete || [])); setFacDupes(new Set(v.dupes || []));
    setFacVehicle(!!v.vehicle); setFacYrMin(v.yrMin == null ? YR_MIN : v.yrMin); setFacYrMax(v.yrMax == null ? YR_MAX : v.yrMax);
    setSortBy(v.sortBy || 'name'); setSortDir(v.sortDir || 'asc');
  };
  const doSave = () => {
    const name = saveName.trim() || ('View ' + (saved.length + 1));
    const next = [...saved, { id: 'sv' + Date.now(), name, view: captureView() }];
    setSaved(next); persistSaved(next); setSaving(false); setSaveName('');
  };
  const deleteSaved = (id) => { const next = saved.filter(s => s.id !== id); setSaved(next); persistSaved(next); };

  const matchQ = (f, year) => !q || [f.name, f.variant, f.specialty, f.fullName, f.vehicle, f.version, f.faction, f.subteam, String(year)].some(s => s && s.toLowerCase().includes(q)) || f.acc.some(a => a[0].toLowerCase().includes(q));
  const passStatus = (f) => {
    if (status === 'gaps') return f.owned === 0;
    if (status === 'dupes') return f.owned > 1;
    if (f.owned === 0) return status === 'all' && !!q; // gaps surface only via search in 'all'
    const st = figState(f);
    if (status === 'complete') return st.completeNow;
    if (status === 'incomplete') return !st.completeNow;
    return true; // 'all' (owned)
  };
  // OR within a facet, AND across facets. (Condition + Release are intentionally unwired.)
  const passFacets = (f, year) => {
    if (facFactions.size && !facFactions.has(f.faction)) return false;
    if (facSubteams.size && !(f.subteam && facSubteams.has(f.subteam))) return false;
    if (facVehicle && !f.vehicle) return false;
    if (yrNarrowed && (year < facYrMin || year > facYrMax)) return false;
    if (facComplete.size) { const b = compBand(f); if (!b || !facComplete.has(b)) return false; }
    if (facDupes.size) {
      const d = f.owned >= 3 ? 'trio' : f.owned === 2 ? 'pair' : f.owned === 1 ? 'single' : null;
      if (!d || !facDupes.has(d)) return false;
    }
    return true;
  };

  // OPTIMISTIC ROLLUP: fold in-session accessory edits into a working copy of the
  // dataset, then derive EVERYTHING (KPIs, year meters, rows, the open modal) from it.
  const applyEdits = (fig) => {
    const e = edits[fig.id];
    if (!e) return fig;
    return { ...fig, acc: fig.acc.map(([n, r, own], k) => {
      const surplus = Math.max(0, own - r * fig.owned); // loose extras beyond capacity stay put
      return [n, r, (e[k] != null ? e[k] : Math.min(own, r * fig.owned)) + surplus];
    }) };
  };
  const effData = Object.keys(edits).length
    ? DATA.map(y => ({ ...y, figures: y.figures.map(applyEdits) }))
    : DATA;
  const t = totals(effData);

  // grouping stays by YEAR; V3 sort applies WITHIN each section
  const order = [...effData].sort((a, b) => yrAsc ? a.year - b.year : b.year - a.year);
  const sections = order.map(y => {
    const figs = y.figures.filter(f => matchQ(f, y.year) && passStatus(f) && passFacets(f, y.year)).sort((a, b) => cmpFigs(a, b, sortBy, sortDir));
    return { year: y, figs };
  }).filter(s => s.figs.length > 0);

  const shownCount = sections.reduce((n, s) => n + s.figs.length, 0);
  const sel = selId != null ? (effData.flatMap(y => y.figures.map(f => ({ ...f, year: y.year }))).find(f => f.id === selId)) : null;

  const expandAll = () => setOpen(new Set(DATA.map(y => y.year)));
  const collapseAll = () => setOpen(new Set());

  const rowProps = { isAll: false, selId, selInst, openIds, onToggle: toggleFig, onOpen: openFig };

  // active-filter tokens for the summary line (status + every active facet)
  const tokens = [];
  if (status !== 'all') tokens.push({ cat: 'Status', label: STATUS_LABEL[status], onClear: () => setStatus('all') });
  facFactions.forEach(k => tokens.push({ cat: 'Faction', label: FAC_LABEL[k] || k, onClear: () => toggleSet(setFacFactions)(k) }));
  facSubteams.forEach(k => tokens.push({ cat: 'Sub-team', label: k, onClear: () => toggleSet(setFacSubteams)(k) }));
  facComplete.forEach(k => tokens.push({ cat: 'Completeness', label: COMPLETE_LABEL[k], onClear: () => toggleSet(setFacComplete)(k) }));
  facDupes.forEach(k => tokens.push({ cat: 'Copies', label: DUPE_LABEL[k], onClear: () => toggleSet(setFacDupes)(k) }));
  if (yrNarrowed) tokens.push({ cat: 'Years', label: facYrMin + '–' + facYrMax, onClear: () => { setFacYrMin(YR_MIN); setFacYrMax(YR_MAX); } });
  if (facVehicle) tokens.push({ cat: 'Vehicle', label: 'Driver / pilot', onClear: () => setFacVehicle(false) });

  // which saved view (if any) the current state exactly matches
  const curSig = viewSig(captureView());
  const activeSavedId = (saved.find(sv => viewSig(sv.view) === curSig) || {}).id;

  return (
    <div className="invp">
      <div className="invp-chrome" ref={chromeRef}>
        <header className="invp-top">
          <div className="inv-brand">
            <span className="inv-brand__mk" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 34 34" fill="none">
                <rect x="3.5" y="8" width="27" height="18" rx="2" stroke="#f3eee2" strokeWidth="2" strokeLinejoin="round" />
                <line x1="3.5" y1="12.5" x2="30.5" y2="12.5" stroke="#f3eee2" strokeWidth="2" />
                <rect x="6.5" y="14.5" width="7.5" height="8.5" stroke="#f3eee2" strokeWidth="2" strokeLinejoin="round" />
                <line x1="17.5" y1="16" x2="27.5" y2="16" stroke="#f3eee2" strokeWidth="2" strokeLinecap="round" />
                <line x1="17.5" y1="19" x2="27.5" y2="19" stroke="#f3eee2" strokeWidth="2" strokeLinecap="round" />
                <path d="M29 21.5 H21 L22.7 24.5 H29 Z" fill="#f3eee2" />
              </svg>
            </span>
            <span className="inv-brand__name">G.I. JOE<br/>COLLECTION</span>
            <nav className="inv-nav">
              <a href="GI Joe Tracker - Inventory.html" className="is-active">Figures</a>
              <a className="inv-nav__soon" href="GI Joe Tracker - Vehicles.html" title="Vehicles & Playsets — in development">Vehicles<em className="inv-nav__tag">In Dev</em></a>
              <a href="GI Joe Tracker - Parts Bin.html">Parts Bin</a>
            </nav>
          </div>
          <div className="invp-mid">
            <label className="inv-search invp-search">
              <span>⌕</span>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="search code name · accessory · year…" />
              {query && <button className="invp-search__x" onClick={() => setQuery('')}>✕</button>}
            </label>
            <button className="inv-addfig" onClick={() => setAddOpen(true)}><span className="inv-addfig__mk">＋</span>Add Figure</button>
          </div>
          <div className="inv-kpis">
            <div className="invk"><span className="invk__v">{t.inInventory}</span><span className="invk__k">Unique Figures</span></div>
            <div className="invk"><span className="invk__v">{t.instances}</span><span className="invk__k">Total Figures</span></div>
            <div className="invk"><span className="invk__v">{t.complete}<small>/{t.inInventory}</small></span><span className="invk__k">Complete</span></div>
          </div>
        </header>

        <div className="invp-bar">
          <div className="chipgroup">
            {FILTER_GROUPS[0].map(f => (
              <button key={f.key} className={"chip" + (status === f.key ? " is-on" : "")} onClick={() => f.key === 'all' ? setStatus('all') : setChip(f.key)}>
                {f.label}{status === f.key && f.key !== 'all' ? <span className="chip__x">✕</span> : null}
              </button>
            ))}
          </div>
          <span className="invp-bar__spacer"></span>
          <div className="chipgroup">
            {FILTER_GROUPS[1].map(f => (
              <button key={f.key} className={"chip" + (status === f.key ? " is-on" : "")} onClick={() => setChip(f.key)}>
                {f.label}{status === f.key ? <span className="chip__x">✕</span> : null}
              </button>
            ))}
          </div>
          <button className={"txtbtn txtbtn--more" + (showMore ? " is-on" : "")} onClick={() => setShowMore(v => !v)} aria-expanded={showMore}>
            {"More Filters"}{facetCount ? <span className="txtbtn__n">{facetCount}</span> : null}<span className="txtbtn__caret">{showMore ? "▴" : "▾"}</span>
          </button>
          {/* V3: sort control — applies within each year section */}
          <div className="sortwrap">
            <button className={"txtbtn txtbtn--sort" + (sortOpen ? " is-on" : "")} onClick={() => setSortOpen(v => !v)} aria-expanded={sortOpen}>
              Sort: {SORT_LABEL[sortBy]}<span className="txtbtn__caret">▾</span>
            </button>
            <button className="dirbtn" onClick={flipDir} title={sortDir === 'asc' ? 'Ascending — flip to descending' : 'Descending — flip to ascending'}>{sortDir === 'asc' ? '▲' : '▼'}</button>
            {sortOpen ? (
              <React.Fragment>
                <div className="sortmenu__scrim" onClick={() => setSortOpen(false)}></div>
                <div className="sortmenu">
                  <div className="sortmenu__cap">SORT WITHIN EACH YEAR</div>
                  {SORTS.map(s => (
                    <button key={s.key} className={"sortmenu__item" + (sortBy === s.key ? " is-on" : "")} onClick={() => pickSort(s.key)}>
                      <span className="sortmenu__check">{sortBy === s.key ? '✓' : ''}</span>{s.label}
                    </button>
                  ))}
                </div>
              </React.Fragment>
            ) : null}
          </div>
          <span className="invp-bar__spacer"></span>
          {!q && <button className="txtbtn" onClick={open.size ? collapseAll : expandAll}>{open.size ? "Collapse All" : "Expand All"}</button>}
          <div className="inv-seg">
            <button className={view === 'list' ? "is-on" : ""} onClick={() => setView('list')}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="1" y="2" width="12" height="2" fill="currentColor" />
                <rect x="1" y="6" width="12" height="2" fill="currentColor" />
                <rect x="1" y="10" width="12" height="2" fill="currentColor" />
              </svg>
              List
            </button>
            <button className={view === 'gallery' ? "is-on" : ""} onClick={() => setView('gallery')}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="5" height="5" fill="currentColor" />
                <rect x="8" y="1" width="5" height="5" fill="currentColor" />
                <rect x="1" y="8" width="5" height="5" fill="currentColor" />
                <rect x="8" y="8" width="5" height="5" fill="currentColor" />
              </svg>
              Gallery
            </button>
          </div>
        </div>

        {/* V3: saved-views strip — your own filter+sort combos, one tap to recall */}
        <div className="invp-views">
          <span className="invp-views__lab">VIEWS</span>
          <div className="invp-views__row">
            {saved.length === 0 && !saving ? <span className="invp-views__empty">Tune the chips, facets &amp; sort, then save the combo for one-tap recall →</span> : null}
            {saved.map(sv => (
              <span key={sv.id} className={"viewpill viewpill--saved" + (activeSavedId === sv.id ? " is-on" : "")}>
                <button className="viewpill__main" onClick={() => applyView(sv.view)}><span className="viewpill__bm">▣</span>{sv.name}</button>
                <button className="viewpill__del" title="Delete saved view" onClick={() => deleteSaved(sv.id)}>✕</button>
              </span>
            ))}
          </div>
          <div className="invp-views__save">
            {saving ? (
              <span className="saveform">
                <input autoFocus value={saveName} onChange={e => setSaveName(e.target.value)}
                       onKeyDown={e => { if (e.key === 'Enter') doSave(); if (e.key === 'Escape') { setSaving(false); setSaveName(''); } }}
                       placeholder="Name this view…" />
                <button className="saveform__ok" onClick={doSave}>Save</button>
                <button className="saveform__x" onClick={() => { setSaving(false); setSaveName(''); }}>✕</button>
              </span>
            ) : (
              <button className="txtbtn txtbtn--save" onClick={() => { setSaving(true); setSaveName(''); }} title="Save the current chips + facets + sort as a reusable view">＋ Save view</button>
            )}
          </div>
        </div>

        {showMore && (
          <div className="invp-facets">
            <FacetRow label="FACTION" options={FACTION_OPTS}
                      selected={facFactions} onToggle={toggleSet(setFacFactions)} facColors />
            <FacetRow label="COMPLETENESS" options={COMPLETE_OPTS}
                      selected={facComplete} onToggle={toggleSet(setFacComplete)} />
            <FacetRow label="SUB-TEAM" options={SUBTEAM_OPTS}
                      selected={facSubteams} onToggle={toggleSet(setFacSubteams)} />
            <FacetRow label="COPIES OWNED" options={DUPE_OPTS}
                      selected={facDupes} onToggle={toggleSet(setFacDupes)} />
            <div className="facet">
              <span className="facet__lab"><b>YEAR RANGE</b></span>
              <div className="facet__range">
                <select value={facYrMin} onChange={e => { const v = +e.target.value; setFacYrMin(Math.min(v, facYrMax)); }}>
                  {ALL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <span>to</span>
                <select value={facYrMax} onChange={e => { const v = +e.target.value; setFacYrMax(Math.max(v, facYrMin)); }}>
                  {ALL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div className="facet">
              <span className="facet__lab"><b>VEHICLE DRIVER / PILOT</b></span>
              <div className="facet__chips">
                <button className={"chip" + (facVehicle ? " is-on" : "")} onClick={() => setFacVehicle(v => !v)}>
                  Driver/ Pilot{facVehicle ? <span className="chip__x">✕</span> : null}
                </button>
              </div>
            </div>
            <div className="facet facet--span is-off">
              <span className="facet__lab"><b>NOT TRACKED YET</b><small>shown for sign-off — needs new fields</small></span>
              <div className="facet__mock">
                <span className="facet__mocklab">Condition</span>
                {CONDITION_OPTS.map(o => <button key={o} className="chip" disabled>{o}</button>)}
                <span className="facet__mockdiv"></span>
                <span className="facet__mocklab">Release</span>
                {RELEASE_OPTS.map(o => <button key={o} className="chip" disabled>{o}</button>)}
              </div>
            </div>
          </div>
        )}

        {tokens.length > 0 && (
          <div className="invp-active">
            <span className="invp-active__lab">FILTERING</span>
            {tokens.map((tk, i) => (
              <button key={i} className="invtok" onClick={tk.onClear} title={"Remove " + tk.cat + " filter"}>
                <b>{tk.cat}</b>{tk.label}<span className="invtok__x">✕</span>
              </button>
            ))}
            <button className="invp-active__clear" onClick={clearFacets}>Clear all</button>
          </div>
        )}
      </div>

      <main className="invp-body">
        {sections.length === 0
          ? <div className="invp-empty">No figures match.</div>
          : sections.map(s => (
              <YearSection key={s.year.year} year={s.year} figs={s.figs} view={view}
                           open={q ? true : open.has(s.year.year)}
                           onToggleYear={toggleYear} rowProps={rowProps} />
            ))}
      </main>

      {sel && <InvModal key={sel.id} fig={sel} initialInst={selInst} onClose={() => setSelId(null)} onEdit={onFigEdit} />}
      {addOpen && window.AddFigure && <window.AddFigure onClose={() => setAddOpen(false)} />}
    </div>
  );
}

Object.assign(window, { InventoryApp });
