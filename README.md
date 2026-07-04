# Handoff: G.I. Joe Collection — Inventory App

## ▶ Run it locally (VS Code + Claude Code)
The prototypes compile JSX in the browser, so they must be served over **http://localhost** — opening the HTML files directly (`file://`) leaves the screens blank.

1. Open this folder in **VS Code** → open the integrated terminal.
2. Start a static server: **`npx serve .`** (or `npm start`, or `python3 -m http.server 3000`).
3. Open the printed URL (e.g. `http://localhost:3000`). **`index.html`** loads first — it links every screen and every spec doc.
4. For **Claude Code**: run `claude` in this folder and start with *"Read CLAUDE.md, then the README and spec docs."*

Keep an internet connection for the first load (React, Babel, and fonts come from CDNs). See **`CLAUDE.md`** for the build-it-for-real primer.

## Overview
A personal **inventory + condition tracker** for a large vintage action-figure collection (target: **700–800 figures**, spanning 1982–1994+). The primary job is **inventory tracking**: knowing which figures you own, how many of each, which accessories each one still needs, and the condition of every copy. The landing screen is the full collection ("All"), grouped by release year, with fast filtering, search, and two display modes (List / Gallery).

This bundle documents the **"All / Inventory" home screen** and the **Instance Detail** screen (single-copy condition + accessories). The Instance Detail page introduces the **damage-map condition system** and the **Parts Bin** relationship — see `INSTANCE_MODEL.md`, `PARTS_BIN.md`, and `NAVIGATION.md`. Other flows (Add Figure, Add Instance) are **not yet designed** — see `OPEN_QUESTIONS.md`.

---

## About the Design Files
The files in this bundle are **design references created in HTML/React-via-Babel** — prototypes that show the intended look, layout, and interaction model. **They are not production code to copy directly.** The Babel-in-the-browser setup, the single-file CSS, and the `Object.assign(window, …)` module pattern are prototyping conveniences, not architecture.

The task is to **recreate these designs in a real codebase** using its established patterns, component library, and build tooling. If no codebase exists yet, choose an appropriate stack (a React + TypeScript SPA or Next.js app is the natural fit — the prototype is already React-shaped) and implement there. Treat the HTML as the source of truth for **visual design and behavior**, and `FRONTEND_STANDARDS.md` for **how to build it properly**.

---

## Fidelity
**High-fidelity.** Colors, typography, spacing, borders, and interactions are all final-intent and should be recreated faithfully. The aesthetic is deliberate (see Design Language below) — it is not a generic admin table. Match it closely, then swap prototype shortcuts (unicode-glyph icons, browser-Babel) for production equivalents.

---

## Design Language (read this first)
The look is a **vintage field-manual / cardback** aesthetic — it intentionally evokes the 1980s toy packaging and military dossier feel of the subject matter.

- **Paper & ink, not white & gray.** Backgrounds are warm off-white/kraft paper tones; foregrounds are near-black "ink." No pure `#fff`/`#000`, no cool grays.
- **Hard edges, offset shadows.** Cards and rows use 1.5–2.5px solid ink borders and a hard offset drop shadow (`3px 3px 0 ink`), never soft blurred shadows or rounded corners. Border-radius is effectively **0** everywhere.
- **Three type roles:** a condensed display face (Oswald) for names/numbers, a monospace (Space Mono) for labels/metadata/data, and a hand face (Patrick Hand) loaded for optional flavor (minimal use in the final).
- **Faction color-coding:** JOE = olive, COBRA = crimson. These are data-driven tags, toggleable.
- **Restraint on color:** the only "status" colors are green (complete/owned-fully) and the single accent (incomplete actions, needs). Everything else is paper/ink.
- **Theming is a feature.** The prototype exposes a small theme panel (paper kraft/white, accent choice, faction colors on/off, a playful "hand-drawn wobble" that is **off by default**). Preserve this as a real theme config, not hard-coded values.

