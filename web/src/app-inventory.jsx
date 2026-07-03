// app-inventory.jsx — WORKING inventory view. All owned copies come from
// JoeStore; catalog roster + completeness math from app-detail.jsx.
// Starts EMPTY, persists across reloads. Rolls in the full design-of-record UI:
// bracketed filter groups + faceted "More Filters", active-filter summary line,
// rich rows (version chip · variant pill · ghost catalog-gaps · rebalance),
// two-meter year headers, list + gallery, and the flip-card detail modal.
import React from 'react';
import { JoeStore } from './store.js';
import {
  INV_CAT, INV_ERAS, INV_CAT_BY_ID,
  fvm, figParts, figState, yearParts, invTotals,
  FactionTag, CompRing, CompBar, PhotoSlot, StockBar,
  InvDetailModal,
} from './app-detail.jsx';

function useStore() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => JoeStore.subscribe(force), []);
  return JoeStore.get();
}

// ---------------------------------------------------------------------------
// Roster row (list) + its inline instance accordion
// ---------------------------------------------------------------------------
function Row({ fig, selId, openIds, onToggle, onOpen }) {
  const p = figParts(fig);
  const ghost = fig.owned === 0;
  const multi = fig.owned > 1;
  const isOpen = openIds.has(fig.id);
  const st = ghost ? null : figState(fig);
  const whole = st ? st.currentWhole : 0;
  const canRebalance = st && st.moves.length > 0;
  const active = fig.id === selId;
  const copies = fig._sum ? fig._sum.copies : [];
  const single = copies[0];
  const cardCount = copies.filter(c => c.cardOnFile).length;
  const need = single ? single.req - single.own : (p.req - p.own);

  return (
    <React.Fragment>
      <button className={"inv-row" + (ghost ? " is-ghost" : "") + (active && !multi ? " is-active" : "") + (multi && isOpen ? " is-open" : "")}
              onClick={() => ghost ? onOpen(fig.id, null) : multi ? onToggle(fig.id) : onOpen(fig.id, single.id)}>
        <span className="inv-thumb" data-tag={ghost ? "—" : ""}></span>
        <span className="inv-name">
          <b>{fig.name}{fig.version ? <em className="idver">{fig.version}</em> : null}{fig.variants > 1 ? <span className="idvar" title={fig.variants + " production variants"}><span className="lyr"><b></b></span>{fig.variants} variants</span> : null}</b>
          <i>{fig.specialty || fig.variant}</i>
        </span>
        <FactionTag faction={fig.faction} mini />
        <span className="inv-owned">{ghost ? "—" : "×" + fig.owned}</span>
        <span className="inv-stock">
          {ghost
            ? <span className="inv-ghosttag">not yet owned</span>
            : multi
              ? <span className="inv-stock__multi">
                  {fig.owned} Figures · {whole} Complete
                  {cardCount > 0 && <span className="inv-fc" title={cardCount + " cop" + (cardCount > 1 ? "ies" : "y") + " with file card on file"}>+ {cardCount} &nbsp;File card{cardCount > 1 ? "s" : ""}</span>}
                  {canRebalance && <span className="inv-rebal" title={"Parts owned could complete a copy — " + st.moves.length + " move" + (st.moves.length > 1 ? "s" : "")}>Rebalance</span>}
                </span>
              : <React.Fragment>
                  <StockBar pct={single.pct} />
                  <span className="inv-stock__n">{single.own}/{single.req}</span>
                  {single.pct !== 100 && <span className="inv-stock__miss" title={single.missing.join(', ')}>{single.missing.join(', ') || "—"}</span>}
                  {single.cardOnFile && <span className="inv-fc" title="File card on file">+ File card</span>}
                </React.Fragment>}
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
                <span key={i} className="inv-move">Move <b>{m.qty > 1 ? m.qty + "× " : ""}{m.part}</b> from <b>No. {m.from}</b> → <b>No. {m.to}</b></span>
              ))}
            </div>
          )}
          {copies.map((c) => (
            <button key={c.id} className={"inv-inst" + (active && selId === fig.id ? "" : "")} onClick={() => onOpen(fig.id, c.id)}>
              <span className="inv-inst__tab">↳</span>
              <span className="inv-inst__id"><span>No. {c.no}</span><i>{c.loc || (c.phys ? c.phys + " / " + c.paint : "ungraded")}</i></span>
              <span className="inv-stock"><StockBar pct={c.pct} />{c.cardOnFile && <span className="inv-fc" title="File card on file">+ File card</span>}</span>
              <span className={"inv-need" + (c.pct === 100 ? " is-zero" : "")}>{c.pct === 100 ? "✓ Complete" : "Missing " + (c.req - c.own)}</span>
              <span className="inv-go">▸</span>
            </button>
          ))}
        </div>
      )}
    </React.Fragment>
  );
}

