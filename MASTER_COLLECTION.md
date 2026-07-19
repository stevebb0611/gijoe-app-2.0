# Master Collection — keeper targets & the per-copy star

## 1. The concept

Not every owned copy is a keeper. The Master Collection is the owner's permanent core
set: by default, one of every figure and every recorded production variant, with
higher targets for troop-builders (multiple Vipers) or favorites (five Airtights). A
copy that's never starred into the Master Collection is tradeable surplus — the owner
is free to sell, trade, or otherwise part with it without the app needing to know.

This is deliberately a thin overlay on the existing data, not a duplicated data model:

- **Figures stay on the Figures page.** The star and target live on the same
  figure/instance records everything else does — there is no separate "master
  collection" table, just `is_master`/`master_target` columns on the tables that
  already exist (§2). The dedicated Master Collection view (§4) reads those same
  records; it does not fork them.
- **The Master Collection view shows copies, not figures.** It is a distinct
  component (`web/src/master-collection.jsx`), not a filtered mode of the
  Figures page's `InventoryView`. That distinction matters: an early version
  *did* implement it as an `InventoryView` filter (any figure with ≥1 starred
  copy passes, then renders that figure's normal row — all owned copies,
  duplicates included). That was wrong and got corrected 2026-07-15 — see the
  troop-builder example in §3. The real view lists exactly the starred
  instances, one row per copy, nothing else.
- **No disposition tracking.** The app has no "sold"/"traded"/"removed" status. If a
  copy leaves the collection, its instance row is deleted (`Remove` in the modal), the
  same as any other removal — the Master Collection flag has no special deletion path.
  Any record of *what* moved and *why* is manual, kept in §5 below, not in the database.

## 2. Data model

Three independent pieces — the star and target added in `migrations/009_master_collection.sql`,
the note added later in `migrations/013_master_collection_notes.sql`:

- **`instances.is_master`** (`BOOLEAN`, default `0`) — the star. Marks one specific
  owned physical copy as a committed keeper. Set freely on any instance regardless of
  completeness or file-card status (see §3, "Star gating") — those stay visible as
  separate notations alongside the star, not a precondition for it.
- **Target quantity** — how many starred copies the owner wants for a given figure or
  production variant. Grain is **per production variant**, not per figure, so a
  multi-variant figure can want different counts of each variant (e.g. more of the
  common running-change than the short-lived one):
  - `variant_lookup.master_target` (`INTEGER`, default `1`) — the target for a specific
    recorded production variant (a `variant_lookup` row).
  - `figures.master_target` (`INTEGER`, default `1`) — the fallback used for figures
    with **no** `variant_lookup` rows (single-variant figures), where there's no variant
    row to attach a target to.

  `server/catalog.js`'s `buildCatalog()` always returns a `variants[]` array per figure
  (synthesizing a blank-letter placeholder for single-variant figures, per
  `VARIANTS.md`) — each entry now also carries `{ id, masterTarget }`, so the frontend
  can treat every figure uniformly: real `variant_lookup` rows have a real `id` and
  their own `masterTarget`; the synthesized placeholder has `id: null` and mirrors
  `figures.master_target`, which is the frontend's signal to PATCH `/api/figures/:id`
  instead of `/api/variants/:id` when the target is changed.

- **`figures.master_notes`** (`TEXT`, nullable) — a free-text note about the figure's
  Master Collection status, e.g. "Storm Shadow figure is yellowing — look for upgrade"
  or "Astro-Viper, China copy owned, Hong Kong not in collection." Figure-level, not
  per-instance or per-variant — the Master Collection card groups by figure (§4), and
  these notes are about the figure/variant slate as a whole. Distinct from the
  pre-existing `figures.notes` (a general catalog-level annotation, exported as its own
  "Notes" column); this one gets its own "Master Collection Notes" column in the xlsx
  export (`server/export-xlsx.js`).
- **`v_master_collection_progress`** — a read-only reporting view (TablePlus only; the
  app computes progress client-side) joining `figures` × `variant_lookup` × `instances`
  to show `target` vs. `starred_count` per figure/variant row.

Progress for a given figure+variant is simply `COUNT(instances with is_master=1 AND
matching figure_id/variant_id)` compared against the target above — computed client-side
in `web/src/store.js` per the currently selected instance's variant, not stored.

## 3. Decisions (resolved June/July 2026)