---

## Screens / Views

There is **one primary screen** with several modes and an overlay. Reference file: `GI Joe Tracker - Inventory.html` (+ `inventory-app.jsx` for component logic).

### 1. Page chrome (sticky)
Two stacked sticky bars that pin to the top of the viewport. A JS measurement writes the combined height to a CSS variable `--chrome-h`, which the year-section headers use as their sticky offset (so they stick *beneath* the chrome). Recreate this with a layout-aware approach (measured height, `position: sticky`, or a sticky stacking context).

**1a. Header** (`.invp-top`) — grid `auto 1fr auto`, gap 22px, padding `12px 26px`, background `--ink`, text `--paper`.
- **Brand**: file-card outline mark in `--accent` · "G.I. JOE COLLECTION" (Oswald 700, 22px, `letter-spacing 1px`) · "INVENTORY" sublabel (Space Mono 9px, `letter-spacing 2px`, opacity .6).
- **Search**: full-width pill, `rgba(255,255,255,.1)` fill, `1.5px rgba(255,255,255,.3)` border, padding `7px 12px`, max-width 460px. Leading ⌕ glyph, transparent `<input>`, trailing clear (✕) when non-empty. Placeholder: "search code name · accessory · year…".
- **KPIs** (3): each bordered `1.5px rgba(255,255,255,.3)`, padding `5px 12px`, min-width 84px. Value Oswald 700 20px (with optional `/N` in Space Mono 11px @ opacity .55), label Space Mono 8px `letter-spacing 1px` opacity .6.
  - `UNIQUE FIGURES` = count of distinct figures owned (owned ≥ 1)
  - `TOTAL FIGURES` = sum of all owned instances (counts duplicates)
  - `FIGURES COMPLETE` = **complete-now** figures (≥1 whole copy) `/` unique figures

**1b. Toolbar** (`.invp-bar`) — flex, wrap, gap 12px, padding `9px 26px`, background `--card`, border-bottom `2px --ink`.
- **Filter chips** — two **bracketed groups** (each a segmented cluster; single-select across all of them, click the active one to clear): **[ `Complete` · `Incomplete` ]** and **[ `Show Duplicates` · `Show Collection Gaps` ]**. Chip = Space Mono 700 10px, paper fill; the group frame is `1.5px --line`; active chip = ink fill, white text, trailing ✕. *(There is no Rebalance chip here — rebalancing moved to the Parts Bin header; see `PARTS_BIN.md`.)*
- **Count**: "`N` of `M`" when filtering, else "`M` figures" (Space Mono 10px, `--ink-soft`).
- **Spacer**, then right-aligned: `YEAR ↑·A–Z` sort button (toggles year asc/desc), `EXPAND ALL`/`COLLAPSE ALL` (hidden while filtering), and a `LIST` / `GALLERY` segmented toggle.

### 2. Year sections (collapsible, the body)
The collection is grouped into one `<section>` per release year, rendered in sort order (year asc by default). Each has a **sticky header** and a collapsible body. **On load, every year is collapsed to its summary.** While a filter or search is active, matching years are force-expanded and non-matching years are removed.