function GalleryCard({ fig, onOpen }) {
  const p = figParts(fig);
  const ghost = fig.owned === 0;
  const multi = fig.owned > 1;
  const st = ghost ? null : figState(fig);
  const copies = fig._sum ? fig._sum.copies : [];
  return (
    <button className={"card inv-card" + (ghost ? " is-ghostcard" : "")} onClick={() => ghost ? onOpen(fig.id, null) : onOpen(fig.id, copies[0].id)}>
      <div className="card__corner"><FactionTag faction={fig.faction} mini /></div>
      <PhotoSlot className="card__photo" />
      <div className="card__name">{fig.name}{fig.version ? <em className="idver">{fig.version}</em> : null}{fig.variants > 1 ? <span className="idvar" title={fig.variants + " production variants"}><span className="lyr"><b></b></span>{fig.variants} variants</span> : null}</div>
      <div className="card__var">{fig.specialty || fig.variant}</div>
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
// Collapsible year section (two meters: Coverage + Complete)
// ---------------------------------------------------------------------------
function YearSection({ year, figs, view, open, onToggleYear, rowProps }) {
  const yp = yearParts(year);
  return (
    <section className={"ysec" + (open ? " is-open" : "")}>
      <button className="ysec__hd" onClick={() => onToggleYear(year)}>
        <span className="ysec__yr">{year}</span>
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
            <div className="inv-cols"><span></span><span>Code Name</span><span>Faction</span><span>Owned</span><span>Stock</span><span>Missing</span><span></span></div>
            {figs.map(f => <Row key={f.id} fig={f} {...rowProps} />)}
          </div>
        ) : (
          <div className="ysec__body">
            <div className="inv-galgrid">{figs.map(f => <GalleryCard key={f.id} fig={f} onOpen={rowProps.onOpen} />)}</div>
          </div>
        )
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------
const FILTER_GROUPS = [
  [{ key: 'all', label: 'All' }, { key: 'complete', label: 'Complete' }, { key: 'incomplete', label: 'Incomplete' }],
  [{ key: 'dupes', label: 'Show Duplicates' }, { key: 'gaps', label: 'Show Collection Gaps' }],
];
const FAC_LABELS = { JOE: 'G.I. Joe', COBRA: 'Cobra', OKTOBER: 'Oktober Guard', DREADNOK: 'Dreadnoks' };
const FACTION_OPTS = [...new Set(INV_CAT.map(f => f.faction))].map(k => ({ key: k, label: FAC_LABELS[k] || k }));
const STATUS_LABEL = { complete: 'Complete', incomplete: 'Incomplete', dupes: 'Duplicates', gaps: 'Collection gaps' };
const COMPLETE_OPTS = [
  { key: 'complete', label: 'Complete' }, { key: 'oneaway', label: '1 part away' },
  { key: 'few', label: 'A few parts' }, { key: 'bare', label: 'Figure only' },
];
const COMPLETE_LABEL = Object.fromEntries(COMPLETE_OPTS.map(o => [o.key, o.label]));
const DUPE_OPTS = [{ key: 'single', label: 'Single' }, { key: 'pair', label: '2 owned' }, { key: 'trio', label: '3+ owned' }];
const DUPE_LABEL = Object.fromEntries(DUPE_OPTS.map(o => [o.key, o.label]));
const CONDITION_OPTS = ['Loose', 'MOC', 'MISB', 'AFA Graded'];
const RELEASE_OPTS = ['Retail', 'Mail-away', 'Convention', 'Store exclusive'];
const ALL_YEARS = [...new Set(INV_CAT.map(y => y.year))].sort((a, b) => a - b);
const YR_MIN = ALL_YEARS[0], YR_MAX = ALL_YEARS[ALL_YEARS.length - 1];

// completeness band for one figure (only meaningful when owned > 0)
function compBand(fig) {
  if (fig.owned === 0) return null;
  const st = figState(fig);
  if (st.completeNow) return 'complete';
  const miss = st.instances.length ? st.instances[0].missing.length : st.reqPer;
  if (miss <= 1) return 'oneaway';
  if (miss <= 3) return 'few';
  return 'bare';
}

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

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
function InventoryView({ onAddFigure, onAddInstance, onNavigate }) {
  useStore();
  const t = invTotals();
  const [view, setView] = React.useState('list');
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const [open, setOpen] = React.useState(() => new Set());
  const [openIds, setOpenIds] = React.useState(() => new Set());
  const [sel, setSel] = React.useState(null); // {catalogId, instId}
  const [yrAsc, setYrAsc] = React.useState(true);
  const [showMore, setShowMore] = React.useState(false);
  const [facFactions, setFacFactions] = React.useState(() => new Set());
  const [facComplete, setFacComplete] = React.useState(() => new Set());
  const [facDupes, setFacDupes] = React.useState(() => new Set());
  const [facYrMin, setFacYrMin] = React.useState(YR_MIN);
  const [facYrMax, setFacYrMax] = React.useState(YR_MAX);

  const chromeRef = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = chromeRef.current; if (!el) return;
    const setH = () => document.documentElement.style.setProperty('--chrome-h', el.offsetHeight + 'px');
    setH();
    const ro = new ResizeObserver(setH); ro.observe(el);
    window.addEventListener('resize', setH);
    return () => { ro.disconnect(); window.removeEventListener('resize', setH); };
  }, []);

  const empty = t.instances === 0;
  const q = query.trim().toLowerCase();
  const yrNarrowed = facYrMin > YR_MIN || facYrMax < YR_MAX;
  const facetCount = facFactions.size + facComplete.size + facDupes.size + (yrNarrowed ? 1 : 0);
  const filtering = !!q || status !== 'all' || facetCount > 0;

  const toggleYear = (y) => setOpen(s => { const n = new Set(s); n.has(y) ? n.delete(y) : n.add(y); return n; });
  const toggleFig = (id) => setOpenIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const openFig = (catalogId, instId) => setSel({ catalogId, instId });
  const setChip = (k) => setStatus(cur => cur === k ? 'all' : k);
  const toggleSet = (setter) => (key) => setter(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const clearFacets = () => { setStatus('all'); setFacFactions(new Set()); setFacComplete(new Set()); setFacDupes(new Set()); setFacYrMin(YR_MIN); setFacYrMax(YR_MAX); };

  const matchQ = (fig) => !q || [fig.name, fig.variant, fig.specialty, fig.version, fig.faction, String(fig.year)].some(s => s && s.toLowerCase().includes(q)) || fig.acc.some(a => a[0].toLowerCase().includes(q));
  const passStatus = (fig) => {
    if (status === 'gaps') return fig.owned === 0;
    if (status === 'dupes') return fig.owned > 1;
    if (fig.owned === 0) return status === 'all' && !!q; // gaps surface via search only
    const st = figState(fig);
    if (status === 'complete') return st.completeNow;
    if (status === 'incomplete') return !st.completeNow;
    return true;
  };
  const passFacets = (fig) => {
    if (facFactions.size && !facFactions.has(fig.faction)) return false;
    if (yrNarrowed && (fig.year < facYrMin || fig.year > facYrMax)) return false;
    if (facComplete.size) { const b = compBand(fig); if (!b || !facComplete.has(b)) return false; }
    if (facDupes.size) {
      const d = fig.owned >= 3 ? 'trio' : fig.owned === 2 ? 'pair' : fig.owned === 1 ? 'single' : null;
      if (!d || !facDupes.has(d)) return false;
    }
    return true;
  };

  // Build view-models grouped by year (catalog roster; filtered to what shows)
  const byYear = {};
  INV_CAT.forEach(cf => { (byYear[cf.year] = byYear[cf.year] || []).push(cf); });
  const years = Object.keys(byYear).map(Number).sort((a, b) => yrAsc ? a - b : b - a);
  const sections = years.map(y => {
    const figs = byYear[y].map(fvm).filter(f => matchQ(f) && passStatus(f) && passFacets(f)).sort((a, b) => a.name.localeCompare(b.name));
    return { year: y, figs };
  }).filter(s => s.figs.length > 0);

  const shownCount = sections.reduce((n, s) => n + s.figs.length, 0);
  const expandAll = () => setOpen(new Set(years));
  const collapseAll = () => setOpen(new Set());
  const rowProps = { selId: sel ? sel.catalogId : null, openIds, onToggle: toggleFig, onOpen: openFig };

  // active-filter tokens
  const tokens = [];
  if (status !== 'all') tokens.push({ cat: 'Status', label: STATUS_LABEL[status], onClear: () => setStatus('all') });
  facFactions.forEach(k => tokens.push({ cat: 'Faction', label: FAC_LABELS[k] || k, onClear: () => toggleSet(setFacFactions)(k) }));
  facComplete.forEach(k => tokens.push({ cat: 'Completeness', label: COMPLETE_LABEL[k], onClear: () => toggleSet(setFacComplete)(k) }));
  facDupes.forEach(k => tokens.push({ cat: 'Copies', label: DUPE_LABEL[k], onClear: () => toggleSet(setFacDupes)(k) }));
  if (yrNarrowed) tokens.push({ cat: 'Years', label: facYrMin + '–' + facYrMax, onClear: () => { setFacYrMin(YR_MIN); setFacYrMax(YR_MAX); } });

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
              <button type="button" className="is-active">Figures</button>
              <a className="inv-nav__soon" href="GI Joe Tracker - Vehicles.html" title="Vehicles & Playsets — in development">Vehicles<em className="inv-nav__tag">In Dev</em></a>
              <button type="button" onClick={() => onNavigate('parts-bin')}>Parts Bin</button>
            </nav>
          </div>
          <div className="invp-mid">
            <label className="inv-search invp-search">
              <span>⌕</span>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="search code name · accessory · year…" />
              {query && <button className="invp-search__x" onClick={() => setQuery('')}>✕</button>}
            </label>
            <button className="inv-addfig" onClick={onAddFigure}><span className="inv-addfig__mk">＋</span>Add Figure</button>
          </div>
          <div className="inv-kpis">
            <div className="invk"><span className="invk__v">{t.inInventory}</span><span className="invk__k">Unique Figures</span></div>
            <div className="invk"><span className="invk__v">{t.instances}</span><span className="invk__k">Total Figures</span></div>
            <div className="invk"><span className="invk__v">{t.complete}<small>/{t.inInventory}</small></span><span className="invk__k">Complete</span></div>
          </div>
        </header>

        {!empty && (
          <React.Fragment>
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
                More Filters{facetCount ? <span className="txtbtn__n">{facetCount}</span> : null}<span className="txtbtn__caret">{showMore ? "▴" : "▾"}</span>
              </button>
              <span className="invp-bar__spacer"></span>
              <span className="invp-bar__count">{filtering ? `${shownCount} of ${t.inInventory}` : `${t.inInventory} figure${t.inInventory !== 1 ? "s" : ""}`}</span>
              <button className="txtbtn" onClick={() => setYrAsc(v => !v)}>YEAR {yrAsc ? "↑" : "↓"}</button>
              {!q && <button className="txtbtn" onClick={open.size ? collapseAll : expandAll}>{open.size ? "Collapse All" : "Expand All"}</button>}
              <div className="inv-seg">
                <button className={view === 'list' ? "is-on" : ""} onClick={() => setView('list')}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true"><rect x="1" y="2" width="12" height="2" fill="currentColor" /><rect x="1" y="6" width="12" height="2" fill="currentColor" /><rect x="1" y="10" width="12" height="2" fill="currentColor" /></svg>
                  List
                </button>
                <button className={view === 'gallery' ? "is-on" : ""} onClick={() => setView('gallery')}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true"><rect x="1" y="1" width="5" height="5" fill="currentColor" /><rect x="8" y="1" width="5" height="5" fill="currentColor" /><rect x="1" y="8" width="5" height="5" fill="currentColor" /><rect x="8" y="8" width="5" height="5" fill="currentColor" /></svg>
                  Gallery
                </button>
              </div>
            </div>

            {showMore && (
              <div className="invp-facets">
                <FacetRow label="FACTION" options={FACTION_OPTS} selected={facFactions} onToggle={toggleSet(setFacFactions)} facColors />
                <FacetRow label="COMPLETENESS" options={COMPLETE_OPTS} selected={facComplete} onToggle={toggleSet(setFacComplete)} />
                <FacetRow label="COPIES OWNED" options={DUPE_OPTS} selected={facDupes} onToggle={toggleSet(setFacDupes)} />
                <div className="facet">
                  <span className="facet__lab"><b>YEAR RANGE</b></span>
                  <div className="facet__range">
                    <select value={facYrMin} onChange={e => { const v = +e.target.value; setFacYrMin(Math.min(v, facYrMax)); }}>{ALL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select>
                    <span>to</span>
                    <select value={facYrMax} onChange={e => { const v = +e.target.value; setFacYrMax(Math.max(v, facYrMin)); }}>{ALL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select>
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
          </React.Fragment>
        )}
      </div>

      <main className="invp-body">
        {empty ? (
          <div className="inv-zero">
            <div className="inv-zero__mk" aria-hidden="true">
              <svg width="60" height="60" viewBox="0 0 34 34" fill="none">
                <rect x="3.5" y="8" width="27" height="18" rx="2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <line x1="3.5" y1="12.5" x2="30.5" y2="12.5" stroke="currentColor" strokeWidth="2" />
                <rect x="6.5" y="14.5" width="7.5" height="8.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <line x1="17.5" y1="16" x2="27.5" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="17.5" y1="19" x2="27.5" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M29 21.5 H21 L22.7 24.5 H29 Z" fill="currentColor" />
              </svg>
            </div>
            <div className="inv-zero__h">Your collection is empty</div>
            <div className="inv-zero__sub">Search {INV_CAT.length} catalogued figures, pick the production variant, log condition &amp; accessories — and build your collection from the ground up. Everything you add is saved on this machine.</div>
            <button className="inv-zero__btn" onClick={onAddFigure}><span>＋</span> ADD YOUR FIRST FIGURE</button>
          </div>
        ) : sections.length === 0 ? (
          <div className="invp-empty">No figures match.</div>
        ) : sections.map(s => (
          <YearSection key={s.year} year={s.year} figs={s.figs} view={view}
                       open={filtering ? true : open.has(s.year)} onToggleYear={toggleYear} rowProps={rowProps} />
        ))}
      </main>

      {sel && <InvDetailModal key={sel.catalogId} catalogId={sel.catalogId} instId={sel.instId} onClose={() => setSel(null)} onAddInstance={onAddInstance} />}
    </div>
  );
}

export { InventoryView };
