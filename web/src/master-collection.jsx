// master-collection.jsx — Master Collection page. Unlike the Figures page's
// filters (which narrow a roster of figure rows, each still showing every
// owned copy), this lists exactly and only the copies the owner has starred
// as permanent keepers — one row per starred instance, not per figure. A
// figure with 3 owned copies and 1 star shows that 1 copy, not all 3.
import React from 'react';
import { JoeStore } from './store.js';
import {
  INV_CAT, fvm, invMasterTotals,
  FactionTag, StockBar, MasterBadge,
  InvDetailModal,
} from './app-detail.jsx';
import { VersionChip, VariantBadge, VariantBracket, EditionTag, SetTag } from './fig-identity.jsx';
import { formatYear } from './fig-identity.js';

function useStore() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => JoeStore.subscribe(force), []);
  return JoeStore.get();
}

function gradeText(c) {
  return c.loc || (c.phys ? c.phys + ' / ' + c.paint : 'ungraded');
}

// Per-year "kept/target" rollup for the year-separator's tick-mark label —
// same capped-contribution idiom as invMasterTotals(), just scoped to the
// figures grouped under one year instead of the whole collection.
function yearTargetStats(ents) {
  let met = 0, target = 0;
  ents.forEach(({ targets }) => targets.forEach((tg) => { target += tg.target; met += Math.min(tg.count, tg.target); }));
  return { met, target };
}

const YEAR_STATS_KEY = 'mc_year_stats_v1';

