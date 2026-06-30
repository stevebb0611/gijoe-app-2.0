# GiJoe Collection, Start — Claude Code handoff

Clean, **empty-start** edition of the current G.I. Joe collection app, ready to rebuild in a real
codebase. This is a verbatim copy of the canonical design handoff (`design_handoff_inventory/`)
with all demo/sample collection data removed. The **catalog** (the canonical list of real figures
and accessories you search against) is kept — that is reference data, not a fake collection.

> Read order: this file → `PORT_VERBATIM.md` → `HANDOFF_TO_CLAUDE_CODE.md` → `README.md` →
> `FRONTEND_STANDARDS.md`. **Do not redesign** the shipped screens — port them.

## Run it (static, no build)
Open any of these directly — plain HTML + React-via-Babel (CDN) + plain-JS data modules:
- `GI Joe Tracker - Collection App.html` — the working app (Figures inventory). Boots **empty**.
- `GI Joe Tracker - Parts Bin.html` — loose-accessory inventory. Boots **empty**.
- `GI Joe Tracker - Vehicles.html` — vehicles/playsets (In Dev).
- Screen references (show populated/representative UI states for the developer):
  `GI Joe Tracker - Add Figure.html`, `Add Instance.html`, `Add Missing Figure.html`,
  `Instance Detail.html`, `Inventory.html`, `Accessory Sub-Groups.html`, `Site Map.html`,
  `Variant Indicator Options.html`, `index.html` (launcher).

Owned inventory persists to `localStorage` under `gi_joe_collection_v1` via `store.js`.
There is no server yet — see `BACKEND_AND_SCALE.md` for the target.

## Architecture (script load order in Collection App.html)
`catalog-data.js` (window.JOE_CATALOG — 520-figure reference) → `store.js` (window.JoeStore,
empty-start owned inventory) → React/Babel → `tweaks-panel.jsx` → `assets/figure-masks.js` +
`assets/figure-zones.js` → `damage-map.jsx` → **`app-detail.jsx`** (builds INV_CAT/invTotals/fvm
and the detail modal) → `app-add-figure.jsx` (the 4-step Find→Details→Condition→Finalize overlay)
→ `app-inventory.jsx` (the InventoryView shell). `app-detail.jsx` must load
before `app-inventory.jsx` — the inventory destructures its exports.

## Add Figure flow (current behavior — port as-is)
- **Find** opens to just a **search box + Year dropdown** with a prompt; the figure list renders
  only after you type (code name / specialty) or pick a year. No default catalog scroll.
  Picking a year lists the **entire** year (no cap); a text search caps at 60. The list scrolls
  inside its own pane so **Back / Next stay pinned** at the modal foot.
- **Details** has a **Mint-on-Card** checkbox and a **File Card** checkbox (on-file + printing
  select) that mirrors the collection detail modal. No instructional helper copy.
- The **`+` on a figure's copy rail** opens the overlay as **“Add Copy”**, locked to that figure
  and starting at Details (Find is skipped) — it never reopens the whole catalog.
- Header close (`✕`) is aligned to the modal card edge.

## Real seed data (`seed/`) — load into the DB; NOT sample data
- `gijoe_db_figures_2.0.csv` (654 rows) · `gijoe_db_accessories.csv` · `gijoe_db_figures_accessories.csv` (the join)

## Design system (non-negotiable — `FRONTEND_STANDARDS.md` is law)
- Header = three zones: left brand + tabs (Figures · Vehicles "In Dev" dashed · Parts Bin),
  center search **grouped with** the olive `+ Add Figure`, right KPI boxes.
- Paper/ink: `--paper:#f3eee2`, `--ink:#211f1a`, olive `#5f6b39`, crimson `#a23a2c`.
- Oswald (display) + Space Mono (mono). Hard offset shadows, square corners. **Sentence case** headings.

## First decisions (from OPEN_QUESTIONS)
1. Grade weights (cracked 3 / damaged 6 / broken 10, broken→Fair cap; paint 1/3/6) — defaults, tune later.
2. Confirm `seed/gijoe_db_figures_accessories.csv` is the canonical figure↔accessory join.
3. Local v1: SQLite file (no Turso), no auth, single-variant first, placeholder photos.

## Changes from the canonical `design_handoff_inventory/` source
These edits are baked into this handoff (and back-ported to the source so a rebuild won't regress):
- Demo/sample collection data removed — boots empty (`store.js`); invented `JOE_ERAS` year
  nicknames emptied in `catalog-data.js` (see `DEMO_DATA_REMOVED.md`).
- Add Figure: search-or-year-gated Find (no default scroll), whole-year listing, File Card
  checkbox in Details, removed MOC definition / instructional copy / “Mark all complete”, the
  `+` opens a scoped “Add Copy”, and the close `✕` aligned to the modal.
