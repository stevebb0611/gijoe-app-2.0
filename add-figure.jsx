// add-figure.jsx — Add Figure POP-OUT modal (June 2026 rework):
//   FIND → DETAILS → CONDITION  (the old FINALIZE step was removed; ＋ADD lives on CONDITION)
//   • FIND      no pre-loaded list. Search (fuzzy, matches alt_name: "Snake-Eyes"≈"Snake Eyes",
//               "Rock & Roll"≈"Rock 'N Roll") OR a Year→Figure dropdown. Results are chronological.
//   • DETAILS   figure context → accessories (per-unit checkboxes + Parts-Bin pull) → location.
//               No "already own ×N / copy #N" language anywhere.
//   • CONDITION shared interactive damage map + live grades + per-copy notes, then ＋ADD TO INVENTORY.
//   Renders as a modal (scrim + dialog). Catalog + fuzzy search come from add-figure-catalog.js.

// Pull shared globals via window with LOCALLY-UNIQUE names. We must NOT `const`-destructure
// names like DamageMap / physicalGrade / AF_CATALOG here: those are already top-level lexical
// bindings from damage-map.jsx and add-figure-catalog.js, and re-declaring them in this
// (shared) global babel scope throws "Identifier already declared" and kills the file.
const AfMap = window.DamageMap, AfGrade = window.GradeBadge, afEmpty = window.dmEmpty;
const afCalcPhys = window.physicalGrade, afCalcPaint = window.paintGrade;
const AfCat = window.AF_CATALOG, afFind = window.afSearch, AF_YEARS = window.afYears, afOwnedOf = window.afCatOwned;

// ---- parts bin: a part type in the bin can be pulled onto any figure that needs it ----
const AF_BIN0 = { "Backpack": 3, "Rifle": 2, "AK Rifle": 2, "Pistol": 2, "Helmet": 1 };
const afBinHas = (bin, acc) => (bin[acc] || 0) > 0;

const AF_STEPS = ["FIND", "DETAILS", "CONDITION"];

function AfStepper({ step, setStep, maxReached }) {
  return (
    <div className="af-steps">
      {AF_STEPS.map((s, i) => (
        <button key={s} className={"af-step" + (i === step ? " is-on" : "") + (i < step ? " is-done" : "")}
                disabled={i > maxReached} onClick={() => i <= maxReached && setStep(i)}>
          <span className="af-step__n">{i < step ? "✓" : i + 1}</span>{s}
        </button>
      ))}
    </div>
  );
}

