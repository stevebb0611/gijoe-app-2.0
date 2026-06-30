// instance-detail.jsx — single-copy detail with the interactive damage map.
// Condition is DERIVED: you tag physical damage on o-ring points and paint wear
// on regions (front/back, 3 severities); a default rules engine produces
// separate Physical + Paint grades. Plus per-instance accessory checklist with
// Parts-Bin pull, primary pin, and bin/box location.

// ---------- shared model (from damage-map.jsx · window globals) ----------
// LOCALLY-UNIQUE alias names — must not re-`const` the shared identifiers (cross-script collision).
const IdMap = window.DamageMap, IdGrade = window.GradeBadge, idEmpty = window.dmEmpty;
const idPhys = window.physicalGrade, idPaint = window.paintGrade, idZoneLabel = window.dmZoneLabel;
const DM_SEV = window.DM_SEV, DM_TABS = window.DM_TABS;

const SAMPLE_ACC = [["M-2 .50 cal", 1], ["Tripod", 1], ["Ammo Box", 1], ["Backpack", 1]];
const SAMPLE_BIN = { "Backpack": 3, "Ammo Box": 1, "M-16 Rifle": 2, "Helmet": 1 };

// File-card printings known for this figure (a filecard_lookup row set, keyed to
// the catalog Figure — a separate relationship table, parallel to variant_lookup).
// Tracked per copy: present? + which printing. Does NOT feed accessory completeness.
const FILECARDS = [
  { letter: 'A', name: 'First print', color: '#5f6b39', tell: '“© 1983 Hasbro” footer · deep-olive border · glossy stock' },
  { letter: 'B', name: 'Reissue ’85', color: '#7d8a4a', tell: '“© 1984 Hasbro” footer · brighter green border · same art' },
  { letter: 'C', name: 'Mail-away', color: '#b88a2f', tell: 'flat matte stock · no border rule · catalog-printed back', flat: true },
];

// ---------- (grade engine, silhouette, damage map, grade badge now come from damage-map.jsx) ----------


