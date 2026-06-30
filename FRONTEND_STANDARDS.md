# Front-End Standards — production build

How to recreate the prototype properly. The prototype optimizes for fast iteration; production should optimize for correctness, accessibility, performance at 700–800+ items, and maintainability. Defer to the target codebase's existing conventions where they exist; otherwise use the below.

---

## Stack
- **React + TypeScript** is the natural target (the prototype is React-shaped). Next.js if you want routing/SSR/URL-state ergonomics; a Vite SPA is fine for a personal tool.
- **TypeScript is strongly recommended** — the data model (catalog × ownership × instances × accessories) has enough shape that types will prevent real bugs. Model `Series`, `Figure`, `Instance`, `Accessory`, and the completeness derivations as typed functions.
- **Drop the prototype mechanics**: no Babel-in-browser, no `Object.assign(window, …)` module sharing, no single inline `<style>`. Use the codebase's bundler, real ES modules, and its styling system.

## Component architecture
Recreate as a clean component tree (names map to the prototype):
- `InventoryPage` (was `InventoryApp`) — owns query/filter/sort/view state; renders chrome + sections + modal.
- `Header` (brand + nav, centered `SearchBox` grouped with `AddFigureButton`, `KpiStat` ×3) — see **Header & sub-header conventions** below
- `Toolbar` (sub-header: `FilterChip` groups, `ExpandAllButton`, `ViewToggle`) — **no sort control**; default order is year-ascending
- `YearSection` (sticky `YearHeader` + collapsible body)
- `FigureRow` (+ `InstanceRow` accordion) for List
- `FigureCard` for Gallery
- `FigureModal` (with `InstanceTabs`, `AccessoryChecklist`, `AcquirePanel`)
- `AddFigureModal` (pop-out launched from the header ＋; steps **FIND → DETAILS → CONDITION**, ＋ADD on the last step). FIND has two independent inputs: a fuzzy catalog **search** + a **Year→Figure** dropdown. Reuses the shared `DamageMap` for the condition step. Catalog + fuzzy matcher come from a data module (`add-figure-catalog.js` in the prototype — in production this is a server query against the `figures` catalog).
- Shared primitives: `FactionTag`, `CompletenessBar`, `CompletenessRing`, `StockCell`, `PhotoSlot`, `Chip`, `SegmentedToggle`, `DamageMap`.
Keep the completeness math (`figParts`/`yearParts`/`totals`) as **pure, tested functions** decoupled from rendering.

## Styling & design tokens
- Put every value from the README's **Design Tokens** into the theme layer (CSS variables / Tailwind theme / CSS-in-JS theme). **No hard-coded hex in components.**
- Preserve the **theme switches** (paper kraft/white, accent choice, faction colors on/off, optional wobble) as a real, persisted theme config — not a dev panel. Wobble defaults **off**.
- Honor the aesthetic invariants: **border-radius 0**, solid ink borders, **hard offset shadows (no blur)**, paper/ink palette, the two type roles. A reviewer should not be able to tell the production build from the prototype.
- Use the hatched/striped gradient utilities for placeholders and bars; centralize them.

## UI conventions (locked in design review)
Firm rules confirmed in review — apply them everywhere, not only where first introduced.

- **No ALL CAPS.** Interface text uses sentence/Title case; do not use `text-transform: uppercase` or hand-cap labels. Exceptions must be **explicitly specified** — currently only the boxed year tab, faction tags (JOE / COBRA / OKTOBER / DREADNOK), and short status tokens. Flag any new all-caps usage for sign-off rather than introducing it by default.
- **One type system, used consistently.** All interactive chrome — nav links, filter chips, the search field, text buttons (Expand/Collapse All), and the view toggle — shares a single treatment: display face (Oswald), weight 600, ~13px, letter-spacing ~0.2px. Keep the mono face out of interactive chrome. Stat-box labels also use the display face (not mono). **Font style *and* color match across the app:** control text is ink (near-black) on paper and paper-white on the dark header — never leave one control gray while its neighbors are ink.
- **Chip alignment follows its section.** When chips/controls are grouped into sections within a bar, justify each group to its zone — left-anchored, centered, or right-anchored — using flexible spacers between groups, not fixed margins. In the sub-header: status group (All · Complete · Incomplete) **left**, modifier group (Show Duplicates · Show Collection Gaps) **centered**, Expand/Collapse + view toggle **right**.

## Header & sub-header conventions (chrome)
Sticky chrome is two rows: the **header** (dark ink background) and the **sub-header / toolbar** (paper card).

**Header (dark) — three zones on one centered baseline:**
- **Left:** brand/title (**G.I. Joe Collection** — file-card mark; “Joe Dossier” was the prior placeholder) + nav links **Figures**, **Parts Bin** (no count badge). Title and nav are vertically centered together — no baseline drift.
- **Center:** the **search field grouped with the `+ Add Figure` action**, centered as a group between the left and right zones with balanced gutters (don’t let search hug left with dead space on the right). Search text/placeholder use the display face. `+ Add Figure` is the single **olive** standout button, with a stable olive independent of the accent theme.
- **Right:** three KPI stat boxes — **Unique Figures · Total Figures · Complete** — values and labels centered, display face, Title case.

