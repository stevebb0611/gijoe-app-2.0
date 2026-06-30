// subgroup-wire.jsx — wireframe explorations for "matched-set" accessory
// sub_groups inside a figure card. Figure-driven, so the SAME components
// render different figures with their real CSV colours (via colorFor).
//
//   FIREFLY v1 (1984, Cobra)
//     Demolition Backpack / Backpack Cover ... gray (singles)
//     Submachine Gun  ┐  light green | dull green   matched set:
//     Walkie-Talkie   ┘  pick ONE version, both must match
//
//   ROCK 'N ROLL v4 (1993, Joe) — same structure, different palette
//     Helmet (silver/purple) / Robotizer Cannon (silver) / Rifle (purple)
//     Submachine Gun / Shotgun / Machete / Missile  ┐ yellow | purple
//                                                    ┘ matched set
//
// Completeness rule: all base singles + every matched-set slot filled in ONE
// shared version. Mixing versions (e.g. yellow gun + purple machete) does NOT
// tally complete. Colours come from the CSV via window.colorFor.

const { useState } = React;

// ---- figure specs (identity + accessory shape, pulled from the CSVs) ----
const FIREFLY = {
  code: "FIREFLY", full: '"Classified"', specialty: "Sabotage, Demolitions & Terror",
  faction: "COBRA", tag: "v1 · 1984",
  base: [{ name: "Demolition Backpack", color: "gray" }, { name: "Backpack Cover", color: "gray" }],
  slots: ["Submachine Gun", "Walkie-Talkie"],
  versions: [{ key: "a", color: "light green" }, { key: "b", color: "dull green" }],
};
const ROCK = {
  code: "ROCK 'N ROLL", full: "McConnel, Craig S.", specialty: "Cybernetic Heavy Weapons Spec.",
  faction: "JOE", tag: "v4 · 1993",
  base: [{ name: "Helmet", color: "silver/purple" }, { name: "Robotizer Cannon", color: "silver" }, { name: "Rifle", color: "purple" }],
  slots: ["Submachine Gun", "Shotgun", "Machete", "Missile"],
  versions: [{ key: "a", color: "yellow" }, { key: "b", color: "purple" }],
};

// ---- shared completeness math -------------------------------------------
function emptyOwn(fig) { return fig.slots.map(() => ({ a: false, b: false })); }
function matchedVer(fig, own) {
  const v = fig.versions.find(v => fig.slots.every((_, s) => own[s][v.key]));
  return v ? v.key : null;
}
function setStatus(fig, own) {
  const m = matchedVer(fig, own);
  if (m) return { ok: true, ver: m, msg: "Matched " + fig.versions.find(v => v.key === m).color + " set" };
  const filled = fig.slots.filter((_, s) => own[s].a || own[s].b).length;
  if (filled === 0) return { ok: false, msg: "No set parts yet" };
  if (filled === fig.slots.length) return { ok: false, warn: true, msg: "Mismatch — versions don't all pair" };
  return { ok: false, msg: "Incomplete — " + filled + "/" + fig.slots.length + " slots" };
}
const verLabel = (c) => c.replace(/\b\w/g, m => m.toUpperCase());

// ---- identity header (blueprint vocabulary) -----------------------------
function CardHead({ fig }) {
  return (
    <div className="sgw-head">
      <div className="sgw-head__l">
        <span className="sgw-head__top">
          <span className={"sgw-fac sgw-fac--" + fig.faction.toLowerCase()}>{fig.faction}</span>
          <span className="sgw-head__name">{fig.code}</span>
        </span>
        <span className="sgw-head__role">{fig.specialty}</span>
      </div>
      <span className="sgw-ver">{fig.full}<br />{fig.tag}</span>
    </div>
  );
}

// a plain single-unit accessory row (colour from CSV string)
function PlainRow({ name, color, on, onToggle }) {
  return (
    <div className={"sgw-row" + (on ? " is-on" : "")}>
      <AccSwatch color={color} />
      <span className="sgw-row__name">{name}</span>
      <button type="button" className={"sgw-box" + (on ? " is-on" : "")} onClick={onToggle}>✓</button>
    </div>
  );
}

function Foot({ complete }) {
  return <div className={"sgw-foot" + (complete ? " is-ok" : "")}>{complete ? "✓ COMPLETE" : "INCOMPLETE"}</div>;
}

