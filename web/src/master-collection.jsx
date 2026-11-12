// master-collection.jsx — Master Collection page. Same year-section / row /
// accordion layout as the Figures page, but lists only figures with >=1 copy
// the owner has starred as a permanent keeper, and each row's accordion holds
// only those starred copies (a figure with 3 owned copies and 1 star shows
// that 1 copy, not all 3).
import React from 'react';
import { JoeStore } from './store.js';
import {
  INV_CAT, fvm, invTotals, invMasterTotals,
  FactionTag, CompBar, StockBar, MasterBadge,
  InvDetailModal,
} from './app-detail.jsx';
import { VersionChip, VariantBadge, VariantBracket, VehicleTag, EditionTag, SetTag, SubGroupTag } from './fig-identity.jsx';
import { formatYear } from './fig-identity.js';
import { BrandHome, VehiclesNavLink } from './line-ui.jsx';
import { LINE } from '../../shared/line-profile.js';
import { normalizeSearch } from './search-util.js';

function useStore() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => JoeStore.subscribe(force), []);
  return JoeStore.get();
}

function titleCase(s) { return (s || '').toLowerCase().replace(/(^|[\s\-'.])\S/g, (c) => c.toUpperCase()); }

function gradeText(c) {
  return c.loc || (c.phys ? c.phys + ' / ' + c.paint : 'ungraded');
}

// Per-year "kept/target" rollup for the year header's Kept meter — same
// capped-contribution idiom as invMasterTotals(), just scoped to the figures
// grouped under one year instead of the whole collection.
function targetStats(ents) {
  let met = 0, target = 0;
  ents.forEach(({ targets }) => targets.forEach((tg) => { target += tg.target; met += Math.min(tg.count, tg.target); }));
  return { met, target };
}

const YEAR_STATS_KEY = 'mc_year_stats_v1';
const COO_SHORT = { China: 'CN', 'Hong Kong': 'HK', Indonesia: 'ID' };
const MC_FILTERS = [{ key: 'all', label: 'All' }, { key: 'met', label: 'Target Met' }, { key: 'under', label: 'Under Target' }];

// Figure row + starred-copy accordion — the Figures page's .inv-row /
// .inv-insts layout (app-inventory.jsx Row), with the Owned/Stock/Missing
// columns repurposed as Starred/Targets/Need.
function McRow({ ent, isOpen, onToggle, onOpen }) {
  const { fig, starred, starredLetters, targets, stats } = ent;
  const need = stats.target - stats.met;
  const hasCoo = fig.coo.length > 0;
  const keptCoo = new Set(starred.map((c) => c.coo).filter(Boolean));
  return (
    <React.Fragment>
      <button className={"inv-row" + (isOpen ? " is-open" : "")} onClick={() => onToggle(fig.id)}>
        <span className="inv-thumb"></span>
        <span className="inv-name">
          <b>{fig.name}<VersionChip version={fig.version} /><EditionTag context={fig.releaseContext} conventionKind={fig.conventionKind} /><SetTag sets={fig.sets} /><SubGroupTag subGroup={fig.subGroup} /><VariantBracket variants={fig._cf.variants} owned={starredLetters} /><VehicleTag vehicle={fig.vehicle} inline /></b>
          <i>{fig.specialty}</i>
        </span>
        <FactionTag faction={fig.faction} mini />
        <span className="inv-owned mc-starred">★{starred.length}</span>
        <span className="inv-stock mc-targets">
          {targets.map((tg) => (
            <span key={tg.letter} className={"mc-target" + (tg.target > 0 && tg.count >= tg.target ? " is-met" : "")}>
              {tg.letter && <b>{tg.letter}</b>}{tg.count}/{tg.target}
            </span>
          ))}
          {hasCoo && fig.coo.map((country, i) => (
            <span key={country} className={"mc-target mc-target--coo" + (i === 0 ? " is-first" : "") + (keptCoo.has(country) ? " is-met" : "")} title={country}>
              <b>{COO_SHORT[country] || country}</b>{keptCoo.has(country) ? "✓" : "—"}
            </span>
          ))}
        </span>
        <span className={"inv-need" + (need <= 0 ? " is-zero" : "")}>{need <= 0 ? "✓ Kept" : "Need " + need}</span>
        <span className="inv-go">{isOpen ? "▾" : "▸"}</span>
      </button>
      {isOpen && (
        <div className="inv-insts">
          <input
            className="mc-note"
            defaultValue={fig.masterNotes}
            placeholder="Note"
            onBlur={(e) => JoeStore.setFigureMasterNotes(fig.id, e.target.value)}
          />
          {starred.map((c) => (
            <button key={c.id} className="inv-inst" onClick={() => onOpen(fig.id, c.id)}>
              <span className="inv-inst__tab">★</span>
              <span className="inv-inst__id"><span>{titleCase(fig.name)}<VariantBadge letter={c.variant} /> No. {c.no}</span><i>{gradeText(c)}</i></span>
              <span className="inv-stock">{hasCoo && <span className={"mc-coo" + (c.coo ? "" : " is-missing")}>{c.coo || "COO"}</span>}<StockBar pct={c.pct} />{LINE.features.fileCards && c.cardOnFile && <span className="inv-fc" title="File card on file">+ File Card</span>}</span>
              <span className={"inv-need" + (c.pct === 100 ? " is-zero" : "")}>{c.pct === 100 ? "✓ Complete" : "Missing " + (c.req - c.own)}</span>
              <span className="inv-go">▸</span>
            </button>
          ))}
        </div>
      )}
    </React.Fragment>
  );
}

const McCols = () => <div className="inv-cols"><span></span><span>{LINE.labels.codeName}</span><span>{LINE.labels.team}</span><span className="mc-cols__starred">Starred</span><span>Targets</span><span>Need</span><span></span></div>;

function MasterCollectionView({ onNavigate, onAddInstance }) {
  useStore();
  const t = invTotals();
  const mt = invMasterTotals();
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const [sel, setSel] = React.useState(null); // {catalogId, instId}
  const [sortMode, setSortMode] = React.useState('year'); // 'year' | 'az'
  const [yrAsc, setYrAsc] = React.useState(true); // year mode only — oldest (1982) first by default
  const [openYears, setOpenYears] = React.useState(() => new Set()); // year sections start collapsed
  const [openIds, setOpenIds] = React.useState(() => new Set());
  const [yearStats, setYearStats] = React.useState(() => {
    try { return localStorage.getItem(YEAR_STATS_KEY) !== '0'; } catch { return true; }
  });
  React.useEffect(() => { try { localStorage.setItem(YEAR_STATS_KEY, yearStats ? '1' : '0'); } catch {} }, [yearStats]);
  const toggleYear = (y) => setOpenYears(s => { const n = new Set(s); n.has(y) ? n.delete(y) : n.add(y); return n; });
  const toggleFig = (id) => setOpenIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const openFig = (catalogId, instId) => setSel({ catalogId, instId });

  // same sticky-header offset the Figures page publishes (.ysec__hd top)
  const chromeRef = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = chromeRef.current; if (!el) return;
    const setH = () => document.documentElement.style.setProperty('--chrome-h', el.offsetHeight + 'px');
    setH();
    const ro = new ResizeObserver(setH); ro.observe(el);
    window.addEventListener('resize', setH);
    return () => { ro.disconnect(); window.removeEventListener('resize', setH); };
  }, []);

  const q = normalizeSearch(query);
  const matchQ = (fig) => !q || [fig.name, fig.specialty, fig.faction, formatYear(fig.year)].some(s => s && normalizeSearch(s).includes(q));

  // One entry per figure with >=1 starred instance, carrying ONLY the
  // starred copies plus per-variant target/progress context (target
  // defaults to 1 everywhere — see migrations/009_master_collection.sql).
  const entries = INV_CAT.map(fvm)
    .filter(matchQ)
    .map((fig) => {
      const allCopies = fig._sum ? fig._sum.copies : [];
      const starred = allCopies.filter((c) => c.masterCollection);
      if (!starred.length) return null;
      // starred-only ownership — deliberately narrower than the Figures page's
      // "any owned copy" bracket, since this page is specifically about what's
      // been kept as a permanent copy, not just what's in the collection at all.
      const starredLetters = new Set(starred.map((c) => c.variant).filter(Boolean));
      const targets = (fig._cf.variants || []).map((v) => {
        const letter = v.letter || '';
        const count = allCopies.filter((c) => (c.variant || '') === letter && c.masterCollection).length;
        return { letter, count, target: v.masterTarget || 0 };
      }).filter((v) => v.target > 0 || v.count > 0);
      const ent = { fig, starred, starredLetters, targets };
      ent.stats = targetStats([ent]);
      return ent;
    })
    .filter(Boolean)
    .filter((e) => status === 'all' || (status === 'met' ? e.stats.met >= e.stats.target : e.stats.met < e.stats.target))
    .sort((a, b) => sortMode === 'az'
      ? a.fig.name.localeCompare(b.fig.name)
      : (yrAsc ? a.fig.year - b.fig.year : b.fig.year - a.fig.year) || a.fig.name.localeCompare(b.fig.name));

  const empty = mt.starredCopies === 0;
  const filtering = !!q || status !== 'all';

  // Year grouping only applies in YEAR sort mode — A–Z mode stays a flat
  // list, since interleaving years alphabetically would make headers
  // meaningless. `entries` is already sorted by year, so a Map preserves
  // the right group order for free.
  let yearGroups = null;
  if (sortMode === 'year') {
    const byYear = new Map();
    entries.forEach((e) => {
      const y = e.fig.year;
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(e);
    });
    yearGroups = [...byYear.entries()];
  }
  const anyYearOpen = yearGroups ? yearGroups.some(([y]) => openYears.has(y)) : false;
  const expandAllYears = () => setOpenYears(new Set(yearGroups.map(([y]) => y)));
  const collapseAllYears = () => setOpenYears(new Set());

  const renderRow = (e) => <McRow key={e.fig.id} ent={e} isOpen={openIds.has(e.fig.id)} onToggle={toggleFig} onOpen={openFig} />;

  return (
    <div className="invp">
      <div className="invp-chrome" ref={chromeRef}>
        <header className="invp-top">
          <div className="inv-brand">
            <BrandHome onNavigate={onNavigate} />
            <nav className="inv-nav">
              <button type="button" onClick={() => onNavigate('figures')}>Figures</button>
              <VehiclesNavLink />
              <button type="button" onClick={() => onNavigate('parts-bin')}>Parts Bin</button>
            </nav>
          </div>
          <div className="invp-mid">
            <label className="inv-search invp-search">
              <span>⌕</span>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="search the Master Collection…" />
              {query && <button className="invp-search__x" onClick={() => setQuery('')}>✕</button>}
            </label>
          </div>
          {/* identical tile set to the Figures page so the header doesn't reflow between pages */}
          <div className="inv-kpis">
            <div className="invk"><span className="invk__v">{t.inInventory}</span><span className="invk__k">Unique Figures</span></div>
            <div className="invk"><span className="invk__v">{t.instances}</span><span className="invk__k">Total Figures</span></div>
            <div className="invk"><span className="invk__v">{t.complete}<small>/{t.inInventory}</small></span><span className="invk__k">Complete</span></div>
            <button type="button" className="invk invk--master" title="Back to all Figures" onClick={() => onNavigate('figures')}>
              <MasterBadge size={20} />
              <span className="invk__v">{mt.metSum}<small>/{mt.targetSum}</small></span>
              <span className="invk__k">Master Collection</span>
            </button>
          </div>
        </header>

        {!empty && (
          <div className="invp-bar">
            <div className="chipgroup">
              {MC_FILTERS.map(f => (
                <button key={f.key} className={"chip" + (status === f.key ? " is-on" : "")} onClick={() => setStatus(status === f.key ? 'all' : f.key)}>
                  {f.label}{status === f.key && f.key !== 'all' ? <span className="chip__x">✕</span> : null}
                </button>
              ))}
            </div>
            <span className="invp-bar__spacer"></span>
            {filtering && <span className="invp-bar__count">{entries.length} of {mt.figuresIn}</span>}
            <button
              className="txtbtn"
              onClick={() => sortMode === 'year' ? setYrAsc(v => !v) : setSortMode('year')}
            >
              YEAR {sortMode === 'year' ? (yrAsc ? "↑" : "↓") : ""}
            </button>
            <button
              className={"txtbtn" + (sortMode === 'az' ? " is-on" : "")}
              onClick={() => setSortMode('az')}
            >
              A–Z
            </button>
            {yearGroups && !filtering && (
              <button className="txtbtn" onClick={anyYearOpen ? collapseAllYears : expandAllYears}>
                {anyYearOpen ? "Collapse All" : "Expand All"}
              </button>
            )}
            {yearGroups && (
              <button
                className={"txtbtn" + (yearStats ? " is-on" : "")}
                onClick={() => setYearStats(v => !v)}
                title="Show the Kept meter on each year header"
              >
                Stats
              </button>
            )}
          </div>
        )}
      </div>

      <main className="invp-body">
        {empty ? (
          <div className="inv-zero">
            <div className="inv-zero__h">Your Master Collection is empty</div>
            <div className="inv-zero__sub">No figures starred yet — open a figure's detail modal and tap the star next to MOC to add a copy to your Master Collection.</div>
            <button className="inv-zero__btn" onClick={() => onNavigate('figures')}><span>＋</span> ADD YOUR FIRST FIGURE TO YOUR MASTER COLLECTION</button>
          </div>
        ) : entries.length === 0 ? (
          <div className="invp-empty">No figures match.</div>
        ) : yearGroups ? (
          yearGroups.map(([year, ents]) => {
            const isOpen = filtering || openYears.has(year);
            const ys = targetStats(ents);
            const pct = ys.target ? Math.round(ys.met / ys.target * 100) : 0;
            const starredN = ents.reduce((n, e) => n + e.starred.length, 0);
            return (
              <section className={"ysec" + (isOpen ? " is-open" : "")} key={year}>
                <button className="ysec__hd" onClick={() => toggleYear(year)}>
                  <span className="ysec__yr">{formatYear(year)}</span>
                  <span className="ysec__title">
                    <span className="ysec__meta">{starredN} starred</span>
                  </span>
                  <span className="ysec__meters">
                    {yearStats && (
                      <span className="ysec__meter">
                        <span className="ysec__meterlab">Kept</span>
                        <span className="ysec__bar"><CompBar pct={pct} height={8} /></span>
                        <span className="ysec__metern">{ys.met}/{ys.target}</span>
                      </span>
                    )}
                  </span>
                  <span className="ysec__pct">{yearStats ? pct + "%" : ""}</span>
                  <span className="ysec__chev">{isOpen ? "▾" : "▸"}</span>
                </button>
                {isOpen && (
                  <div className="ysec__body">
                    <McCols />
                    {ents.map(renderRow)}
                  </div>
                )}
              </section>
            );
          })
        ) : (
          <div className="ysec__body">
            <McCols />
            {entries.map(renderRow)}
          </div>
        )}
      </main>

      {sel && <InvDetailModal key={sel.catalogId} catalogId={sel.catalogId} instId={sel.instId} onClose={() => setSel(null)} onAddInstance={onAddInstance} />}
    </div>
  );
}

export { MasterCollectionView };