- **Target grain — per production variant, not per figure.** A troop-builder override
  (e.g. Viper variant A → 3) shouldn't force every other variant of that figure to the
  same count. Single-variant figures (the large majority) just use the one
  `figures.master_target` fallback, so this adds no extra UI for the common case.
- **Star gating — none.** Any owned instance can be starred regardless of completeness
  or file-card status. "Complete with accessories and file cards" is the *aspiration*
  for a Master Collection copy, not an app-enforced gate — the existing whole/`✓` and
  file-card notations already show that status alongside the star, so nothing blocks a
  work-in-progress copy from being marked as the keeper while it's being completed.
- **UI scope for v1 — Figure Detail modal only.** *(Superseded 2026-07-15, see below.)*
  The gold-outlined instance tab, the star toggle, and the target/progress stepper
  shipped first, modal-only, with a header badge + dedicated view called out as a
  natural fast-follow.
- **Header badge + dedicated view — built 2026-07-15.** A circular gold "military
  badge" chip in the main header links to a Master Collection view. The badge's
  full 150px ceremonial design (see `Master Collection Chip.html` /
  `README_Master_Collection.md` design handoff, "05d") didn't fit the ~116px
  header chrome — scaled down to a compact `.invk`-style KPI chip instead,
  keeping the gold star + ring motif but dropping the three-star/thread detail,
  which doesn't read at that size. First implementation reused `InventoryView`
  with a `masterOnly` filter — see next bullet for why that was replaced same-day.
- **Filter approach rejected, replaced with a dedicated instance-level view —
  2026-07-15.** The `masterOnly`-filter version showed the *whole figure row*
  (every owned copy, however many) for any figure with ≥1 starred copy. Caught
  immediately by two concrete examples: an Ace with 1 of 3 copies starred showed
  all 3 in the Master Collection view; a Blowtorch with only variant-A and -B
  copies starred showed all 5 copies across A/B/C. Both defeat the point — the
  Master Collection is supposed to show *what's committed*, not *everything
  owned by a figure that has at least one commitment*. Replaced with
  `web/src/master-collection.jsx` (`MasterCollectionView`), a standalone
  component (peer to `PartsBin`, not a mode of `InventoryView`) that filters at
  the **instance** level: it lists only copies with `is_master = 1`, grouped
  under their figure for context, with per-variant target/progress shown
  alongside. `app-inventory.jsx`'s Figures page reverted to exactly its
  pre-Master-Collection behavior — no `masterOnly` prop, no filter predicate —
  the header badge chip is now a pure nav link.
- **Defaults — target 1, starred 0, everywhere.** Every figure/variant starts at "0/1"
  on migration — no backfill or auto-starring of existing single-copy figures. The
  Master Collection is generated live from the existing `figures`/`instances` tables,
  not a separately populated list, so there's nothing to seed beyond the default
  columns themselves.

## 4. UI surface

### Figure Detail modal (`web/src/app-detail.jsx`)

- **Star toggle** — a small star button in the modal's dark header, left of the MOC
  checkbox (`.inv-cardhd__master`). Gold-filled when the currently selected copy
  (`raw.masterCollection`) is in the Master Collection; outline-only otherwise.
- **Gold-outlined tab** — each copy's `No. N` tab in the flip-card's tab rail gets a
  gold outline (`.inv-tab.is-master`, `--gold` CSS token) whenever that copy is
  starred, independent of which copy is currently active (`.is-active`) or whole
  (`✓`) — all three states can be visible on a tab at once.
- **Target/progress stepper** — under the variant/specialty line
  (`.inv-mc`), shows `{starred}/{target}` for the *currently selected copy's*
  production variant, with `−`/`+` buttons to adjust the target. Switching between a
  figure's variant tabs shows each variant's own independent count, per §3.

### Header badge (`web/src/app-inventory.jsx`, also mirrored on the Master Collection page itself)

