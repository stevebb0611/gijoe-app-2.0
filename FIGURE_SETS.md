# Figure Sets — multi-pack grouping display

> Companion to `ACCESSORY_GROUPS.md`/`FIGURE_SPLITS.md`/`MAIL_RELEASES.md` — this doc is the
> per-set operational log for a fun bonus completionist display: some vintage figures were
> originally sold bundled as a 2-pack/3-pack "set" rather than individually. This is a **pure
> grouping/display layer over already-ownable catalog figures** — it never creates a new
> ownable entry, and it doesn't change how any individual figure's own completeness works.
> Every set gets one entry below, confirmed against a real reference before being added —
> same discipline as every sibling doc.

## What a "set" is here

`figure_sets` + `figure_set_members` (`migrations/015_figure_sets.sql`) link existing
`figures.id` rows together with a **required quantity per figure** — not just presence. The
one confirmed example needs this: the 1982 JC Penney Cobra 3-pack needs **2** copies of
Cobra v1, not 1, plus 1 Cobra Officer v1. A figure can belong to more than one set in
principle (many-to-many), though in practice most figures belong to none.

**v2 (migration 016): instance-level tagging, not a count.** v1's progress math counted
*any* owned copy of a member figure, capped at the required quantity — it couldn't tell
which specific physical copies actually came from a given pack if the owner owned more
copies than the pack needed. `instances.set_id` (nullable, `ON DELETE SET NULL`) now lets a
specific owned copy be explicitly tagged as one of a set's slots — matching a real MOC
2-pack/3-pack as the single physical unit it is. Tagging happens via one more field on the
*normal* Add Figure flow and the *normal* Detail-modal edit (no separate bulk "Add Set"
flow) — see `web/src/set-card.jsx`'s header comment and `app-detail.jsx`/`app-add-figure.jsx`.

Progress is computed client-side (`web/src/store.js`'s `setProgress(setId)`/
`setSlots(setId)`, reading `instances.set_id`), same "cap each member's contribution at its
own required quantity, sum" idiom `masterTotals()` already uses for Master Collection — not
stored anywhere. **Known limitation:** hiding retailer-exclusive accessories from a member
figure's own Detail modal (below) is figure-level (`fig.sets.length > 0`), not tag-level — an
untagged copy of a set-member figure has no UI surface left to record loose retailer-
exclusive accessory ownership. Not an active problem with today's data (checked at build
time), but worth knowing if it ever comes up.

## Not the same thing as `ACCESSORY_GROUPS.md`'s `retailer_exclusive` mechanism

The 1982 JC Penney Cobra 3-pack is already documented there, at the *accessory* level:
Cobra v1's swapped M-16/Bipod-or-Bazooka gear and Cobra Officer's swapped Mortar+Stand are
tagged `figure_accessories.release_context = 'retailer_exclusive'` (migration
`012_retailer_exclusive_context.sql`) — that's about which *accessories* on an otherwise-
normal figure came from the pack, and never blocks that figure's own Complete status. This
doc is the *figure-level* grouping — "these figures were sold together" — a different axis.
The two docs describe the same real-world pack from two different angles; keep them in sync
when either is touched (JC Penney's `figures.id` 3/5 match `ACCESSORY_GROUPS.md`'s
"figure catalog id" citations for the same two figures).

