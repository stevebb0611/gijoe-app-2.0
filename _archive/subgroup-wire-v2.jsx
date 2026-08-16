// subgroup-wire-v2.jsx — REDESIGNED Option C ("Slot + variant pills").
//
// Feedback being addressed:
//   • A (version lock) hid the other shade as you toggled → dropped.
//   • B (ledger) ran too tall → dropped.
//   • C felt right but couldn't express QUANTITY. Now each slot carries a
//     required qty, and every colour pill shows that many tick boxes on one
//     line. Rock 'N Roll v4's Missile is ×2, so its row shows two ticks per
//     shade — a matched set isn't complete until BOTH missiles are the
//     shared colour.
//
// Completeness: all base singles owned + one version in which every matched
// slot's tick count >= its required qty. Counts come from the blueprint
// (catalog: Missile qty 2). Colours resolve from the CSV via window.colorFor.

const { useState } = React;

// ---- figure specs (qty now lives on each matched slot) ------------------
const FIREFLY = {
  code: "FIREFLY", full: '"Classified"', specialty: "Sabotage, Demolitions & Terror",
  faction: "COBRA", tag: "v1 · 1984",
  base: [{ name: "Demolition Backpack", color: "gray" }, { name: "Backpack Cover", color: "gray" }],
  slots: [{ name: "Submachine Gun", qty: 1 }, { name: "Walkie-Talkie", qty: 1 }],
  versions: [{ key: "a", color: "light green" }, { key: "b", color: "dull green" }],
};
const ROCK = {
  code: "ROCK 'N ROLL", full: "McConnel, Craig S.", specialty: "Cybernetic Heavy Weapons Spec.",
  faction: "JOE", tag: "v4 · 1993",
  base: [{ name: "Helmet", color: "silver/purple" }, { name: "Robotizer Cannon", color: "silver" }, { name: "Rifle", color: "purple" }],
  slots: [{ name: "Submachine Gun", qty: 1 }, { name: "Shotgun", qty: 1 }, { name: "Machete", qty: 1 }, { name: "Missile", qty: 2 }],
  versions: [{ key: "a", color: "yellow" }, { key: "b", color: "purple" }],
};

// ---- variant-group figures (flat accessory list, faithful to the join) --
// Faithful to the live DB: a figure owns a FLAT list of accessories, each
// with a real id, color and quantity_required. The ONLY grouping the data
// carries is `group_id` — and a group_id means "interchangeable variants:
// own ANY one and that slot is satisfied." So the boxed structure renders
// purely off group_id; everything ungrouped is just a plain row.
//   Scrap-Iron: only group_id 8401 (thin/thick Remote Activator) is a
//     variant group. The Missile System pieces are NOT a group — they're
//     individual accessories (a couple at qty 2), shown as plain rows.
//   A.V.A.C.: his whole kit is one group_id, 8601 (soft/hard parachute).
const SCRAP = {
  code: "SCRAP-IRON", alt: ["Scrap Iron"], full: "Classified", specialty: "Tank Destroyer · Anti-Armor",
  faction: "COBRA", tag: "v1 · 1984",
  acc: [
    { id: "A0105", name: "RAR Pistol", color: "black", qty: 1 },
    { id: "A0106", name: "Missile System Top", color: "black", qty: 1 },
    { id: "A0107", name: "Missile System Bottom", color: "black", qty: 1 },
    { id: "A0108", name: "Missile System Base", color: "black", qty: 1 },
    { id: "A0109", name: "Missile System Legs", color: "black", qty: 2 },
    { id: "A0110", name: "Missiles", color: "red", qty: 2 },
    { id: "A0111", name: "Remote Activator (thin handle)", color: "black", group_id: 8401 },
    { id: "A0112", name: "Remote Activator (thick handle)", color: "black", group_id: 8401 },
  ],
};
const AVAC = {
  code: "A.V.A.C.", full: "Air-Viper, Advanced Class", specialty: "Cobra Air Force · Pilot",
  faction: "COBRA", tag: "v1 · 1986",
  acc: [
    { id: "A0225", name: "Parachute pack (soft plastic)", color: "black", group_id: 8601 },
    { id: "A0226", name: "Parachute pack (hard plastic)", color: "black", group_id: 8601 },
  ],
};
// release_context demo (Figure 7 — the Cobra trooper). Only the retail
// accessory counts toward completion; the four convention pieces are tracked
// but sit OUTSIDE the formula, shown in their own context box. `ctx` mirrors
// the join's release_context column (retail | convention | bonus | mail-in |
// exclusive). No group_id on these — the two axes are independent.
const COBRA_TROOPER = {
  code: "COBRA", alt: ["Cobra Soldier", "Cobra Trooper"], full: "The Enemy", specialty: "Infantry · The Enemy",
  faction: "COBRA", tag: "v1 · 1982",
  acc: [
    { id: "A0004", name: "Dragunov (SVD) Sniper's Rifle", color: "black", qty: 1 },
    { id: "A0013", name: "M-16 Heavy Machine Gun", color: "black", ctx: "convention" },
    { id: "A0014", name: "Bipod", color: "black", ctx: "convention" },
    { id: "A0028", name: "Bazooka (single thin handle)", color: "light green", ctx: "convention" },
    { id: "A0029", name: "Bazooka (single thick handle)", color: "dark green", ctx: "convention" },
  ],
};

