# File Cards — reusable style catalog (`file_cards` · `figure_file_cards`)

Companion to the file-card notation on `instances` (`filecard_on_file` + `filecard_id`,
see `INSTANCE_MODEL.md`). File card (on-file/not, and which printing) is tracked per
copy as a notation — it does **not** feed the completeness percentage.

**This catalog is a slow, ongoing effort — ownership tracking does not wait on it.**
`instances.filecard_color`/`filecard_grade` (migration 019) are a lightweight,
always-available pair of fields for what the owner actually has in hand: a hand-typed
color note (e.g. "Peach", "Gray") and a coarse `Poor`/`Good`/`Mint` grade for the physical
card. Both are independent of `filecard_id` and of this catalog being populated — set from
the FILE CARD box in the detail modal / Add Figure CONDITION step (`web/src/filecards.jsx`'s
`FileCardColorInput`/`FileCardGrade`) any time a copy is marked on file, whether or not its
printing has been identified below.

## The problem this replaces

The original prototype (and the first live port) hard-coded one **generic** 3-entry
printing list (`A - First print` / `B - Reissue '85` / `C - Mail-away`) shared by every
figure in the collection. Real vintage file cards vary — card-back color, logo (G.I. Joe
vs. Cobra), text/print differences — so a fixed global list can't represent them
accurately.

**A first attempt at fixing this (2026-09-10) got the shape wrong** — it treated
`file_cards` as a per-figure log (one code minted per figure's story: "Cobra Commander's
red backing," "Spirit's 1984 bio") instead of a shared reference catalog. That's backwards:
`file_cards` should work exactly like `gijoe_db_accessories.csv` — a catalog of distinct,
**reusable physical styles**, joined to figures via `figure_file_cards` the same way
accessories join to figures via `figure_accessories`. Most figures just *link* to an
existing style (two figures with the same-color, same-logo card don't need two `file_cards`
rows). That first attempt (`FC001`–`FC010`) was deleted and rebuilt under the model below
— see [[project_file_cards_catalog_planned]] in project memory for the full history if
picking this up again.

## Data model

- `file_cards` — one row per distinct **reusable printing style**, not per figure.
  Carries `card_back`/`card_color` (for the swatch — resolved through the same
  `colorFor()`/`AccSwatch` used for accessory colors), `release_type`, `logo_version`,
  `text_version`, `country`, `notes`. A style can differ from another on any one of these
  independently — e.g. same `card_back` color but different `text_version` (a bio line
  edited out in a later print run).
- `figure_file_cards` — many-to-many join (`figure_id`, `file_card_id`). One style can
  apply to many figures (a base color/logo combo used line-wide); one figure can have
  several styles (it shipped across more than one printing).
- `instances.filecard_id` — nullable FK into `file_cards`. `NULL` is a legitimate state:
  the copy is marked on-file but the specific printing hasn't been identified/catalogued
  yet.

### Code numbering — blocked by category, not sequential

Mirrors the accessory-ID convention (`A17xx` → `A18xx` → `A19xx`): each category gets a
reserved range with headroom for corrections/insertions, rather than tight sequential
packing. 3-digit codes (`FC001`, not `FC0001`).

| Block | Category | Notes |
|---|---|---|
| `FC001`–`FC025` | Base color × logo combinations | One entry per distinct retail card color, ×2 when both G.I. Joe-logo and Cobra-logo versions exist. Reusable across the whole line — most figures just link here. |
| `FC026`–`FC029` | *(gap — buffer)* | |
| `FC030`–`FC049` | Release-type | Non-standard-retail packaging: Red Back (mail-away premium), Mail-In, Bubble Card, convention-exclusive, etc. Reusable across every figure that shipped that way. |
| `FC050`+ | Figure-specific variants | Bio-text edits, card-art redesigns (e.g. a headshot-only portrait later redrawn to torso-and-head) — generally **not** reusable across figures, but still get their own catalog code. Introduced chronologically as discovered, not tied to figure order. |

**Reuse rule:** before minting a new code, check whether the figure's actual card matches
an existing `FC001`–`FC049` entry. A new figure with a plain Peach/G.I.-Joe-logo card links
to the existing Peach/G.I. Joe code — it does not get a new row. Only mint a new code when
an attribute genuinely isn't covered by anything already catalogued.

## Tooling

Two hand-maintained CSVs at the repo root are the source of truth, synced into the DB by
`server/migrate-file-cards.mjs` (`node server/migrate-file-cards.mjs`, safe to re-run any
number of times):

- **`gijoe_db_file_cards.csv`** — one row per distinct style: `file_card_code` (unique,
  next free number **within the correct block** — see table above), `code_name` (the
  figure it was first identified on, for reference only — not a scoping key), `release_type`,
  `card_back`, `card_color`, `logo_version`, `text_version`, `country`, `notes`. Leave a
  column blank if unknown.
- **`gijoe_db_figure_file_cards.csv`** — one row per figure ↔ style link: `code_name`,
  `file_card_code`, `figure_id` (**set this explicitly whenever `code_name` could match
  more than one catalog row** — e.g. a figure with multiple versions like Cobra Commander
  or Clutch — otherwise the script resolves to the lowest matching id, which is often
  wrong), `is_original`, `notes`.

Upserts: re-running after editing a CSV row updates the matching DB row (matched on
`file_card_code`, or `(figure_id, file_card_id)` for links) rather than skipping it.

## Building this out — phased, catalog-first

1. **Base catalog (`FC001`–`FC025`)** — one dedicated research pass across the whole
   1982–1994 line: every distinct retail card-back color, × G.I. Joe/Cobra logo where both
   exist. Not figure-by-figure — this is a bounded, well-sourced question answered once.
2. **Release-type catalog (`FC030`–`FC049`)** — same approach for Red Back/Mail-In/Bubble/
   convention-exclusive packaging.
3. **Figure-specific variants (`FC050`+)** — bio/art edits, added as discovered while
   matching figures against the base catalog (step 4) turns them up.
4. **Match figures to the catalog (ongoing)** — for each figure, link to whichever
   base/release-type code(s) it actually used, and add a `FC050`+ code only if it also has
   a genuine figure-specific variant. Should mostly be quick lookups against an
   already-built reference, not fresh research per figure — the outcome of doing 1–3 first.

**Worklist:** `server/export-catalog-snapshot.mjs` dumps `v_figures_missing_file_card` (a
DB view — figures with no `figure_file_cards` row yet) as
`v_figures_missing_file_card.csv` in every `npm run export-catalog` snapshot.

**Sourcing rule — no invented facts:** every entry needs a real source — the owner's own
card/photo, or an explicitly cited external reference. Never fabricate a color/logo/text
detail from memory. **yojoe.com's main site (all paths, including `/action/` and
`/cardback/`) is gated behind a bot-paywall as of 2026-09** and can't be fetched directly —
use `forums.yojoe.com` (community compilation threads, still reachable) and established
dealer/grading-listing sites (e.g. dallasvintagetoys.com) instead; treat these as workable
but somewhat lower-confidence than a direct card-back scan.

## Catalog (empty — rebuild in progress)

Base color/logo catalog, release-type catalog, and figure-specific variants all deleted
2026-09-23 pending the phased rebuild above. No entries yet.

<!-- FC001-FC025 (base color/logo), FC030-FC049 (release-type), and FC050+
     (figure-specific) entries go here as they're researched. -->
