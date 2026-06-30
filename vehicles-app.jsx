// vehicles-app.jsx — the Vehicles destination.
// Same chrome as Figures (header from chrome.css) + a vehicles body that mirrors
// the figures layout: year sections → list rows / gallery cards, completeness off
// each vehicle's parts blueprint, a quick-look detail modal, and a Playsets filter
// (per the IA direction: Playsets ship as an in-Vehicles modifier, not a 4th tab).

const VEH_DATA = window.VEH_DATA;
const vehState = window.vehState;
const vehFactionClass = window.vehFactionClass;

function VFac({ f, mini }) {
  return <span className={"wf-fac " + vehFactionClass(f) + (mini ? " wf-fac--mini" : "")}>{f === "COBRA" ? "COBRA" : "G.I. JOE"}</span>;
}

// class → tiny glyph for the thumbnail (keeps the kraft-photo placeholder language)
function classGlyph(klass) {
  const k = klass.toLowerCase();
  if (k.includes("jet") || k.includes("glider") || k.includes("copter")) return "✈";
  if (k.includes("sub") || k.includes("hydrofoil") || k.includes("carrier")) return "⚓";
  if (k.includes("tank")) return "▦";
  if (k.includes("base") || k.includes("fortress")) return "⌂";
  return "▣";
}

// sub-header chips — matched to the Figures toolbar (same labels, order, two-group split)
const VEH_FILTER_GROUPS = [
  [ { key: 'all', label: 'All' }, { key: 'complete', label: 'Complete' }, { key: 'incomplete', label: 'Incomplete' } ],
  [ { key: 'dupes', label: 'Show Duplicates' }, { key: 'gaps', label: 'Show Collection Gaps' } ],
];

// ============================================================ list row
function VehRow({ v }) {
  const st = vehState(v);
  const ghost = v.owned === 0;
  const missLabel = st.missing.map(p => p[0] + (p[1] - p[2] > 1 ? ` ×${p[1] - p[2]}` : "")).join(", ");
  return (
    <div className={"inv-row" + (ghost ? " is-ghost" : "")}>
      <div className="inv-thumb" aria-hidden="true"><span style={{ fontSize: 19 }}>{classGlyph(v.klass)}</span></div>
      <span className="inv-name">
        <b>{v.name}{v.type === 'playset' ? <em className="vveh-pill">PLAYSET</em> : null}{v.owned > 1 ? <em className="idver">×{v.owned}</em> : null}</b>
        <i>{v.klass}</i>
        {v.driver ? <span className="idveh"><b>Pilot</b>{v.driver}</span> : null}
      </span>
      <VFac f={v.faction} mini />
      <span className="inv-owned">{ghost ? <span className="inv-ghosttag">WANTED</span> : v.owned}</span>
      <span className="inv-stock">
        {ghost ? (
          <span className="inv-stock__miss">not in collection</span>
        ) : st.complete ? (
          <><div className="inv-bar"><div className="inv-bar__fill is-done" style={{ width: '100%' }}></div></div><span className="inv-stock__done">COMPLETE</span></>
        ) : (
          <><div className="inv-bar"><div className="inv-bar__fill" style={{ width: st.pct + '%' }}></div></div><span className="inv-stock__miss" title={missLabel}>missing {missLabel}</span></>
        )}
      </span>
      <span className={"inv-need" + (st.complete ? " is-zero" : ghost ? " is-ghost" : "")}>
        {ghost ? "+ADD" : st.complete ? "✓" : `−${st.missing.reduce((s, p) => s + (p[1] - p[2]), 0)}`}
      </span>
      <span className="inv-go">›</span>
    </div>
  );
}

// ============================================================ gallery card
function VehCard({ v }) {
  const st = vehState(v);
  const ghost = v.owned === 0;
  return (
    <div className={"card inv-card" + (ghost ? " is-ghostcard" : "")}>
      <div className="card__corner"><VFac f={v.faction} mini /></div>
      <div className="wf-photo card__photo"><span style={{ fontSize: 40 }}>{classGlyph(v.klass)}</span><span className="wf-photo__tag" style={{ position: 'absolute', bottom: 8, left: 8 }}>{v.year}</span></div>
      <div className="card__name">{v.name}{v.type === 'playset' ? <em className="vveh-pill">PLAYSET</em> : null}</div>
      <div className="card__var">{v.klass}</div>
      {v.driver ? <div className="idveh"><b>Pilot</b>{v.driver}</div> : null}
      <div className="card__foot">
        {ghost
          ? <span className="card__add">+ WANTED</span>
          : st.complete
            ? <span className="card__multi is-whole">COMPLETE</span>
            : <span className="card__multi">{st.have}/{st.req} parts</span>}
        <span className="card__own">×{v.owned}</span>
      </div>
    </div>
  );
}

