// parts-bin.jsx — WORKING loose-accessory inventory, wired to JoeStore.
// Ported from the parts-bin.jsx prototype, adapted to the real schema: parts
// are identified by a global accessory_id (not figure-scoped) — see
// PARTS_BIN.md "DATA MODEL". Shared-vs-single-use and the home figure are
// derived from figure_accessories (server/accessories.js), not hand-authored
// sample data. Reverse-lookup, fills-a-gap and pull-to-complete all run
// against the real collection in the store.
import React from 'react';
import { JoeStore, JoeData } from './store.js';
import { figState, applyRebalance, AccItem } from './app-detail.jsx';
import { VersionChip } from './fig-identity.jsx';
import { figIdentityText, formatYear } from './fig-identity.js';

const figLabel = (cf) => cf ? figIdentityText({ name: cf.name, version: cf.ver ? 'v' + cf.ver : '' }) : "—";

// "Shared · fits X / Y / Z" — capped so hyper-common parts (e.g. a battle
// stand shared by 90+ figures) don't blow out the row.
const FITS_CAP = 4;
function fitsLabel(names) {
  if (!names || !names.length) return "fits multiple figures";
  const shown = names.slice(0, FITS_CAP).join(" / ");
  const extra = names.length - FITS_CAP;
  return "fits " + shown + (extra > 0 ? " +" + extra + " more" : "");
}

function useStore() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => JoeStore.subscribe(force), []);
  return JoeStore.get();
}

// ---- reverse-lookup: which owned copies are missing which parts ----
function buildNeeds() {
  const needs = [];
  const ownedIds = [...new Set(JoeStore.get().instances.map(i => i.catalogId))];
  ownedIds.forEach(id => {
    const cf = JoeData.CAT_BY_ID.get(id); if (!cf) return;
    const bp = cf.blueprint || []; if (!bp.length) return;
    const sum = JoeData.figureSummary(id); if (!sum) return;
    const fig = figLabel(cf);
    sum.copies.forEach(c => {
      // A copy only "needs" what its own production variant actually calls
      // for — see bpForVariant + ACCESSORY_GROUPS.md "variant_id".
      JoeData.bpForVariant(bp, c.variant).forEach(([name, q, accessoryId]) => {
        const have = (c.acc && c.acc[name]) || 0;
        if (have < q) needs.push({ instanceId: c.id, catalogId: id, no: c.no, fig, accessory: name, accessoryId, missing: q - have });
      });
    });
  });
  return needs;
}

// match a bin entry (global accessory_id) to the gaps it can fill — any figure
// using the same accessory_id is compatible, so this is plain id equality.
function evaluate(entry, NEEDS) {
  const matched = NEEDS.filter(n => n.accessoryId === entry.id);
  const missingUnits = matched.reduce((s, n) => s + n.missing, 0);
  return { matched, needed: matched.length, fillable: Math.min(entry.qty, missingUnits) };
}

// concrete one-tap pulls available right now (one per fillable gap, capped by qty)
function buildSuggestions(bin, NEEDS) {
  const remaining = {}; bin.forEach(e => { remaining[e.id] = e.qty; });
  const out = [];
  NEEDS.forEach(n => {
    const part = bin.find(e => e.id === n.accessoryId && remaining[e.id] > 0);
    if (part) { remaining[part.id] -= 1; out.push({ need: n, partId: part.id, accessory: n.accessory }); }
  });
  return out;
}

const FILTERS = [
  { key: 'shared', label: 'Shared' },
  { key: 'single', label: 'Single-use' },
];
const GROUPBYS = [
  { key: 'group',  label: 'CATEGORY' },
  { key: 'home',   label: 'FIGURE' },
  { key: 'status', label: 'STATUS' },
];