// ---- completeness math (count-based) ------------------------------------
function emptyOwn(fig) { return fig.slots.map(() => ({ a: 0, b: 0 })); }
function setStatus(fig, own) {
  const matched = fig.versions.find(v => fig.slots.every((sl, s) => own[s][v.key] >= sl.qty));
  if (matched) return { ok: true, ver: matched.key, msg: "Matched " + matched.color + " set" };
  const anyOwned = fig.slots.some((sl, s) => fig.versions.some(v => own[s][v.key] > 0));
  if (!anyOwned) return { ok: false, msg: "No set parts yet" };
  const satisfied = fig.slots.filter((sl, s) => fig.versions.some(v => own[s][v.key] >= sl.qty)).length;
  if (satisfied === fig.slots.length) return { ok: false, warn: true, msg: "Mismatch — versions don't all pair" };
  return { ok: false, msg: "Incomplete — " + satisfied + "/" + fig.slots.length + " slots" };
}
const verLabel = (c) => c.replace(/\b\w/g, m => m.toUpperCase());

// ---- identity header ----------------------------------------------------
function CardHead({ fig }) {
  return (
    <div className="sgw-head">
      <div className="sgw-head__l">
        <span className="sgw-head__top">
          <span className={"sgw-fac sgw-fac--" + fig.faction.toLowerCase()}>{fig.faction}</span>
          <span className="sgw-head__name">{fig.code}</span>
        </span>
        <span className="sgw-head__role">{fig.specialty}</span>
        {fig.alt && fig.alt.length > 0 && <span className="sgw-head__alt">A.K.A. {fig.alt.join(" · ")}</span>}
      </div>
      <span className="sgw-ver">{fig.full}<br />{fig.tag}</span>
    </div>
  );
}
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
  return <div className={"sgw-foot" + (complete ? " is-ok" : "")}>{complete ? "✓ Complete" : "Incomplete"}</div>;
}

// ---- one version column: just its N tick boxes. The colour name now lives
//      once in the header row, not repeated on every pill. -----------------
function VariantPill({ color, qty, count, onSet }) {
  const col = colorFor(color);
  // click the i-th box: if it's already filled, drop back to i; else fill up to i+1
  const click = (i) => onSet(count > i ? i : i + 1);
  return (
    <div className="vpill">
      {Array.from({ length: qty }).map((_, i) => {
        const on = count > i;
        return (
          <button key={i} type="button" className={"vtick" + (on ? " is-on" : "")}
                  title={verLabel(color) + " " + (i + 1) + "/" + qty}
                  style={on ? { background: col.css, borderColor: col.solid } : null}
                  onClick={() => click(i)}>{on ? "✓" : ""}</button>
        );
      })}
    </div>
  );
}

