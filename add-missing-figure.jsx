// add-missing-figure.jsx — Add Figure ▸ "not in catalog" (OPEN_QUESTIONS #8 · VARIANTS §7.6)
// SINGLE PURPOSE (June 2026): append a REAL figure missing from the catalog — a genuine
// mail-away / convention / exclusive that figures_2.0 doesn't list yet. Creates a normal
// catalog row (real F-code, real blueprint, variants allowed); behaves like any catalog figure.
// The custom / homemade path and the two-path chooser were DROPPED — a kitbash has no
// "complete" state to chase, so it doesn't fit a completionist collection.
// This is a RARE action: the seed catalog is assumed essentially complete, and rows can equally
// be added by editing the reference DB directly — both write the same catalog table.
// Hands off to the SAME Details → Condition steps that add the owned copy.

const FACTIONS = [
  { id: "JOE",      label: "G.I. Joe",       color: "#5f6b39" },
  { id: "COBRA",    label: "Cobra",          color: "#a23a2c" },
  { id: "OKTOBER",  label: "Oktober Guard",  color: "oklch(0.5 0.085 245)" },
  { id: "DREADNOK", label: "Dreadnoks",      color: "oklch(0.55 0.108 58)" },
];
const facOf = (id) => FACTIONS.find(f => f.id === id) || null;

// ---- accessory blueprint editor ----
function BlueprintEditor({ rows, setRows }) {
  const setName = (i, v) => setRows(r => r.map((row, k) => k === i ? { ...row, name: v } : row));
  const bump = (i, d) => setRows(r => r.map((row, k) => k === i ? { ...row, qty: Math.max(1, row.qty + d) } : row));
  const del = (i) => setRows(r => r.filter((_, k) => k !== i));
  const add = () => setRows(r => [...r, { name: "", qty: 1 }]);
  return (
    <div className="afc-blue">
      {rows.length === 0 && <div className="afc-blue__empty">No accessories yet — add the parts a complete copy needs.</div>}
      {rows.map((row, i) => (
        <div className="afc-brow" key={i}>
          <input className="af-in" value={row.name} placeholder="e.g. Rifle, Backpack, Helmet…"
                 onChange={e => setName(i, e.target.value)} />
          <div className="afc-qty">
            <button onClick={() => bump(i, -1)} aria-label="less">–</button>
            <span>×{row.qty}</span>
            <button onClick={() => bump(i, +1)} aria-label="more">+</button>
          </div>
          <button className="afc-del" onClick={() => del(i)} aria-label="remove">✕</button>
        </div>
      ))}
      <button className="afc-add" onClick={add}>＋ ADD ACCESSORY</button>
    </div>
  );
}

