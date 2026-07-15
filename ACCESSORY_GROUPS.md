# Accessory Groups — grouped accessory slots (`group_id` · `match_key` · `release_context` · `variant_id`)

> Companion to `PARTS_BIN.md` → "Accessory completeness model." That doc locks the general
> rules for two axes on `figure_accessories`: `group_id` (own any one member of a slot) and
> `release_context` (retail vs tracked-but-non-blocking) — read it first for the rule
> definitions. This doc is the **per-figure operational log** for all four axes: every
> figure with a `group_id` slot, every figure whose blueprint carries a non-`retail`
> `release_context` accessory (convention/bonus/mail-in/exclusive), and every figure with a
> `variant_id`-scoped row, gets one entry below, chronological by year of release then
> alphabetical. Most figures use plain `group_id` only ("pick one"); a subset also need
> `match_key`, a narrower mechanism layered on top of `group_id` for a specific case those
> two don't cover (see "The problem" below); a third, independent case needs neither — it's
> logged solely for a non-retail `release_context` accessory, tagged **Mechanism:
> `release_context`**; a fourth, also independent, is a row exclusive to one production
> variant, tagged **Mechanism: `variant_id`** (see that section below). Each entry's
> **Mechanism:** line says which applies — the behavior differs, so don't assume from the
> figure alone.

## The problem match_key solves