Search matches across **code name, variant, faction, year, and accessory**. Year is read from the figure’s parent series, not the figure record itself.

**Sub-header / toolbar (paper):** filter chips in three justified groups (see chip alignment above). **No year sort control** — default order is year-ascending. **Expand/Collapse All** stays available except during an active text search.

**Expansion behavior:** a **text search** auto-expands matching year sections (you want to see hits); **status chips do not auto-expand** — selecting Show Duplicates / Show Collection Gaps leaves years collapsed so a large (e.g. 400-figure) gap set reads as tidy year headers the user opens on demand.

## Faction tags (4 factions)
Four color-coded faction tokens, all pitched at the same chroma/lightness family so they read as a set:
- **JOE** = olive `--olive`, **COBRA** = crimson `--crimson`, **OKTOBER** (Oktober Guard) = steel-blue `oklch(0.5 0.085 245)`, **DREADNOK** = warm ochre/orange `oklch(0.55 0.108 58)`.
- Tags are **fixed-width and center-aligned** (`min-width` sized to fit the longest name — DREADNOK — so every tag in a column lines up and the label is truly centered; do **not** rely on `letter-spacing` hacks, and ensure the box is wide enough that long names don’t overflow into the next grid column). A `--mini` size variant is used inside list rows.
- The **“Faction colors” theme toggle** desaturates all four to neutral ink — keep that path working for any new faction.

## Iconography
Replace unicode glyphs with a real icon library (Lucide/Feather recommended), one component per icon, sized to match (14–18px). Map: search ⌕, chevrons ▸/▾, close ✕, add ＋, check ✓, **list = three stacked horizontal lines, gallery = 2×2 grid of squares** (not lookalike box glyphs), instance ↳. Icons inherit `currentColor` so they invert with their button’s active state.

## Accessibility (the prototype is not yet a11y-complete — fix in production)
- **Semantics**: year headers are `<button aria-expanded>` controlling the section; accordion rows likewise. Use real `<button>`/`<a>`, lists where appropriate.
- **Modal**: focus-trap, `role="dialog"` + `aria-modal="true"`, return focus to the trigger on close, `Esc` to close, scrim click to close, prevent background scroll.
- **Keyboard**: full keyboard operability — tab order, Enter/Space on rows/chips, arrow-key nav within instance tabs.
- **Focus-visible** styles that fit the aesthetic (e.g. a 2–3px ink/accent outline) — don't remove outlines.
- **Color contrast**: ink-on-paper is high-contrast; verify the **accent** chips/labels meet WCAG AA on paper (the red/olive/amber/steel options) and that faction tag text (white on olive/crimson) passes. Don't rely on color alone — keep the text labels (NEED/FULL/complete) alongside color.
- **Hit targets**: ≥44px on touch; the dense desktop rows must reflow to comfortable touch targets on mobile.
- **Reduced motion**: respect `prefers-reduced-motion` (disable wobble + hover transforms).
- **Images**: real figure photos need meaningful `alt` (figure name + variant); placeholders are decorative.

## Performance at scale (700–800+ figures)
- **Virtualize** long lists (expanded years, broad search results) with `@tanstack/react-virtual` or `react-window`. Don't render hundreds of rows eagerly.
- **Debounce** search (~150–250ms); consider server-side query/filter at scale.
- **Memoize** derived sections/filters (`useMemo`) and row components (`React.memo`); keep completeness math cheap and cached.
- Avoid layout thrash from the `--chrome-h` measurement — measure with `ResizeObserver`, write the variable once per resize, not per scroll.
- Code-split the modal and any heavy secondary flows.

## State & persistence
- **URL** (query params): `query`, `status` filter, and the expanded-year set — makes views shareable and back-button-correct. (Sort is currently fixed to year-ascending; add a `sort` param if a sort control is reintroduced.) Use the router or a small URL-state hook.
- **Local prefs** (localStorage): `view` (list/gallery) and theme.
- Keep server data in a query cache (TanStack Query or framework equivalent); the inventory is read-heavy with targeted mutations (toggle accessory, add instance, remove copy).
- Model mutations optimistically where it helps (checking an accessory should feel instant and roll up to completeness live).

## Responsive
- Mobile is likely first-class (flea-market use) — confirm scope, then design real mobile patterns: row → stacked card, modal → full-screen sheet, sticky chrome that doesn't eat the viewport, comfortable touch targets. The ≤900px rules in the prototype are a starting rough-in only.

## Quality bar
- Unit-test the completeness math and filter/sort/search predicates (pure functions — easy wins, high value).
- Component/interaction tests for: expand/collapse, filter chip single-select + clear, search reveal-gaps behavior, accordion open, modal open/close/focus.
- Type the data model end-to-end; no `any` on catalog/instance shapes.
- Lint/format to the codebase's config.

## What to carry over vs. rebuild
- **Carry over faithfully**: visual design, tokens, layout, component composition, interaction model, the completeness math, the copy/labels.
- **Rebuild properly**: the data layer (replace static `wf-data.jsx`), the **Instance model** (replace the synthesized per-copy allocation in `figState()` with real per-instance records), the **rebalance engine** (currently advisory only — wire APPLY MOVES to mutate per-copy `have` flags), icons, accessibility, virtualization, theming-as-config, and routing/persistence.
