// app-add-figure.jsx — WORKING Add Figure flow (overlay). Searches the real
// catalog, and on finalize writes a real owned instance to JoeStore.
// FIND → DETAILS → CONDITION → FINALIZE. Damage map from damage-map.jsx.
import React from 'react';
import { JoeStore, JoeData } from './store.js';
import { DamageMap, GradeBadge, physicalGrade, paintGrade, dmEmpty } from './damage-map.jsx';
import { DamageModePanel } from './app-detail.jsx';
import { AccessoryList, orderedBlueprint } from './accessory-groups.jsx';
import { AccSwatch } from './acc-colors.jsx';
import { VersionChip, VariantBadge, VehicleTag } from './fig-identity.jsx';
import { formatYear, CONVENTION_YEAR } from './fig-identity.js';
import { FileCardRow, FileCardTell } from './filecards.jsx';
const AF_CATALOG = JoeData.CAT || [];
// CONVENTION_YEAR sorts to the end regardless of numeric value — it's not a
// real year, so it doesn't belong interleaved by magnitude, but it does need
// to be a pickable option here (unlike Inventory's min/max range facet,
// this is a single-select filter, so one extra option is cheap and it was
// previously only reachable via text search).
const AF_YEARS = [...new Set(AF_CATALOG.map(f => f.year))].filter(y => y !== CONVENTION_YEAR).sort((a, b) => a - b);
if (AF_CATALOG.some(f => f.year === CONVENTION_YEAR)) AF_YEARS.push(CONVENTION_YEAR);

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