// ============================================================ part row
function PartRow({ entry, NEEDS, openId, setOpenId }) {
  const ev = evaluate(entry, NEEDS);
  const open = openId === entry.id;
  const [dmgOpen, setDmgOpen] = React.useState(false);
  const home = entry.shared ? "Shared · " + fitsLabel(entry.homeFigureNames) : (entry.homeFigureName || "—");
  return (
    <div className={"pb-row" + (ev.needed ? " is-needed" : "")}>
      <div className="pb-qty">
        <span className="pb-qty__n">×{entry.qty}</span>
        {entry.damaged > 0 && <span className="pb-qty__dmg" title={entry.damaged + " of these units are damaged"}>{entry.damaged} damaged</span>}
      </div>
      <div className="pb-main">
        <div className="pb-name">
          {entry.accessory}
        </div>
        <div className="pb-fits">figure: <b>{home}</b></div>
        <div className="pb-status">
          {ev.needed > 0 ? (
            <button className="pb-need" onClick={() => setOpenId(open ? null : entry.id)}>
              ▸ fills {ev.fillable} gap{ev.fillable !== 1 ? "s" : ""} · needed by {ev.needed} cop{ev.needed !== 1 ? "ies" : "y"}
            </button>
          ) : <span className="pb-none">no current need</span>}
        </div>
        {open && ev.matched.length > 0 && (
          <div className="pb-needs">
            {ev.matched.map((n, i) => (
              <button key={i} className="pb-needs__row" disabled={entry.qty === 0}
                      onClick={() => JoeStore.pullPart(entry.id, n.instanceId, entry.accessory)}>
                <span className="pb-needs__inst">{n.fig} · No. {n.no}</span>
                <span className="pb-needs__act">pull to complete ›</span>
              </button>
            ))}
          </div>
        )}
        {dmgOpen && (
          <div className="acc-list acc-list--dmg pb-dmgpanel">
            <div className="acc-list__cap"><span>DAMAGED UNITS</span><span><b>{entry.damaged}</b>/{entry.qty}</span></div>
            <AccItem name={entry.accessory} req={entry.qty} tone="damage"
                     checked={Array.from({ length: entry.qty }, (_, k) => k < entry.damaged)}
                     onSet={(k) => JoeStore.setPartDamage(entry.id, k)} />
          </div>
        )}
        {entry.notes && <div className="pb-noteline">✎ <span>{entry.notes}</span></div>}
      </div>
      <div className="pb-actions">
        <button className="pb-btn pb-btn--ghost" onClick={() => JoeStore.adjustPart(entry.id, +1)}>＋</button>
        <button className="pb-btn pb-btn--ghost" onClick={() => JoeStore.adjustPart(entry.id, -1)}>－</button>
        <button className={"pb-btn pb-btn--ghost pb-btn--dmg" + (dmgOpen ? " is-on" : "") + (entry.damaged > 0 ? " has-damage" : "")}
                title="Mark units of this loose part as damaged" onClick={() => setDmgOpen(v => !v)}>⚠</button>
      </div>
    </div>
  );
}