function AddFigure({ onClose }) {
  const [step, setStep] = React.useState(0);
  const [maxReached, setMax] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [year, setYear] = React.useState("");          // Year→Figure dropdown
  const [selId, setSelId] = React.useState(null);
  const [selVar, setSelVar] = React.useState(null);
  const [loc, setLoc] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [coo, setCoo] = React.useState({});   // Country of Origin — which mold stamp(s) this copy carries
  const [owned, setOwnedAcc] = React.useState({});
  const [pulled, setPulled] = React.useState({});
  const [bin, setBin] = React.useState(AF_BIN0);
  const [moc, setMoc] = React.useState(false);   // Mint on Card — sealed, overrides accessory checks → 100%
  // condition — single zone-map value
  const [dmg, setDmg] = React.useState(() => afEmpty('male'));
  const [done, setDone] = React.useState(false);

  const fig = AfCat.find(f => f.id === selId) || null;
  const isMulti = !!(fig && fig.variants);
  const chosen = isMulti ? fig.variants.find(v => v.letter === selVar) : null;
  const ownedHere = isMulti ? (chosen ? chosen.owned : 0) : (fig ? fig.owned : 0);
  const isNew = !!fig && (isMulti ? !!chosen : true) && ownedHere === 0;
  const varLabel = isMulti ? (chosen ? "v" + chosen.ver + " · " + chosen.letter : "") : null;
  const varTell = chosen ? chosen.tell : null;

  // changing the figure clears variant, parts, condition
  React.useEffect(() => {
    setSelVar(null); setOwnedAcc({}); setPulled({}); setBin(AF_BIN0); setMoc(false);
    setCoo({});
    setDmg(afEmpty(fig && fig.body === 'female' ? 'female' : 'male'));
  }, [selId]);

  // esc closes the modal
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // FIND — search and Year→Figure browse are INDEPENDENT inputs.
  //  • search queries the whole catalog (any year); the year dropdown never narrows it
  //  • the dropdown resolves to ONE figure (no long scrollable year list)
  const q = query.trim();
  const searchResults = q ? afFind(q, "") : [];
  const yearFigs = year ? AfCat.filter(f => f.year === +year).sort((a, b) => a.name.localeCompare(b.name)) : [];
  const dropFig = (!q && fig && year && fig.year === +year) ? fig : null;  // single browsed figure

  const blueprint = fig ? fig.blueprint : [];
  const unitsOf = (n) => owned[n] || 0;
  const lineDone = ([n, qr]) => unitsOf(n) >= qr;
  // MOC seals the copy: every part is assumed present, so completeness is forced whole.
  const fullDone = moc ? blueprint.length : blueprint.filter(lineDone).length;
  const binMatches = blueprint.filter(([n]) => fig && (afBinHas(bin, n) || pulled[n]));

  const goto = (i) => { setStep(i); setMax(m => Math.max(m, i)); };
  const next = () => goto(Math.min(step + 1, AF_STEPS.length - 1));
  const back = () => goto(Math.max(step - 1, 0));

  // accessories
  const setUnit = (n, idx) => setOwnedAcc(o => {
    const cur = o[n] || 0;
    return { ...o, [n]: cur > idx ? idx : idx + 1 };
  });
  const pull = (n, qreq) => {
    if (!afBinHas(bin, n) || unitsOf(n) >= qreq) return;
    setBin(b => ({ ...b, [n]: b[n] - 1 }));
    setOwnedAcc(o => ({ ...o, [n]: Math.min((o[n] || 0) + 1, qreq) }));
    setPulled(p => ({ ...p, [n]: (p[n] || 0) + 1 }));
  };
  const pullAll = () => {
    if (!fig) return;
    const no = { ...owned }, nb = { ...bin }, np = { ...pulled };
    blueprint.forEach(([n, qreq]) => {
      while (afBinHas(nb, n) && (no[n] || 0) < qreq) {
        nb[n] -= 1; no[n] = (no[n] || 0) + 1; np[n] = (np[n] || 0) + 1;
      }
    });
    setOwnedAcc(no); setBin(nb); setPulled(np);
  };

  // Country of Origin — only figures with identified mold stamps expose the option
  const cooOpts = (fig && Array.isArray(fig.coo)) ? fig.coo : [];
  const toggleCoo = (c) => setCoo(o => ({ ...o, [c]: !o[c] }));

  const phys = afCalcPhys(dmg);
  const paint = afCalcPaint(dmg);
  const marksCount = phys.zones + paint.zones;
  const ungraded = marksCount === 0;

  const canNext = step === 0 ? (!!fig && (!isMulti || selVar !== null)) : true;
  const isLast = step === AF_STEPS.length - 1;

  const resetAll = () => {
    setDone(false); setSelId(null); setQuery(""); setYear(""); setSelVar(null); setLoc(""); setNotes("");
    setOwnedAcc({}); setPulled({}); setBin(AF_BIN0); setMoc(false); setCoo({}); setDmg(afEmpty('male')); goto(0);
  };

  const stop = (e) => e.stopPropagation();

  // one catalog row + its inline variant picker (shared by search list and dropdown card)
  const renderResult = (f) => {
    const own = afOwnedOf(f);
    const sub = f.variants ? f.variants.length + " variants" : f.variant;
    return (
      <React.Fragment key={f.id}>
        <button className={"af-res" + (f.id === selId ? " is-sel" : "")} onClick={() => setSelId(f.id)}>
          <span className="af-res__thumb"></span>
          <span className="af-res__name">
            <b>{f.name}</b>
            <i>{sub} · {f.year}{f.alt ? " · " : ""}{f.alt && <em>aka {f.alt}</em>}</i>
          </span>
          <span className={"wf-fac wf-fac--" + f.faction.toLowerCase() + " wf-fac--mini"}>{f.faction}</span>
          <span className="af-res__pick">{f.id === selId ? "● selected" : "select ›"}</span>
        </button>
        {f.id === selId && f.variants && (
          <div className="af-varpick">
            {f.variants.map(v => (
              <button key={v.letter} className={"af-var" + (selVar === v.letter ? " is-sel" : "")} onClick={() => setSelVar(v.letter)}>
                <span className="af-var__radio"></span>
                <span className="af-var__lab">v{v.ver} · {v.letter}{v.rare && <em>RARE</em>}</span>
                <span className="af-var__tell">{v.tell}</span>
              </button>
            ))}
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="af-scrim" onClick={onClose}>
      <div className="af-modal" onClick={stop} role="dialog" aria-modal="true" aria-label="Add Figure">
        <header className="af-mtop">
          <span className="af-mtitle">ADD FIGURE</span>
          <button className="af-mx" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <AfStepper step={step} setStep={goto} maxReached={maxReached} />

        <div className="af-body">
          {/* ============ STEP 1 — FIND ============ */}
          {step === 0 && (
            <div className="af-find">
              <div className="af-find__tools">
                <label className="af-search">
                  <span>⌕</span>
                  <input value={query} onChange={e => setQuery(e.target.value)}
                         placeholder="search by code name — Snake Eyes, Rock & Roll, Cobra…" autoFocus />
                </label>
                <div className="af-or">OR BROWSE BY YEAR</div>
                <div className="af-pick">
                  <span className="af-sel">
                    <select value={year} onChange={e => { setYear(e.target.value); setSelId(null); }}>
                      <option value="">Year…</option>
                      {AF_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </span>
                  <span className="af-sel">
                    <select value={dropFig ? selId : ""} disabled={!year}
                            onChange={e => e.target.value && setSelId(+e.target.value)}>
                      <option value="">{year ? "Figure…" : "pick a year first"}</option>
                      {yearFigs.map(f => (
                        <option key={f.id} value={f.id}>{f.name}{f.variants ? "" : " · " + f.variant}</option>
                      ))}
                    </select>
                  </span>
                </div>
              </div>

              {q ? (
                searchResults.length === 0 ? (
                  <div className="af-empty">
                    <div className="af-empty__mk">∅</div>
                    <div className="af-empty__h">No catalog match</div>
                    <div className="af-empty__sub">Nothing matches “{query}”. Check the spelling, or — if it's a real figure missing from the catalog — add it.</div>
                    <div className="af-custom"><a className="af-link" href="GI Joe Tracker - Add Missing Figure.html">＋ add a figure missing from the catalog</a></div>
                  </div>
                ) : (
                  <>
                    <p className="af-count">{searchResults.length} match{searchResults.length !== 1 ? "es" : ""} · chronological</p>
                    <div className="af-results">{searchResults.map(renderResult)}</div>
                  </>
                )
              ) : dropFig ? (
                <>
                  <p className="af-count">{year} · selected from catalog</p>
                  <div className="af-results">{renderResult(dropFig)}</div>
                </>
              ) : (
                <div className="af-empty">
                  <div className="af-empty__mk">⌕</div>
                  <div className="af-empty__h">Find the figure to add</div>
                  <div className="af-empty__sub">Search by code name — alternate spellings work (Snake-Eyes, Rock and Roll) — or use the Year → Figure menus to pick one directly.</div>
                </div>
              )}
            </div>
          )}

          {/* ============ STEP 2 — DETAILS ============ */}
          {step === 1 && fig && (
            <div className="af-details">
              <div className="af-fig">
                <span className="af-fig__thumb"></span>
                <div>
                  <div className="af-fig__name">{fig.name} <span className={"wf-fac wf-fac--" + fig.faction.toLowerCase() + " wf-fac--mini"}>{fig.faction}</span>{varLabel && <span className="af-fig__vtag">{varLabel}</span>}</div>
                  <div className="af-fig__var">{isMulti ? (varTell + " · " + fig.year) : fig.variant + " · " + fig.year}</div>
                </div>
              </div>

              <label className={"af-moc" + (moc ? " is-on" : "")}>
                <input type="checkbox" checked={moc} onChange={e => setMoc(e.target.checked)} />
                <span className="af-moc__box">{moc ? "✓" : ""}</span>
                <span className="af-moc__txt">
                  <b>Mint on Card <span className="af-moc__abbr">MOC</span></b>
                  <i>Sealed &amp; unverified — assumes all parts present and locks this copy <b>100% complete</b>. Skips accessory checks and the damage map.</i>
                </span>
              </label>

              <div className={"af-block" + (moc ? " af-block--sealed" : "")}>
                <p className="af-seclab">{moc
                  ? <React.Fragment><b>Accessories</b> · <span className="af-sealed__inline">sealed on card — all {blueprint.length} parts assumed present</span></React.Fragment>
                  : <React.Fragment><b>Accessories</b> · {fullDone}/{blueprint.length} complete · tick each unit you have, or pull from your Bin</React.Fragment>}</p>
                <div className="af-acc">
                  {blueprint.map(([n, qreq]) => {
                    const u = unitsOf(n);
                    const isDone = moc || u >= qreq;
                    const canPull = !moc && afBinHas(bin, n) && !isDone;
                    return (
                      <div key={n} className={"af-acc__row" + (isDone ? " is-done" : "")}>
                        <div className="af-acc__left">
                          <span className="af-acc__n">{n}</span>
                          {canPull && <button className="af-acc__pull" onClick={() => pull(n, qreq)}>+bin {bin[n]}</button>}
                        </div>
                        <div className="af-acc__right">
                          <div className="af-acc__boxes">
                            {Array.from({ length: qreq }).map((_, i) => (
                              <button key={i} className={"af-unit" + ((moc || i < u) ? " is-on" : "")}
                                      disabled={moc}
                                      title={`unit ${i + 1} of ${qreq}`} onClick={() => setUnit(n, i)}>✓</button>
                            ))}
                          </div>
                          <span className={"af-acc__count" + (isDone ? " is-done" : "")}>{moc ? qreq : u}/{qreq}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!moc && binMatches.length > 0 && (
                  <div className="af-rec">
                    <div className="af-rec__txt"><b>{binMatches.length} of this copy's {blueprint.length} parts</b> {binMatches.length === 1 ? "is" : "are"} in your Parts Bin.</div>
                    <button className="af-rec__btn" onClick={pullAll} disabled={binMatches.every(lineDone)}>⇣ PULL ALL FROM BIN</button>
                  </div>
                )}
              </div>

              <div className="af-block af-block--last">
                <p className="af-seclab"><b>This copy</b> · location &amp; notes</p>
                <div className="af-meta">
                  <label className="af-meta__field">
                    <span className="af-meta__lab">NOTES · THIS COPY</span>
                    <textarea className="af-in af-in--area" value={notes} onChange={e => setNotes(e.target.value)}
                              placeholder={moc ? "optional — card grade, bubble crush, sun-fade, AFA number…" : "optional — joint feel, provenance, where you bought it, paint quirks…"}></textarea>
                  </label>
                  <label className="af-meta__field">
                    <span className="af-meta__lab">BIN / BOX LOCATION</span>
                    <input className="af-in" value={loc} onChange={e => setLoc(e.target.value)} placeholder="e.g. BIN C-04 · long-box" />
                  </label>
                </div>
                {cooOpts.length > 0 && (
                  <div className="af-coo">
                    <div className="af-coo__hd">COUNTRY OF ORIGIN <em>· tick the mold stamp on this copy</em></div>
                    <div className="af-coo__opts">
                      {cooOpts.map(c => (
                        <label key={c} className={"af-coo__opt" + (coo[c] ? " is-on" : "")}>
                          <input type="checkbox" checked={!!coo[c]} onChange={() => toggleCoo(c)} />
                          <span className="af-coo__box">{coo[c] ? "✓" : ""}</span>
                          <span className="af-coo__lab">{c}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============ STEP 3 — CONDITION ============ */}
          {step === 2 && fig && !done && (
            <div className="af-cond">
              <div className="af-cond__map">
                {moc ? (
                  <div className="af-sealed">
                    <div className="af-sealed__card">
                      <div className="af-sealed__tag">MINT ON CARD</div>
                      <div className="af-sealed__sub">SEALED · UNOPENED</div>
                    </div>
                    <p>The loose-figure damage map doesn't apply to a carded copy. Note any card or bubble flaws below.</p>
                  </div>
                ) : (
                  <AfMap value={dmg} onChange={setDmg} genderLocked={true} />
                )}
              </div>
              <div className="af-cond__side">
                <section className="panel">
                  <div className="panel__hd">CONDITION <em>· {moc ? "mint on card" : ungraded ? "ungraded" : "derived from " + marksCount + " mark" + (marksCount !== 1 ? "s" : "")}</em></div>
                  {moc ? (
                    <div className="af-mocgrade">
                      <span className="af-mocgrade__badge">MOC</span>
                      <div className="af-mocgrade__txt"><b>Factory mint · sealed</b><i>100% complete — accessories not individually tracked while carded</i></div>
                    </div>
                  ) : ungraded ? (
                    <div className="panel__note">Tag the diagram to record this copy's condition — grades derive live. Or leave it <b>ungraded</b> and map it later on the copy's detail page.</div>
                  ) : (
                    <div className="grades">
                      <AfGrade kind="PHYSICAL" result={phys} />
                      <AfGrade kind="PAINT" result={paint} />
                    </div>
                  )}
                </section>

              </div>
            </div>
          )}

          {/* ============ SUCCESS ============ */}
          {done && fig && (
            <div className="af-okwrap">
              <div className="af-ok">✓</div>
              <div className="af-ok__h">{fig.name}{isMulti ? " " + varLabel : ""} added</div>
              <div className="af-ok__sub">
                {moc ? `Mint on Card · 100% complete (sealed)` : (fullDone > 0 ? `${fullDone}/${blueprint.length} accessories complete` : "no accessories yet")} ·{" "}
                {moc ? "factory mint" : ungraded ? "condition still to map" : `${phys.grade} / ${paint.grade}`}
                {loc ? ` · ${loc}` : ""}
              </div>
              <div className="af-ok__btns">
                <a className="af-okbtn af-okbtn--go" href="GI Joe Tracker - Instance Detail.html">OPEN COPY DETAIL ›</a>
                <button className="af-okbtn" onClick={resetAll}>ADD ANOTHER</button>
                <button className="af-okbtn" onClick={onClose}>CLOSE</button>
              </div>
            </div>
          )}
        </div>

        {!done && (
          <div className="af-foot">
            <button className="af-nav af-nav--ghost" onClick={back} disabled={step === 0}>‹ BACK</button>
            <span className="af-foot__mid">{fig ? `${fig.name} · step ${step + 1} of ${AF_STEPS.length}` : "find a figure to begin"}</span>
            {isLast
              ? <button className="af-nav af-nav--add" onClick={() => setDone(true)} disabled={!fig}>＋ ADD TO INVENTORY</button>
              : <button className="af-nav" onClick={next} disabled={!canNext}>NEXT ›</button>}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { AddFigure });