Also not the same thing: a figure sharing a mold/box with *unrelated* other figures (a
carded 2-pack that's really "two individually-collectible figures happened to ship in one
blister") isn't a set worth logging here unless the pack itself is the meaningful
completionist unit the owner wants to track — use judgment, and when in doubt, ask before
adding a marginal case.

## Data model

`figure_sets` (`set_id`, `name`, `year`, `description`) and `figure_set_members` (`set_id`,
`figure_id`, `quantity_required`) — a many-to-many junction, not a single `figures.set_id`
column, matching this schema's existing junction-table convention
(`figure_accessories`/`figure_coo`/`figure_file_cards`) rather than `sub_group_id`'s
single-FK convention. `figure_set_members.set_id` is `ON DELETE CASCADE` — deleting a set
definition removes its membership rows.

`instances.set_id` (migration 016, nullable, `ON DELETE SET NULL` — deliberately *not*
`CASCADE` like `figure_set_members`, since deleting a set definition should clear the tag on
a real owned copy, never delete the physical-copy row itself) marks a specific owned
instance as one of that set's slots.

**Reseed caveat:** a from-scratch `npm run seed` does **not** repopulate `figure_sets`/
`figure_set_members` — same limitation `figure_coo` already has (that one's populated by the
separate `server/import-coo.mjs`, not by `gijoe_collection.sql`'s inline seed data, for the
identical reason: the inline seed section runs before any `figures` rows exist from the
CSVs, so it can't reference a `figure_id`). Recovery after a reseed means replaying the
confirmed-set entries below, one `add-figure-set.mjs` command per entry (or pasting each
entry's logged `INSERT OR IGNORE` SQL directly) — `instances.set_id` tags themselves are
lost too in that scenario (instances aren't preserved across a from-scratch reseed at all,
same as every other per-copy field) and would need re-tagging via the Detail modal.

## UI surface

- **Special Release set card** (`web/src/set-card.jsx`, rendered only inside
  `app-inventory.jsx`'s `SPECIAL_RELEASE_YEAR` section) — one card per confirmed set, a black
  header (name + live `owned/required`) that expands to one row per slot
  (`JoeData.setSlots(setId)`): a tagged instance shows its own retailer-exclusive accessory
  checklist (editable inline) or a MOC badge if sealed; an empty slot is a ghost "+ Add" row
  that opens the normal Add Figure flow for that member figure with the set pre-selected.
- **Tagging a copy**: a "Part of set" field in Add Figure's DETAILS step (shown only when the
  figure has `sets.length`), and the same choice re-editable per-instance in the full Detail
  modal (`web/src/app-detail.jsx`) — both write `instances.set_id` via the normal
  `JoeStore.addInstance`/`updateInstance` API, no bespoke bulk-add flow.
- **Base figure Detail modal**: shows the `SET` badge (a static "see Special Release"
  pointer, no recomputed progress) but no retailer-exclusive accessory rows and no
  owned/required breakdown once `fig.sets.length > 0` — that detail lives only in the set
  card now, decluttering what used to be a redundant badge+text+checklist repeat.

## Tooling

`server/add-figure-set.mjs` — CLI helper, mirrors `server/add-figure.mjs`'s shape
(`--flag value` parsing, one invocation per set — sized for dozens of future additions, not
an in-file specs array to hand-edit each time):

```
node server/add-figure-set.mjs --name "..." --year YYYY --description "..." --members "figureId:qty,figureId:qty"
node server/add-figure-set.mjs --search-figures "<text>"
node server/add-figure-set.mjs --delete <setId>
```

On success it prints the created `set_id` plus the literal `INSERT OR IGNORE` SQL for that
set — log that alongside the CLI command in this doc's per-set entry, so the full list is
reconstructable from this doc alone. Restart the backend after (`npm start` — no
hot-reload); the catalog also only loads once per page load, so reload the app tab too.

## Scope discipline

**Do not add an entry here without a real reference or the owner's own physically-owned
set.** Guessing at what was "probably" sold together bakes in bad data the same way guessing
at a release-edition split would — see `FIGURE_SPLITS.md`'s identical rule. A pack that
turns out to be two unrelated figures that just happened to ship together isn't worth
logging unless it's a genuine completionist unit (see above).

## Sets (chronological by year)

### 1982 — JC Penney Cobra 3-Pack

- **Members:** Cobra v1 (figure id 3) ×2, Cobra Officer v1 (figure id 5) ×1.
- **Cross-ref:** `ACCESSORY_GROUPS.md`'s 1982 Cobra / Cobra Officer entries — same real-world
  pack, accessory-level swap detail (M-16/Bipod vs. Bazooka on the two Cobras; Mortar +
  Bipod Stand on the Officer).
- **Source:** YoJoe.com, cited 2026-07-16/19 in `ACCESSORY_GROUPS.md`.
- **Reconstruction record:**
  ```
  node server/add-figure-set.mjs --name "1982 JC Penney Cobra 3-Pack" --year 1982 \
    --description "Retail-exclusive 3-pack: two Cobra v1 (one with M-16/Bipod, one with a Bazooka) + one Cobra Officer v1 (Mortar + Bipod Stand). See ACCESSORY_GROUPS.md." \
    --members "3:2,5:1"
  ```
  ```sql
  INSERT OR IGNORE INTO figure_sets (set_id, name, year, description) VALUES
      (1, '1982 JC Penney Cobra 3-Pack', 1982, 'Retail-exclusive 3-pack: two Cobra v1 (one with M-16/Bipod, one with a Bazooka) + one Cobra Officer v1 (Mortar + Bipod Stand). See ACCESSORY_GROUPS.md.');
  INSERT OR IGNORE INTO figure_set_members (set_id, figure_id, quantity_required) VALUES
      (1, 3, 2), (1, 5, 1);
  ```
- **Status:** ✅ seeded directly via `migrations/015_figure_sets.sql` (schema + this one
  entry, applied straight to the live DB rather than via the CLI since it was the first
  entry and the tooling didn't exist yet), verified via `/api/catalog`.

Future sets get appended here one at a time as the owner identifies/confirms them — this
doc is explicitly not meant to be exhaustive at launch; dozens more are expected over time.