// ---------- remove flow: disposition modal + result screen ----------
function RemoveModal({ figName, instLabel, present, marksCount, onRemove, onLater, onDelete, onClose }) {
  const [mode, setMode] = React.useState('sort');
  const [choice, setChoice] = React.useState(() => {
    const c = {}; present.forEach(p => { c[p] = 'stay'; }); return c; // default: parts stay → bin
  });
  const stay = present.filter(p => choice[p] === 'stay');
  const go = present.filter(p => choice[p] === 'go');
  const setAll = (v) => setChoice(() => { const c = {}; present.forEach(p => { c[p] = v; }); return c; });

  if (mode === 'delete') {
    return (
      <div className="rm-back" onClick={onClose}>
        <div className="rm" onClick={e => e.stopPropagation()}>
          <div className="rm__top"><span className="mk">⚠</span>
            <div className="rm__title">DELETE ENTRY<em>{figName} · {instLabel}</em></div>
            <button className="rm__x" onClick={onClose}>✕</button>
          </div>
          <div className="rm__danger">
            Delete <b>{figName} {instLabel}</b> as a <b>mistaken entry</b>? Its condition map and notes are discarded and <b>no accessories</b> are deposited in the Parts Bin. Use this only for copies added in error — not for a figure that actually left your collection.
          </div>
          <div className="rm__foot">
            <div className="rm__sum">Different from removing a copy you owned.</div>
            <div className="rm__acts">
              <button className="rm__btn" onClick={() => setMode('sort')}>‹ BACK</button>
              <button className="rm__btn rm__btn--go" onClick={onDelete}>DELETE ENTRY</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rm-back" onClick={onClose}>
      <div className="rm" onClick={e => e.stopPropagation()}>
        <div className="rm__top"><span className="mk">◄</span>
          <div className="rm__title">REMOVE COPY<em>{figName} · {instLabel}</em></div>
          <button className="rm__x" onClick={onClose}>✕</button>
        </div>
        <div className="rm__warn">
          This copy's <b>condition map</b> and <b>{marksCount} damage mark{marksCount !== 1 ? "s" : ""}</b> leave with it (recoverable via Undo). First, decide where its accessories go — by default they <b>stay in your Parts Bin</b>.
        </div>

        <div className="rm__sechd">
          <span className="rm__sechd-t">ACCESSORIES ON THIS COPY</span>
          {present.length > 1 && (
            <div className="rm__bulk">
              <button onClick={() => setAll('stay')}>ALL STAY</button>
              <button onClick={() => setAll('go')}>ALL GO</button>
            </div>
          )}
        </div>

        <div className="rm__list">
          {present.length === 0
            ? <div className="rm__none">No accessories present on this copy — nothing to sort.</div>
            : present.map(n => (
              <div className="rm__row" key={n}>
                <div>
                  <div className="rm__n">{n}</div>
                  <div className="rm__meta">present on this copy</div>
                </div>
                <div className="split">
                  <button className={choice[n] === 'stay' ? "on-stay" : ""} onClick={() => setChoice(c => ({ ...c, [n]: 'stay' }))}>STAYS IN BIN</button>
                  <button className={choice[n] === 'go' ? "on-go" : ""} onClick={() => setChoice(c => ({ ...c, [n]: 'go' }))}>GOES W/ FIGURE</button>
                </div>
              </div>
            ))}
        </div>

        <div className="rm__delete">
          <button onClick={() => setMode('delete')}>Entered by mistake? Delete entry instead →</button>
        </div>

        <div className="rm__foot">
          <div className="rm__sum"><b>{stay.length}</b> → bin · <b>{go.length}</b> leave with {figName}</div>
          <div className="rm__acts">
            <button className="rm__btn" onClick={onLater} title="Park this in the Parts Bin intake to sort later">DECIDE LATER</button>
            <button className="rm__btn rm__btn--go" onClick={() => onRemove(choice)}>REMOVE COPY</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({ status, figName, instLabel, stayNames, goNames, presentCount, onUndo }) {
  const cfg = {
    removed: { ic: "✓", h: `${figName} ${instLabel} removed` },
    parked:  { ic: "◷", h: `${figName} ${instLabel} removed` },
    deleted: { ic: "✕", h: `Entry deleted` },
  }[status];
  return (
    <div className="rmdone-wrap">
      <div className="rmdone">
        <div className="rmdone__top">
          <div className="rmdone__ic">{cfg.ic}</div>
          <div className="rmdone__h">{cfg.h}<em>{status === 'deleted' ? "MISTAKEN ENTRY · NOTHING MOVED" : "COPY LEFT THE COLLECTION"}</em></div>
        </div>

        <div className="rmdone__body">
          {status === 'removed' && (
            <>
              {stayNames.length > 0 && (
                <div className="rmdone__grp">
                  <span className="rmdone__grplab">KEPT → PARTS BIN</span>
                  <div className="rmdone__parts">{stayNames.map(n => <span key={n} className="rmdone__chip">{n}</span>)}</div>
                </div>
              )}
              {goNames.length > 0 && (
                <div className="rmdone__grp">
                  <span className="rmdone__grplab">LEFT WITH FIGURE</span>
                  <div className="rmdone__parts">{goNames.map(n => <span key={n} className="rmdone__chip is-go">{n}</span>)}</div>
                </div>
              )}
              <div className="rmdone__line">The condition map and damage log were archived with the copy. <b>Undo</b> restores everything, including any parts pulled back from the bin.</div>
            </>
          )}
          {status === 'parked' && (
            <div className="rmdone__line">The figure is out of your inventory, but its <b>{presentCount} accessor{presentCount !== 1 ? "ies" : "y"}</b> still need sorting. They're waiting in the <b>Parts Bin · Intake</b> as a pending removal — open it to choose what stays and what goes.</div>
          )}
          {status === 'deleted' && (
            <div className="rmdone__line">This copy was deleted as a mistaken entry. <b>No accessories</b> were moved to the Parts Bin and no bin quantities changed.</div>
          )}
        </div>

        <div className="rmdone__foot">
          <button className="rmdone__undo" onClick={onUndo}>↺ UNDO</button>
          {status === 'parked'
            ? <a className="rmdone__link" href="GI Joe Tracker - Parts Bin.html">SORT IN BIN INTAKE ›</a>
            : status === 'removed'
              ? <a className="rmdone__link" href="GI Joe Tracker - Parts Bin.html">VIEW PARTS BIN ›</a>
              : null}
          <a className="rmdone__link rmdone__link--end" href="GI Joe Tracker - Inventory.html">BACK TO INVENTORY</a>
        </div>
      </div>
    </div>
  );
}

// ---------- file-card panel ----------
function FileCardPanel({ cards, onFile, setOnFile, sel, setSel }) {
  const selCard = cards.find(c => c.letter === sel);
  return (
    <section className="panel">
      <div className="panel__hd">FILE CARD <em>· the cardback dossier</em>
        <span className={"fc-hd-badge " + (onFile ? "on" : "off")}>{onFile ? "ON FILE" : "NOT ON FILE"}</span>
      </div>
      <div className="fc">
        <button className={"fc-have" + (onFile ? " is-on" : "")} onClick={() => setOnFile(v => !v)}>
          <span className="fc-have__ck">{onFile ? "✓" : ""}</span>
          <span className="fc-have__l">
            <span className="fc-have__t">{onFile ? "Card in hand" : "No card on file"}</span>
            <span className="fc-have__s">{onFile ? "logged with this copy" : "tap to mark the file card present"}</span>
          </span>
        </button>

        {onFile ? (
          <div className="fc-pick">
            <div className="fc-selrow">
              <span className="fc-sel-lab">PRINTING</span>
              <span className="fc-selwrap">
                <select className="fc-sel" value={sel} onChange={e => setSel(e.target.value)}>
                  {cards.map(c => <option key={c.letter} value={c.letter}>{c.letter} · {c.name}</option>)}
                </select>
                <span className="fc-selwrap__c">▾</span>
              </span>
              <span className="fc-cat">{cards.length} on record</span>
            </div>
            {selCard && <div className="fc-tell">{selCard.tell}</div>}
          </div>
        ) : (
          <div className="fc-note">Not required to complete this copy — tracked on its own. Mark it <b>on file</b> to log which of the <b>{cards.length} known printings</b> you have.</div>
        )}
      </div>
    </section>
  );
}

// ---------- root ----------
function InstanceDetail() {
  const [dmg, setDmg] = React.useState(() => ({
    gender: 'male',
    condition: { front: { handR: 2, kneeL: 1, waist: 1 }, rear: {} },
    paint: { front: { torso: 1, thighR: 2 }, rear: {} },
  }));
  const [moc, setMoc] = React.useState(false);   // Mint on Card — sealed; overrides accessory checks → 100%
  const [have, setHave] = React.useState({ "M-2 .50 cal": true, "Tripod": true, "Ammo Box": false, "Backpack": true });
  const [bin, setBin] = React.useState(SAMPLE_BIN);
  const [loc, setLoc] = React.useState("BIN C-04 · long-box");
  const [notes, setNotes] = React.useState("loose · tight joints — bought at JoeCon");
  const [primary, setPrimary] = React.useState(true);
  const [cardOnFile, setCardOnFile] = React.useState(true);
  const [cardVar, setCardVar] = React.useState('A');
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [result, setResult] = React.useState(null); // { status, stayNames, goNames, presentCount }

  const phys = idPhys(dmg);
  const paint = idPaint(dmg);
  const accDone = moc ? SAMPLE_ACC.length : SAMPLE_ACC.filter(a => have[a[0]]).length;

  const toggleHave = (name) => setHave(h => ({ ...h, [name]: !h[name] }));
  const pullFromBin = (name) => {
    if (!bin[name]) return;
    setBin(b => ({ ...b, [name]: b[name] - 1 }));
    setHave(h => ({ ...h, [name]: true }));
  };

  // ----- remove flow -----
  const present = SAMPLE_ACC.filter(a => have[a[0]]).map(a => a[0]);
  const marksCount = phys.zones + paint.zones;
  const doRemove = (choice) => {
    const stayNames = present.filter(p => choice[p] === 'stay');
    const goNames = present.filter(p => choice[p] === 'go');
    setBin(b => { const nb = { ...b }; stayNames.forEach(n => { nb[n] = (nb[n] || 0) + 1; }); return nb; });
    setResult({ status: 'removed', stayNames, goNames, presentCount: present.length });
    setRemoveOpen(false);
  };
  const doLater = () => { setResult({ status: 'parked', stayNames: [], goNames: [], presentCount: present.length }); setRemoveOpen(false); };
  const doDelete = () => { setResult({ status: 'deleted', stayNames: [], goNames: [], presentCount: present.length }); setRemoveOpen(false); };
  const undo = () => setResult(null);

  if (result) return <ResultScreen figName="ROADBLOCK" instLabel="No. 1" onUndo={undo} {...result} />;

  return (
    <div className="idp">
      {/* header */}
      <header className="idp-top">
        <div className="idp-crumb">
          <button className="idp-back">‹ INVENTORY</button>
          <span className="idp-crumb__sep">/</span>
          <span className="idp-crumb__fig">ROADBLOCK</span>
          <span className="idp-fac wf-fac wf-fac--joe">JOE</span>
          <span className="idp-crumb__var">v1 · Heavy MG · 1984</span>
        </div>
        <div className="idp-inst">
          <div className="seg">
            <button className="is-on">No. 1</button>
            <button>No. 2</button>
            <button className="seg--add">＋</button>
          </div>
          <button className={"idp-prim" + (primary ? " is-on" : "")} onClick={() => setPrimary(v => !v)}>
            {primary ? "★ PRIMARY" : "☆ SET PRIMARY"}
          </button>
        </div>
      </header>

      <div className="idp-body">
        {/* left: damage map (or sealed placeholder when MOC) */}
        <div className="idp-map">
          {moc ? (
            <div className="id-sealed">
              <div className="id-sealed__card">
                <div className="id-sealed__tag">MINT ON CARD</div>
                <div className="id-sealed__sub">SEALED · UNOPENED</div>
              </div>
              <p>The loose-figure condition diagram doesn't apply to a carded copy. Record any card or bubble flaws in the notes.</p>
            </div>
          ) : (
            <IdMap value={dmg} onChange={setDmg} genderLocked={true} />
          )}
        </div>

        {/* right: condition + log + checklist */}
        <div className="idp-side">
          <section className="panel">
            <div className="panel__hd">CONDITION <em>· {moc ? "mint on card" : "derived from damage"}</em></div>
            {moc ? (
              <div className="id-mocgrade">
                <span className="id-mocgrade__badge">MOC</span>
                <div className="id-mocgrade__txt"><b>Factory mint · sealed</b><i>100% complete — not graded on the loose-figure scale while carded</i></div>
              </div>
            ) : (
              <React.Fragment>
                <div className="grades">
                  <IdGrade kind="PHYSICAL" result={phys} />
                  <IdGrade kind="PAINT" result={paint} />
                </div>
                <div className="panel__note">Grades update live from the map. Click a zone to cycle its severity; the Condition and Paint tabs grade separately.</div>
              </React.Fragment>
            )}
          </section>

          {!moc && (
          <section className="panel">
            <div className="panel__hd">DAMAGE LOG <em>· {marksCount} zone{marksCount !== 1 ? "s" : ""}</em></div>
            <table className="dlog">
              <thead><tr><th>TAB</th><th>VIEW</th><th>ZONE</th><th>SEV</th></tr></thead>
              <tbody>
                {['condition', 'paint'].flatMap(tabKey => ['front', 'rear'].flatMap(v =>
                  Object.entries((dmg[tabKey] && dmg[tabKey][v]) || {}).map(([zid, lvl]) => (
                    <tr key={tabKey + v + zid} className={tabKey === 'paint' ? "is-paint" : ""}>
                      <td>{DM_TABS[tabKey].label}</td>
                      <td>{v}</td>
                      <td>{idZoneLabel(dmg.gender, zid)}</td>
                      <td><span className="sevdot" style={{ background: DM_SEV[lvl].c }}>{DM_TABS[tabKey].sevLabel(lvl)[0]}</span></td>
                    </tr>
                  ))
                ))}
                {marksCount === 0 && (
                  <tr><td colSpan="4" className="dlog__empty">No damage logged — click a zone on the map to record condition.</td></tr>
                )}
              </tbody>
            </table>
          </section>
          )}

          <section className="panel">
            <div className="panel__hd">THIS COPY <em>· location &amp; notes</em></div>
            <div className="idp-meta">
              <label className="idp-meta__field">
                <span className="idp-meta__lab">NOTES · THIS COPY</span>
                <textarea className="idp-meta__in idp-meta__in--area" value={notes} onChange={e => setNotes(e.target.value)}
                          placeholder="joint feel, provenance, where you bought it, paint quirks…"></textarea>
              </label>
              <label className="idp-meta__field">
                <span className="idp-meta__lab">BIN / BOX LOCATION</span>
                <input className="idp-meta__in" value={loc} onChange={e => setLoc(e.target.value)} placeholder="e.g. BIN C-04 · long-box" />
              </label>
            </div>
          </section>

          <section className="panel panel--meta">
            <div className="metarow">
              <span className="metarow__lab">REMOVE</span>
              <button className="metarow__remove" onClick={() => setRemoveOpen(true)}>REMOVE COPY ›</button>
              <span className="metarow__hint">you'll be asked where each accessory goes — keep it in the Parts Bin or send it out with the figure</span>
            </div>
          </section>
        </div>
      </div>

      {removeOpen && (
        <RemoveModal figName="ROADBLOCK" instLabel="No. 1" present={present} marksCount={marksCount}
                     onRemove={doRemove} onLater={doLater} onDelete={doDelete} onClose={() => setRemoveOpen(false)} />
      )}
    </div>
  );
}

Object.assign(window, { InstanceDetail });
