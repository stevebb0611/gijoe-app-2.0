# CLAUDE.md — G.I. Joe Tracker handoff

> ⚠️ **PORT, DON'T REDESIGN.** Read `PORT_VERBATIM.md` FIRST. The owner wants the EXACT
> look/feel/behavior of the prototype — a mechanical port, not a recreation. Where this
> file or `FRONTEND_STANDARDS.md` say "recreate / rebuild / clean component tree,"
> `PORT_VERBATIM.md` overrides them.

You are working inside a **design handoff bundle**, not a production codebase. Read this first, then `README.md`, then `OPEN_QUESTIONS.md`.

## What this bundle is

A personal **inventory + condition tracker** for a large vintage G.I. Joe collection (target **700–800 figures**). It contains two layers:

- **A WORKING APP** (`GI Joe Tracker - Collection App.html`) — starts empty, searches the real catalog parsed from the CSVs, and saves owned copies to `localStorage`. This is the test-drivable product, not a mockup.
- **6 static reference mockups** + **9 JSX/JS modules** — the original visual prototypes (fixed sample data).
- **10 markdown specs** — the source of truth for design, data model, and decisions.

### The working app (start here to run it)
- `GI Joe Tracker - Collection App.html` — shell (combined CSS, mounts the app, Tweaks panel with Export/Import/Clear).
- `catalog-data.js` — GENERATED reference catalog (`window.JOE_CATALOG`, 520 entries grouped by code name + version, with variants and accessory blueprints joined from the accessories CSVs). Never mutated.
- `store.js` — `window.JoeStore` (localStorage-backed owned inventory + pub/sub) and `window.JoeData` (completeness math). Storage key: `gi_joe_collection_v1`.
- `app-inventory.jsx` — live inventory view (empty state, year groups, detail modal, accessory toggles, remove).
- `app-add-figure.jsx` — Add Figure flow (FIND → DETAILS → CONDITION → FINALIZE) writing real instances to the store.
- `damage-map.jsx` — shared condition diagram + grade engine (reused by the add flow).

## Your job

**Port these prototypes into a real build with the smallest possible diff — do NOT redesign.** See `PORT_VERBATIM.md` for the exact rule and steps. The prototype is already real React + CSS; move it verbatim, changing only how it compiles (Vite/Next instead of browser-Babel) and how modules share code (`import`/`export` instead of `window`). If no project exists yet, scaffold a **React + TypeScript** Vite SPA (or Next.js) and port into it.

- Treat the **HTML/JSX as the source of truth for visual design and behavior.**
- Treat **`FRONTEND_STANDARDS.md` as the source of truth for how to build it properly.**
- Treat **`OPEN_QUESTIONS.md` as a blocker list** — several modeling decisions (notably the per-instance data model) must be resolved before or early in implementation. Surface these to the user rather than guessing.

## Fidelity

**High-fidelity.** Colors, typography, spacing, borders, and interactions are final-intent — match them faithfully. The aesthetic is a deliberate **vintage field-manual / cardback** look (paper & ink, hard edges, offset shadows, zero border-radius, Oswald + Space Mono). It is not a generic admin table. See "Design Language" and "Design Tokens" in `README.md`.

Production swaps to make: replace unicode-glyph icons (`▸ ▾ ✕ ⚖ ＋ ✓` …) with a real icon set (Lucide/Feather), self-host or pipeline the fonts, and replace the in-browser Babel with a real build.

## Running the prototypes locally

The JSX is fetched and compiled at runtime, so the screens **must be served over http://localhost** — opening files directly (`file://`) leaves them blank.

```
npx serve .          # then open the printed URL (e.g. http://localhost:3000)
# or: npm start
# or: python3 -m http.server 3000
```

`index.html` is the landing page — it links every screen and every spec doc. Keep an internet connection for the first load (CDN React/Babel/fonts).

## Map of the bundle

| File | What it is |
|---|---|
| `index.html` | Landing page — run instructions + links to all screens & docs |
| `GI Joe Tracker - Inventory.html` + `inventory-app.jsx` | **Home screen — design of record.** Year-grouped collection, search/filter, List/Gallery, instance accordions, detail modal |
| `GI Joe Tracker - Instance Detail.html` + `instance-detail.jsx` | Single-copy detail: damage map, derived grade, accessory checklist, variant identity |
| `GI Joe Tracker - Add Figure.html` + `add-figure.jsx` | 3-step intake (Find → Details → Condition) + production-variant picker (required for multi-variant figures) + Parts-Bin pull |
| `GI Joe Tracker - Add Instance.html` + `add-instance.jsx` | Add another copy of an owned figure |
| `GI Joe Tracker - Parts Bin.html` + `parts-bin.jsx` | Loose-accessory inventory, compatibility/reverse-lookup, ⚖ rebalance |
| `GI Joe Tracker - Inventory (Scale States).html` | Self-contained scale/density stress test (no JSX deps) |
| `damage-map.jsx` | Shared damage-map condition component |
| `wf-data.jsx` | Sample catalog + completeness math (`figParts`, `figState`, `yearParts`, `totals`) |
| `parts-catalog.js` | 798-entry accessory catalog driving the Parts Bin |
| `tweaks-panel.jsx` | Theme panel (paper/accent/faction/wobble) — informs a real theme config, not shipped as-is |

### Specs
`README.md` (start here) · `OPEN_QUESTIONS.md` (decisions — read second) · `FRONTEND_STANDARDS.md` · `INSTANCE_MODEL.md` · `VARIANTS.md` · `PARTS_BIN.md` · `TAXONOMY.md` · `NAVIGATION.md` · `BACKEND_AND_SCALE.md`.

## Known prototype shortcuts to NOT carry over

- **Per-instance data is synthesized** in `wf-data.jsx` (`figState()`) — the sample stores only aggregate accessory counts and derives a plausible per-copy allocation. A real **Instance** entity must replace this (`OPEN_QUESTIONS.md` #1/#5).
- **Add Figure runs on superseded, name-keyed sample data** (`OPEN_QUESTIONS.md` #8).
- **All figure images are hatched placeholders** — real photography is a TODO (source + storage).
- Brand name is **"G.I. Joe Collection"** (decided June 2026; replaced the "Joe Dossier" placeholder) with a vintage-ARAH-file-card outline mark — live across every current surface (Figures, Vehicles, Parts Bin, and the Scale States reference). The old "Joe Dossier" working app and the name-exploration sheet are in `_archive/`. The name uses the Hasbro mark by choice (fine for private use; revisit before any public release — see OPEN_QUESTIONS #10).