function MasterCollectionView({ onNavigate, onAddInstance }) {
  useStore();
  const mt = invMasterTotals();
  const [query, setQuery] = React.useState('');
  const [sel, setSel] = React.useState(null); // {catalogId, instId}
  const [sortMode, setSortMode] = React.useState('year'); // 'year' | 'az'
  const [yrAsc, setYrAsc] = React.useState(true); // year mode only — oldest (1982) first by default
  const [openYears, setOpenYears] = React.useState(() => new Set()); // year sections start collapsed
  const [yearStats, setYearStats] = React.useState(() => {
    try { return localStorage.getItem(YEAR_STATS_KEY) !== '0'; } catch { return true; }
  });
  React.useEffect(() => { try { localStorage.setItem(YEAR_STATS_KEY, yearStats ? '1' : '0'); } catch {} }, [yearStats]);
  const toggleYear = (y) => setOpenYears(s => { const n = new Set(s); n.has(y) ? n.delete(y) : n.add(y); return n; });

  const q = query.trim().toLowerCase();
  const matchQ = (fig) => !q || [fig.name, fig.specialty, fig.faction, formatYear(fig.year)].some(s => s && s.toLowerCase().includes(q));

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
      return { fig, starred, starredLetters, targets };
    })
    .filter(Boolean)
    .sort((a, b) => sortMode === 'az'
      ? a.fig.name.localeCompare(b.fig.name)
      : (yrAsc ? a.fig.year - b.fig.year : b.fig.year - a.fig.year) || a.fig.name.localeCompare(b.fig.name));

  const empty = mt.starredCopies === 0;
  const filtering = !!q;

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

  const renderCard = ({ fig, starred, starredLetters, targets }, showYear) => (
    <div className="mc-card" key={fig.id}>
      <div className="mc-card__hd">
        <span className="mc-card__name"><b>{fig.name}</b><VersionChip version={fig.version} /><EditionTag context={fig.releaseContext} conventionKind={fig.conventionKind} /><SetTag sets={fig.sets} /><VariantBracket variants={fig._cf.variants} owned={starredLetters} /></span>
        <FactionTag faction={fig.faction} mini />
        {showYear && <span className="mc-card__year">{formatYear(fig.year)}</span>}
        {targets.length > 0 && (
          <span className="mc-card__targets">
            {targets.map((tg) => (
              <span key={tg.letter} className={"mc-target" + (tg.target > 0 && tg.count >= tg.target ? " is-met" : "")}>
                {tg.letter && <VariantBadge letter={tg.letter} />}{tg.count}/{tg.target}
              </span>
            ))}
          </span>
        )}
        <input
          className="mc-card__note"
          defaultValue={fig.masterNotes}
          placeholder="Add a note about this figure…"
          onBlur={(e) => JoeStore.setFigureMasterNotes(fig.id, e.target.value)}
        />
      </div>
      <div className="mc-card__insts">
        {starred.map((c) => (
          <button key={c.id} className="mc-inst" onClick={() => setSel({ catalogId: fig.id, instId: c.id })}>
            <span className="mc-inst__lead">
              <span className="inv-inst__tab">★</span>
              <span className="inv-inst__id"><span>No. {c.no}<VariantBadge letter={c.variant} /></span><i>{gradeText(c)}</i></span>
            </span>
            <span className="mc-inst__stat">
              <span className="inv-stock"><StockBar pct={c.pct} />{c.cardOnFile && <span className="inv-fc" title="File card on file">+ File Card</span>}</span>
              <span className={"inv-need" + (c.pct === 100 ? " is-zero" : "")}>{c.pct === 100 ? "✓ Complete" : "Missing " + (c.req - c.own)}</span>
            </span>
            <span className="inv-go">▸</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="invp">
      <div className="invp-chrome">
        <header className="invp-top">
          <div className="inv-brand">
            <button type="button" className="inv-brand__home" onClick={() => onNavigate('figures')} aria-label="Go to Figures">
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
            </button>
            <nav className="inv-nav">
              <button type="button" onClick={() => onNavigate('figures')}>Figures</button>
              <a className="inv-nav__soon" href="GI Joe Tracker - Vehicles.html" title="Vehicles & Playsets — in development">Vehicles<em className="inv-nav__tag">In Dev</em></a>
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
          <div className="inv-kpis">
            <div className="invk"><span className="invk__v">{mt.figuresIn}</span><span className="invk__k">Figures In</span></div>
            <div className="invk"><span className="invk__v">{mt.starredCopies}</span><span className="invk__k">Starred Copies</span></div>
            <button type="button" className="invk invk--master is-active" title="Back to all Figures" onClick={() => onNavigate('figures')}>
              <MasterBadge size={20} />
              <span className="invk__v">{mt.metSum}<small>/{mt.targetSum}</small></span>
              <span className="invk__k">Target Filled</span>
            </button>
          </div>
        </header>

        {!empty && (
          <div className="invp-bar">
            <span className="invp-bar__count">{entries.length} figure{entries.length !== 1 ? "s" : ""}</span>
            <span className="invp-bar__spacer"></span>
            <button
              className={"txtbtn" + (sortMode === 'year' ? " is-on" : "")}
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
            {yearGroups && (
              <>
                <button className="txtbtn" onClick={anyYearOpen ? collapseAllYears : expandAllYears}>
                  {anyYearOpen ? "Collapse All" : "Expand All"}
                </button>
                <button
                  className={"txtbtn" + (yearStats ? " is-on" : "")}
                  onClick={() => setYearStats(v => !v)}
                  title="Show kept/target count on each year separator"
                >
                  Stats
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <main className="invp-body">
        {empty ? (
          <div className="invp-empty">No figures starred yet — open a figure's detail modal and tap the star next to MOC to add a copy to your Master Collection.</div>
        ) : entries.length === 0 ? (
          <div className="invp-empty">No figures match.</div>
        ) : yearGroups ? (
          yearGroups.map(([year, ents]) => {
            const isOpen = filtering || openYears.has(year);
            const stats = yearTargetStats(ents);
            return (
              <section className={"mcyr-sec" + (isOpen ? " is-open" : "")} key={year}>
                <button type="button" className="mcyr" onClick={() => toggleYear(year)}>
                  <span className="mcyr__dot">{formatYear(year)}</span>
                  <span className="mcyr__line">
                    {yearStats && stats.target > 0 && <span className="mcyr__stat">{stats.met}/{stats.target} kept</span>}
                  </span>
                  <span className="mcyr__chev">{isOpen ? "▾" : "▸"}</span>
                </button>
                {isOpen && <div className="mc-list">{ents.map((e) => renderCard(e, false))}</div>}
              </section>
            );
          })
        ) : (
          <div className="mc-list">{entries.map((e) => renderCard(e, true))}</div>
        )}
      </main>

      {sel && <InvDetailModal key={sel.catalogId} catalogId={sel.catalogId} instId={sel.instId} onClose={() => setSel(null)} onAddInstance={onAddInstance} />}
    </div>
  );
}

export { MasterCollectionView };