**2a. Year header** (`.ysec__hd`) — sticky at `top: var(--chrome-h)`, grid `92px 1fr 232px 50px 26px`, gap 18px, padding `12px`, background `--paper`, dashed bottom border. **Expanded state inverts to `--ink` background / `--paper` text.** Columns:
- Year number — a **black boxed tab** (Oswald 700 ~23px, `--ink` fill, `--paper` text, hard `2px 2px 0` offset shadow); inverts to paper-on-ink when the section is expanded
- Title block: meta "`N owned`" — total *physical copies* owned from that year, duplicates included (10px, `--ink-soft`), e.g. "18 owned" for 1982. A third, independent metric from the two meters: the meters count *distinct variants* covered against the roster total; this counts raw instances, so a figure with 2 duplicate copies of the same variant adds 2 here but only 1 to the "Figures" meter. *(Briefly showed the roster total itself ("43 figures") — July 2026 — before the owner clarified they wanted an owned-count here instead. Before that it carried a redundant "`X/Y owned · Z whole`" line duplicating the meters. The series flavor label — "THE ORIGINAL 13", "RED SHADOWS RISING", etc. — was removed earlier per owner request; the year number alone heads each section otherwise.)*
- **Two meters**, same denominator (the full series roster, e.g. 43 for 1982): **Figures** (owned/roster) and **Complete** (complete-now/roster), thin striped bars; COMPLETE goes green at 100%
- Percent (Oswald 700, 16px) — the Complete meter's value
- Chevron ▸/▾

**2b. Section body** — padding `12px 4px 18px`. Renders either the **List** or the **Gallery** for that year's filtered+sorted figures (sorted A–Z within the year).

### 3. List view — roster rows
A column header row (`.inv-cols`, Space Mono 9px labels: CODE NAME / FACTION / OWNED / STOCK / NEED) followed by figure rows.