function AddFigureOverlay({ onClose, presetCatalogId = null, presetVariant = null, presetAcc = null }) {
  const preset = presetCatalogId != null;            // launched from a figure's + (add a copy) — lock to that figure, skip FIND
  const [step, setStep] = React.useState(preset ? 1 : 0);
  const [maxReached, setMax] = React.useState(preset ? 1 : 0);
  const [query, setQuery] = React.useState("");
  const [yearF, setYearF] = React.useState("");
  const [selId, setSelId] = React.useState(presetCatalogId);
  const [selVar, setSelVar] = React.useState(presetVariant); // letter | '' (single) | null
  const [loc, setLoc] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [owned, setOwnedAcc] = React.useState(() => presetAcc || {});   // accName -> units owned
  const [moc, setMoc] = React.useState(false);       // Mint on Card (sealed) — counts 100% complete
  const [filecard, setFilecard] = React.useState({ onFile: false, fileCardId: null });
  const [coo, setCoo] = React.useState(''); // optional — country of origin, only offered when fig.coo has entries
  // condition — single zone-map value; dmg.clean is the explicit "no damage found"
  // confirmation (vs. not yet mapped), and travels with marks into the stored instance
  const [dmg, setDmg] = React.useState(() => dmEmpty('male'));
  const [accDamage, setAccDamage] = React.useState({}); // accName -> units damaged, a subset of owned
  const [done, setDone] = React.useState(false);

  const fig = AF_CATALOG.find(f => f.id === selId) || null;
  const single = isSingle(fig);
  const multi = fig && !single;
  const chosen = multi ? fig.variants.find(v => v.letter === selVar) : null;
  const variantKey = single ? '' : (selVar || '');
  const ownedHere = fig ? JoeData.ownedCount(fig.id, variantKey) : 0;
  const isNew = !!fig && ownedHere === 0;
  const varTell = chosen ? chosen.tell : null;

  // selecting a figure clears variant + parts + condition; auto-pick for single-variant
  React.useEffect(() => {
    if (!fig) return;
    setSelVar(isSingle(fig) ? '' : (presetVariant && fig.id === presetCatalogId ? presetVariant : null));
    setOwnedAcc(presetAcc && fig.id === presetCatalogId ? presetAcc : {});
    setMoc(false); setFilecard({ onFile: false, fileCardId: null }); setDmg(dmEmpty(fig.body === 'female' ? 'female' : 'male')); setCoo(''); setAccDamage({});
  }, [selId]);

  const q = query.trim().toLowerCase();
  const allResults = AF_CATALOG.filter(f => (!yearF || f.year === +yearF) && (!q || [f.name, f.role, formatYear(f.year), f.faction]
    .concat(f.variants.map(v => v.tell)).some(s => s && s.toLowerCase().includes(q))));
  const hasFilter = !!q || !!yearF;
  const results = !hasFilter ? [] : yearF ? allResults : allResults.slice(0, 60);

  // Scoped to the variant picked in DETAILS (variantKey) — a variant-exclusive
  // accessory (e.g. Blocker's v1 B-only Visor) shouldn't be offered until that
  // variant is chosen. See bpForVariant + ACCESSORY_GROUPS.md "variant_id".
  const blueprint = fig ? JoeData.bpForVariant(fig.blueprint, variantKey) : [];
  const ordered = orderedBlueprint(blueprint);
  const unitsOf = (n) => owned[n] || 0;
  const bpReq = JoeData.bpReq(blueprint);
  const fullDone = JoeData.instOwn(blueprint, owned);
  const ownedAcc = blueprint.filter(([n]) => (owned[n] || 0) > 0);

  const goto = (i) => { setStep(i); setMax(m => Math.max(m, i)); };
  const next = () => goto(Math.min(step + 1, AF_STEPS.length - 1));
  const back = () => goto(Math.max(step - 1, 0));

  const setUnit = (n, idx) => setOwnedAcc(o => { const cur = o[n] || 0; return { ...o, [n]: cur > idx ? idx : idx + 1 }; });
  // color (blueprint tuple index 6, added 2026-07-03 — see acc-colors.jsx)
  // renders as an AccSwatch beside the name, decoration only. short=true is
  // for variant-slot options: display the shortened option label (via
  // JoeData.optLabel) plus its match_key tag badge, same row shape as a solo item.
  const afAccRow = (a, short) => {
    const [n, qreq, , , , tag, color] = a;
    const u = unitsOf(n); const isDone = u >= qreq;
    return (
      <div key={n} className={"af-acc__row" + (isDone ? " is-done" : "")}>
        <div className="af-acc__left">
          {short && tag != null && <span className="af-acc__tag">{tag}</span>}
          {color && <AccSwatch color={color} />}<span className="af-acc__n">{short ? JoeData.optLabel(n) : n}</span>
        </div>
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
      accDamage: moc ? {} : { ...accDamage },
      phys: moc ? null : (ungraded ? null : phys.grade),
      paint: moc ? null : (ungraded ? null : paint.grade),
      marks: moc ? null : dmg,
      loc: loc.trim(), notes: notes.trim(),
      filecard: filecard.onFile ? { onFile: true, fileCardId: filecard.fileCardId } : { onFile: false, fileCardId: null },
      coo: coo || '',
    });
    setDone(true);
  };

  const resetAll = () => {
    setDone(false); setSelId(null); setQuery(""); setSelVar(null); setLoc(""); setNotes("");
    setOwnedAcc({}); setMoc(false); setFilecard({ onFile: false, fileCardId: null }); setDmg(dmEmpty('male')); setAccDamage({}); setYearF(""); goto(0);
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
                    {AF_YEARS.map(y => <option key={y} value={y}>{formatYear(y)}</option>)}
                  </select>
                </span>
              </div>
              {hasFilter && <div className="af-resmeta">{allResults.length} match{allResults.length !== 1 ? "es" : ""}{allResults.length > results.length ? ` · showing first ${results.length}` : ""}</div>}
              <div className="af-results">
                {results.map(f => {
                  const own = JoeData.ownedCount(f.id);
                  // always lead with the version — role/variant-count alone isn't enough to
                  // tell apart same-name/same-year rows like Grunt v1.5 vs v2 (both "Infantry")
                  const sub = "v" + f.ver + (isSingle(f) ? (f.role ? " · " + f.role : "") : " · " + f.variants.length + " variants");
                  return (
                  <React.Fragment key={f.id}>
                  <button className={"af-res" + (f.id === selId ? " is-sel" : "")} onClick={() => setSelId(f.id)}>
                    <span className="af-res__thumb"></span>
                    <span className="af-res__name"><b>{f.name}</b><i>{sub} · {formatYear(f.year)}</i>{f.vehicle && <span className="idveh" title={"Vehicle driver — packaged with the " + f.vehicle}><b>VEHICLE</b> {f.vehicle}</span>}</span>
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
                {hasFilter && results.length === 0 && <div className="af-nores">No catalog match{query ? ` for “${query}”` : ""}{yearF ? ` in ${formatYear(+yearF)}` : ""}.</div>}
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
                  <div className="af-fig__name">
                    {fig.name}<VersionChip version={"v" + fig.ver} />
                    <span className={"wf-fac wf-fac--" + fig.faction.toLowerCase() + " wf-fac--mini"}>{fig.faction}</span>
                    {multi && chosen ? <VariantBadge letter={chosen.letter} /> : null}
                  </div>
                  <div className="af-fig__var">{multi ? (varTell ? varTell + " · " + formatYear(fig.year) : formatYear(fig.year)) : (fig.role ? fig.role + " · " : "") + formatYear(fig.year)}</div>
                  <VehicleTag vehicle={fig.vehicle} />
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
                        <AccessoryList ordered={ordered} renderSolo={(a) => afAccRow(a)} renderOption={(a) => afAccRow(a, true)} />
                      </div>
                    )}
                  </React.Fragment>
                )}

                <div className="acc-list fc-list" style={{ marginTop: 18 }}>
                  <div className="acc-list__cap"><span>FILE CARD</span><span>{filecard.onFile && <b>ON FILE</b>}</span></div>
                  <div className="acc fc-row">
                    <span className="acc__name">Card on file</span>
                    {filecard.onFile && <FileCardRow fig={fig} printing={filecard.fileCardId} onChange={fileCardId => setFilecard(s => ({ ...s, fileCardId }))} />}
                    <button type="button" className={"acc__box fc-box" + (filecard.onFile ? " is-on" : "")} onClick={() => setFilecard(s => ({ ...s, onFile: !s.onFile }))} title={filecard.onFile ? "Mark card not on file" : "Mark file card on file"}>{filecard.onFile ? "✓" : ""}</button>
                  </div>
                  {filecard.onFile && <FileCardTell fig={fig} printing={filecard.fileCardId} />}
                </div>

                <p className="af-seclab" style={{ marginTop: 18 }}><b>Bin / box location</b> <i style={{ fontStyle: 'normal', color: 'var(--ink-soft)' }}>(optional)</i></p>
                <input className="af-in" value={loc} onChange={e => setLoc(e.target.value)} placeholder="e.g. BIN C-04 · long-box" />

                {fig.coo.length > 0 && (
                  <div className="acc-list fc-list coo-list" style={{ marginTop: 18 }}>
                    <div className="acc-list__cap"><span>COUNTRY OF ORIGIN</span><span>{coo && <b>{coo}</b>}</span></div>
                    <div className="acc fc-coorow">
                      {fig.coo.map(country => (
                        <span key={country} className="fc-coo__opt">
                          <span className="acc__name">{country}</span>
                          <button type="button" className={"acc__box fc-box" + (coo === country ? " is-on" : "")}
                                  onClick={() => setCoo(c => c === country ? '' : country)}
                                  title={coo === country ? "Clear country of origin" : "Set as country of origin"}>
                            {coo === country ? "✓" : ""}
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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
                {!moc && blueprint.length > 0 && (
                  <section className="panel">
                    <div className="panel__hd">ACCESSORY DAMAGE <em>· optional</em></div>
                    <DamageModePanel ownedAcc={ownedAcc} rawAcc={owned} accDamage={accDamage}
                      onSetDamage={(name, k) => setAccDamage(d => ({ ...d, [name]: k }))} />
                  </section>
                )}
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
                <div className="af-sum__row"><span>Figure</span><b>
                  {fig.name}<VersionChip version={"v" + fig.ver} />{multi && chosen ? <VariantBadge letter={chosen.letter} /> : null}
                  {(!multi && fig.role) ? " · " + fig.role : ""} · {formatYear(fig.year)}
                </b></div>
                {multi && <div className="af-sum__row"><span>Variant</span><b>{varTell}</b></div>}
                <div className="af-sum__row"><span>Copy</span><b>{isNew ? "first of this variant" : "additional copy"}</b></div>
                <div className="af-sum__row"><span>Accessories</span><b>{moc ? "sealed on card · 100% (assumed present)" : (blueprint.length ? `${fullDone}/${bpReq} complete` : "none on file")}</b></div>
                <div className="af-sum__row"><span>Condition</span><b>{moc ? "Mint on Card · factory mint (sealed)" : (ungraded ? "ungraded — map later" : marksCount === 0 ? `${phys.grade} physical / ${paint.grade} paint · confirmed clean` : `${phys.grade} physical / ${paint.grade} paint · ${marksCount} mark${marksCount !== 1 ? "s" : ""}`)}</b></div>
                <div className="af-sum__row"><span>Location</span><b>{loc || "—"}</b></div>
                {notes && <div className="af-sum__row"><span>Notes</span><b>{notes}</b></div>}
              </div>
            </div>
          )}

          {/* ===== SUCCESS ===== */}
          {step === 3 && done && (
            <div className="af-okwrap">
              <div className="af-ok">✓</div>
              <div className="af-ok__h">{fig.name}<VersionChip version={"v" + fig.ver} /> added</div>
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
              : <button className="af-nav" onClick={commit}>＋ ADD TO INVENTORY</button>}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

export { AddFigureOverlay };