Some figures were manufactured in two (or more) colorways, and the accessories that came
with each colorway are themselves colored to match. The catalog only has one row per
figure (production variants fold into `variant_lookup`, not separate catalog rows — see
`VARIANTS.md`), so a colorway's accessories all end up as siblings in one flat blueprint
list. Grouping same-*item* accessories together with plain `group_id` ("own any one
Submachine Gun") is necessary but not sufficient: it lets you pick a light-green gun and a
dull-green radio and still show Complete, which never happened on a real card — the pieces
that shipped together were always the same color.

**Rule:** when two or more `group_id` slots are tagged with `match_key`, the figure is only
Complete if **one `match_key` value satisfies every tagged slot together** — own the full
light-green set, or the full dull-green set, never a mix. Figures with **no** `match_key`
tag on any slot use the plain `group_id` rule instead: own any one member, independently,
per slot — see `PARTS_BIN.md` for that rule's full definition.

## Data model

`figure_accessories.match_key` (`TEXT`, nullable) — migration `003_match_key.sql`. A tag
shared by the members of *different* `group_id` slots that must be chosen together.

```
group_id  slot            accessory                   match_key
--------  --------------  --------------------------  ---------
9         Submachine Gun  A0078 (light green)          A
9         Submachine Gun  A0079 (dull green)            B
10        Walkie-Talkie   A0080 (light green)           A
10        Walkie-Talkie   A0081 (dull green)            B
```

Completeness (`web/src/store.js`, `clusterBlueprint`/`matchedSetSatisfied`): groups with no
`match_key` on any member keep the plain "own any one" rule, unaffected. Groups that do
carry a `match_key` are pulled into a separate bucket and evaluated together — the whole
bucket counts as **one** required unit toward `bpReq`/`instOwn` (not one per slot), and is
only satisfied when a single tag value resolves every slot in the bucket.

## The name-collision bug this exposed

Ownership is tracked by accessory **name**, scoped to one figure
(`server/instances.js` — `instance_accessories` keys off a name → id lookup that assumes
names are unique within a figure's blueprint). Any figure needing `match_key` almost by
definition has two same-named accessories (that's what makes them a matched set), which
broke that invariant — checking one color's option silently toggled both, because they
resolved to the same tracked row.

Fixed in `server/blueprint-names.js` (`disambiguateNames`), used identically by
`catalog.js` (what the frontend displays/tracks by) and `instances.js` (how a PATCHed name
resolves back to an `accessory_id`, both directions — write and `getState()` read). Appends
`(color)` to any accessory name that collides with a sibling in the same figure's blueprint;
falls back to a numbered suffix if color also collides. **Any figure added to this
document needs this fix — it isn't optional per-figure.**

## Tooling

1. Add the figure's `group_id` slots — extend the `GROUPS` array in
   `server/migrate-accessory-groups.mjs` (use `extGroupId: null` for slots not sourced from
   the CSV's group_id column, which is how Firefly's were built — see that file's comments
   for why the CSV column can't be trusted blindly).
2. Tag the matching members — `node server/set-match-key.mjs --figure <F-code> --accessory <A-code,...> --key <tag>`, once per color/tag.
3. Restart the backend (`npm start` — it doesn't hot-reload) so `catalog.js`/`instances.js` pick up the new data.

## Scope discipline (match_key tagging)

**Do not bulk-apply `match_key` from a duplicate-name or duplicate-color scan.** A repeated
accessory name is not reliable signal on its own — some duplicates are genuinely
independent required items that happen to share a name (Alley Viper's two *different*
orange Submachine Guns; Chun Li's three separate yellow Swords), not a matched-color set.
Every figure below tagged **Mechanism: `match_key`** was confirmed individually by the
owner before being added. Treat those entries as owner-reviewed ground truth, not a pattern
to extrapolate from. Plain-`group_id` entries below are a separate, bulk-sourced list (see
each entry's **Source:** line) — they were never `match_key` candidates in the first place.

## Considered, not applicable

Figures that look like match_key candidates (duplicate-colored accessories across two
group_id slots) but were confirmed by the owner to be independent "or" choices instead —
listed here so they aren't re-flagged by a future duplicate-color scan.

*(None currently outstanding. Blowtorch was the original case that prompted this section —
it's now filed as a normal chronological entry below, tagged **Mechanism: plain**, since it
does have `group_id` groups; see 1984 — Blowtorch.)*

## `release_context` mechanism (non-retail accessories, no `group_id`)

A figure can earn an entry below purely because part of its blueprint is tagged a
non-`retail` `release_context` (`convention` · `bonus` · `mail-in` · `exclusive`) — no
`group_id`/`match_key` involved. `PARTS_BIN.md` § *Accessory completeness model* has the
full rule; short version: these accessories pull into their own per-context group (e.g.
"Convention") at the point they fall in the blueprint, are tracked, and **never block
Complete/percent** for that figure. Tag these entries **Mechanism: `release_context`**.

**Scope discipline (same standard as match_key):** only add an entry here once the
non-retail tag is individually confirmed — don't bulk-write up every figure the DB
currently has flagged. As of 2026-07-10 the DB carries a generic `"Accessory Tree"` bonus
row (leftover sprue) bulk-tagged across ~96 figures via import — that's an unreviewed
artifact, not owner-confirmed, and is intentionally **not** enumerated below; see
"Non-retail backlog" at the end of this doc. (2026-07-11 update: a narrower category-level
form of confirmation is now also allowed — see "Category-level `release_context`
reclassification" immediately below.)

## Category-level `release_context` reclassification (2026-07-11)

Distinct from the figure-by-figure recall that produced the Figures entries below: the
owner scanned `accessory_categories` directly and confirmed that **every** accessory in
three whole categories is non-blocking, regardless of which figure it ships with — no
per-figure review needed since the category itself defines the mechanism (a decal/sticker,
a lump of sculpting putty, or a bundled cassette/VHS tape isn't a returnable, gradable
retail part).

**Categories marked `bonus`:** Decal (`accessory_categories.category_id` 39), Putty (48),
Cassette / VHS (52).

**Tooling:** `server/set-category-bonus.mjs` — bulk `UPDATE figure_accessories SET
release_context = 'bonus'` for every row whose accessory's `category_id` is in that list
and isn't already `bonus`. Re-runnable (only non-`bonus` rows are touched; a second run
reclassified 0). Only touches `figure_accessories.release_context` (what
`catalog.js`/`store.js` actually read for completeness) — leaves the unused
`accessories.release_context` top-level column at its default `retail`, same precedent as
every earlier entry in this doc (e.g. Duke's flag, Zartan's stickers).

**Already covered by earlier figure-specific entries (unaffected by this run — already
`bonus`):** Duke's American Flag (decal, A0044) and Zartan's four heat stickers (Decal)
— see their entries above.

**Newly reclassified (15 pairings across 14 figures), 2026-07-11:**

| Year | Figure | Category | Accessory |
|---|---|---|---|
| 1985 | Tripwire v2 | Cassette / VHS | Listen 'n Fun Cassette Tape (A0224) |
| 1986 | Claymore v1 | Cassette / VHS | Special Mission: Brazil Cassette Tape (A0236) |
| 1986 | Dial-Tone v2 | Cassette / VHS | Special Mission: Brazil Cassette Tape (A0236) |
| 1986 | Leatherneck v2 | Cassette / VHS | Special Mission: Brazil Cassette Tape (A0236) |
| 1986 | Mainframe v2 | Cassette / VHS | Special Mission: Brazil Cassette Tape (A0236) |
| 1986 | Wet-Suit v2 | Cassette / VHS | Special Mission: Brazil Cassette Tape (A0236) |
| 1987 | Gung-Ho v2 | Decal | Rank and Stripes (decal) (A0328) |
| 1990 | Rapid-Fire v1 | Cassette / VHS | Video Cassette Tape (A0781) |
| 1993 | Blast-Off v1 | Putty | Bio-Armor Putty (A1225) |
| 1993 | Clutch v3 | Putty | Bio-Armor Putty (A1246) |
| 1993 | Cyber-Vipers v1 | Putty | Bio-Armor Putty (A1283) |
| 1993 | Gung-Ho v5 | Putty | Bio-Armor Putty (A1351) |
| 1993 | Mega-Vipers v1 | Putty | Body-Armor Putty (A1410) |
| 1993 | Mirage v1 | Putty | Body-Armor Putty (A1417) |
| 1993 | Monstro-Vipers v1 | Putty | Body-Armor Putty (A1420) |

Note: Claymore/Dial-Tone/Leatherneck/Mainframe/Wet-Suit's Cassette Tape is one shared
accessory row (`accessories.id` 236) reused across all five figures' blueprints, not five
separate accessories.

**Status:** ✅ `release_context` set in DB via `server/set-category-bonus.mjs` and verified
via `/api/catalog` (Mirage, Rapid-Fire, Tripwire spot-checked), 2026-07-11. Not yet visually
verified in-app. None of these figures have a `group_id`/`match_key` slot, so no separate
Figures-list entry is needed for them individually — this table is their record instead.

**Scope discipline note:** this is a distinct, narrower exception to the rule above — it's
category-level owner confirmation ("every Decal/Putty/Cassette-VHS accessory, whichever
figure it's on"), not a bulk-write from an unreviewed import artifact like the "Accessory
Tree" backlog. Don't extend this precedent to other categories without the same explicit,
direct confirmation.

## match_key on non-retail (bonus/context) accessories

Zartan (below) is the first entry where `match_key` is set on accessories that are
also tagged a non-`retail` `release_context`. Traced through the code, `release_context`
wins outright — `clusterBlueprint` (`web/src/store.js`) filters to `retail` items
*before* it ever builds the `group_id`/`match_key` buckets, so a non-retail slot's
`group_id`/`match_key` never reaches `matchedSetSatisfied`. Confirms the intended
behavior: bonus items stay fully non-blocking regardless of match_key.

Display is a separate story: `orderedBlueprint` (`web/src/accessory-groups.jsx`)
also branches on `release_context` before `group_id` — every non-retail item lands in
one flat `ContextGroup`/`renderSolo` bucket, same as a context item with no `group_id`
at all. So today, `group_id`/`match_key` on a bonus item is bookkeeping only: it
doesn't (yet) render as a "pick one" option group with an A/B tag the way a retail
matched set does. Zartan's four stickers currently show as four flat rows under
"Bonus".

## `variant_id` mechanism (an accessory exclusive to one production variant)

A fourth, independent axis on `figure_accessories` — migration `007_variant_scoped_accessories.sql`.
`group_id`/`match_key`/`release_context` all describe *how* a blueprint row counts toward
Complete; `variant_id` describes *which copies the row applies to at all*.

**The problem:** production variants fold into one catalog row (the variant-collapse
rule — see `VARIANTS.md`), so when two variants of the same figure physically shipped
with different hardware, both variants' accessories land as siblings on one flat
blueprint list, same as a `match_key` colorway would. But a variant-exclusive part isn't
an "own any one" choice like a `group_id` slot — it's a hard requirement for *one*
variant and flatly doesn't exist for the other. Blocker (below) is the first case:
v1 B ("With visor, red inner arm") shipped with a Visor; v1 A ("No visor, black inner
arm") never did. Leaving the Visor as a plain, unscoped row meant every v1 A copy was
permanently marked incomplete for a part it physically cannot have.

**Rule:** `figure_accessories.variant_id` (`INTEGER`, nullable, FK → `variant_lookup.id`).
`NULL` (the default, and every pre-`007` row) = the row applies to every variant of the
figure, unchanged from before this column existed. Set = the row only counts toward, and
is only shown/checkable for, an **instance** (`instances.variant_id`) pinned to that exact
`variant_lookup` letter.

**Data model:**
```
figure_id  accessory        variant_id → letter
---------  ---------------  -------------------
132        Visor            109 → B
132        XL-13 Laser      (null — every variant)
```

**Completeness/display (`shared/completeness.js` `bpForVariant(bp, variantLetter)`):**
unlike the other three axes, this isn't handled inside `clusterBlueprint()` — it's
instance-specific (a figure's `bp` array has no single "variant" of its own), so every
caller filters with `bpForVariant()` *before* handing `bp` to `clusterBlueprint`/`bpReq`/
`instOwn`/`instPct`/`instWhole`/`missingList`/`orderedBlueprint`. Wired into: `store.js`
`figureSummary` (per-copy required/owned/whole/%/missing), `app-detail.jsx`'s Instance
Detail checklist, `app-add-figure.jsx`'s DETAILS checklist (scoped to whichever variant is
picked; nothing variant-exclusive shows before a variant is chosen), `parts-bin.jsx`'s
reverse-lookup needs list, and the Excel export.

**Rebalance engine scope boundary:** `figState()`'s ⚖ pooling/reshuffle math
(`app-detail.jsx`) assumes every loose copy of a figure owes the *same* blueprint — true
for the other three axes, not for `variant_id` (a v1 B-only Visor can't be "moved onto" a
v1 A copy). Rather than rework that engine's optimal-whole-copy math for heterogeneous
per-copy requirements, variant-scoped rows are excluded from its pooling input entirely
(`rebalanceBp = bp.filter(row => !row[7])`) — per-copy completeness above still requires
and displays them correctly, this only means the ⚖ suggestion engine won't try to
move/count a variant-exclusive part. Also prevents a real hazard: `applyRebalance`'s
write-back (`JoeStore.updateInstance(c.id, { acc: accMap })`) only touches names present
in `st._bp` (now `rebalanceBp`) — if a variant-scoped name had leaked into that set, the
write-back would upsert `0` for it on every copy the plan touches, silently wiping an
already-owned variant-exclusive part on copies whose variant it doesn't even apply to.

## Figures (chronological by year of release, then by catalog id)

### 1982 — Cobra (v1, figure catalog id 3 — source F-code F007)

- **Mechanism:** `release_context` — accessories tagged `convention` sit in their own
  group and never block Complete; no `group_id` on this figure.
- **Variants:** none on file — single catalog row (`display_name` "Cobra v1 A"; `alt_name`
  "Cobra Soldier or Cobra Trooper").
- **Non-retail accessories:** M-16 Heavy Machine Gun (A0013), Bipod (A0014), Bazooka
  single thin handle (A0028), Bazooka single thick handle (A0029) — all `release_context:
  'convention'`.
- **Unaffected (plain retail, required):** Dragunov (SVD) Sniper's Rifle (A0004) — the
  only accessory required for Complete.
- **Source:** live DB (`figure_accessories.release_context`), confirmed 2026-07-10. This
  is the canonical example already cited in `PARTS_BIN.md` § *Accessory completeness
  model* ("Cobra trooper" demo) — logged here as its own entry now that this doc's scope
  covers `release_context`.
- **Status:** data already set in DB; not newly changed by this doc.

### 1983 — Duke (v1, figure catalog id 27 — source F-codes F057–F061)

- **Mechanism:** `match_key` — tags `A`/`B` tie two `group_id` slots to the same colorway.
- **Variants:** F057 A / F058 B / F059 C / F060 D / F061 E — folded into one catalog row
  (id 27) per the standard variant-collapse rule (`VARIANTS.md`)
- **Matched pieces:** Helmet + M-32 "Pulverizer" Submachine Gun, tagged `A` or `B`. Unlike
  Firefly, the Helmet slot has three members, not two — a "green" tag can be satisfied by
  *either* of two different helmet molds:
  - Tag `A` ("green"): Helmet (with holes) light green (A0024, shared accessory — also used
    by 5 other figures) **or** Helmet (no holes) green (A0039) + Submachine Gun green (A0041)
  - Tag `B` ("bright green"): Helmet (with holes) bright green (A0040, Duke-exclusive) +
    Submachine Gun bright green (A0042, Duke-exclusive)
  - `matchedSetSatisfied` already supports multiple members per (slot, tag) — owning *any*
    tag-`A` helmet alongside the tag-`A` gun satisfies the bucket; no code change was needed.
- **Unaffected (plain, independently required):** Helicopter Assault Trooper Backpack,
  Binocular
- **Bonus (tracked, non-blocking):** American Flag (decal) — reclassified `retail` → `bonus`
  via `set-accessory-context.mjs`, 2026-07-03
- **Status:** ✅ implemented and verified (group_id + match_key set, API round-trip and
  `matchedSetSatisfied` unit-checked, 2026-07-03). Visually confirmed in-app 2026-07-06 —
  see `PARTS_BIN.md` §1: Helmet and Gun now render as two independent groups at their own
  blueprint positions (not merged into one block), each option tagged with its A/B badge.
  Toggling a tag-A option on each slot correctly resolved the bucket and pushed the copy
  to 100%; net toggling left the real instance's owned accessories unchanged.

### 1984 — Blowtorch (v1, figure catalog id 50 — source F-codes F086/F087/F088, variants A/B/C)

- **Mechanism:** plain `group_id` — own any one member of each slot below (no `match_key`
  tie between them).
- **Variants:** F086 A / F087 B / F088 C — folded into one catalog row (id 50) per the
  standard variant-collapse rule (`VARIANTS.md`).
- **Group_id slots:** Helmet / Helmet (with holes), both yellow (`accessory_groups.id` 1,
  ext CSV group `8401`); Flamethrower / Flamethrower, light green / dark green
  (`accessory_groups.id` 2, ext CSV group `8402`). Each slot is independently "own any
  one" — no color/mold pairing ties a specific helmet to a specific flamethrower. This is
  the case that originally prompted the "Considered, not applicable" section above; it
  looked like a `match_key` candidate but isn't one.
- **Source:** CSV `group_id` column, ext ids `8401`/`8402`.
- **Status:** ✅ group_id confirmed correct as-is; visually verified in-app and confirmed
  with owner, 2026-07-03.

### 1984 — Firefly (v1, figure catalog id 56 — source F-codes F096 / F097)

- **Mechanism:** `match_key` — tags `A`/`B` tie two `group_id` slots to the same colorway.
- **Variants:** F096 · A "Black eyes" / F097 · B "Brown eyes" — folded into one catalog row (id 56) with both letters in `variant_lookup`, per the standard variant-collapse rule (`VARIANTS.md`)
- **Matched pieces:** Submachine Gun + Walkie-Talkie, light green (tag `A`) or dull green (tag `B`)
- **Unaffected (plain, independently required):** Demolition Backpack, Demolition Backpack Cover
- **Status:** ✅ implemented and verified via API round-trip and in-app (2026-07-03).

### 1984 — Mutt (v1, figure catalog id 57 — source F-code F098)

- **Mechanism:** plain `group_id` — own any one member of the slot below.
- **Variants:** none on file — single catalog row.
- **Group_id slot:** Helmet / Helmet (with holes) (`accessory_groups.id` 3, ext CSV group
  `8405`).
- **Source:** CSV `group_id` column, ext id `8405`.
- **Status:** group_id set in DB; bulk-imported from the CSV column, not individually
  owner-verified in-app the way the `match_key` figures above were.

### 1984 — Recondo (v1, figure catalog id 58 — source F-code F099)

- **Mechanism:** `match_key` — tags `A`/`B` tie two `group_id` slots to the same colorway.
- **Variants:** F099 · A "green camo stripes" / F100 · B "dark olive camo stripes" — folded
  into one catalog row (id 58) per the standard variant-collapse rule (`VARIANTS.md`). Note
  `code_name = 'Recondo'` also matches a later Tiger Force v2 (id 194, F264) — the unqualified
  lookup in `migrate-accessory-groups.mjs` resolves to id 58 since it's the lower id, same
  pattern as Duke above.
- **Matched pieces:** Cross Country Backpack + M-14E2X Rifle, light green (tag `A`) or dark
  green (tag `B`). Source data had a typo — the dark-green Backpack's `accessories.name` was
  "Cross Country Packpack" — fixed to "Cross Country Backpack" so `disambiguateNames`
  collapses it onto the same slot as its light-green sibling instead of rendering as an
  unrelated fifth item.
- **Unaffected:** none — the full blueprint is just these two matched pairs.
- **Status:** ✅ implemented and verified, 2026-07-06. Both real owned copies (previously
  stuck at 50% complete, each showing the wrong-color counterpart as "missing") now correctly
  compute 100%/Complete against their own colorway. Verified via API round-trip
  (`/api/catalog` shows group_id 14/15 + match_key A/B, Backpack pair before Rifle pair,
  matching blueprint order) and in-app: both copies read 100%, each group renders as "Cross
  Country Backpack"/"M-14E2X Rifle" · MATCH A COLORWAY with light/dark-green options tagged
  A/B in that order. Also verified live that the damaged-flag toggle now renders before the
  match_key tag badge on a matched-slot row (`.acc__dmgflag` moved inside `.acc__namewrap`,
  ahead of `.acc__tag`, in `web/src/app-detail.jsx`'s `AccItem` — this is a global layout
  change, not scoped to Recondo).

### 1984 — Rip Cord (v1, figure catalog id 59 — source F-code F101)

- **Mechanism:** plain `group_id` — own any one member of each slot below.
- **Variants:** none on file — single catalog row.
- **Group_id slots:** Helmet / Helmet (with holes) (`accessory_groups.id` 4, ext CSV group
  `8408`); SLR-W1L1 Rifle / SLR-W1L1 Rifle (`accessory_groups.id` 5, ext CSV group `8409`).
- **Source:** CSV `group_id` column, ext ids `8408`/`8409`.
- **Status:** group_id set in DB; bulk-imported from the CSV column, not individually
  owner-verified in-app.

### 1984 — Roadblock (v1, figure catalog id 60 — source F-code F102)

- **Mechanism:** `match_key` — tags `A`/`B` tie two `group_id` slots to the same colorway.
- **Variants:** none on file — single catalog row. `code_name = 'Roadblock'` also matches 6
  later versions (v2–v7), but the lowest id (60, v1) is the one with these accessories, same
  pattern as Duke/Recondo/Spirit above.
- **Matched pieces:** M-2X Heavy Machine Gun + Tripod, green (tag `A`) or dark green (tag `B`)
  (`accessory_groups.id` 24/25). The CSV's own `group_id` column (ext `8410`/`8411`) cross-pairs
  MG+Tripod by color directly rather than as two same-item slots — not used, same reasoning as
  Firefly/Recondo/Spirit (see `migrate-accessory-groups.mjs` header); hand-built via
  `extGroupId: null` instead.
- **Unaffected (plain, independently required):** Helmet (no holes), Machine Gunner Backpack,
  Ammo Box — no color pairing ties these to a specific MG/Tripod colorway.
- **Source:** hand-built (`extGroupId: null`), owner-confirmed 2026-07-12.
- **Status:** ✅ group_id (24/25) + match_key A/B set and verified via API round-trip
  (`/api/catalog` shows both slots with group_id/match_key, `disambiguateNames` rendering
  "M-2X Heavy Machine Gun (green)"/"(dark green)" and "Tripod (green)"/"(dark green)") and
  direct DB read, 2026-07-12. Of the 3 real owned copies, two (ids 105/106) own the full green
  set and now correctly resolve complete on this slot (previously would have wrongly also
  required the dark-green counterparts); the third (id 107) is still missing a tripod of either
  color, unaffected by this fix. Not yet visually verified in-app.

### 1984 — Scrap-Iron (v1, figure catalog id 61 — source F-code F103)

- **Mechanism:** plain `group_id` — own any one member of the slot below.
- **Variants:** none on file — single catalog row.
- **Group_id slot:** Remote Activator (thin handle) / Remote Activator (thick handle)
  (`accessory_groups.id` 6, ext CSV group `8412`). This is the canonical "pick one" example
  cited in `PARTS_BIN.md` § *Accessory completeness model*.
- **Source:** CSV `group_id` column, ext id `8412`.
- **Status:** group_id set in DB; bulk-imported from the CSV column, not individually
  owner-verified in-app.

### 1984 — Spirit (v1, figure catalog id 62 — source F-code F104)

- **Mechanism:** `match_key` — tags `A`/`B` tie two `group_id` slots to the same colorway.
- **Variants:** F104 · A "large emblem on right arm" / F105 · B "small emblem on right arm" —
  folded into one catalog row (id 62) per the standard variant-collapse rule (`VARIANTS.md`).
  `code_name = 'Spirit'` also matches a v2 (id 253, F329) with an exact-match `code_name`; the
  v3/v4 rows have a trailing-space `code_name` ("Spirit ") so they don't collide with the
  unqualified lookup in `migrate-accessory-groups.mjs`, which resolves to id 62 (the lower id),
  same pattern as Duke/Recondo above.
- **Matched pieces:** Arrow Cassette Pack + Auto-Arrow Launcher, light green (tag `A`) or dark
  green (tag `B`). Both accessories' names already collided exactly pre-fix, so
  `disambiguateNames` was already appending "(light green)"/"(dark green)" — no name typo to
  fix here, unlike Recondo.
- **Unaffected (plain, independently required):** Belt (green/red), Freedom (Eagle, brown),
  Freedom Claw (brown).
- **Status:** ✅ implemented and verified, 2026-07-06. Verified via API round-trip
  (`/api/catalog` shows group_id 16/17 + match_key A/B, Arrow Cassette Pack pair before
  Auto-Arrow Launcher pair, matching blueprint order) and in-app: the fully-kitted dark-green
  copy reads 4/4 · 100% (previously would have read 6 required items, wrongly counting both
  colorways), with the Arrow Cassette Pack and Auto-Arrow Launcher each rendering as their own
  "· MATCH A COLORWAY" group, light-green (A) before dark-green (B), ahead of the three
  unaffected solo items in DB order.

### 1984 — Thunder (v1, figure catalog id 65 — source F-code F108)

- **Mechanism:** plain `group_id` — own any one member of the slot below.
- **Variants:** none on file — single catalog row.
- **Group_id slot:** Radio Headset / Radio Headset (`accessory_groups.id` 7, ext CSV group
  `8415`).
- **Source:** CSV `group_id` column, ext id `8415`.
- **Status:** group_id set in DB; bulk-imported from the CSV column, not individually
  owner-verified in-app.

### 1984 — Zartan (v1, figure catalog id 68 — source F-code F112)

- **Mechanism:** `match_key` — tags `A`/`B` tie two `group_id` slots to the same colorway
  (a sticker-sheet pairing, not a color pairing — see below).
- **Variants:** none on file — single catalog row. `code_name = 'Zartan'` also matches a
  later Ninja Force v2 (id 478, F578); the unqualified lookup in
  `migrate-accessory-groups.mjs` resolves to id 68 (the lower id), same pattern as
  Duke/Recondo/Spirit above.
- **Not a colorway pairing** — the only match_key case so far that isn't about
  matching-colored pieces. Chest Armor and Thigh Pad each shipped with a heat sticker,
  and the sticker sheet came either single-sided or double-sided (not mixed) — Chest
  Armor Heat Sticker (single/double) and Thigh Pad Heat Sticker (single/double), tagged
  `A` (single) / `B` (double).
- **All four are `release_context: 'bonus'`** (reclassified `retail` → `bonus` via
  `set-accessory-context.mjs`, 2026-07-06 — decals/stickers, non-blocking) — see "match_key
  on non-retail (bonus/context) accessories" above. `clusterBlueprint` filters to `retail`
  before building match_key buckets, so this match_key data has **no effect on
  Complete/percent** either way; it's recorded for when/if the Bonus section's display
  is extended to honor group_id (currently it renders as four flat rows, no A/B tag).
- **Unaffected:** none — the full blueprint outside these four is Face Mask Disguise,
  Chest Armor, Left Thigh Pad, Right Thigh Pad, Backpack, Pistol (all plain retail solo
  items, no group_id).
- **Status:** ✅ group_id (accessory_groups.id 18/19) + match_key A/B set and verified via
  direct DB read, 2026-07-06/07. Not yet verified in-app since the Bonus section doesn't
  render group_id-based option groups today (see note above) — no visual change expected
  until that's built.

### 1985 — Crimson Guard (v1, figure catalog id 75 — source F-codes F120/F121)

- **Mechanism:** plain `group_id` — own any one member of the slot below. Not a
  `match_key` case — a single slot with three interchangeable molds/colors, not a
  cross-slot colorway tie (the AK-48AW Rifle outside the slot is solid black, no
  colorway to match).
- **Variants:** F120 · A "Lighter red uniform" / F121 · B "Darker red uniform" — folded
  into one catalog row (id 75) per the standard variant-collapse rule (`VARIANTS.md`).
  `code_name = 'Crimson Guard'` doesn't collide with the later Python/Immortal/Commander
  rows (different code_names), so the unqualified lookup in
  `migrate-accessory-groups.mjs` resolves unambiguously.
- **Group_id slot:** Dress Backpack (solid back), light red (A0161) / Dress Backpack
  (solid back), dark red (A0162) / Dress Backpack (hollow back), light red (A0163) —
  three interchangeable molds/colors, own any one (`accessory_groups.id` 21).
- **Unaffected (plain, independently required):** AK-48AW Rifle with Bayonet
- **Source:** CSV `group_id` column, ext id `8501`. Owner-confirmed 2026-07-07 as a
  plain "pick one of three" slot (not previously counted among the CSV's 8 trusted
  ext groups — see `migrate-accessory-groups.mjs` header — now the 9th).
- **Status:** ✅ group_id set in DB and verified via API round-trip
  (`/api/catalog` shows all three Dress Backpack accessories carrying group_id 21,
  no match_key; Rifle ungrouped), 2026-07-07. Not yet visually verified in-app.

### 1985 — Snow Serpent (v1, figure catalog id 89 — source F-code F137)

- **Mechanism:** `release_context` — accessories tagged `convention` sit in their own
  group and never block Complete; no `group_id` on this figure.
- **Variants:** none on file — single catalog row.
- **Non-retail accessories:** Missile Launcher (A0701), Missile (A0702) —
  reclassified `retail` → `convention` via `set-accessory-context.mjs`, 2026-07-10,
  owner-confirmed.
- **Unaffected (plain retail, required):** Survival Backpack (A0206), Parachute Pack
  (A0207), AK-47 Assault Rifle (A0208), Snow Shoe (A0209), Anti-Tank EK99 Missile (A0210),
  Missile Stand (A0211) — no `group_id` on any of these; the Anti-Tank EK99 Missile and
  Missile Stand are separate items from the convention Missile Launcher/Missile pair
  above, not the same accessories renamed.
- **Status:** ✅ release_context set in DB via `set-accessory-context.mjs` and verified
  via `/api/catalog`, 2026-07-10. Not yet visually verified in-app.

### 1985 — Flint (v1, figure catalog id 78 — source F-code F125)

- **Mechanism:** `release_context` — accessories tagged `convention` sit in their own
  group and never block Complete; no `group_id` on this figure.
- **Variants:** none on file — single catalog row.
- **Non-retail accessories:** Rifle (A0680), Grenade Launcher (Pistol) (A0681) —
  reclassified `retail` → `convention` via `set-accessory-context.mjs`, 2026-07-10,
  owner-confirmed.
- **Unaffected (plain retail, required):** Infantry Field Pack (A0173), I-12 Short
  Barrel Riot Shotgun (A0174).
- **Status:** ✅ release_context set in DB via `set-accessory-context.mjs` and verified,
  2026-07-10. Not yet visually verified in-app.

### 1986 — A.V.A.C. (v1, figure catalog id 96 — source F-code F145)

- **Mechanism:** plain `group_id` — own any one member of the slot below.
- **Variants:** none on file — single catalog row.
- **Group_id slot:** Parachute pack (soft plastic) / Parachute pack (hard plastic)
  (`accessory_groups.id` 8, ext CSV group `8601`). This is the other canonical "pick one"
  example cited in `PARTS_BIN.md` § *Accessory completeness model*.
- **Source:** CSV `group_id` column, ext id `8601`.
- **Status:** group_id set in DB; bulk-imported from the CSV column, not individually
  owner-verified in-app.

### 1986 — Dr. Mindbender (v1, figure catalog id 103 — source F-code F154)

- **Mechanism:** plain `group_id` — own any one member of the slot below. Not a
  `match_key` case — a single slot with two interchangeable applications of the
  same emblem, not a cross-slot colorway tie.
- **Variants:** none on file — single catalog row. `code_name = 'Dr. Mindbender'`
  also matches a later v2 (id 406, F500); the unqualified lookup in
  `migrate-accessory-groups.mjs` resolves to id 103 (the lower id), same
  pattern as Duke/Recondo/Spirit/Zartan/T.A.R.G.A.T. above.
- **Group_id slot:** Cobra Cape (patch) / Cobra Cape (iron-on) — two
  interchangeable ways the Cobra emblem was applied to the same cape, own any
  one (`accessory_groups.id` 22).
- **Unaffected (plain, independently required):** .45 Caliber Pistol, Electric
  Prod, Generator, Hose 6" Long (long).
- **Source:** hand-built (`extGroupId: null` in `server/migrate-accessory-groups.mjs`
  — not sourced from the CSV's `group_id` column), owner-confirmed 2026-07-11.
- **Status:** ✅ group_id set in DB and verified via API round-trip
  (`/api/catalog` shows both Cobra Cape accessories carrying group_id 22, no
  match_key), 2026-07-11. Not yet visually verified in-app.

### 1986 — Roadblock (v2, figure catalog id 115 — source F-code F167)

- **Mechanism:** `release_context` — accessories tagged `convention` sit in their own
  group and never block Complete; no `group_id` on this figure.
- **Variants:** none on file — single catalog row.
- **Non-retail accessories:** Machine Gun (A0787), Mine Launcher (A0793) —
  reclassified `retail` → `convention` via `set-accessory-context.mjs`, 2026-07-12,
  owner-confirmed.
- **Unaffected (plain retail, required):** L7A21 GPMG Heavy Machine Gun (A0264), Tripod
  (A0265) — the actual belt-fed gun + tripod pairing this figure shipped with; distinct
  items from the convention Machine Gun/Mine Launcher pair above, not the same
  accessories renamed.
- **Status:** ✅ release_context set in DB via `set-accessory-context.mjs` and verified
  (`Machine Gun (A0787): retail → convention`, `Mine Launcher (A0793): retail →
  convention`), 2026-07-12. Not yet visually verified in-app.

### 1986 — Serpentor (v1, figure catalog id 117 — source F-code F169)

- **Mechanism:** plain `group_id` — own any one member of the slot below. Not a
  `match_key` case — a single slot with five interchangeable colorways of the
  same item, not a cross-slot colorway tie (Snake Headdress, Dagger, and Cape
  don't pair to a specific snake color).
- **Variants:** none on file — single catalog row, no version collision.
- **Group_id slot:** Snake, gold (A0271) / bronze (A0272) / dark brown (A0273) /
  translucent brown (A0274, source data spells it "transulent brown") / green
  (A0275) — five interchangeable colorways, own any one
  (`accessory_groups.id` 23). All five share the identical accessory name
  ("Snake"); `disambiguateNames` appends each one's color, matching the
  Crimson Guard/Dress Backpack precedent.
- **Unaffected (plain, independently required):** Snake Headdress, Dagger, Cape.
- **Source:** hand-built (`extGroupId: null` in `server/migrate-accessory-groups.mjs`
  — not sourced from the CSV's `group_id` column), owner-confirmed 2026-07-11.
- **Status:** ✅ group_id set in DB and verified via API round-trip
  (`/api/catalog` shows all five Snake accessories carrying group_id 23, no
  match_key, each disambiguated by color), 2026-07-11. Not yet visually
  verified in-app.

### 1986 — Zarana (v1, figure catalog id 127 — source F-codes F182/F183/F184/F716, variants A/B/C)

- **Mechanism:** `release_context` — accessories tagged `convention` sit in their own
  group and never block Complete; no `group_id` on this figure.
- **Variants:** three production variants fold into this single catalog row — A
  ("Earrings, darker red gloves & kneepads") and B ("No earrings, lighter red gloves
  & kneepads") are retail; C ("No earrings") is the 1992 convention re-release. See
  `VARIANTS.md`.
- **Non-retail accessories:** Submachine Gun (A0822), Sword (barbed) (A0759) —
  reclassified `retail` → `convention` via `set-accessory-context.mjs`, 2026-07-12,
  owner-confirmed.
- **Blueprint correction:** Grenade-Adorned Quiver Backpack (A0284) and Harpoon Rifle
  (A0285) were removed from this figure's blueprint — a source-CSV data-entry error
  had duplicated Zandar's (1986, figure catalog id 126, F181) accessories onto
  Zarana's row; they belong to Zandar only, owner-confirmed. Fixed directly in
  `figure_accessories` (and the corresponding zero-owned `instance_accessories` rows)
  plus the source `gijoe_db_figures_accessories_group_id.csv` (F182 rows), 2026-07-12.
- **Unaffected (plain retail, required):** Backpack (A0286), Razor Honed Spur Cutting
  Weapon (A0287).
- **Status:** ✅ release_context set in DB via `set-accessory-context.mjs`
  (`Submachine Gun (A0822): retail → convention`, `Sword (barbed) (A0759): retail →
  convention`) and the blueprint correction applied directly to `figure_accessories` +
  source CSV, verified via SQL query, 2026-07-12. Not yet visually verified in-app.

### 1987 — Blocker (v1, figure catalog id 132 — source F-codes F190 A / F191 B)

- **Mechanism:** `variant_id` — the Visor is scoped to variant B only (see the
  "`variant_id` mechanism" section above); no `group_id`/`match_key` on this figure.
- **Variants:** F190 · A "No visor, black inner arm" / F191 · B "With visor, red inner
  arm" — folded into one catalog row (id 132) per the standard variant-collapse rule
  (`VARIANTS.md`).
- **Blueprint correction:** green Mouthpiece (A0297) and DK-528 Infra-Green Laser Pistol
  (A0298) were removed from this figure's blueprint — a source-CSV data-entry error had
  duplicated Blaster's (1987, figure catalog id 131, F189) accessories onto Blocker's row;
  they belong to Blaster only, owner-confirmed. No owned Blocker instance had ever
  recorded units for either, so no `instance_accessories` data was orphaned. Fixed
  directly in `figure_accessories`, 2026-07-12.
- **Variant-scoped:** Visor (A0299) — v1 B only (`variant_lookup.id` 109); a v1 A copy is
  never asked for it and can't check it off.
- **Unaffected (plain retail, required, every variant):** XL-13 Light Refraction
  Submachine Laser (A0300).
- **Status:** ✅ applied directly to `figure_accessories` (delete + `variant_id` scope) via
  `migrations/007_variant_scoped_accessories.sql`, verified against
  `v_figure_completeness`/`v_instance_missing_accessories` and the two owned v1 A
  instances (356, 357) re-evaluating correctly, 2026-07-12. Not yet visually verified
  in-app.

### 1987 — Dodger (v1, figure catalog id 138 — source F-code F198)

- **Mechanism:** plain `group_id` — own any one member of the slot below. Not a
  `match_key` case — a single slot with two interchangeable molds of the same
  item, same shape as Scrap-Iron's Remote Activator / Recoil's Mine Case above.
- **Variants:** none on file — single catalog row. `code_name = 'Dodger'` also
  matches a later v2 (id 268, F349), but the lowest id (138, v1) is the one
  with these accessories, same pattern as Duke/Recondo/Spirit/Zartan/Dr.
  Mindbender/T.A.R.G.A.T./Roadblock above.
- **Group_id slot:** Ultra-Sonic Photon Rifle (thin handle) / Ultra-Sonic
  Photon Rifle (thick handle) (`accessory_groups.id` 26).
- **Unaffected (plain, independently required):** Microphone.
- **Source:** hand-built (`extGroupId: null` in `server/migrate-accessory-groups.mjs`
  — blank in the CSV's `group_id` column for both A0315/A0316).
- **Status:** ✅ group_id set in DB and verified via direct DB read (figure_id
  138: A0315/A0316 both carry group_id 26, no match_key; Microphone
  ungrouped), 2026-07-13. Not yet visually verified in-app.

### 1987 — Falcon (v1, figure catalog id 139 — source F-code F199)

- **Mechanism:** `release_context` — accessories tagged `convention` sit in their own
  group and never block Complete; no `group_id` on this figure.
- **Variants:** none on file — single catalog row.
- **Non-retail accessories:** Rifle (A0692), Flare Gun (A0807) — reclassified
  `retail` → `convention` via `set-accessory-context.mjs`, 2026-07-13, owner-confirmed.
- **Unaffected (plain retail, required):** Special Forces Field Commications Pack
  Backpack (A0317), Antenna (A0318), 12-Gauge Pump Shotgun (A0319), Bowie Survival
  Knife (A0320).
- **Status:** ✅ release_context set in DB via `set-accessory-context.mjs` and verified
  (`Rifle (A0692): retail → convention`, `Flare Gun (A0807): retail → convention`) via
  SQL query, 2026-07-13. Not yet visually verified in-app.

### 1987 — Gung-Ho (v2, figure catalog id 142 — source F-code F203)

- **Mechanism:** `release_context` — accessories tagged `convention` sit in their own
  group and never block Complete; no `group_id` on this figure.
- **Variants:** none on file — single catalog row. Part of the parked mainline/convention
  `(code_name, version)` dedup collision noted in `OPEN_QUESTIONS_Claude.md` (F203 vs.
  the 700-block F702 row) — not resolved here; this entry only reclassifies the
  accessories already attached to the surviving F203 row, per owner instruction.
- **Non-retail accessories:** Kris (wavy) (A0758), Sword (barbed) (A0759) — reclassified
  `retail` → `convention` via `set-accessory-context.mjs`, 2026-07-13, owner-confirmed.
- **Unaffected:** Non-Com Dress Sabre (A0327) stays plain retail, required. Rank and
  Stripes (decal) (A0328) was already `bonus` (bulk Decal reclassification, 2026-07-11 —
  see the table above), untouched by this change.
- **Status:** ✅ release_context set in DB via `set-accessory-context.mjs` and verified
  (`Kris (wavy) (A0758): retail → convention`, `Sword (barbed) (A0759): retail →
  convention`) via SQL query, 2026-07-13. Not yet visually verified in-app.

### 1987 — Outback (v1, figure catalog id 152 — source F-code F213)

- **Mechanism:** `release_context` — accessories tagged `convention` sit in their own
  group and never block Complete; no `group_id` on this figure.
- **Variants:** none on file — single catalog row. Part of the parked mainline/convention
  dedup collision noted in `OPEN_QUESTIONS_Claude.md` (Outback is on the ~20-name list);
  not resolved here — this entry only fixes the accessories on the surviving F213 row,
  per owner instruction.
- **Blueprint correction:** Flashlight (black, A0463) removed outright — it belongs to
  Outback v2 (F262/id 192, the Toys R Us black-uniform release) only; a source-CSV
  duplication had leaked it onto v1's blueprint too, same bug class as the Blocker/Blaster
  mixup (`migrations/007_variant_scoped_accessories.sql`).
- **Non-retail accessories:** Rifle (white, A0647), Machine Gun (brown, A0652) —
  reclassified `retail` → `convention` via `set-accessory-context.mjs`, 2026-07-13,
  owner-confirmed.
- **New accessory:** the convention release also shipped its own Flashlight (green) —
  same name+color as the retail one (A0352), but a physically distinct pack-in, not a
  reused row (no spare green Flashlight existed anywhere else in the catalog to
  repurpose). Created `A1931` (`server/fix-outback-v1-blueprint.mjs`), attached
  convention-only.
- **Unaffected (plain retail, required):** Survival Backpack (A0349), Heckler & Koch G3
  Rifle (A0350), Web Belt (A0351), Flashlight (green, A0352, retail copy).
- **Bug found + fixed:** two rows sharing both name *and* color on one figure (retail vs.
  convention Flashlight, both "Flashlight"/green) exposed a latent bug in
  `server/blueprint-names.js`'s `disambiguateNames()` — its own header comment described a
  numbered-suffix fallback for this exact case ("even color collides") but never actually
  implemented it, so both rows rendered as the identical label "Flashlight (green)" and
  `instances.js`'s name→id `Map` silently collapsed them to whichever row sorted second
  (`instance_accessories` itself is keyed by `accessory_id`, so no stored ownership data
  was corrupted — this only affected live name resolution for toggling). Fixed with a
  second disambiguation pass keyed on the color-appended label; now renders "Flashlight
  (green) #1" (retail) / "Flashlight (green) #2" (convention). Also self-corrects four
  other figures with pre-existing, unrelated same-name-same-color collisions (Major Bludd
  v2, Mercer v2, Chun Li v1, Alley Viper v3) that had the same latent bug.
- **Status:** ✅ release_context/removal/new-accessory applied via
  `server/fix-outback-v1-blueprint.mjs`, `disambiguateNames()` fixed in
  `server/blueprint-names.js`, both verified via `/api/catalog` (blueprint shows Backpack/
  Rifle/Web Belt/Flashlight #1 retail, Rifle/Machine Gun/Flashlight #2 convention, no black
  Flashlight), 2026-07-13. Not yet visually verified in-app.

### 1989 — Countdown (v1, figure catalog id 220 — source F-code F294)

- **Mechanism:** plain `group_id` — own any one member of the slot below. Not a
  `match_key` case — a single slot with two interchangeable molds of the same
  item, same shape as Scrap-Iron/Recoil/Dodger's thin/thick-handle slots above.
- **Variants:** none on file — single catalog row. `code_name = 'Countdown'`
  also matches a later v2 (id 397, F491) and v3 (id 492, F592), but the lowest
  id (220, v1) is the one with these accessories, same pattern as
  Duke/Recondo/Spirit/Zartan/Dr. Mindbender/T.A.R.G.A.T./Roadblock/Dodger above.
- **Group_id slot:** Space Helmet (soft plastic) / Space Helmet (hard plastic)
  (`accessory_groups.id` 27).
- **Unaffected (plain, independently required):** Backpack, Grappling Hook,
  Counterweight, Pistol, String.
- **Source:** hand-built (`extGroupId: null` in `server/migrate-accessory-groups.mjs`
  — blank in the CSV's `group_id` column for both A0547/A0548).
- **Status:** ✅ group_id set in DB and verified via direct DB read (figure_id
  220: A0547/A0548 both carry group_id 27, no match_key), 2026-07-14. Not yet
  visually verified in-app.

### 1989 — Python Officer (v1, figure catalog id 240 — source F-code F316)

- **Mechanism:** `release_context` — accessories tagged `convention` sit in their own
  group and never block Complete; no `group_id` on this figure.
- **Variants:** none on file — single catalog row.
- **Non-retail accessories:** Pistol (A0626), Rifle (A0614) — reclassified `retail` →
  `convention` via `set-accessory-context.mjs`, 2026-07-14, owner-confirmed.
- **Unaffected (plain retail, required):** Dragunov (SVD) Sniper's Rifle (A0004) — the
  only accessory required for Complete.
- **Status:** ✅ release_context set in DB via `set-accessory-context.mjs` and verified
  via `/api/catalog` (`Pistol (A0626): retail → convention`, `Rifle (A0614): retail →
  convention`), 2026-07-14. Not yet visually verified in-app.

### 1989 — Python Tele-Viper (v1, figure catalog id 241 — source F-code F317)

- **Mechanism:** `release_context` — accessories tagged `convention` sit in their own
  group and never block Complete; no `group_id` on this figure.
- **Variants:** none on file — single catalog row.
- **Non-retail accessories:** Pistol (A0552), Knife (A0778) — reclassified `retail` →
  `convention` via `set-accessory-context.mjs`, 2026-07-14, owner-confirmed.
- **Blueprint correction:** Pistol (A0552) `quantity_required` raised 1 → 2 (the
  convention release requires two), applied directly to `figure_accessories`,
  2026-07-14, owner-confirmed.
- **Unaffected (plain retail, required):** Communications Backpack (A0215), Hose 6"
  Long (long) (A1902), VS-11 Scanner Rifle (A0216).
- **Status:** ✅ release_context/quantity set in DB via `set-accessory-context.mjs` +
  direct `figure_accessories` update and verified via direct DB read (`Pistol
  (A0552): retail → convention, qty 1 → 2`, `Knife (A0778): retail → convention`),
  2026-07-14. Not yet visually verified in-app.

### 1989 — Python Trooper (v1, figure catalog id 242 — source F-code F318)

- **Mechanism:** `release_context` — accessories tagged `convention` sit in their own
  group and never block Complete; no `group_id` on this figure.
- **Variants:** none on file — single catalog row.
- **Non-retail accessories:** AK-47 Assault Rifle, white (A0610) — reclassified
  `retail` → `convention` via `set-accessory-context.mjs`, 2026-07-14, owner-confirmed.
- **Catalog correction:** A0610 was misnamed "AK-47 Rifle" (inconsistent with A0006/
  A0208's "AK-47 Assault Rifle"); renamed to match. A0610 is used only by this figure,
  so the rename is scoped safely — no other figure's blueprint is affected. Applied
  directly to `accessories.name`, 2026-07-14, owner-confirmed.
- **Unaffected (plain retail, required):** AK-47 Assault Rifle, black (A0006) — the
  retail pack-in; distinct row from the white convention rifle above, disambiguated
  by color.
- **Status:** ✅ release_context/rename set in DB via `set-accessory-context.mjs` +
  direct `accessories` update and verified via direct DB read (`AK-47 Rifle → AK-47
  Assault Rifle (A0610): retail → convention`), 2026-07-14. Not yet visually verified
  in-app.

### 1989 — Recoil (v1, figure catalog id 245 — source F-code F321)

- **Mechanism:** plain `group_id` — own any one member of the slot below.
- **Variants:** none on file — single catalog row.
- **Group_id slot:** Mine Case (thin handle) / Mine Case (thick handle)
  (`accessory_groups.id` 13).
- **Source:** hand-built (`extGroupId: null` in `server/migrate-accessory-groups.mjs` — not
  sourced from the CSV's `group_id` column).
- **Status:** group_id set in DB; not individually owner-verified in-app.

### 1989 — T.A.R.G.A.T. (v1, figure catalog id 255 — source F-code F335)

- **Mechanism:** plain `group_id` — own any one member of the slot below. Not a `match_key`
  case — a single slot with three interchangeable molds, not a cross-slot colorway tie.
- **Variants:** none on file — single catalog row. `code_name` has a trailing space
  ("T.A.R.G.A.T. ") shared with a later v2 (id 472, F572) — the unqualified lookup in
  `migrate-accessory-groups.mjs` resolves to the lower id (255, v1), same pattern as
  Duke/Recondo/Spirit/Zartan above.
- **Group_id slot:** Laser Gun (rigid plastic) / Laser Gun (soft plastic, opened clip) /
  Laser Gun (soft plastic, closed clip) — three interchangeable molds, own any one
  (`accessory_groups.id` 20).
- **Source:** hand-built (`extGroupId: null` in `server/migrate-accessory-groups.mjs` — not
  sourced from the CSV's `group_id` column).
- **Status:** group_id set in DB; not individually owner-verified in-app.

### 1990 — Dial-Tone (v3, figure catalog id 266 — source F-code F347)

- **Mechanism:** plain `group_id` — own any one member of the slot below. Not a
  `match_key` case — a single slot, two interchangeable Sonic Backpack molds, same
  shape as Dodger(v1)/Countdown above.
- **Variants:** none on file — single catalog row.
- **Group_id slot:** Sonic Backpack (raised edges around buttons) / Sonic Backpack (no
  edges around buttons) (`accessory_groups.id` 28).
- **Catalog correction:** the "no edges around buttons" accessory row (A0710) carried
  two trailing tab characters baked into `accessories.name` (CSV import glitch,
  invisible in most views) — trimmed, 2026-07-15, owner-confirmed. Same fix applied to
  the five sibling rows below (A0718/A0732/A0741/A0825/A0839).
- **Unaffected (plain, independently required):** Battery Cover, Pistol, Machine Gun,
  Flamethrower, Grenade Launcher, Grenade Launcher Cylinder.
- **Source:** hand-built (`extGroupId: null` in `server/migrate-accessory-groups.mjs` —
  blank in the CSV's `group_id` column for both A0709/A0710), owner-found 2026-07-15.
- **Figure/accessory swap correction:** this whole 8-item set (A0709-A0716) was
  originally attached to figure catalog id **267 (Decimator v1, F348)** instead of
  266, and Decimator's real gear (Helmet A0707, Speargun A0708) was attached to 266
  instead of 267 — `gijoe_db_figures_accessories.csv` swapped the F-code on these two
  adjacent blocks (code_name label stayed correct, F-code didn't), and the live DB was
  originally seeded off that F-code column. `gijoe_db_accessories.csv`'s independent
  `host_figure` column had it right the whole time. Fixed directly in the DB —
  `migrations/010_dial_tone_decimator_swap.sql` — and in
  `server/migrate-accessory-groups.mjs` (`fcode` flipped from F348 to F347),
  owner-confirmed against the physical figure 2026-07-15.
- **Status:** ✅ group_id set in DB and figure/accessory assignment corrected, verified
  via direct DB read (figure_id 266: A0709-A0716 including group_id 28 on A0709/A0710;
  figure_id 267/Decimator: A0707/A0708), 2026-07-15. Not yet visually verified in-app.

### 1990 — Dodger (v2, figure catalog id 268 — source F-code F349)

- **Mechanism:** plain `group_id` — own any one member of the slot below.
- **Variants:** none on file — single catalog row. `Dodger` also matches an earlier v1
  (id 138, F198 — already grouped above for its own Ultra-Sonic Photon Rifle slot), so
  unlike the Duke/Recondo/Spirit/Zartan/…/Countdown cases above where the plain
  code_name lookup's "lowest id" happens to be the right figure, here it would resolve
  to the WRONG one — disambiguated via `fcode: 'F349'` in
  `server/migrate-accessory-groups.mjs`.
- **Group_id slot:** Sonic Backpack (raised edges around buttons) / Sonic Backpack (no
  edges around buttons) (`accessory_groups.id` 29).
- **Unaffected (plain, independently required):** Battery Cover, Submachine Gun, Rifle,
  Proton Rifle, Laser Rifle.
- **Source:** hand-built (`extGroupId: null`), owner-found 2026-07-15.
- **Status:** ✅ group_id set in DB and verified via direct DB read (figure_id 268:
  A0717/A0718 both carry group_id 29), 2026-07-15. Not yet visually verified in-app.

### 1990 — Lampreys (v2, figure catalog id 271 — source F-code F352)

- **Mechanism:** plain `group_id` — own any one member of the slot below.
- **Variants:** none on file — single catalog row. `Lampreys` also matches an earlier v1
  (id 84, F132, no `group_id` slot of its own) — disambiguated via `fcode: 'F352'`, same
  reason as Dodger above.
- **Group_id slot:** Sonic Backpack (raised edges around buttons) / Sonic Backpack (no
  edges around buttons) (`accessory_groups.id` 30).
- **Unaffected (plain, independently required):** Rifle, Submachine Gun with Silencer,
  Machine Gun with Bayonet, Battery Cover.
- **Source:** hand-built (`extGroupId: null`), owner-found 2026-07-15.
- **Status:** ✅ group_id set in DB and verified via direct DB read (figure_id 271:
  A0731/A0732 both carry group_id 30), 2026-07-15. Not yet visually verified in-app.

### 1990 — Law (v2, figure catalog id 273 — source F-code F354)

- **Mechanism:** plain `group_id` — own any one member of the slot below.
- **Variants:** none on file — single catalog row. `Law` also matches a later v3
  (id 432, F528) — the plain code_name lookup's "lowest id" already resolves correctly
  here, but `fcode: 'F354'` was used for consistency with the rest of this pass.
- **Group_id slot:** Sonic Backpack (raised edges around buttons) / Sonic Backpack (no
  edges around buttons) (`accessory_groups.id` 31).
- **Unaffected (plain, independently required):** Helmet, Browning Double Action 9mm
  Pistol, Battery Cover, Pistol, Rifle, L7A21 GPMG Heavy Machine Gun, Tripod.
- **Source:** hand-built (`extGroupId: null`), owner-found 2026-07-15.
- **Status:** ✅ group_id set in DB and verified via direct DB read (figure_id 273:
  A0740/A0741 both carry group_id 31), 2026-07-15. Not yet visually verified in-app.

### 1990 — Tunnel Rat (v3, figure catalog id 290 — source F-code F373)

- **Mechanism:** plain `group_id` — own any one member of the slot below.
- **Variants:** none on file — single catalog row. `Tunnel Rat` also matches an earlier
  v1 (id 166, F230) and v2 (id 210, F284) — disambiguated via `fcode: 'F373'`, same
  reason as Dodger/Lampreys above.
- **Group_id slot:** Sonic Backpack (raised edges around buttons) / Sonic Backpack (no
  edges around buttons) (`accessory_groups.id` 32).
- **Unaffected (plain, independently required):** Assault Pistol, Air-Cooled 7.62
  Calibre Machine Gun with Infrared Scope, Battery Cover, Experimental Ground-to-Air
  Pistol, Anti-Tank EK99 Missile, Missile Stand.
- **Source:** hand-built (`extGroupId: null`), owner-found 2026-07-15.
- **Status:** ✅ group_id set in DB and verified via direct DB read (figure_id 290:
  A0824/A0825 both carry group_id 32), 2026-07-15. Not yet visually verified in-app.

### 1990 — Viper (v2, figure catalog id 294 — source F-code F377)

- **Mechanism:** plain `group_id` — own any one member of the slot below.
- **Variants:** none on file — single catalog row. `Viper` also matches a later v3
  (id 522, F628) — the plain code_name lookup's "lowest id" already resolves correctly
  here, but `fcode: 'F377'` was used for consistency with the rest of this pass.
- **Group_id slot:** Sonic Backpack (raised edges around buttons) / Sonic Backpack (no
  edges around buttons) (`accessory_groups.id` 33).
- **Unaffected (plain, independently required):** Battery Cover, .45 Caliber Pistol,
  Submachine Gun, Laser Pistol, Mortar, Mortar Mount, Mortar Stand (Traversing
  Assembly).
- **Source:** hand-built (`extGroupId: null`), owner-found 2026-07-15.
- **Status:** ✅ group_id set in DB and verified via direct DB read (figure_id 294:
  A0838/A0839 both carry group_id 33), 2026-07-15. Not yet visually verified in-app.

### 1991 — Psyche-Out (v3, figure catalog id 318 — source F-code F403)

- **Mechanism:** plain `group_id` — own any one member of the slot below. Not a
  `match_key` case — a single slot, two interchangeable Sonic Backpack molds.
- **Variants:** none on file — single catalog row. `Psyche-Out` also matches an earlier
  v1 (id 154, F215) and v2 (id 193, F263) — disambiguated via `fcode: 'F403'`, same
  reason as Dodger/Lampreys/Tunnel Rat above.
- **Group_id slot:** Sonic Backpack (raised peg on side) / Sonic Backpack (hole on side)
  — same pick-one mechanism as the button-edge pairs above, different mold detail (a
  peg/hole attachment rather than button edges), owner-confirmed same treatment,
  2026-07-15 (`accessory_groups.id` 34).
- **Unaffected (plain, independently required):** Microphone, Battery Cover, Antenna,
  Radar Dish, Radar Screen, E.C.M. (Laser Rifle), E.C.M. (small, attach to Psyche-Out),
  E.C.M. (large, attach to rifle), Action Figure Battle Stand, Hose 6" Long (long).
- **Source:** hand-built (`extGroupId: null`), owner-found 2026-07-15.
- **Status:** ✅ group_id set in DB and verified via direct DB read (figure_id 318:
  A0953/A0954 both carry group_id 34), 2026-07-15. Not yet visually verified in-app.

## Non-retail backlog (not yet reviewed)

Figures with a non-`retail` `release_context` accessory currently in the DB that are
**not** written up above, held here so a future scan doesn't re-flag them as missing
coverage:

- **~96 figures carry a single generic `"Accessory Tree"` accessory tagged
  `release_context: 'bonus'`** — leftover-sprue bookkeeping bulk-applied during import,
  not confirmed figure-by-figure the way Cobra/Duke/Zartan above were. A handful of these
  have a more specific tree name (`Accessory Tree "Sea Sled Top"`, `"Parachute"`,
  `"Bunker Two Pieces"`, `"Raft"`, …) but the same "not yet reviewed" status applies.
  Regenerate the current list with:
  ```sql
  SELECT f.code_name, f.version, a.name, fa.release_context
  FROM figure_accessories fa
  JOIN figures f ON f.id = fa.figure_id
  JOIN accessories a ON a.id = fa.accessory_id
  WHERE fa.release_context != 'retail'
  ORDER BY f.code_name, f.version;
  ```
- Promote an entry out of this backlog into the Figures list above only once it's been
  individually confirmed with the owner (same discipline as match_key's "Scope
  discipline" section) — don't bulk-write these up from the query alone.
