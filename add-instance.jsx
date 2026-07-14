// add-instance.jsx — Add Instance: a LIGHT "add another copy of a figure I already own."
// Add Figure MINUS the catalog search. TWO windows (OPEN_QUESTIONS #8, revised June 2026):
//   ① THIS COPY  — variant (ONLY for multi-variant figures) → accessories checklist
//                  (with Parts-Bin pull) → bin/box location  [location closes the step]
//   ② CONDITION  — the shared interactive damage map → per-copy notes  [then ADD COPY]
// No "primary" concept anywhere. Single-variant figures show no variant UI at all.
// Damage map / engine come from the shared window-scoped damage-map.jsx module.

const { DamageMap, GradeBadge, physicalGrade, paintGrade, dmEmpty } = window;

// ---- owned figures you could be adding a copy of (the launch context) ----
const OWNED = [
  { id: 104, name: "BREAKER", faction: "JOE", year: 1982, role: "Communications", body: "male",
    blueprint: [["M-16 Rifle", 1], ["Backpack (common '82)", 1]],
    variants: [
      { letter: "A", ver: "1", tell: "Straight-arm · thin thumbs · flat paint",   owned: 1 },
      { letter: "B", ver: "1", tell: "Straight-arm · thick thumbs · glossy paint", owned: 2 },
      { letter: "C", ver: "1", tell: "Straight-arm · thick thumbs · reverse rivets", owned: 0 },
    ] },
  { id: 204, name: "SNOW JOB", faction: "JOE", year: 1983, role: "Arctic Trooper", owned: 1, body: "male",
    blueprint: [["XMLR-3A Rifle", 1], ["Backpack (common '82)", 1], ["Skis", 2]] },
  { id: 304, name: "ROADBLOCK", faction: "JOE", year: 1984, role: "Heavy MG", owned: 1, body: "male",
    blueprint: [["M-2 .50 cal", 1], ["Tripod", 1], ["Ammo Box", 1], ["Backpack", 1]] },
  { id: 404, name: "TOLLBOOTH", faction: "JOE", year: 1985, role: "Bridge Layer", owned: 1, body: "male",
    blueprint: [["Helmet", 1], ["Rifle", 1], ["Backpack", 1], ["Pylon", 2], ["Winch Hook", 2],
               ["Cable", 3], ["Bridge Span", 4], ["Support Strut", 5], ["Tread Link", 6],
               ["Tool", 1], ["Antenna", 1], ["Pin", 4]] },
];
const catOwned = (f) => f.variants ? f.variants.reduce((s, v) => s + v.owned, 0) : f.owned;

// ---- parts bin (qty) + compatibility (accessory → figures it fits) ----
const BIN0 = { "Backpack (common '82)": 3, "M-16 Rifle": 1, "AK Rifle": 2, "Ammo Box": 1, "Tripod": 2, "Helmet (pilot)": 1, "Skis": 1, "Pistol": 1 };
const FITS = {
  "Backpack (common '82)": ["STALKER", "COBRA CMDR", "SNOW JOB", "GRUNT", "FLASH", "BREAKER"],
  "M-16 Rifle": ["GRUNT", "BREAKER", "FLASH", "CLUTCH"],
  "Skis": ["SNOW JOB", "SNOW SERPENT"],
  "Ammo Box": ["ROADBLOCK"], "Tripod": ["ROADBLOCK"], "Backpack": ["ROADBLOCK"],
};
const binHas = (bin, fig, acc) => (bin[acc] || 0) > 0 && (FITS[acc] || []).includes(fig);

const STEPS = ["THIS COPY", "CONDITION"];

function Stepper({ step, goto, maxReached }) {
  return (
    <div className="af-steps">
      {STEPS.map((s, i) => (
        <button key={s} className={"af-step" + (i === step ? " is-on" : "") + (i < step ? " is-done" : "")}
                disabled={i > maxReached} onClick={() => i <= maxReached && goto(i)}>
          <span className="af-step__n">{i < step ? "✓" : i + 1}</span>{s}
        </button>
      ))}
    </div>
  );
}

