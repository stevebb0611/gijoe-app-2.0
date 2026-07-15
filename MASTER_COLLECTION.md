# Master Collection — keeper targets & the per-copy star

## 1. The concept

Not every owned copy is a keeper. The Master Collection is the owner's permanent core
set: by default, one of every figure and every recorded production variant, with
higher targets for troop-builders (multiple Vipers) or favorites (five Airtights). A
copy that's never starred into the Master Collection is tradeable surplus — the owner
is free to sell, trade, or otherwise part with it without the app needing to know.

This is deliberately a thin overlay on the existing data, not a duplicated list:

- **Figures stay on the Figures page — the Master Collection view is a filtered
  lens on it, not a separate data model.** The star and target live on the same
  figure/instance records everything else does. The dedicated Master Collection
  view (§4) is the same `InventoryView` component (`web/src/app-inventory.jsx`)
  rendered with a `masterOnly` filter, not a new page/component with its own
  layout — every row, filter, and search behavior there is identical to Figures,
  just scoped to starred copies.
- **No disposition tracking.** The app has no "sold"/"traded"/"removed" status. If a
  copy leaves the collection, its instance row is deleted (`Remove` in the modal), the
  same as any other removal — the Master Collection flag has no special deletion path.
  Any record of *what* moved and *why* is manual, kept in §5 below, not in the database.

## 2. Data model

Two independent pieces, both added in `migrations/009_master_collection.sql`:

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
  badge" chip in the main header links to a Master Collection view, reusing
  `InventoryView` with a `masterOnly` filter rather than a new component/route with
  its own layout (§4). The badge's full 150px ceremonial design (see
  `Master Collection Chip.html` / `README_Master_Collection.md` design handoff, "05d")
  didn't fit the ~116px header chrome — scaled down to a compact `.invk`-style KPI
  chip instead, keeping the gold star + ring motif but dropping the three-star/thread
  detail, which doesn't read at that size.
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

### Header badge + Master Collection view (`web/src/app-inventory.jsx`)

- **Header badge chip** — `.invk--master` in the `.inv-kpis` row (right side of the
  main header, alongside Unique/Total/Complete). Renders `MasterBadge`
  (`web/src/app-detail.jsx` — a gold/paper/ink ringed circle with a gold star, a
  compact reinterpretation of the design handoff's "05d" badge) plus the collection-
  wide `{metSum}/{targetSum}` fraction (every figure/variant's `Math.min(starred,
  target)` summed over its target — see `JoeStore.masterTotals()` in `store.js`).
  Clicking it navigates to the Master Collection view; while on that view the chip
  gets an `.is-active` gold-tinted state and clicking it again returns to Figures.
- **Master Collection view** — `main.jsx` tracks a third `page` value,
  `'master-collection'`, passed into `InventoryView` as a `masterOnly` prop rather
  than a distinct component. `masterOnly` adds one predicate (`passMaster`) to the
  existing year-grouped filter pipeline: a figure only shows if at least one of its
  copies is starred (not merely `target > 0`, since every figure defaults to a
  target of 1 — that would show the whole catalog). All existing Figures-page
  filters (status chips, faction/completeness/copies facets, search, List/Gallery)
  still work, now scoped to that starred subset. The three KPI chips swap labels to
  Master-Collection-specific stats (`Figures In` / `Starred Copies` / `Target
  Filled`, from `JoeData.masterTotals()`), and the "Figures" nav button loses its
  `is-active` state (now clickable, navigating back). Because it's the same
  component instance, not a remount, local UI state (expanded rows, search query,
  active filters) persists across a Figures ↔ Master Collection round-trip.

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