// ============================================================ year section
function VehSection({ sec, open, toggle }) {
  const owned = sec.vehicles.filter(v => v.owned > 0);
  const complete = sec.vehicles.filter(v => vehState(v).complete).length;
  const pct = owned.length ? Math.round((complete / owned.length) * 100) : 0;
  return (
    <section className={"ysec" + (open ? " is-open" : "")}>
      <button className="ysec__hd" onClick={toggle}>
        <span className="ysec__yr">{sec.isPlayGroup ? "⌂" : sec.year}</span>
        <span className="ysec__title">
          <span className="ysec__lab">{sec.label}</span>
          <span className="ysec__meta">{sec.note} · {sec.vehicles.length} item{sec.vehicles.length !== 1 ? "s" : ""}</span>
        </span>
        <span className="ysec__meters">
          <span className="ysec__meter">
            <span className="ysec__meterlab">OWNED</span>
            <span className="wf-bar" style={{ height: 8 }}><span className="wf-bar__fill" style={{ width: (sec.vehicles.length ? owned.length / sec.vehicles.length * 100 : 0) + '%' }}></span></span>
            <span className="ysec__metern">{owned.length}/{sec.vehicles.length}</span>
          </span>
          <span className="ysec__meter">
            <span className="ysec__meterlab">COMPLETE</span>
            <span className="wf-bar" style={{ height: 8 }}><span className="wf-bar__fill is-done" style={{ width: pct + '%' }}></span></span>
            <span className="ysec__metern">{complete}/{owned.length}</span>
          </span>
        </span>
        <span className="ysec__pct">{pct}%</span>
        <span className="ysec__chev">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="ysec__body">
          {sec.vehicles.map(v => <VehRow key={v.id} v={v} />)}
        </div>
      )}
    </section>
  );
}