function AddInstance() {
  const [srcId, setSrcId] = React.useState(104);
  const [step, setStep] = React.useState(0);
  const [maxReached, setMax] = React.useState(0);
  const [selVar, setSelVar] = React.useState(null);
  const [loc, setLoc] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [bin, setBin] = React.useState(BIN0);
  const [owned, setOwned] = React.useState({});         // accName -> units owned (0..qreq)
  const [pulled, setPulled] = React.useState({});       // accName -> units pulled from bin
  // condition — single zone-map value { gender, condition:{front,rear}, paint:{front,rear} }
  const [dmg, setDmg] = React.useState(() => dmEmpty('male'));
  const [done, setDone] = React.useState(false);

  const fig = OWNED.find(f => f.id === srcId);
  const isMulti = !!fig.variants;
  const chosen = isMulti ? fig.variants.find(v => v.letter === selVar) : null;
  const ownedVar = isMulti ? (chosen ? chosen.owned : 0) : fig.owned;
  const instNo = ownedVar + 1;
  const totalOwned = catOwned(fig);
  const varLabel = isMulti ? (chosen ? "v" + chosen.ver + " · " + chosen.letter : "") : null;
  const newVariant = isMulti && chosen && chosen.owned === 0;

  const blueprint = fig.blueprint;
  const unitsOf = (n) => owned[n] || 0;
  const lineDone = ([n, q]) => unitsOf(n) >= q;
  const fullDone = blueprint.filter(lineDone).length;
  const pulledCount = Object.values(pulled).reduce((a, b) => a + b, 0);

  React.useEffect(() => {
    setSelVar(null); setLoc(""); setNotes(""); setPulled({}); setOwned({}); setBin(BIN0);
    setDmg(dmEmpty(fig.body || 'male'));
    setStep(0); setMax(0); setDone(false);
  }, [srcId]);

  const goto = (i) => { setStep(i); setMax(m => Math.max(m, i)); };
  const next = () => goto(Math.min(step + 1, STEPS.length - 1));
  const back = () => goto(Math.max(step - 1, 0));

  // accessories — per-unit ownership (click box N to fill 1..N, click a filled box to unfill)
  const setUnit = (n, idx) => setOwned(o => {
    const cur = o[n] || 0;
    return { ...o, [n]: cur > idx ? idx : idx + 1 };
  });
  const pull = (n, qreq) => {
    if (!binHas(bin, fig.name, n) || unitsOf(n) >= qreq) return;
    setBin(b => ({ ...b, [n]: b[n] - 1 }));
    setOwned(o => ({ ...o, [n]: Math.min((o[n] || 0) + 1, qreq) }));
    setPulled(p => ({ ...p, [n]: (p[n] || 0) + 1 }));
  };

  const phys = physicalGrade(dmg);
  const paint = paintGrade(dmg);
  const marksCount = phys.zones + paint.zones;
  const ungraded = marksCount === 0;

  const canNext = !isMulti || selVar !== null;   // step 1 needs a variant pick (multi only)

  const resetAll = () => {
    setDone(false); setSelVar(null); setLoc(""); setNotes(""); setPulled({}); setOwned({}); setBin(BIN0);
    setDmg(dmEmpty(fig.body || 'male')); goto(0);
  };

  return (
    <div className="af">
      <header className="af-top">
        <a className="af-back" href="GI Joe Tracker - Inventory.html">‹ INVENTORY</a>
        <div className="af-title">ADD A COPY</div>
        <div className="af-demo">
          <span className="af-demo__lab">DEMO FROM</span>
          <select value={srcId} onChange={e => setSrcId(Number(e.target.value))}>
            <option value={104}>BREAKER · multi-variant</option>
            <option value={204}>SNOW JOB · single + Skis×2</option>
            <option value={304}>ROADBLOCK · single, 4 parts</option>
            <option value={404}>TOLLBOOTH · 12 parts, qty 1–6</option>
          </select>
        </div>
      </header>

      <div className="af-card">
        <Stepper step={step} goto={goto} maxReached={maxReached} />

        <div className="af-body">
          {!done && (
            <div className="af-fig">
              <span className="af-fig__thumb"></span>
              <div>
                <div className="af-fig__name">{fig.name} <span className={"wf-fac wf-fac--" + fig.faction.toLowerCase() + " wf-fac--mini"}>{fig.faction}</span></div>
                <div className="af-fig__var">{(isMulti ? fig.variants.length + " variants" : fig.role)} · {fig.year}</div>
                <div className="af-fig__inst">you already own <b>×{totalOwned}</b> · this logs another copy</div>
              </div>
            </div>
          )}

          {/* ============ STEP 1 — THIS COPY ============ */}
          {step === 0 && !done && (
            <div>
              {/* variant — ONLY for multi-variant figures */}
              {isMulti && (
                <div className="af-block">
                  <p className="af-seclab"><b>Which variant is this copy?</b> · match the physical tell</p>
                  <div className="af-varpick">
                    {fig.variants.map(v => (
                      <button key={v.letter} className={"af-var" + (selVar === v.letter ? " is-sel" : "")} onClick={() => setSelVar(v.letter)}>
                        <span className="af-var__radio"></span>
                        <span className="af-var__lab">v{v.ver} · {v.letter}</span>
                        <span className="af-var__tell">{v.tell}</span>
                        <span className="af-var__own">{v.owned === 0 ? "none yet" : "own ×" + v.owned}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* accessories — columned list, per-unit checkboxes */}
              <div className="af-block">
                <p className="af-seclab"><b>Accessories</b> · {fullDone}/{blueprint.length} complete · tick each unit you have, or pull from your Bin</p>
                <div className="af-acc">
                  {blueprint.map(([n, qreq]) => {
                    const u = unitsOf(n);
                    const isDone = u >= qreq;
                    const canPull = binHas(bin, fig.name, n) && !isDone;
                    return (
                      <div key={n} className={"af-acc__row" + (isDone ? " is-done" : "")}>
                        <div className="af-acc__left">
                          <span className="af-acc__n">{n}</span>
                          {canPull && <button className="af-acc__pull" onClick={() => pull(n, qreq)}>+bin {bin[n]}</button>}
                        </div>
                        <div className="af-acc__right">
                          <div className="af-acc__boxes">
                            {Array.from({ length: qreq }).map((_, i) => (
                              <button key={i} className={"af-unit" + (i < u ? " is-on" : "")}
                                      title={`unit ${i + 1} of ${qreq}`} onClick={() => setUnit(n, i)}>✓</button>
                            ))}
                          </div>
                          <span className={"af-acc__count" + (isDone ? " is-done" : "")}>{u}/{qreq}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* bin / box location — closes the step */}
              <div className="af-block af-block--last">
                <p className="af-seclab"><b>Bin / box location</b> · where this copy lives</p>
                <input className="af-in" value={loc} onChange={e => setLoc(e.target.value)} placeholder="box 1, box 2, small tote" />
              </div>
            </div>
          )}

          {/* ============ STEP 2 — CONDITION ============ */}
          {step === 1 && !done && (
            <div className="af-cond">
              <div className="af-cond__map">
                <DamageMap value={dmg} onChange={setDmg} genderLocked={true} />
              </div>
              <div className="af-cond__side">
                <section className="panel">
                  <div className="panel__hd">CONDITION <em>· {ungraded ? "ungraded" : "derived from " + marksCount + " mark" + (marksCount !== 1 ? "s" : "")}</em></div>
                  {ungraded ? (
                    <div className="panel__note">Tag the diagram to record this copy's condition — grades derive live. Or leave it <b>ungraded</b> and map it later on the copy's detail page.</div>
                  ) : (
                    <div className="grades">
                      <GradeBadge kind="PHYSICAL" result={phys} />
                      <GradeBadge kind="PAINT" result={paint} />
                    </div>
                  )}
                </section>

                <section className="panel">
                  <div className="panel__hd">NOTES <em>· this copy only</em></div>
                  <textarea className="af-notes" value={notes} onChange={e => setNotes(e.target.value)}
                            placeholder="damage notes — figure/accessory, damage…"></textarea>
                </section>

                <button className="af-add" onClick={() => setDone(true)}>＋ ADD COPY TO INVENTORY</button>
              </div>
            </div>
          )}

          {/* ============ SUCCESS ============ */}
          {done && (
            <div className="af-okwrap">
              <div className="af-ok">✓</div>
              <div className="af-ok__h">{fig.name}{isMulti ? " " + varLabel : ""} · copy #{instNo} added</div>
              <div className="af-ok__sub">
                {fullDone > 0 ? `${fullDone}/${blueprint.length} accessories complete` : "no accessories yet"}
                {pulledCount > 0 ? ` (${pulledCount} from bin)` : ""} ·{" "}
                {ungraded ? "condition still to map" : `${phys.grade} / ${paint.grade}`}
                {loc ? ` · ${loc}` : ""}
              </div>
              <div className="af-ok__btns">
                <a className="af-okbtn af-okbtn--go" href="GI Joe Tracker - Instance Detail.html">OPEN COPY DETAIL ›</a>
                <button className="af-okbtn" onClick={resetAll}>ADD ANOTHER COPY</button>
                <a className="af-okbtn" href="GI Joe Tracker - Inventory.html">BACK TO INVENTORY</a>
              </div>
            </div>
          )}
        </div>

        {!done && (
          <div className="af-foot">
            <button className="af-nav af-nav--ghost" onClick={back} disabled={step === 0}>‹ BACK</button>
            <span className="af-foot__mid">{fig.name} · step {step + 1} of {STEPS.length}</span>
            {step < STEPS.length - 1
              ? <button className="af-nav" onClick={next} disabled={!canNext}>NEXT ›</button>
              : <button className="af-nav" onClick={() => setDone(true)}>＋ ADD COPY</button>}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { AddInstance });