// =========================================================================
// OPTION C v2 — slot + variant pills, now quantity-aware.
// =========================================================================
function OptionPills2({ fig, seed }) {
  const [base, setBase] = useState(() => fig.base.map(() => true));
  const [own, setOwn] = useState(() => seed || emptyOwn(fig));
  const st = setStatus(fig, own);
  const complete = base.every(Boolean) && st.ok;
  const setCount = (s, k, n) => setOwn(o => o.map((x, j) => j === s ? { ...x, [k]: n } : x));
  return (
    <div className="sgw-card">
      <CardHead fig={fig} />
      <div className="sgw-list">
        {fig.base.map((b, i) => (
          <PlainRow key={i} name={b.name} color={b.color} on={base[i]}
                    onToggle={() => setBase(s => s.map((v, j) => j === i ? !v : v))} />
        ))}
        <div className="sgw-pillset">
          <div className="sgw-pillhead">
            <span className="sgw-pillhead__lbl">Accessory Variant</span>
            <div className="sgw-cols">
              {fig.versions.map(v => {
                const matched = st.ok && st.ver === v.key;
                return (
                  <span key={v.key} className={"sgw-colh" + (matched ? " is-matched" : "")}>
                    <AccSwatch color={v.color} size={11} />
                    {verLabel(v.color).split(" ")[0]}
                  </span>
                );
              })}
            </div>
          </div>
          {fig.slots.map((sl, i) => (
            <div key={i} className="sgw-pillrow2">
              <span className="sgw-pillrow2__name">
                {sl.name}
              </span>
              <div className="sgw-pills2">
                {fig.versions.map(v => (
                  <VariantPill key={v.key} color={v.color} qty={sl.qty}
                               count={own[i][v.key]} onSet={n => setCount(i, v.key, n)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Foot complete={complete} />
    </div>
  );
}

Object.assign(window, { FIREFLY, ROCK, OptionPills2 });

// ---- a standalone column of qty tick boxes (no colour variants) ---------
//      Right-justified to match the matched-set columns. Fill is green for
//      plain assemblies, or the swatch colour when a colour is supplied.
function QtyBoxes({ qty, count, onSet, fill }) {
  const click = (i) => onSet(count > i ? i : i + 1);
  const style = (on) => on ? (fill ? { background: fill.css, borderColor: fill.solid } : { background: "var(--ok)", borderColor: "var(--ok)" }) : null;
  return (
    <div className="sgw-pills2">
      <div className="vpill">
        {Array.from({ length: qty }).map((_, i) => {
          const on = count > i;
          return (
            <button key={i} type="button" className={"vtick" + (on ? " is-on" : "")}
                    style={style(on)} onClick={() => click(i)}>{on ? "✓" : ""}</button>
          );
        })}
      </div>
    </div>
  );
}

// ---- variant-group helpers ----------------------------------------------
// A group_id clusters interchangeable variants. The shared label is the name
// before the parenthetical; each option's label is the text inside it.
function groupLabel(items) {
  const m = items[0].name.match(/^(.*?)\s*\(/);
  return m ? m[1].trim() : items[0].name;
}
function optLabel(name) {
  const m = name.match(/\(([^)]+)\)/);
  return m ? m[1] : name;
}
// Cluster a flat accessory list into render blocks, preserving order:
// shared group_id -> one "variant" block; everything else -> a "single" row.
function clusterAcc(acc) {
  const blocks = [], at = {};
  acc.forEach(a => {
    if (a.group_id != null) {
      if (at[a.group_id] == null) { at[a.group_id] = blocks.length; blocks.push({ type: "variant", gid: a.group_id, items: [a] }); }
      else blocks[at[a.group_id]].items.push(a);
    } else blocks.push({ type: "single", item: a });
  });
  return blocks;
}

// =========================================================================
// VARIANT CARD — flat accessory list; group_id is the ONLY thing that boxes.
// Singles render as plain rows (qty-aware). A group_id renders as one
// "own any one" box. No prose annotations live in the card — those are
// handoff notes and sit beside the card on the canvas, not in product UI.
// =========================================================================
function GroupCard({ fig, seed }) {
  const [own, setOwn] = useState(() => seed || {});
  const get = (id) => own[id] || 0;
  const set = (id, n) => setOwn(o => ({ ...o, [id]: n }));

  // Retail accessories drive completion. Anything with a non-retail
  // release_context is tracked but EXCLUDED from the formula, and rendered
  // in its own context box (grouped by context, in first-seen order).
  const retail = fig.acc.filter(a => !a.ctx || a.ctx === "retail");
  const extras = fig.acc.filter(a => a.ctx && a.ctx !== "retail");
  const blocks = clusterAcc(retail);
  const ctxGroups = [], cAt = {};
  extras.forEach(a => {
    if (cAt[a.ctx] == null) { cAt[a.ctx] = ctxGroups.length; ctxGroups.push({ ctx: a.ctx, items: [a] }); }
    else ctxGroups[cAt[a.ctx]].items.push(a);
  });
  const ctxTitle = (c) => c.charAt(0).toUpperCase() + c.slice(1);

  const blockOk = (b) => b.type === "variant"
    ? b.items.some(it => get(it.id) >= 1)
    : get(b.item.id) >= (b.item.qty || 1);
  const complete = blocks.every(blockOk);

  const AccRow = (a) => {
    const q = a.qty || 1;
    return (
      <div className="sgw-row">
        <AccSwatch color={a.color} />
        <span className="sgw-row__name">{a.name}</span>
        {q === 1
          ? <button type="button" className={"sgw-box" + (get(a.id) >= 1 ? " is-on" : "")}
                    onClick={() => set(a.id, get(a.id) >= 1 ? 0 : 1)}>✓</button>
          : <QtyBoxes qty={q} count={get(a.id)} onSet={n => set(a.id, n)} />}
      </div>
    );
  };

  return (
    <div className="sgw-card">
      <CardHead fig={fig} />
      <div className="sgw-list">
        {blocks.map((b, bi) => {
          if (b.type === "single") {
            const a = b.item, q = a.qty || 1;
            if (q === 1) {
              return <PlainRow key={bi} name={a.name} color={a.color} on={get(a.id) >= 1}
                               onToggle={() => set(a.id, get(a.id) >= 1 ? 0 : 1)} />;
            }
            return (
              <div key={bi} className="sgw-row">
                <AccSwatch color={a.color} />
                <span className="sgw-row__name">{a.name}</span>
                <QtyBoxes qty={q} count={get(a.id)} onSet={n => set(a.id, n)} />
              </div>
            );
          }
          // variant block — driven entirely by the shared group_id
          return (
            <div key={bi} className="sgw-pillset">
              <div className="sgw-vhead">
                <span className="sgw-vhead__lbl">{groupLabel(b.items)}</span>
              </div>
              <div className="sgw-voptrow">
                {b.items.map((it, oi) => (
                  <React.Fragment key={it.id}>
                    {oi > 0 && <span className="sgw-or">or</span>}
                    <button type="button" className={"sgw-opt" + (get(it.id) ? " is-on" : "")}
                            onClick={() => set(it.id, get(it.id) ? 0 : 1)}>
                      <span className="sgw-opt__box">{get(it.id) ? "✓" : ""}</span>{optLabel(it.name)}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>
          );
        })}

        {ctxGroups.map((cg, ci) => (
          <div key={"ctx" + ci} className="sgw-pillset">
            <div className="sgw-vhead">
              <span className="sgw-vhead__lbl">{ctxTitle(cg.ctx)}</span>
            </div>
            {cg.items.map(a => <React.Fragment key={a.id}>{AccRow(a)}</React.Fragment>)}
          </div>
        ))}
      </div>
      <Foot complete={complete} />
    </div>
  );
}

Object.assign(window, { SCRAP, AVAC, COBRA_TROOPER, GroupCard });
