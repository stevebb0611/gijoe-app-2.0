# Handoff → Claude Code (start here in VS Code)

Quick checklist for moving this design bundle into a real build. Read order:
**CLAUDE.md → README.md → BACKEND_AND_SCALE.md → PARTS_BIN.md → OPEN_QUESTIONS_Claude.md.**

## Updates since last handoff (June 2026)
- **File card = notation, NOT completeness (revisited & locked).** A copy's completeness is **figure + accessories only**. Whether the **file card** (cardback) is on file is tracked per copy and shown as a **notation badge** — it is never folded into the `%` / `whole` / `missing` math. A sealed **MOC** copy reads as on-file (the card rides on the backer). We briefly prototyped making the card count toward completeness, then reverted to notation.
- **New "+ File card" badge** in the Inventory (`app-inventory.jsx`): appears on single-copy rows, on each copy row inside a multi-figure accordion, and as a **"+ N File cards"** roll-up on multi-figure rows. Olive `#5f6b39`, Space Mono, **sentence case** (per `FRONTEND_STANDARDS.md` — no all-caps). Driven by a `cardOnFile` field (`= moc || filecard.onFile`) now exposed from `figureSummary` in `store.js`.
- **Data model:** instance shape carries `filecard: { onFile, printing }` (`store.js` header). The detail modal's file-card box (`app-detail.jsx`) toggles `onFile` and picks the printing (A/B/C), labeled "noted on this copy · not required for complete."
- **Live-wired reference is the Collection App stack.** `GI Joe Tracker - Collection App.html` + `store.js` + `app-inventory.jsx` / `app-detail.jsx` / `app-add-figure.jsx` is the current store-wired build (ticks/grades/MOC/notes/file-card/rebalance all persist). The older single-file `inventory-app.jsx` / `Inventory.html` is the earlier static-sample version of the same screen.
- **Pending data:** a real `filecard_lookup` (printings per figure) — the prototype hard-codes a stand-in `FILECARDS` list.

## What this bundle is (and isn't)
- These HTML/React-via-Babel files are **design references** — look + behavior, not production code. Rebuild the UI properly per `FRONTEND_STANDARDS.md`.
- There is **no real database yet.** The schema is *designed* in `BACKEND_AND_SCALE.md` but not implemented. The prototypes run on **generated stand-in data**, not the real CSVs.
- No live sync with the design tool — this local copy is now the source of truth.

## First job: scaffold, don't "adjust"
1. Stand up the app from the schema in `BACKEND_AND_SCALE.md` (Next.js + cloud DB — Turso/libSQL assumed; confirm).
2. Rebuild the screens from the HTML refs (`GI Joe Tracker - Inventory.html` + `inventory-app.jsx` is the primary one).

## Clean slate — empty ONE kind of data, not both
- **Catalog / reference tables (figures, accessories, the join): SEED these.** This is the master list of everything that ever existed — the yardstick completeness measures against. Do **not** leave it empty or "gaps" and "missing N parts" become meaningless.
- **Ownership tables (`owned_figures`, `owned_accessories`, notes, bin contents): EMPTY on deploy.** The collection starts clean and grows one figure at a time via Add Figure. (Decision: `OPEN_QUESTIONS_Claude.md #3`.)

## Data you must supply (not in this bundle)
The real seed source files — the prototype only has generated stand-ins (`wf-data.jsx`, `add-figure-catalog.js`, `catalog-data.js`, sample bins):
- `gijoe_db_figures_2.0.csv` — canonical figures (~654 rows).
- `gijoe_db_accessories.csv` — accessories (~803 rows).
- **`figures_accessories` join — PENDING EXPORT.** The figure×accessory×qty_required table. This is the source of truth for blueprints/completeness — the build is blocked on it. See `PARTS_BIN.md`.

## Known prototype shortcuts to replace
- Browser-Babel + `Object.assign(window, …)` module pattern → real build tooling/imports.
- Unicode-glyph icons → a real icon set.
- In-session React state for edits/notes (Inventory modal) → real persistence.
- Synthesized `figState` per-instance allocation → a real per-instance Instance entity (`OPEN_QUESTIONS_Claude.md #1/#13`).

## Suggested opening prompt
> Read CLAUDE.md, README.md, then BACKEND_AND_SCALE.md and PARTS_BIN.md. Scaffold the real app from the schema in BACKEND_AND_SCALE.md (Next.js + the cloud DB noted there). Seed the **catalog** tables from the reference CSVs, but leave all **ownership** tables empty — the collection starts clean and grows via Add Figure. The HTML files are visual/behavior references only; rebuild the UI per FRONTEND_STANDARDS.md.