function AddMissingFigure({ onClose }) {
  const [done, setDone] = React.useState(false);
  const [name, setName] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [faction, setFaction] = React.useState("JOE");
  const [year, setYear] = React.useState("");
  const [series, setSeries] = React.useState("");
  const [specialty, setSpecialty] = React.useState("");
  const [altNames, setAltNames] = React.useState("");
  const [code, setCode] = React.useState("F0701");      // auto-suggested next free slot in the 700-block
  const [codeAuto, setCodeAuto] = React.useState(true);
  const [variantCount, setVariantCount] = React.useState("1");
  const [blueprint, setBlueprint] = React.useState([{ name: "", qty: 1 }]);

  const esc = React.useCallback((e) => { if (e.key === "Escape") onClose && onClose(); }, [onClose]);
  React.useEffect(() => { window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [esc]);

  const YEARS = []; for (let y = 1982; y <= 1994; y++) YEARS.push(y);

  const reset = () => {
    setName(""); setFullName(""); setFaction("JOE"); setYear(""); setSeries(""); setSpecialty("");
    setAltNames(""); setCode("F0701"); setCodeAuto(true); setVariantCount("1");
    setBlueprint([{ name: "", qty: 1 }]); setDone(false);
  };

  const valid = name.trim() && faction && year;
  const stop = (e) => e.stopPropagation();

  const renderForm = () => (
    <div className="afc-form">
      <div className="afc-crumb"><button onClick={onClose}>‹ back to search</button></div>
      <div className="afc-banner">
        <span className="afc-banner__mk">ADMIN</span>
        <div>Adds a row to the shared <b>reference catalog</b> — for a real figure (mail-away, convention, exclusive) the database doesn't list yet. Reused for every copy added later, so get it right. <b>Rare:</b> the seed catalog is assumed complete; you can also add rows by editing the reference DB directly — both reach the same table.</div>
      </div>

      <div className="afc-grid">
        <div className="afc-field">
          <label className="afc-lab"><b>Code name</b> <span className="afc-req">*</span></label>
          <input className="af-in" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. STEEL BRIGADE" autoFocus />
        </div>
        <div className="afc-field">
          <label className="afc-lab">Full name <em>· if printed on the card</em></label>
          <input className="af-in" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. (mail-away trooper)" />
        </div>
        <div className="afc-field">
          <label className="afc-lab"><b>Faction</b> <span className="afc-req">*</span></label>
          <span className="afc-sel">
            <select value={faction} onChange={e => setFaction(e.target.value)}>
              {FACTIONS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </span>
        </div>
        <div className="afc-field">
          <label className="afc-lab"><b>Year</b> <span className="afc-req">*</span></label>
          <span className="afc-sel">
            <select value={year} onChange={e => setYear(e.target.value)}>
              <option value="">Year…</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </span>
        </div>
        <div className="afc-field">
          <label className="afc-lab">Specialty / role</label>
          <input className="af-in" value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="e.g. Infantry" />
        </div>
        <div className="afc-field">
          <label className="afc-lab">Series <em>· wave</em></label>
          <input className="af-in" value={series} onChange={e => setSeries(e.target.value)} placeholder="e.g. Mail-in" />
        </div>
        <div className="afc-field afc-field--wide">
          <label className="afc-lab">Alternate spellings <em>· comma-separated, powers fuzzy search</em></label>
          <input className="af-in" value={altNames} onChange={e => setAltNames(e.target.value)} placeholder="e.g. Steel-Brigade, Steel Brigade Trooper" />
        </div>
      </div>

      <div className="afc-section">
        <div className="afc-grid">
          <div className="afc-field">
            <label className="afc-lab"><b>Catalog ID</b> <em>· allocated by hand</em></label>
            <div className="afc-id">
              <input className="afc-id__code" value={code}
                     onChange={e => { setCode(e.target.value.toUpperCase()); setCodeAuto(false); }} />
              {codeAuto && <span className="afc-id__auto">AUTO · 700-BLOCK</span>}
            </div>
            <span className="afc-hint">IDs are <b>stable keys with deliberate gaps</b>, not a sequence. The <b>700-block</b> is the mail-in / convention / exclusive zone — suggested next free slot shown. Override into a gap if it belongs elsewhere.</span>
          </div>
          <div className="afc-field">
            <label className="afc-lab">Known production variants</label>
            <span className="afc-sel">
              <select value={variantCount} onChange={e => setVariantCount(e.target.value)}>
                <option value="1">1 · single variant</option>
                <option value="2">2 variants</option>
                <option value="3">3 variants</option>
                <option value="4">4+ variants</option>
              </select>
            </span>
            <span className="afc-hint">Empty lettered slots are created; you fill in each variant's physical "tell" later on the figure's page.</span>
          </div>
        </div>
      </div>

      <div className="afc-section">
        <p className="af-seclab"><b>Accessory blueprint</b> · the parts a complete copy needs — drives completeness for every copy</p>
        <BlueprintEditor rows={blueprint} setRows={setBlueprint} />
      </div>

      {name.trim() && (
        <div className="afc-prev">
          <span className="afc-prev__thumb"></span>
          <div>
            <span className="afc-prev__lab">HOW IT WILL READ IN THE CATALOG</span>
            <div className="afc-prev__name">{name.toUpperCase()}
              <span className="afc-tag" style={{ background: facOf(faction).color, color: "#fff" }}>{facOf(faction).label}</span></div>
            <div className="afc-prev__meta">{code} · {specialty || "—"}{year ? " · " + year : ""} · {(+variantCount) > 1 ? variantCount + " variants" : "single variant"} · {blueprint.filter(b => b.name.trim()).length} accessories</div>
          </div>
        </div>
      )}
    </div>
  );

  const renderDone = () => (
    <div className="afc-okwrap">
      <div className="afc-ok">✓</div>
      <div className="afc-ok__h">{name.toUpperCase()} added to catalog</div>
      <div className="afc-ok__sub">Catalog entry <b>{code}</b> created. Now add your copy of it — continue to <b>Details → Condition</b>. From now on it shows up in search like any other figure.</div>
      <div className="afc-ok__btns">
        <a className="af-okbtn af-okbtn--go" href="GI Joe Tracker - Add Figure.html">CONTINUE TO DETAILS ›</a>
        <button className="af-okbtn" onClick={reset}>ADD ANOTHER</button>
        <button className="af-okbtn" onClick={onClose}>CLOSE</button>
      </div>
    </div>
  );

  return (
    <div className="af-scrim" onClick={onClose}>
      <div className="af-modal" onClick={stop} role="dialog" aria-modal="true" aria-label="Add a figure missing from the catalog">
        <header className="af-mtop">
          <span className="af-mtitle">{done ? "DONE" : "ADD A MISSING FIGURE"}</span>
          <button className="af-mx" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="af-body">
          {done ? renderDone() : renderForm()}
        </div>

        {!done && (
          <div className="af-foot">
            <button className="af-nav af-nav--ghost" onClick={onClose}>‹ BACK</button>
            <span className="af-foot__mid">{valid ? `${name.toUpperCase()} · ${code} · ready to append` : "code name, faction & year required"}</span>
            <button className="af-nav af-nav--add" disabled={!valid} onClick={() => setDone(true)}>＋ APPEND &amp; CONTINUE</button>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { AddMissingFigure });