- **Header badge chip** — `.invk--master` in the `.inv-kpis` row (right side of the
  main header, alongside Unique/Total/Complete). Renders `MasterBadge`
  (`web/src/app-detail.jsx` — a gold/paper/ink ringed circle with a gold star, a
  compact reinterpretation of the design handoff's "05d" badge) plus the collection-
  wide `{metSum}/{targetSum}` fraction (every figure/variant's `Math.min(starred,
  target)` summed over its target — see `JoeStore.masterTotals()` in `store.js`).
  On the Figures page it's a plain nav link to the Master Collection view; on the
  Master Collection view itself it's rendered `.is-active` (gold-tinted) and
  navigates back to Figures. The badge icon is positioned as an absolutely-placed
  corner accent (`top:-8px; right:-8px` in `app.css`), not stacked inline — kept
  out of the chip's normal flex flow so the chip stays the exact same height as
  the other three KPI chips regardless of icon size.

### Master Collection view (`web/src/master-collection.jsx`)

A standalone page component, structurally a peer of `PartsBin`
(`web/src/parts-bin.jsx`) — its own copy of the header chrome (brand, nav,
search), wired into `main.jsx`'s `page` state as `'master-collection'`, not a
prop/mode of `InventoryView`.

- **Data shape — one card per figure, one row per starred copy.** For every
  catalog figure, only its instances with `masterCollection: true` are
  collected; figures with zero starred copies don't appear at all. Each
  card's header shows the figure identity (name, version, faction, year) plus
  a small per-variant target/progress readout (`.mc-target`, e.g. a Blowtorch
  card showing `A 1/1 · B 1/3 · C 0/1`), gold-highlighted (`.is-met`) once a
  variant's starred count reaches its target. Below that, each starred copy
  renders as its own row reusing the same `.inv-inst` styling as the Figures
  page's per-copy accordion rows (identity, stock/completeness bar, file-card
  flag, missing count) — a duplicate figure with 1 of 3 copies starred shows
  exactly that 1 row, not 3.
- **KPI chips** — `Figures In` / `Starred Copies` / `Target Filled` (from
  `JoeData.masterTotals()` via the shared `invMasterTotals()` wrapper in
  `app-detail.jsx`), replacing the Figures page's Unique/Total/Complete chips
  in this view's own header — there's no shared/toggling state between the two
  pages' headers since they're now separate component instances.
  `masterTotals()` walks every figure × variant slot in the catalog (not just
  owned ones, since every slot defaults to a target of 1) and caps each slot's
  contribution at its own target, so over-starring a troop-builder past its
  target doesn't inflate the overall completion fraction.
- **Opening a copy** — clicking a starred row opens the same `InvDetailModal`
  used everywhere else, pinned to that instance (`{catalogId, instId}`). The
  modal still shows *all* of that figure's copies as tabs (not just starred
  ones) with gold outlines marking which are starred — the Master Collection
  view's list is scoped, but the modal you land in is the normal full one, so
  you can still star/unstar other copies from there.
- **Search** — a single free-text box (name/specialty/faction/year) filters
  the card list; there's no faceted filter bar like the Figures page, since
  the Master Collection is already a small, curated subset.
- **Sort toggle** (added 2026-07-19) — a slim `.invp-bar` under the header
  (figure count + `YEAR ↑/↓` / `A–Z` buttons, `.txtbtn`) lets the list re-sort
  as it grows past a glance-able size. Year mode defaults to newest-first,
  matching the pre-toggle sort; clicking Year again flips direction; A–Z
  ignores year entirely. Deliberately just a sort control, not the Figures
  page's full collapsible `YearSection` grouping — Master Collection cards
  already carry more per-card chrome (target chips, the note box, instance
  rows) than a plain roster row, so year-header chrome was judged not worth
  it for what's meant to stay a curated, scannable list.
- **Per-figure note** (added 2026-07-19) — a free-text input (`.mc-card__note`)
  inside the card's dark header bar, wired to `figures.master_notes`. Saved
  on blur (`JoeStore.setFigureMasterNotes`), same debounce-free
  patch-the-cached-catalog-object pattern as the master-target stepper — no
  `/api/catalog` refetch. Included in the xlsx export as its own "Master
  Collection Notes" column (`server/export-xlsx.js`), separate from the
  general per-figure "Notes" column.

## 5. Disposition policy — movement log

Copies not starred into the Master Collection are tradeable surplus. Selling, trading,
or otherwise removing one is **not tracked by the app** — deleting the instance is
enough on the database side. This section is a manually-maintained, free-form log for
the owner to jot down what actually moved, if and when they want a record of it. Not
required, not read by any code — purely a human notebook.

<!-- Add entries below, newest first. Free-form — e.g.:
### 2026-08-02
- Traded 2 surplus Cobra Officers (non-master copies) for a carded Zartan.
-->