// =========================================================================
// OPTION A — VERSION LOCK : commit the card to one shade; tick the slots.
// =========================================================================
function OptionVersionLock({ fig, seed }) {
  const [base, setBase] = useState(() => fig.base.map((_, i) => i === 0));
  const [ver, setVer] = useState("a");
  const [own, setOwn] = useState(() => seed || emptyOwn(fig));
  const baseOk = base.every(Boolean);
  const complete = baseOk && fig.slots.every((_, s) => own[s][ver]);
  const tint = colorFor(fig.versions.find(v => v.key === ver).color).solid;
  return (
    <div className="sgw-card">
      <CardHead fig={fig} />
      <div className="sgw-list">
        {fig.base.map((b, i) => (
          <PlainRow key={i} name={b.name} color={b.color} on={base[i]}
                    onToggle={() => setBase(s => s.map((v, j) => j === i ? !v : v))} />
        ))}
        <div className="sgw-set">
          <div className="sgw-set__cap">
            <span>MATCHED SET · LOCK 1 VERSION</span>
            <div className="sgw-seg">
              {fig.versions.map(v => (
                <button key={v.key} type="button" className={"sgw-seg__b" + (ver === v.key ? " is-on" : "")} onClick={() => setVer(v.key)}>
                  <span className="sgw-seg__dot" style={{ background: colorFor(v.color).css }}></span>{verLabel(v.color)}
                </button>
              ))}
            </div>
          </div>
          {fig.slots.map((s, i) => (
            <div key={i} className={"sgw-row" + (own[i][ver] ? " is-on" : "")}>
              <span className="acc-sw" style={{ width: 11, height: 11, borderRadius: 2, background: tint, border: "1px solid rgba(0,0,0,.32)", display: "inline-block" }}></span>
              <span className="sgw-row__name">{s}</span>
              <button type="button" className={"sgw-box" + (own[i][ver] ? " is-on" : "")}
                      onClick={() => setOwn(o => o.map((x, j) => j === i ? { ...x, [ver]: !x[ver] } : x))}>✓</button>
            </div>
          ))}
        </div>
      </div>
      <Foot complete={complete} />
    </div>
  );
}

// =========================================================================
// OPTION B — OWNERSHIP LEDGER : log every variant; detect best matched set.
// =========================================================================
function OptionLedger({ fig, seed }) {
  const [base, setBase] = useState(() => fig.base.map(() => true));
  const [own, setOwn] = useState(() => seed || emptyOwn(fig));
  const st = setStatus(fig, own);
  const complete = base.every(Boolean) && st.ok;
  const tog = (s, k) => setOwn(o => o.map((x, j) => j === s ? { ...x, [k]: !x[k] } : x));
  return (
    <div className="sgw-card">
      <CardHead fig={fig} />
      <div className="sgw-list">
        {fig.base.map((b, i) => (
          <PlainRow key={i} name={b.name} color={b.color} on={base[i]}
                    onToggle={() => setBase(s => s.map((v, j) => j === i ? !v : v))} />
        ))}
        <div className="sgw-bracket">
          <div className="sgw-bracket__cap">1 MATCHED SET REQUIRED — log what you own</div>
          {fig.slots.map((s, i) => (
            <div key={i}>
              <div className="sgw-slotlbl">{s}</div>
              {fig.versions.map(v => (
                <div key={v.key} className={"sgw-vrow" + (own[i][v.key] ? " is-on" : "")}>
                  <AccSwatch color={v.color} />
                  <span className="sgw-row__name">{verLabel(v.color)}</span>
                  <button type="button" className={"sgw-box" + (own[i][v.key] ? " is-on" : "")} onClick={() => tog(i, v.key)}>✓</button>
                </div>
              ))}
            </div>
          ))}
          <div className={"sgw-setstat" + (st.ok ? " is-ok" : st.warn ? " is-warn" : "")}>
            <span className="sgw-setstat__ic">{st.ok ? "✓" : st.warn ? "⚠" : "○"}</span>{st.msg}
          </div>
        </div>
      </div>
      <Foot complete={complete} />
    </div>
  );
}

// =========================================================================
// OPTION C — SLOT + VARIANT PILLS : one row per slot, colour pills mark held.
// =========================================================================
function OptionPills({ fig, seed }) {
  const [base, setBase] = useState(() => fig.base.map(() => true));
  const [own, setOwn] = useState(() => seed || emptyOwn(fig));
  const st = setStatus(fig, own);
  const complete = base.every(Boolean) && st.ok;
  const tog = (s, k) => setOwn(o => o.map((x, j) => j === s ? { ...x, [k]: !x[k] } : x));
  return (
    <div className="sgw-card">
      <CardHead fig={fig} />
      <div className="sgw-list">
        {fig.base.map((b, i) => (
          <PlainRow key={i} name={b.name} color={b.color} on={base[i]}
                    onToggle={() => setBase(s => s.map((v, j) => j === i ? !v : v))} />
        ))}
        <div className="sgw-pillset">
          <div className="sgw-pillset__cap">
            <span>MATCHED SET</span>
            <span className={"sgw-tag" + (st.ok ? " is-ok" : st.warn ? " is-warn" : "")}>
              {st.ok ? "✓ " + verLabel(fig.versions.find(v => v.key === st.ver).color) : st.warn ? "⚠ mismatch" : "—"}
            </span>
          </div>
          {fig.slots.map((s, i) => (
            <div key={i} className="sgw-pillrow">
              <span className="sgw-pillrow__name">{s}</span>
              <div className="sgw-pills">
                {fig.versions.map(v => {
                  const on = own[i][v.key], col = colorFor(v.color);
                  return (
                    <button key={v.key} type="button" className={"sgw-pill" + (on ? " is-on" : "")}
                            title={verLabel(v.color)} onClick={() => tog(i, v.key)}
                            style={on ? { background: col.css, borderColor: col.solid, color: "#fff" } : null}>
                      <span className="sgw-pill__dot" style={{ background: col.css }}></span>{verLabel(v.color).split(" ")[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Foot complete={complete} />
    </div>
  );
}

Object.assign(window, { FIREFLY, ROCK, OptionVersionLock, OptionLedger, OptionPills });
