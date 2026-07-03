// app-add-figure.jsx — WORKING Add Figure flow (overlay). Searches the real
// catalog, and on finalize writes a real owned instance to JoeStore.
// FIND → DETAILS → CONDITION → FINALIZE. Damage map from damage-map.jsx.
import React from 'react';
import { JoeStore, JoeData } from './store.js';
import { DamageMap, GradeBadge, physicalGrade, paintGrade, dmEmpty } from './damage-map.jsx';
import { VariantGroup, ContextGroup, clusterContexts } from './accessory-groups.jsx';
const AF_CATALOG = JoeData.CAT || [];
const AF_FILECARDS = [{ letter: 'A', name: 'First print' }, { letter: 'B', name: "Reissue '85" }, { letter: 'C', name: 'Mail-away' }];
const AF_YEARS = [...new Set(AF_CATALOG.map(f => f.year))].sort((a, b) => a - b);

const AF_STEPS = ["FIND", "DETAILS", "CONDITION", "FINALIZE"];

function AfStepper({ step, setStep, maxReached, lockFirst }) {
  return (
    <div className="af-steps">
      {AF_STEPS.map((s, i) => (
        <button key={s} className={"af-step" + (i === step ? " is-on" : "") + (i < step ? " is-done" : "")}
                disabled={i > maxReached || (lockFirst && i === 0)} onClick={() => i <= maxReached && !(lockFirst && i === 0) && setStep(i)}>
          <span className="af-step__n">{i < step ? "✓" : i + 1}</span>{s}
        </button>
      ))}
    </div>
  );
}

function isSingle(fig) { return fig && fig.variants.length === 1 && !fig.variants[0].letter; }