**Row** (`.inv-row`) — grid `42px 1fr 64px 50px 1.5fr 92px 24px`, gap 12px, padding `8px 12px`, `--card` background, `1.5px --ink` border, `3px 3px 0 ink` shadow, 6px bottom gap. Hover nudges `-1px,-1px` and deepens the shadow. Columns:
- **Thumbnail** 42×42, hatched placeholder (`—` for not-owned)
- **Name**: code name (Oswald 700, 16px) + variant (10px, `--ink-soft`)
- **Faction tag** (mini)
- **Owned**: `×N` (Oswald 700, 16px), or `—` if not owned
- **Stock**: depends on state (see below)
- **Need chip**: `NEED n` / `✓ FULL` (green) / `＋ ADD` (accent dashed, for catalog gaps) / for multi-copy: `M/N` (whole/owned) or `✓ ALL`
- **Go** ▸ (or ▾ when the row's accordion is expanded)

**Stock cell variants:**
- *Single owned figure*: a short 78px striped bar (neutral `--ink-soft`, green when whole) + fraction `own/req` + either "✓ whole" (green) or the **names of the missing accessories** (muted, fraction-tagged like "Skis 1/2" when req>1, truncated with ellipsis). The row still expands into the accordion (see 3a) — one copy, but variant-gap accountability applies just the same.
- *Multi-instance figure* (`owned > 1`): no bar — a summary "`N copies · M whole`" (M = complete-now copies). When the figure is *completable but not complete-now*, a **`⚖ REBALANCE`** hint appears (the recommender — see `INSTANCE_MODEL.md`).
- *Catalog gap* (`owned == 0`): dashed muted row, "not yet owned". Does not expand — clicking opens the acquire modal directly.

**3a. Inline instance accordion** (List only). Clicking **any owned row** — single-copy or multi — expands indented sub-rows beneath it, connected by a dashed left guide (`.inv-insts` / `.inv-inst`); *(July 2026: previously multi-copy only — single-copy rows opened straight into the modal, which hid variant-gap info for the common "own 1 of N variants" case.)* Each sub-row shows: `↳ {Figure Name} No. n · {variant letter}` (title-cased) + a condition note, its **own** short bar + fraction + missing-parts/whole text, and its own NEED chip. Copies are **sorted most-complete-first and numbered contiguously** (No. 1 = most complete; removing a copy renumbers the rest — no gaps). When the figure is *completable but not complete-now*, a **`⚖ REBALANCE`** box heads the accordion with the move list. When the catalog lists a production variant no owned copy carries, a **`⚠ Missing variant(s)`** callout (`.inv-gapbox`, dashed rust border) closes out the *bottom* of the accordion, below the copy rows. Multiple figures may be expanded at once. Clicking a sub-row opens the modal focused on that copy.
> ⚠️ Per-instance completeness is **synthesized** in the prototype (`figState()` in `wf-data.jsx`) — the sample data stores only aggregate accessory counts, so a deterministic per-copy allocation (scattered "as-stored" + greedy "optimal") is derived to demo complete-now vs. completable and the rebalance recommender. Real per-instance data must replace this — see `OPEN_QUESTIONS.md`.

### 4. Gallery view — cardback cards
A 4-column grid (`.inv-galgrid`, gap 16px) of cards per year. **Card** (`.card`) — `--card` fill, `2px --ink` border, hard shadow, padding 14px, photo placeholder 132px tall, code name (Oswald 700, 18px), variant (10px), and a footer with `OWNED ×N` (Space Mono 700 on ink) plus:
- single figure → a 46px completeness ring,
- multi-instance → "`M/N ✓`" badge,
- catalog gap → dashed card, "NOT OWNED" + "＋ ADD".

Cards sit on a **straight grid** (no wobble) and open the modal on click. There is no inline accordion in Gallery — multi-instance detail lives in the modal's instance tabs.

### 5. Detail modal (overlay)
Centered fixed overlay (`.inv-modal`, 720px wide, grid `230px 1fr`) over a scrim. Closes on scrim-click, ✕, or `Esc`. Two layouts:

**5a. Owned figure** — Left: photo, faction tag, name, `variant · year`, an 84px completeness ring. Right: **copy tabs** (`No. 1…N`, the whole ones flagged ✓, + a `＋` to add), an optional `⚖ REBALANCE` callout with move list + APPLY MOVES, an accessories summary line + note, a 2-column **accessory checklist** (each chip: ✓ have / ＋ missing, name, `owned/required`), and actions: `＋ ADD INSTANCE`, `EDIT NOTES`, `REMOVE`. *(Built July 2026, see `OPEN_QUESTIONS_ISSUES_FOUND.md` #5: for multi-variant figures the "N variants" badge is itself the hotlink — click it to open an inline A/B/C picker, pre-selected to the copy's current letter, to correct a mis-identified variant. Matches the `change ›` correction affordance already specced in `VARIANTS.md` §"Instance Detail" — no separate "identify later" state, a plain overwrite of `variantId`.)*

**5b. Catalog gap (not owned)** — Left: photo, faction, name, a "NOT IN INVENTORY" plate instead of a ring. Right: a "CATALOG ENTRY" blurb explaining that adding creates the first instance + a blank checklist from the **blueprint**, the blueprint accessory grid, and a single `＋ ADD TO INVENTORY` action.

---

## Interactions & Behavior
- **Expand/collapse year**: click header toggles; `EXPAND ALL`/`COLLAPSE ALL` in toolbar. While filtering/searching, matching years are force-open and the toggle is hidden.
- **Filter chips**: single-select across both bracketed groups; click active to clear. Semantics: `complete` = owned & **complete-now** (≥1 whole copy); `incomplete` = owned & not complete-now; `dupes` = owned > 1; `gaps` = owned == 0 **or** owned but missing one or more production variants (`isGap()` — July 2026, see `OPEN_QUESTIONS_ISSUES_FOUND.md` #11); default ("all") shows owned-only **unless** a search query is present (search reveals gaps too).
- **Search**: live, case-insensitive, matches code name / variant / faction / year / accessory name. Auto-expands matching years; updates the count to "N of M".
- **Sort**: year (asc/desc toggle), A–Z within each year. (Currently the only sort; more are an open question.)
- **List/Gallery toggle**: swaps the body renderer per year; preserves filters/search/expansion.
- **Row click**: any owned figure (single-copy or multi) → toggle inline accordion; catalog gap → open acquire modal.
- **Instance sub-row click**: open modal at that instance index.
- **Gallery card click**: open modal.
- **Modal**: copy tabs (`No. 1…N`) switch the per-copy view (derived by `figState`); an optional `⚖ REBALANCE` callout lists moves; `Esc`/scrim/✕ close.
- **Hover states**: rows nudge + deepen shadow; chips/buttons invert or fill; year headers lighten.
- **Responsive** (≤900px in prototype): header collapses to one column, gallery → 2 columns, year header drops the two meters. This is a rough-in — confirm real mobile scope (`OPEN_QUESTIONS.md`).

---

## State Management
From `InventoryApp` (`inventory-app.jsx`). Recreate as component state or a store; **persist the bold ones to URL** (shareable/back-button) and the rest to local prefs:
- `view`: `'list' | 'gallery'` *(persist: prefs)*
- `query`: search string *(persist: URL)*
- `status`: `'all' | 'incomplete' | 'complete' | 'dupes' | 'gaps'` *(persist: URL)*
- `open`: Set of expanded year numbers *(persist: URL or prefs)*
- `openIds`: Set of figures with their instance accordion expanded
- `selId` / `selInst`: currently-open modal figure id + instance index
- `yrAsc`: year sort direction *(persist: prefs)*
- Derived: filtered+grouped `sections`, `shownCount`, the `--chrome-h` measurement.

Data fetching: the prototype reads a static in-memory catalog. Production needs a real data layer (see `OPEN_QUESTIONS.md`) — likely a paginated/queryable API given 700–800 figures.

---

## Data Model (as prototyped — confirm against real schema)
The sample lives in `wf-data.jsx`. It models a **catalog joined with ownership**:

```
Series (year group)
  year: number              // e.g. 1984
  label: string             // e.g. "RED SHADOWS RISING" — STILL in the data but NO LONGER DISPLAYED (owner removed the series flavor titles); the year number alone heads each section
  figures: Figure[]

Figure (catalog entry + ownership rollup)
  id: number
  name: string              // code_name, e.g. "ROADBLOCK"
  variant: string           // version/role descriptor, e.g. "v1 · Heavy MG" — NOT the
                            // production-variant layer (letter+tell). See VARIANTS.md.
  faction: "JOE" | "COBRA"
  owned: number             // count of owned instances (0 = catalog gap)
  acc: [name, required, owned][]   // accessory blueprint + aggregate owned

Completeness math (figParts / figState / yearParts / totals) — PER-INSTANCE (see OPEN_QUESTIONS #5):
  figure.req  = Σ required;  figure.own = Σ min(owned, required)   // = the BEST/optimal copy's parts
  figure.pct  = own/req
  completable  = pct === 100                 // parts owned COULD make a copy whole
  complete-now = ≥ 1 copy is whole as parts are currently assigned   // the real "complete"
  figState(fig): per-instance allocation + currentWhole / optimalWhole /
                 completeNow / completable / surplus / rebalance moves
  year."Figures"  = ownedVariantSlots / rosterVariantSlots     // "how much of the series you own"
  year."Complete" = completeNowSlots / rosterVariantSlots      // "how much of the series is whole"
  // (July 2026) roster/owned/complete are all counted per PRODUCTION VARIANT,
  // not per catalog figure — a true complete year means owning every variant,
  // not one copy of each code name (1982's 16 code names carry 43 variants
  // between them; see OPEN_QUESTIONS_ISSUES_FOUND.md #9/#11/#13). A figure
  // contributes >=1 slots (its variants[] array, always >=1 — see
  // VARIANTS.md); "owned"/"complete" only credit variant letters you actually
  // hold a copy of, not raw copy count. Both meters share the SAME
  // denominator (the full series roster) so "Figures" and "Complete" read as
  // two cuts of the one true total, not complete-of-owned. This is the
  // roster/coverage axis only — the accessory blueprint itself still keys on
  // figureId with no per-variant override (OPEN_QUESTIONS.md §7.5).
  totals: figs, instances(=Σowned), inInventory(owned≥1), complete(=complete-now), missing(req−own)
```

**Key modeling gap:** `acc` stores an *aggregate* owned count per accessory, and `owned` is just an instance count. There is **no real per-instance record** — `figState()` derives a plausible per-copy allocation so the per-instance completeness + rebalance UI can be shown. The real model must define an **Instance** entity (see `OPEN_QUESTIONS.md`, the #1 decision).

**Variant modeling gap:** the flat `variant` string above is only the version/role descriptor. A separate **production-variant** layer (letter + physical "tell", e.g. Breaker v1·A thin-thumbs vs v1·B thick-thumbs) is already built into **Add Figure** and **Instance Detail**, including an **UNIDENTIFIED** "pin it later" state. The full model — hierarchy, schema, the identify-later lifecycle, and how to fold it into the Inventory — is specified in **`VARIANTS.md`**.

---

## Design Tokens
Exact values from the prototype CSS (`GI Joe Tracker - Inventory.html`). Expose as theme variables.

**Color**
| Token | Value (white/default) | Value (kraft theme) | Role |
|---|---|---|---|
| `--paper` | `#f3eee2` | `#c9bca0` | page background |
| `--card` | `#e9e2d2` | `#dccfb2` | cards, rows, toolbar |
| `--ink` | `#211f1a` | — | text, borders, headers |
| `--ink-soft` | `#56503f` | — | secondary text |
| `--line` | `rgba(33,31,26,.55)` | — | strong hairlines |
| `--line-soft` | `rgba(33,31,26,.22)` | — | faint hatching/dividers |
| `--accent` | `#b8402f` (default) | — | needs/actions; **user-selectable** |
| `--ok` | `#5d7d4d` | — | complete / fully-owned |
| `--olive` | `#5f6b39` | — | JOE faction |
| `--crimson` | `#a23a2c` | — | COBRA faction |
| `--ring-track` | `rgba(33,31,26,.16)` | — | unfilled ring track |

Accent options offered in the theme panel: `#b8402f` (red), `#6b6f39` (olive), `#c9772f` (amber), `#3f6f86` (steel blue). *(User's current preference: olive `#6b6f39`.)*

**Typography**
| Role | Family | Usage |
|---|---|---|
| Display | **Oswald** (400–700) | code names, year numbers, KPI values, button labels, section labels |
| Mono | **Space Mono** (400/700) | UI labels, fractions, metadata, chips, counts |
| Hand | **Patrick Hand** | optional flavor; minimal in final |

Representative sizes: year number ~23px/700 (boxed ink tab) · figure name 16px/700 (gallery 18) · KPI value 20px/700 · modal name 24px/700 · body/labels 9–13px. Mono labels use `letter-spacing` .5–2px. **Minimum text size ~9px** is used only for all-caps mono micro-labels; body copy ≥10px.

**Geometry & effects**
- Border-radius: `0` throughout.
- Borders: `1.5px` (rows/chips/widgets), `2px` (cards/toolbar), `2.5px` (modal), solid `--ink`; dashed for ghost/gap and guide lines.
- Shadow: `3px 3px 0 var(--ink)` (cards/rows), `4px 4px 0` on hover/active, `8px 8px 0 rgba(33,31,26,.5)` (modal). **No blur.**
- Hatched placeholder fill: `repeating-linear-gradient(45deg, transparent 0 7px, var(--line-soft) 7px 8px)`.
- Striped bar fill: `repeating-linear-gradient(45deg, rgba(255,255,255,.25) 0 4px, transparent 4px 8px)`.
- Spacing rhythm: section padding 26px horizontal; control padding 5–9px; grid gaps 12–18px.
- Sticky offset: `--chrome-h` (measured header+toolbar height).
- Breakpoint: `900px`.

**Iconography**: the prototype uses unicode glyphs (`▣ ⌕ ▸ ▾ ✕ ↳ ▤ ▦ ＋ ✓ ⚖`; `½` marks a partially-owned accessory). **Replace with a real icon set** (Lucide/Feather or similar) in production, keeping the same meanings (⚖ = rebalance).

---

## Assets
- **No raster assets.** Every figure image is a **hatched placeholder** (`.wf-photo` / `PhotoSlot`) with a "FIG. PHOTO" tag. Real figure photography is a TODO and an open question (source + storage).
- **Fonts** via Google Fonts (Oswald, Space Mono, Patrick Hand). In production, self-host or use the codebase's font pipeline.
- **Brand / name** — decided (June 2026): **G.I. Joe Collection**, with a vintage-ARAH-file-card outline mark, applied consistently across every current surface (Figures, Vehicles, Parts Bin, and the Scale States reference). The prior “Joe Dossier” placeholder + its unicode-glyph mark are retired; the old working app and name-exploration sheet live in `_archive/` (OPEN_QUESTIONS #10).

---

## Files in this bundle
- `GI Joe Tracker - Inventory.html` — **the design of record** for the home screen. Full-page inventory: tokens + all component CSS + page shell.
- `inventory-app.jsx` — inventory logic: `InventoryApp`, `YearSection`, `Row`, `GalleryCard`, `InvModal`, plus filter/sort/search.
- `GI Joe Tracker - Instance Detail.html` + `instance-detail.jsx` — **the single-copy detail + damage-map condition system** (see `INSTANCE_MODEL.md`). Also hosts the **VARIANT IDENTITY** panel — for *correcting* a copy's variant (the identify-later / unidentified state was removed — `VARIANTS.md` §3).
- `GI Joe Tracker - Add Figure.html` + `add-figure.jsx` — **the Add Figure wizard** (Find → Details → Condition), incl. the **production-variant picker** (a variant is **required** — the UNIDENTIFIED / identify-later path was removed, `VARIANTS.md` §3) and the Parts-Bin pull (runs on superseded name-keyed sample data — `OPEN_QUESTIONS.md` #8).
- `GI Joe Tracker - Parts Bin.html` + `parts-bin.jsx` — **the Parts Bin page** (loose accessories, compatibility, reverse-lookup, and the `⚖ REBALANCE` header tag; see `PARTS_BIN.md`). Loads `parts-catalog.js` (the accessory catalog) and `wf-data.jsx` (for the rebalance panel's figure data).
- `parts-catalog.js` — the 798-entry accessory catalog (category / home figure / shared-ness) that drives the Parts Bin.
- `wf-data.jsx` — sample catalog (1982–1992) + completeness math (`figParts`, `figState`, `yearParts`, `totals`) and shared widgets. Shared by Inventory and (for the rebalance panel) the Parts Bin.
- `tweaks-panel.jsx` — the theme panel (paper/accent/wobble/faction) — informs the production theme config, not shipped as-is.

### Specs (read these)
- `INSTANCE_MODEL.md` — instance schema, the damage map, and the derived-grade engine (exact default weights/thresholds/caps).
- `VARIANTS.md` — the **production-variant** model: the character → figure → variant → instance hierarchy, the physical "tell," and the **variant-required-at-Add** rule (the UNIDENTIFIED / identify-later lifecycle was dropped — §3).
- `PARTS_BIN.md` — the loose-accessory inventory and the two-way figure↔bin flow.
- `NAVIGATION.md` — how screens connect; how Instance Detail and the Parts Bin are reached.
- `OPEN_QUESTIONS.md` — **decisions to resolve before/early in implementation.** Read first.
- `FRONTEND_STANDARDS.md` — architecture, accessibility, performance, code standards.

> Also in the project (not bundled, for reference): `GI Joe Tracker - Home Wireframes.html` holds three **archived alternate directions** (Roster Ledger, Cardback Wall, Mission Status) that were explored before this one was chosen. Ignore unless you want prior art.