// ============================================================ add-a-loose-part (figure-first, whole catalog)
function AddPartModal({ onClose }) {
  const [q, setQ] = React.useState('');
  const [figId, setFigId] = React.useState(null);
  const [sel, setSel] = React.useState({}); // { accessoryName: qty }
  const [notes, setNotes] = React.useState('');

  const query = q.trim().toLowerCase();
  const results = query
    ? JoeData.CAT.filter(f => f.name.toLowerCase().includes(query) || (f.role || '').toLowerCase().includes(query)).slice(0, 40)
    : [];
  const fig = figId != null ? JoeData.CAT_BY_ID.get(figId) : null;
  const bp = fig ? (fig.blueprint || []) : [];
  const selNames = Object.keys(sel);
  const totalPieces = selNames.reduce((s, n) => s + sel[n], 0);
  const canAdd = fig && selNames.length > 0;

  const choose = (f) => { setFigId(f.id); setSel({}); };
  const toggleAcc = (name) => setSel(s => { const n = { ...s }; if (n[name]) delete n[name]; else n[name] = 1; return n; });
  const bumpAcc = (name, d) => setSel(s => ({ ...s, [name]: Math.max(1, (s[name] || 1) + d) }));
  const submit = () => {
    const notesV = notes.trim();
    selNames.forEach(name => JoeStore.addPart({ catalogId: figId, accessory: name, qty: sel[name], notes: notesV }));
    onClose();
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__top">
          <span className="mk mk--add">＋</span>
          <div className="modal__title">ADD LOOSE PARTS<em>figure → its accessories · into bin</em></div>
          <button className="modal__x" onClick={onClose}>✕</button>
        </div>
        <div className="modal__sub">
          Loose parts are logged under the figure they belong to. Find the figure (any of the {JoeData.CAT.length} in the catalog — you don't have to own it yet), then tap each accessory you're stashing and set how many of each.
        </div>

        <div className="modal__list">
          {!fig ? (
            <div className="fld">
              <label className="fld__lab">FIND THE FIGURE</label>
              <div className="afield">
                <input className="inp" value={q} autoFocus onChange={e => setQ(e.target.value)} placeholder="search code name · specialty…" />
              </div>
              {query && (
                <div className="sugg">
                  {results.length === 0 ? <div className="sugg__none">No figures match.</div>
                    : results.map(f => (
                      <button key={f.id} className="sugg__item" onClick={() => choose(f)}>
                        <span>{f.name}<VersionChip version={f.ver ? "v" + f.ver : ""} /></span><em>{formatYear(f.year)} · {f.role || f.faction}</em>
                      </button>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <React.Fragment>
              <div className="fld">
                <label className="fld__lab">FIGURE</label>
                <div className="pb-pickfig">
                  <span><b>{fig.name}</b><VersionChip version={fig.ver ? "v" + fig.ver : ""} /> <em>{formatYear(fig.year)} · {fig.role || fig.faction}</em></span>
                  <button className="pb-pickfig__x" onClick={() => { setFigId(null); setSel({}); }}>change</button>
                </div>
              </div>
              <div className="fld">
                <label className="fld__lab">ACCESSORIES <span className="fld__opt">tap to add · set qty per line</span></label>
                {bp.length === 0
                  ? <div className="fld__note">No accessories on file for this figure.</div>
                  : <div className="pb-acclist">
                      {bp.map(([name, qreq, accessoryId]) => {
                        const meta = JoeData.ACC_BY_ID.get(accessoryId);
                        const on = !!sel[name];
                        return (
                          <div key={name} className={"pb-accopt" + (on ? " is-sel" : "")}>
                            <button type="button" className="pb-accopt__hit" onClick={() => toggleAcc(name)}>
                              <span className="pb-accopt__radio"></span>
                              <span className="pb-accopt__n">{name}{qreq > 1 ? " ×" + qreq : ""}</span>
                              <span className="pb-accopt__cat">{(meta && meta.categoryLabel) || "—"}</span>
                            </button>
                            {on && (
                              <div className="qstep qstep--sm">
                                <button type="button" onClick={() => bumpAcc(name, -1)}>－</button>
                                <span className="qstep__n">{sel[name]}</span>
                                <button type="button" onClick={() => bumpAcc(name, +1)}>＋</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>}
              </div>
              <div className="fld">
                <label className="fld__lab">NOTES <span className="fld__opt">optional</span></label>
                <input className="inp" value={notes} maxLength={80} onChange={e => setNotes(e.target.value)} placeholder="e.g. repro · yellowed · 5/24 show…" />
              </div>
            </React.Fragment>
          )}
        </div>

        <div className="modal__foot">
          <div className="modal__sum">
            {!fig
              ? <span>pick a figure, then its accessories</span>
              : selNames.length
                ? <span><b>{selNames.length}</b> part{selNames.length !== 1 ? "s" : ""} · {totalPieces} piece{totalPieces !== 1 ? "s" : ""} → {fig.name}</span>
                : <span>tap the accessories you're stashing</span>}
          </div>
          <button className="modal__confirm" disabled={!canAdd} onClick={submit}>ADD TO BIN</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================ rebalance panel (live)
function RebalanceModal({ figs, onClose }) {
  React.useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__top">
          <span className="mk" style={{ color: 'var(--accent)' }}>⚖</span>
          <div className="modal__title">REBALANCE ACCESSORIES<em>complete a copy — or get your closest copy as far as it'll go</em></div>
          <button className="modal__x" onClick={onClose}>✕</button>
        </div>
        <div className="rebal-intro">
          Two ways to tidy a figure's scattered parts. <b>Completes a copy</b> — you own enough to make a whole one, just spread across copies. <b>Best partial</b> — no full copy is possible yet, but consolidating gets your closest copy as complete as it can be.
        </div>
        {figs.length === 0
          ? <div className="rebal-empty">Nothing to rebalance.</div>
          : <div className="rebal-list">
              {figs.map(r => {
                const partial = r.mode === 'partial';
                const mvs = partial ? r.st.partial.moves : r.st.moves;
                return (
                <div key={r.id} className={"rebal-fig" + (partial ? " rebal-fig--partial" : "")}>
                  <div className="rebal-fig__hd">
                    <span className="rebal-fig__name">{r.name}<VersionChip version={r.version} /></span>
                    <span className="rebal-fig__meta">{r.specialty ? r.specialty + " · " : ""}{formatYear(r.year)} · ×{r.st.owned}</span>
                    <span className={"rebal-fig__goal" + (partial ? " is-partial" : "")}>
                      {partial
                        ? "No. " + r.st.partial.targetNo + ": " + r.st.partial.from + "→" + r.st.partial.to + "/" + r.st.partial.reqCount
                        : "+" + (r.st.optimalWhole - r.st.currentWhole) + " whole"}
                    </span>
                  </div>
                  <div className="rebal-fig__kind">{partial ? "BEST PARTIAL · no full copy possible yet" : "COMPLETES A COPY"}</div>
                  <div className="rebal-moves">
                    {mvs.slice(0, 6).map((m, i) => (
                      <span key={i} className="rebal-move">Move <b>{m.qty > 1 ? m.qty + "× " : ""}{m.part}</b> from <b>No. {m.from}</b> → <b>No. {m.to}</b></span>
                    ))}
                  </div>
                  <button className="rebal-fig__act" onClick={() => applyRebalance(r.id, r.mode)}>APPLY MOVES</button>
                </div>
                );
              })}
            </div>}
      </div>
    </div>
  );
}

// ============================================================ group section
function GroupSection({ sec, sep, collapsed, toggle, NEEDS, openId, setOpenId }) {
  const t = sec.rows.reduce((o, { e, ev }) => { o.pieces += e.qty; o.fills += ev.fillable; return o; }, { pieces: 0, fills: 0 });
  return (
    <section className={"grp" + (sep ? " grp--sep" : "")}>
      <button className="grp__head" onClick={() => toggle(sec.key)}>
        <span className={"grp__chev" + (collapsed ? " is-closed" : "")}>▾</span>
        <span className="grp__title">{sec.label}</span>
        <span className="grp__meta">
          {sec.rows.length} part{sec.rows.length !== 1 ? "s" : ""} · {t.pieces} pc
          {t.fills > 0 ? <em className="is-fill"> · {t.fills} fill gaps</em> : null}
        </span>
      </button>
      {!collapsed && (
        <div className="grp__body">
          {sec.rows.map(({ e }) => <PartRow key={e.id} entry={e} NEEDS={NEEDS} openId={openId} setOpenId={setOpenId} />)}
        </div>
      )}
    </section>
  );
}

function buildSections(items, mode) {
  const byNeed = (a, b) => (b.ev.needed - a.ev.needed) || a.e.accessory.localeCompare(b.e.accessory);
  let keyOf, labelOf, order = null, sortByCatId = false;
  if (mode === 'group') {
    keyOf = ({ e }) => e.categoryLabel || '—';
    labelOf = (k) => k.toUpperCase();
    sortByCatId = true;
  } else if (mode === 'home') {
    keyOf = ({ e }) => e.shared ? 'Shared' : (e.homeFigureName || '—');
    labelOf = (k) => k === 'Shared' ? 'SHARED · FITS MULTIPLE FIGURES' : k;
  } else {
    keyOf = ({ ev }) => ev.needed ? 'gap' : 'none'; order = ['gap', 'none'];
    labelOf = (k) => ({ gap: 'FILLS GAPS', none: 'NO CURRENT NEED' }[k]);
  }
  const map = new Map();
  const catIdOf = new Map(); // category label -> its numeric category_id (CSV order)
  items.forEach(it => {
    const k = keyOf(it);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
    if (sortByCatId && !catIdOf.has(k)) catIdOf.set(k, it.e.categoryId != null ? it.e.categoryId : Infinity);
  });
  let keys = [...map.keys()];
  if (sortByCatId) {
    keys.sort((a, b) => catIdOf.get(a) - catIdOf.get(b));
  } else if (mode === 'home') {
    // "Shared" isn't a figure — keep it out of the alphabetical run and
    // always trailing, set off by a divider (see .grp--sep).
    keys.sort((a, b) => (a === 'Shared') - (b === 'Shared') || String(a).localeCompare(String(b)));
  } else {
    keys.sort((a, b) => order ? order.indexOf(a) - order.indexOf(b) : String(a).localeCompare(String(b)));
  }
  return keys.map(k => ({ key: k, label: labelOf(k), rows: map.get(k).sort(byNeed), sep: mode === 'home' && k === 'Shared' }));
}

// ============================================================ app
function PartsBin({ onNavigate }) {
  const store = useStore();
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [groupBy, setGroupBy] = React.useState('group');
  const [openId, setOpenId] = React.useState(null);
  const [collapsed, setCollapsed] = React.useState(() => new Set());
  const [addOpen, setAddOpen] = React.useState(false);
  const [rebalOpen, setRebalOpen] = React.useState(false);

  // bin entries decorated with real accessory metadata
  const bin = store.bin.map(e => {
    const meta = JoeData.ACC_BY_ID.get(e.id) || {};
    return { ...e, categoryId: meta.categoryId != null ? meta.categoryId : null, categoryLabel: meta.categoryLabel || null, shared: !!meta.shared, homeFigureName: meta.homeFigureName || null, homeFigureNames: meta.homeFigureNames || null };
  });
  const NEEDS = React.useMemo(buildNeeds, [store]);
  const suggestions = buildSuggestions(bin, NEEDS);

  // figures completable by moving parts between copies
  const rebalFigs = React.useMemo(() => {
    const ownedIds = [...new Set(store.instances.map(i => i.catalogId))];
    return ownedIds.map(id => {
      const cf = JoeData.CAT_BY_ID.get(id); if (!cf) return null;
      const st = figState({ id, _cf: cf });
      const whole = !!(st.moves && st.moves.length);
      const partial = !whole && !!(st.partial && st.partial.moves.length);
      if (!whole && !partial) return null;
      return { id, name: cf.name, specialty: cf.role || null, version: 'v' + cf.ver, year: cf.year, st, mode: whole ? 'whole' : 'partial' };
    }).filter(Boolean);
  }, [store]);

  const setChip = (k) => setFilter(cur => cur === k ? 'all' : k);
  const toggle = (k) => setCollapsed(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const q = query.trim().toLowerCase();
  const items = bin
    .map(e => ({ e, ev: evaluate(e, NEEDS) }))
    .filter(({ e }) => !q || e.accessory.toLowerCase().includes(q) || (e.homeFigureName || "").toLowerCase().includes(q) || (e.homeFigureNames || []).some(n => n.toLowerCase().includes(q)) || (e.categoryLabel || "").toLowerCase().includes(q))
    .filter(({ e }) => {
      if (filter === 'shared') return e.shared;
      if (filter === 'single') return !e.shared;
      return true;
    });

  const sections = buildSections(items, groupBy);
  const totals = bin.reduce((t, e) => { t.qty += e.qty; return t; }, { qty: 0 });
  const fillsTotal = suggestions.length;
  const allCollapsed = sections.length > 0 && sections.every(s => collapsed.has(s.key));
  const toggleAll = () => setCollapsed(allCollapsed ? new Set() : new Set(sections.map(s => s.key)));
  const shownCount = items.length;
  const empty = bin.length === 0;

  return (
    <div className="pbp">
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
              <button type="button" className="is-active">Parts Bin</button>
            </nav>
          </div>
          <div className="invp-mid">
            <label className="inv-search invp-search">
              <span>⌕</span>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="search part · category · figure…" />
              {query && <button className="invp-search__x" onClick={() => setQuery('')}>✕</button>}
            </label>
            <button className="inv-addfig" onClick={() => setAddOpen(true)}><span className="inv-addfig__mk">＋</span>Add Part</button>
          </div>
          <div className="inv-kpis">
            <div className="invk"><span className="invk__v">{fillsTotal}</span><span className="invk__k">Fills Gaps</span></div>
            <button className="invk invk--rebal" onClick={() => setRebalOpen(true)} title="Figures you can complete by moving parts between copies">
              <span className="invk__v">{rebalFigs.length}</span><span className="invk__k">Rebalance</span>
            </button>
            <div className="invk"><span className="invk__v">{totals.qty}</span><span className="invk__k">Loose Parts</span></div>
          </div>
        </header>

        {!empty && (
          <div className="pbp-bar">
            <div className="pbp-bar__inner">
              <div className="pbp-bar__chips">
                <button className={"chip" + (filter === 'all' ? " is-on" : "")} onClick={() => setFilter('all')}>All</button>
                <span className="pbp-bar__chipgap"></span>
                <div className="chipgroup">
                  {FILTERS.map(f => (
                    <button key={f.key} className={"chip" + (filter === f.key ? " is-on" : "")} onClick={() => setChip(f.key)}>
                      {f.label}{filter === f.key ? <span className="chip__x">✕</span> : null}
                    </button>
                  ))}
                </div>
              </div>
              <span className="pbp-bar__spacer"></span>
              <span className="pbp-bar__lab">GROUP BY</span>
              <div className="seg seg--sm">
                {GROUPBYS.map(g => (
                  <button key={g.key} className={groupBy === g.key ? "is-on" : ""} onClick={() => setGroupBy(g.key)}>{g.label}</button>
                ))}
              </div>
              <button className="rbtn rbtn--all" onClick={toggleAll}>{allCollapsed ? "▸ expand all" : "▾ collapse all"}</button>
            </div>
          </div>
        )}
      </div>

      <main className="pbp-body">
        {empty ? (
          <div className="pbp-empty pbp-empty--zero">
            <div className="pbp-empty__h">Your Parts Bin is empty</div>
            <div className="pbp-empty__sub">Stash a loose accessory and it lands here — tagged to its figure, watching your collection for a copy it can complete.</div>
            <button className="inv-zero__btn pbp-empty__btn" onClick={() => setAddOpen(true)}><span>＋</span> ADD A LOOSE PART</button>
          </div>
        ) : (
          <React.Fragment>
            {/* ===== READY TO PULL (live two-way A) ===== */}
            <section className="intake">
              <div className="intake__head">
                <span className="intake__title">READY TO COMPLETE
                  {suggestions.length ? null : <em>nothing to pull</em>}
                </span>
              </div>
              {suggestions.length === 0 ? (
                <div className="intake__empty">
                  No loose part currently fills a gap. When a bin part matches an owned copy that's missing it, a one-tap <b>pull to complete</b> shows up here.
                </div>
              ) : (
                <div className="intake__group">
                  {suggestions.slice(0, 8).map((s, i) => (
                    <div key={i} className="ev ev--in">
                      <div className="ev__dir">⇣</div>
                      <div className="ev__main">
                        <div className="ev__kind">PULL · COMPLETES A GAP</div>
                        <div className="ev__line">{s.accessory} → {s.need.fig} · No. {s.need.no}</div>
                        <div className="ev__sub">This copy is missing it and you hold a loose one.</div>
                      </div>
                      <div className="ev__act">
                        <button className="ev__btn ev__btn--go" onClick={() => JoeStore.pullPart(s.partId, s.need.instanceId, s.accessory)}>⇣ PULL TO COMPLETE</button>
                      </div>
                    </div>
                  ))}
                  {suggestions.length > 8 && <div className="intake__more">+{suggestions.length - 8} more — pull from the part rows below.</div>}
                </div>
              )}
            </section>

            {/* ===== PARTS LIST ===== */}
            <section className="pbp-stack">
              <div className="pbp-secthead">
                <span className="pbp-secthead__t">LOOSE PARTS</span>
                <span className="pbp-secthead__c">{shownCount} shown · {sections.length} group{sections.length !== 1 ? "s" : ""}</span>
              </div>
              {shownCount === 0
                ? <div className="pbp-empty">No parts match.</div>
                : sections.map((sec, i) => (
                    <GroupSection key={sec.key} sec={sec} sep={i > 0 && sec.sep} collapsed={collapsed.has(sec.key)} toggle={toggle}
                      NEEDS={NEEDS} openId={openId} setOpenId={setOpenId} />
                  ))}
            </section>
          </React.Fragment>
        )}
      </main>

      {addOpen && <AddPartModal onClose={() => setAddOpen(false)} />}
      {rebalOpen && <RebalanceModal figs={rebalFigs} onClose={() => setRebalOpen(false)} />}
    </div>
  );
}

export { PartsBin };