function AddFigureOverlay({ onClose, presetCatalogId = null, presetVariant = null }) {
  const preset = presetCatalogId != null;            // launched from a figure's + (add a copy) — lock to that figure, skip FIND
  const [step, setStep] = React.useState(preset ? 1 : 0);
  const [maxReached, setMax] = React.useState(preset ? 1 : 0);
  const [query, setQuery] = React.useState("");
  const [yearF, setYearF] = React.useState("");
  const [selId, setSelId] = React.useState(presetCatalogId);
  const [selVar, setSelVar] = React.useState(presetVariant); // letter | '' (single) | null
  const [loc, setLoc] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [owned, setOwnedAcc] = React.useState({});   // accName -> units owned
  const [moc, setMoc] = React.useState(false);       // Mint on Card (sealed) — counts 100% complete
  const [filecard, setFilecard] = React.useState({ onFile: false, printing: 'A' });
  // condition — single zone-map value; dmg.clean is the explicit "no damage found"
  // confirmation (vs. not yet mapped), and travels with marks into the stored instance
  const [dmg, setDmg] = React.useState(() => dmEmpty('male'));
  const [done, setDone] = React.useState(false);

  const fig = AF_CATALOG.find(f => f.id === selId) || null;
  const single = isSingle(fig);
  const multi = fig && !single;
  const chosen = multi ? fig.variants.find(v => v.letter === selVar) : null;
  const variantKey = single ? '' : (selVar || '');
  const ownedHere = fig ? JoeData.ownedCount(fig.id, variantKey) : 0;
  const isNew = !!fig && ownedHere === 0;
  const instNo = ownedHere + 1;
  const varLabel = multi ? (chosen ? "v" + fig.ver + " · " + chosen.letter : "") : (single ? "v" + fig.ver : null);
  const varTell = chosen ? chosen.tell : null;

  // selecting a figure clears variant + parts + condition; auto-pick for single-variant
  React.useEffect(() => {
    if (!fig) return;
    setSelVar(isSingle(fig) ? '' : (presetVariant && fig.id === presetCatalogId ? presetVariant : null));
    setOwnedAcc({}); setMoc(false); setFilecard({ onFile: false, printing: 'A' }); setDmg(dmEmpty(fig.body === 'female' ? 'female' : 'male'));
  }, [selId]);

  const q = query.trim().toLowerCase();
  const allResults = AF_CATALOG.filter(f => (!yearF || f.year === +yearF) && (!q || [f.name, f.role, String(f.year), f.faction]
    .concat(f.variants.map(v => v.tell)).some(s => s && s.toLowerCase().includes(q))));
  const hasFilter = !!q || !!yearF;
  const results = !hasFilter ? [] : yearF ? allResults : allResults.slice(0, 60);

  const blueprint = fig ? fig.blueprint : [];
  const clusterBp = JoeData.clusterBlueprint(blueprint);
  const ctxGroups = clusterContexts(blueprint);
  const unitsOf = (n) => owned[n] || 0;
  const bpReq = JoeData.bpReq(blueprint);
  const fullDone = JoeData.instOwn(blueprint, owned);

  const goto = (i) => { setStep(i); setMax(m => Math.max(m, i)); };
  const next = () => goto(Math.min(step + 1, AF_STEPS.length - 1));
  const back = () => goto(Math.max(step - 1, 0));

  const setUnit = (n, idx) => setOwnedAcc(o => { const cur = o[n] || 0; return { ...o, [n]: cur > idx ? idx : idx + 1 }; });
  const setUnitTo = (n, val) => setOwnedAcc(o => ({ ...o, [n]: val }));
  const afAccRow = ([n, qreq]) => {
    const u = unitsOf(n); const isDone = u >= qreq;
    return (
      <div key={n} className={"af-acc__row" + (isDone ? " is-done" : "")}>
        <div className="af-acc__left"><span className="af-acc__n">{n}</span></div>
        <div className="af-acc__right">
          <div className="af-acc__boxes">
            {Array.from({ length: qreq }).map((_, i) => (
              <button key={i} className={"af-unit" + (i < u ? " is-on" : "")} title={`unit ${i + 1} of ${qreq}`} onClick={() => setUnit(n, i)}>✓</button>
            ))}
          </div>
          <span className={"af-acc__count" + (isDone ? " is-done" : "")}>{u}/{qreq}</span>
        </div>
      </div>
    );
  };
  const markAllAcc = () => setOwnedAcc(() => { const o = {}; blueprint.forEach(([n, qr]) => o[n] = qr); return o; });

  // condition handlers
  const phys = physicalGrade(dmg);
  const paint = paintGrade(dmg);
  const marksCount = phys.zones + paint.zones;
  const clean = !!dmg.clean;
  const ungraded = marksCount === 0 && !clean;
  const canNext = step === 0 ? (!!fig && (single || selVar !== null)) : true;

  const commit = () => {
    if (!fig) return;
    const accFull = {}; blueprint.forEach(([n, qr]) => accFull[n] = qr);
    JoeStore.addInstance({
      catalogId: fig.id, variant: variantKey, moc,
      acc: moc ? accFull : { ...owned },
      phys: moc ? null : (ungraded ? null : phys.grade),
      paint: moc ? null : (ungraded ? null : paint.grade),
      marks: moc ? null : dmg,
      loc: loc.trim(), notes: notes.trim(),
      filecard: filecard.onFile ? { onFile: true, printing: filecard.printing } : { onFile: false, printing: 'A' },
    });
    setDone(true);
  };

  const resetAll = () => {
    setDone(false); setSelId(null); setQuery(""); setSelVar(null); setLoc(""); setNotes("");
    setOwnedAcc({}); setMoc(false); setFilecard({ onFile: false, printing: 'A' }); setDmg(dmEmpty('male')); setYearF(""); goto(0);
  };

  return (
    <div className="af-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="af af--overlay">
      <div className="af-card">
        <header className="af-top">
          <div className="af-title">{preset ? "ADD COPY" : "ADD FIGURE"}</div>
          <button className="af-x" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <AfStepper step={step} setStep={goto} maxReached={maxReached} lockFirst={preset} />

        <div className="af-body">
          {/* ===== STEP 1 — FIND ===== */}
          {step === 0 && (
            <div className="af-find">
              <div className="af-find__tools">
                <label className="af-search">
                  <span>⌕</span>
                  <input value={query} onChange={e => setQuery(e.target.value)}
                         placeholder={"search " + AF_CATALOG.length + " figures — code name · specialty…"} autoFocus />
                  {query && <button className="af-clear" onClick={() => setQuery('')}>✕</button>}
                </label>
                <span className="af-yearsel">
                  <select value={yearF} onChange={e => setYearF(e.target.value)}>
                    <option value="">All years</option>
                    {AF_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </span>
              </div>
              {hasFilter && <div className="af-resmeta">{allResults.length} match{allResults.length !== 1 ? "es" : ""}{allResults.length > results.length ? ` · showing first ${results.length}` : ""}</div>}
              <div className="af-results">
                {results.map(f => {
                  const own = JoeData.ownedCount(f.id);
                  const sub = isSingle(f) ? (f.role || ("v" + f.ver)) : f.variants.length + " variants";
                  return (
                  <React.Fragment key={f.id}>
                  <button className={"af-res" + (f.id === selId ? " is-sel" : "")} onClick={() => setSelId(f.id)}>
                    <span className="af-res__thumb"></span>
                    <span className="af-res__name"><b>{f.name}</b><i>{sub} · {f.year}</i></span>
                    <span className={"wf-fac wf-fac--" + f.faction.toLowerCase() + " wf-fac--mini"}>{f.faction}</span>
                    <span className="af-res__own">{own === 0 ? "not owned" : "owned ×" + own}</span>
                    <span className="af-res__pick">{f.id === selId ? (isSingle(f) ? "● selected" : "▾ pick variant") : "select ›"}</span>
                  </button>
                  {f.id === selId && !isSingle(f) && (
                    <div className="af-varpick">
                      {f.variants.map(v => (
                        <button key={v.letter} className={"af-var" + (selVar === v.letter ? " is-sel" : "")} onClick={() => setSelVar(v.letter)}>
                          <span className="af-var__radio"></span>
                          <span className="af-var__lab">v{f.ver} · {v.letter || "—"}</span>
                          <span className="af-var__tell">{v.tell || "no distinguishing notes"}</span>
                          <span className="af-var__own">{JoeData.ownedCount(f.id, v.letter) === 0 ? "not owned" : "×" + JoeData.ownedCount(f.id, v.letter)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  </React.Fragment>
                  );
                })}
                {hasFilter && results.length === 0 && <div className="af-nores">No catalog match{query ? ` for “${query}”` : ""}{yearF ? ` in ${yearF}` : ""}.</div>}
                {!hasFilter && <div className="af-prompt">Search by code name or specialty above, or pick a year — matching figures list here.</div>}
              </div>
            </div>
          )}

          {/* ===== STEP 2 — DETAILS ===== */}
          {step === 1 && fig && (
            <div className="af-details">
              <div className="af-fig">
                <span className="af-fig__thumb"></span>
                <div>
                  <div className="af-fig__name">{fig.name} <span className={"wf-fac wf-fac--" + fig.faction.toLowerCase() + " wf-fac--mini"}>{fig.faction}</span>{varLabel && <span className="af-fig__vtag">{varLabel}</span>}</div>
                  <div className="af-fig__var">{multi ? (varTell ? varTell + " · " + fig.year : fig.year) : (fig.role ? fig.role + " · " : "") + fig.year}</div>
                </div>
              </div>

              <div className="af-block af-block--last">
                <label className={"inv-moc" + (moc ? " is-on" : "")}>
                  <input type="checkbox" checked={moc} onChange={e => setMoc(e.target.checked)} />
                  <span className="inv-moc__box">{moc ? "\u2713" : ""}</span>
                  <span className="inv-moc__txt">
                    <b>Mint on Card <em>MOC</em></b>
                  </span>
                </label>

                {moc ? (
                  <p className="af-seclab"><b>Accessories</b> · sealed on card — all {bpReq} assumed present</p>
                ) : (
                  <React.Fragment>
                    <p className="af-seclab"><b>Accessories</b> · {fullDone}/{bpReq} complete{blueprint.length ? "" : " — no blueprint on file for this figure"}</p>
                    {blueprint.length > 0 && (
                      <div className="af-acc">
                        {clusterBp.solo.map(afAccRow)}
                        {clusterBp.groups.map((items, i) => (
                          <VariantGroup key={i} items={items} acc={owned} live onSet={setUnitTo} />
                        ))}
                        {ctxGroups.map((cg) => (
                          <ContextGroup key={cg.context} context={cg.context} items={cg.items} renderRow={afAccRow} />
                        ))}
                      </div>
                    )}
                  </React.Fragment>
                )}

                <div className="acc-list fc-list" style={{ marginTop: 18 }}>
                  <div className="acc-list__cap"><span>FILE CARD</span><span>{filecard.onFile && <b>ON FILE</b>}</span></div>
                  <div className="acc fc-row">
                    <span className="acc__name">Card on file</span>
                    {filecard.onFile &&
                      <span className="fc-selwrap"><select className="fc-sel" value={filecard.printing} onChange={e => setFilecard(s => ({ ...s, printing: e.target.value }))}>{AF_FILECARDS.map(c => <option key={c.letter} value={c.letter}>{c.letter} · {c.name}</option>)}</select><span className="fc-caret">▾</span></span>}
                    <button type="button" className={"acc__box fc-box" + (filecard.onFile ? " is-on" : "")} onClick={() => setFilecard(s => ({ ...s, onFile: !s.onFile }))} title={filecard.onFile ? "Mark card not on file" : "Mark file card on file"}>{filecard.onFile ? "✓" : ""}</button>
                  </div>
                </div>

                <p className="af-seclab" style={{ marginTop: 18 }}><b>Bin / box location</b> <i style={{ fontStyle: 'normal', color: 'var(--ink-soft)' }}>(optional)</i></p>
                <input className="af-in" value={loc} onChange={e => setLoc(e.target.value)} placeholder="e.g. BIN C-04 · long-box" />
              </div>
            </div>
          )}

          {/* ===== STEP 3 — CONDITION ===== */}
          {step === 2 && fig && (
            <div className="af-cond">
              <div className="af-cond__map">
                {moc ? (
                  <div className="id-sealed">
                    <div className="id-sealed__card"><div className="id-sealed__tag">MINT ON CARD</div><div className="id-sealed__sub">SEALED · UNOPENED</div></div>
                    <p>The loose-figure condition diagram doesn't apply to a carded copy. Note any card or bubble flaws below.</p>
                  </div>
                ) : (
                  <DamageMap value={dmg} onChange={setDmg} genderLocked={true} />
                )}
              </div>
              <div className="af-cond__side">
                <section className="panel">
                  <div className="panel__hd">CONDITION <em>· {moc ? "mint on card" : (ungraded ? "ungraded" : marksCount === 0 ? "clean · confirmed" : "from " + marksCount + " mark" + (marksCount !== 1 ? "s" : ""))}</em></div>
                  {moc ? (
                    <div className="id-mocgrade">
                      <span className="id-mocgrade__badge">MOC</span>
                      <span className="id-mocgrade__txt"><b>Factory mint · sealed</b><i>Grade derives from the card &amp; bubble, not the figure — record specifics in notes.</i></span>
                    </div>
                  ) : ungraded ? (
                    <div className="panel__note">
                      <div>Tag the diagram to record condition, or mark it clean.</div>
                      <button className="af-markall" onClick={() => setDmg(d => ({ ...d, clean: true }))}>✓ MARK CLEAN — NO DAMAGE</button>
                    </div>
                  ) : (
                    <React.Fragment>
                      <div className="grades">
                        <GradeBadge kind="PHYSICAL" result={phys} />
                        <GradeBadge kind="PAINT" result={paint} />
                      </div>
                      {clean && marksCount === 0 && (
                        <div className="panel__note">Confirmed clean — no damage mapped. <button className="af-clear" onClick={() => setDmg(d => ({ ...d, clean: false }))}>undo</button></div>
                      )}
                    </React.Fragment>
                  )}
                </section>
                <section className="panel">
                  <div className="panel__hd">NOTES <em>· this copy only</em></div>
                  <textarea className="af-notes" value={notes} onChange={e => setNotes(e.target.value)}
                            placeholder={moc ? "optional — card grade, bubble crush, AFA number, sticker condition…" : "optional — joint feel, provenance, where you bought it, paint quirks…"}></textarea>
                </section>
              </div>
            </div>
          )}

          {/* ===== STEP 4 — FINALIZE ===== */}
          {step === 3 && fig && !done && (
            <div className="af-confirm">
              <div className="af-sum">
                <div className="af-sum__row"><span>Figure</span><b>{fig.name} · {multi ? varLabel : (fig.role || varLabel)} · {fig.year}</b></div>
                {multi && <div className="af-sum__row"><span>Variant</span><b>{varTell}</b></div>}
                <div className="af-sum__row"><span>Copy</span><b>#{instNo}{isNew ? " · first of this variant" : ""}</b></div>
                <div className="af-sum__row"><span>Accessories</span><b>{moc ? "sealed on card · 100% (assumed present)" : (blueprint.length ? `${fullDone}/${bpReq} complete` : "none on file")}</b></div>
                <div className="af-sum__row"><span>Condition</span><b>{moc ? "Mint on Card · factory mint (sealed)" : (ungraded ? "ungraded — map later" : marksCount === 0 ? `${phys.grade} physical / ${paint.grade} paint · confirmed clean` : `${phys.grade} physical / ${paint.grade} paint · ${marksCount} mark${marksCount !== 1 ? "s" : ""}`)}</b></div>
                <div className="af-sum__row"><span>Location</span><b>{loc || "—"}</b></div>
                {notes && <div className="af-sum__row"><span>Notes</span><b>{notes}</b></div>}
              </div>
              <button className="af-add" onClick={commit}>＋ ADD TO INVENTORY</button>
            </div>
          )}

          {/* ===== SUCCESS ===== */}
          {step === 3 && done && (
            <div className="af-okwrap">
              <div className="af-ok">✓</div>
              <div className="af-ok__h">{fig.name}{multi ? " " + varLabel : ""} · copy #{instNo} added</div>
              <div className="af-ok__sub">
                {moc ? "Mint on Card · 100% complete (sealed) · factory mint" : (
                  <React.Fragment>
                    {blueprint.length ? (fullDone > 0 ? `${fullDone}/${bpReq} accessories complete` : "no accessories yet") : "no blueprint"} ·{" "}
                    {ungraded ? "condition still to map" : `${phys.grade} / ${paint.grade}`}{loc ? ` · ${loc}` : ""}
                  </React.Fragment>
                )}
              </div>
              <div className="af-ok__btns">
                <button className="af-okbtn af-okbtn--go" onClick={resetAll}>＋ ADD ANOTHER</button>
                <button className="af-okbtn" onClick={onClose}>DONE → INVENTORY</button>
              </div>
            </div>
          )}
        </div>

        {!done && (
          <div className="af-foot">
            <button className="af-nav af-nav--ghost" onClick={back} disabled={step === 0 || (preset && step === 1)}>‹ BACK</button>
            <span className="af-foot__mid">{fig ? `${fig.name} · step ${step + 1} of ${AF_STEPS.length}` : "select a figure to begin"}</span>
            {step < AF_STEPS.length - 1
              ? <button className="af-nav" onClick={next} disabled={!canNext}>NEXT ›</button>
              : <button className="af-nav" onClick={commit}>＋ ADD</button>}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

export { AddFigureOverlay };
