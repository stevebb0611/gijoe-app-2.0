# CLAUDE.md — G.I. Joe Tracker handoff

> ⚠️ **PORT, DON'T REDESIGN.** Read `PORT_VERBATIM.md` FIRST. The owner wants the EXACT
> look/feel/behavior of the prototype — a mechanical port, not a recreation. Where this
> file or `FRONTEND_STANDARDS.md` say "recreate / rebuild / clean component tree,"
> `PORT_VERBATIM.md` overrides them.

> ✅ **STATUS UPDATE (July 2026): the port already happened.** Everything below this line
> describes the original design-handoff bundle and the porting job as a task still to do.
> That job (`OPEN_QUESTIONS_Claude.md` #17a/#17b) is **done** — there is now a real,
> running app: a Vite build in **`web/`** (`web/src/*.jsx`, built to `web/dist`) served by a
> local **Express + `better-sqlite3`** server (**`server/`**), reading/writing the live
> `gijoe_collection.db`. **Run it with `npm start`**, not `npx serve .` — that serves the
> real built app + `/api/*` routes at `http://localhost:3000`; the raw HTML/JSX files below
> remain reachable only as reference mockups the server also serves statically. Dozens of
> real features (variants, damage tracking, Parts Bin, file cards, country-of-origin, the
> rebalance engine, accessory groups) have shipped into `web/`/`server/` since the port —
> see the git log and `OPEN_QUESTIONS_ISSUES_FOUND.md` for what's actually built. Treat this
> file's framing ("design handoff, not production," "your job: port it") as historical
> context for the prototype files, not as the current task — **the current task is
> extending the live app in `web/`/`server/`, following the design rules below.**

You are working inside a **design handoff bundle**, not a production codebase. Read this first, then `README.md`, then `OPEN_QUESTIONS_Claude.md`.

## What this bundle is

A personal **inventory + condition tracker** for a large vintage G.I. Joe collection (target **700–800 figures**). It contains two layers:

- **The live app** (`web/` + `server/`, see below) — the real, ported, database-backed build; run it with `npm start`.
- **A WORKING APP prototype** (`GI Joe Tracker - Collection App.html`) — the pre-port reference: starts empty, searches the real catalog parsed from the CSVs, and saved owned copies to `localStorage`. Superseded by the live app for anything but visual/behavioral reference.
- **Static reference mockups** + **JSX/JS modules** — the original visual prototypes (fixed sample data).
- **Markdown specs** — the source of truth for design, data model, and decisions (see the Specs list below — now includes `FILE_CARDS.md`).

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
- Treat **`OPEN_QUESTIONS_Claude.md` as a blocker list** — several modeling decisions (notably the per-instance data model) must be resolved before or early in implementation. Surface these to the user rather than guessing.

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

**The live app** (query this, not the prototype, when checking current behavior):

| Path | What it is |
|---|---|
| `server/index.js` | Express entry point — serves `web/dist` + the `/api/*` routes, falls back to the raw repo root for reference mockups |
| `server/catalog.js`, `server/accessories.js`, `server/instances.js`, `server/export-xlsx.js` | API handlers reading/writing `gijoe_collection.db` (`better-sqlite3`) |
| `gijoe_collection.db` + `gijoe_collection.sql` (schema) + `migrations/*.sql` | The live database and its schema/migration history — the actual source of truth, not the CSVs |
| `web/src/main.jsx` | Vite app root — mounts `InventoryView` / `PartsBin` + the Tweaks panel |
| `web/src/app-inventory.jsx`, `app-detail.jsx`, `app-add-figure.jsx`, `parts-bin.jsx`, `damage-map.jsx`, `store.js`, `accessory-groups.jsx`, `fig-identity.js`/`.jsx`, `filecards.jsx` | The ported + since-extended real components — these, not the root `.jsx` files, are what's running |

**The original prototype** (visual/behavioral reference only — see `PORT_VERBATIM.md`):

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
`README.md` (start here) · `OPEN_QUESTIONS_Claude.md` + `OPEN_QUESTIONS_ISSUES_FOUND.md` (decisions/issues — read second) · `FRONTEND_STANDARDS.md` · `INSTANCE_MODEL.md` · `VARIANTS.md` · `PARTS_BIN.md` · `ACCESSORY_GROUPS.md` · `FIGURE_SPLITS.md` · `FILE_CARDS.md` · `MASTER_COLLECTION.md` · `TAXONOMY.md` · `MAIL_RELEASES.md` · `FIGURE_SETS.md` · `NAVIGATION.md` · `BACKEND_AND_SCALE.md`.

## Known prototype shortcuts to NOT carry over

- **Per-instance data is synthesized** in `wf-data.jsx` (`figState()`) — the sample stores only aggregate accessory counts and derives a plausible per-copy allocation. A real **Instance** entity must replace this (`OPEN_QUESTIONS_Claude.md` #1/#5).
- **Add Figure runs on superseded, name-keyed sample data** (`OPEN_QUESTIONS_Claude.md` #8).
- **All figure images are hatched placeholders** — real photography is a TODO (source + storage).
- Brand name is **"G.I. Joe Collection"** (decided June 2026; replaced the "Joe Dossier" placeholder) with a vintage-ARAH-file-card outline mark — live across every current surface (Figures, Vehicles, Parts Bin, and the Scale States reference). The old "Joe Dossier" working app and the name-exploration sheet are in `_archive/`. The name uses the Hasbro mark by choice (fine for private use; revisit before any public release — see OPEN_QUESTIONS_Claude.md #10).
