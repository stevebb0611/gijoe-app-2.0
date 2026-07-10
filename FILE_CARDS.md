# File Cards — per-figure printing catalog (`file_cards` · `figure_file_cards`)

Companion to the file-card notation on `instances` (`filecard_on_file` + `filecard_id`,
see `INSTANCE_MODEL.md`). File card (on-file/not, and which printing) is tracked per
copy as a notation — it does **not** feed the completeness percentage.

## The problem this replaces

The original prototype (and the first live port) hard-coded one **generic** 3-entry
printing list (`A - First print` / `B - Reissue '85` / `C - Mail-away`) shared by every
figure in the collection. Real vintage file cards vary by figure — card-back color,
logo (G.I. Joe vs. Cobra), text/print differences — so a fixed global list can't
represent them accurately. `file_cards` + the `figure_file_cards` join table (schema
already present in `gijoe_collection.db`, unused until this doc/script populated it)
model this as a real per-figure relationship instead, the same shape as `variant_lookup`
and the `ACCESSORY_GROUPS.md` worklog: a chronological, hand-researched log, synced into
the DB by `server/migrate-file-cards.mjs`.

## Data model

- `file_cards` — one row per distinct printing (`file_card_code` unique, e.g. `FC001`),
  carrying `card_back`/`card_color` (for the swatch — resolved through the same
  `colorFor()`/`AccSwatch` used for accessory colors), `release_type`, `logo_version`,
  `text_version`, `country`, `notes` (free-text identifying description). Printings can
  differ on any one of these independently — e.g. two rows can share the same `card_back`
  but have different `text_version` (Zartan's "schizophrenia" bio line being edited out in
  a later print run, same card color, is the canonical example). All populated fields
  surface in the app's file-card "tell" line, not just color.
- `figure_file_cards` — many-to-many join (`figure_id`, `file_card_id`), so one printing
  can apply to more than one catalog row and one figure can have several printings.
- `instances.filecard_id` — nullable FK into `file_cards`. `NULL` is a legitimate state:
  the copy is marked on-file but the specific printing hasn't been identified/catalogued
  yet (common for every figure until it gets a `FILE_CARDS.md` entry below).

## Tooling

Two hand-maintained CSVs at the repo root are the source of truth, synced into the DB by
`server/migrate-file-cards.mjs` (`node server/migrate-file-cards.mjs`, safe to re-run any
number of times):

- **`gijoe_db_file_cards.csv`** — one row per distinct printing: `file_card_code`
  (unique, e.g. `FC001` — pick the next free number), `code_name`, `release_type`,
  `card_back`, `card_color`, `logo_version`, `text_version`, `country`, `notes`. Leave a
  column blank if you don't know that value yet.
- **`gijoe_db_figure_file_cards.csv`** — one row per figure ↔ printing link:
  `code_name`, `file_card_code`, `figure_id` (optional — only needed if `code_name`
  matches more than one catalog row and you need a specific version; otherwise leave
  blank and the script resolves to the lowest matching id, warning if there was more than
  one match), `is_original`, `notes`.

Unlike `server/migrate-accessory-groups.mjs` (a small array added to once per figure and
rarely revisited), this script **upserts**: re-running it after editing a CSV row updates
the matching DB row (matched on `file_card_code`, or `(figure_id, file_card_id)` for
links) rather than skipping it, so corrections and new rows both just work on the next
run. To add a figure: append rows to both CSVs, add a worklog entry below, then re-run
the script.

## Figures (chronological by year of release, then by catalog id)

### 1982 — Breaker (v1, figure catalog id 1)

- **Printings researched:** 2
  - `FC001` — **Carded Tan**: first-print retail card, tan card back.
  - `FC002` — **Mail-Away, Red Backed**: mail-away premium offer, glossy red card back.
- **Source:** owner-supplied (2026-07-07), working example for the `file_cards` /
  `figure_file_cards` schema.
- **Existing instance fixup:** instance `id=13` (this figure) had the old free-text
  `filecard_printing = 'A'` (meant "first print" under the retired 3-letter scheme) —
  migrated to `filecard_id` = `FC001` ("Carded Tan"), the matching real printing.
- **Status:** ✅ seeded in DB and verified via API round-trip.

<!-- Add the next figure's entry above this line, same shape as Breaker's. -->