// ============================================================ app
function VehiclesApp() {
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const [playsets, setPlaysets] = React.useState('all'); // all | only | hide
  const [view, setView] = React.useState('list');
  const [open, setOpen] = React.useState(() => new Set(VEH_DATA.map((_, i) => i)));
  const [addOpen, setAddOpen] = React.useState(false);

  const q = query.trim().toLowerCase();

  const matchQ = (v) => !q || [v.name, v.klass, v.driver, v.faction, String(v.year)].some(s => s && s.toLowerCase().includes(q)) || v.parts.some(p => p[0].toLowerCase().includes(q));
  const passStatus = (v) => {
    const st = vehState(v);
    if (status === 'complete') return st.complete;
    if (status === 'incomplete') return v.owned > 0 && !st.complete;
    if (status === 'dupes') return v.owned > 1;
    if (status === 'gaps') return v.owned === 0;
    return true;
  };
  const passPlay = (v) => playsets === 'all' ? true : playsets === 'only' ? v.type === 'playset' : v.type !== 'playset';

  const sections = VEH_DATA
    .map((sec, i) => ({ ...sec, _i: i, vehicles: sec.vehicles.filter(v => matchQ(v) && passStatus(v) && passPlay(v)) }))
    .filter(sec => sec.vehicles.length > 0);

  // KPIs — the three requested: Unique Vehicles / Total Owned / Complete
  const flat = VEH_DATA.flatMap(s => s.vehicles);
  const uniqueOwned = flat.filter(v => v.owned > 0).length;
  const totalOwned = flat.reduce((s, v) => s + v.owned, 0);
  const completeCount = flat.filter(v => vehState(v).complete).length;

  const filtering = !!q || status !== 'all' || playsets !== 'all';
  const shown = sections.reduce((s, sec) => s + sec.vehicles.length, 0);

  const toggle = (i) => setOpen(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const expandAll = () => setOpen(new Set(VEH_DATA.map((_, i) => i)));
  const collapseAll = () => setOpen(new Set());
  const setChip = (k) => setStatus(cur => cur === k ? 'all' : k);

  return (
    <div className="invp">
      <div className="invp-chrome">
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
              <a href="GI Joe Tracker - Inventory.html">Figures</a>
              <a className="inv-nav__soon is-active" href="GI Joe Tracker - Vehicles.html">Vehicles<em className="inv-nav__tag">In Dev</em></a>
              <a href="GI Joe Tracker - Parts Bin.html">Parts Bin</a>
            </nav>
          </div>
          <div className="invp-mid">
            <label className="inv-search invp-search">
              <span>⌕</span>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="search vehicle · class · pilot · part…" />
              {query && <button className="invp-search__x" onClick={() => setQuery('')}>✕</button>}
            </label>
            <button className="inv-addfig" onClick={() => setAddOpen(true)}><span className="inv-addfig__mk">＋</span>Add Vehicle</button>
          </div>
          <div className="inv-kpis">
            <div className="invk"><span className="invk__v">{uniqueOwned}</span><span className="invk__k">Unique Vehicles</span></div>
            <div className="invk"><span className="invk__v">{totalOwned}</span><span className="invk__k">Total Owned</span></div>
            <div className="invk"><span className="invk__v">{completeCount}<small>/{uniqueOwned}</small></span><span className="invk__k">Complete</span></div>
          </div>
        </header>

        <div className="invp-bar">
          <div className="chipgroup">
            {VEH_FILTER_GROUPS[0].map(f => (
              <button key={f.key} className={"chip" + (status === f.key ? " is-on" : "")} onClick={() => f.key === 'all' ? setStatus('all') : setChip(f.key)}>
                {f.label}{status === f.key && f.key !== 'all' ? <span className="chip__x">✕</span> : null}
              </button>
            ))}
          </div>
          <span className="invp-bar__spacer"></span>
          <div className="chipgroup">
            {VEH_FILTER_GROUPS[1].map(f => (
              <button key={f.key} className={"chip" + (status === f.key ? " is-on" : "")} onClick={() => setChip(f.key)}>
                {f.label}{status === f.key ? <span className="chip__x">✕</span> : null}
              </button>
            ))}
          </div>
          <span className="invp-bar__lab">PLAYSETS</span>
          <div className="inv-seg">
            <button className={playsets === 'all' ? "is-on" : ""} onClick={() => setPlaysets('all')}>All</button>
            <button className={playsets === 'only' ? "is-on" : ""} onClick={() => setPlaysets('only')}>Only</button>
            <button className={playsets === 'hide' ? "is-on" : ""} onClick={() => setPlaysets('hide')}>Hide</button>
          </div>
          <span className="invp-bar__spacer"></span>
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

        {filtering && (
          <div className="invp-active">
            <span className="invp-active__lab">SHOWING</span>
            <span className="vveh-count">{shown} of {flat.length} item{flat.length !== 1 ? "s" : ""}</span>
            <button className="invp-active__clear" onClick={() => { setQuery(''); setStatus('all'); setPlaysets('all'); }}>Clear</button>
          </div>
        )}
      </div>

      <main className="invp-body">
        {sections.length === 0
          ? <div className="invp-empty">No vehicles match.</div>
          : view === 'list'
            ? sections.map(sec => <VehSection key={sec._i} sec={sec} open={open.has(sec._i)} toggle={() => toggle(sec._i)} />)
            : <div className="vveh-gallerywrap">
                {sections.map(sec => (
                  <section key={sec._i} className="vveh-galsec">
                    <div className="vveh-galsec__hd"><span className="ysec__yr">{sec.isPlayGroup ? "⌂" : sec.year}</span><span className="ysec__lab">{sec.label}</span><span className="ysec__meta">{sec.vehicles.length} item{sec.vehicles.length !== 1 ? "s" : ""}</span></div>
                    <div className="inv-galgrid">{sec.vehicles.map(v => <VehCard key={v.id} v={v} />)}</div>
                  </section>
                ))}
              </div>}
      </main>

      {addOpen && <AddVehicleModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

// ============================================================ add vehicle (light placeholder modal — mirrors Add Figure shell)
function AddVehicleModal({ onClose }) {
  React.useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  const [name, setName] = React.useState('');
  const [faction, setFaction] = React.useState('JOE');
  const [type, setType] = React.useState('vehicle');
  return (
    <div className="vmodal-back" onClick={onClose}>
      <div className="vmodal" onClick={e => e.stopPropagation()}>
        <div className="vmodal__top">
          <span className="vmodal__mk">＋</span>
          <div className="vmodal__title">ADD A VEHICLE<em>into the motor pool</em></div>
          <button className="vmodal__x" onClick={onClose}>✕</button>
        </div>
        <div className="vmodal__sub">
          Search the catalog or log a new vehicle by hand. Its class, pilot and parts blueprint come from the catalog — completeness tracks against that blueprint just like a figure's accessories.
        </div>
        <div className="vmodal__body">
          <div className="vfld">
            <label className="vfld__lab">VEHICLE NAME</label>
            <input className="vinp" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. VAMP Mark II, Skystriker, HISS Tank…" />
          </div>
          <div className="vfld">
            <label className="vfld__lab">FACTION</label>
            <div className="inv-seg">
              <button className={faction === 'JOE' ? "is-on" : ""} onClick={() => setFaction('JOE')}>G.I. JOE</button>
              <button className={faction === 'COBRA' ? "is-on" : ""} onClick={() => setFaction('COBRA')}>COBRA</button>
            </div>
          </div>
          <div className="vfld">
            <label className="vfld__lab">TYPE</label>
            <div className="inv-seg">
              <button className={type === 'vehicle' ? "is-on" : ""} onClick={() => setType('vehicle')}>Vehicle</button>
              <button className={type === 'playset' ? "is-on" : ""} onClick={() => setType('playset')}>Playset</button>
            </div>
          </div>
          <div className="vfld__note">Demo form — the full catalog-backed flow (parts blueprint, pilot match, condition) follows the Add Figure pattern.</div>
        </div>
        <div className="vmodal__foot">
          <button className="vbtn vbtn--ghost" onClick={onClose}>Cancel</button>
          <button className="vbtn" disabled={!name.trim()} onClick={onClose}>＋ Add to motor pool</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { VehiclesApp });
