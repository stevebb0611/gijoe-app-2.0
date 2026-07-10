# Accessory Groups — grouped accessory slots (`group_id` · `match_key`)

> Companion to `PARTS_BIN.md` → "Accessory completeness model." That doc locks the general
> rules for two axes on `figure_accessories`: `group_id` (own any one member of a slot) and
> `release_context` (retail vs tracked-but-non-blocking) — read it first for the rule
> definitions. This doc is the **per-figure operational log**: every figure with a
> `group_id` slot gets one entry below, chronological by year of release. Most figures use
> plain `group_id` only ("pick one"); a subset also need `match_key`, a third, narrower
> mechanism layered on top of `group_id` for a specific case those two don't cover (see
> "The problem" below). Each entry's **Mechanism:** line says which applies — the behavior
> differs, so don't assume from the figure alone.

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

## Figures (chronological by year of release, then by catalog id)

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

### 1986 — A.V.A.C. (v1, figure catalog id 96 — source F-code F145)

- **Mechanism:** plain `group_id` — own any one member of the slot below.
- **Variants:** none on file — single catalog row.
- **Group_id slot:** Parachute pack (soft plastic) / Parachute pack (hard plastic)
  (`accessory_groups.id` 8, ext CSV group `8601`). This is the other canonical "pick one"
  example cited in `PARTS_BIN.md` § *Accessory completeness model*.
- **Source:** CSV `group_id` column, ext id `8601`.
- **Status:** group_id set in DB; bulk-imported from the CSV column, not individually
  owner-verified in-app.

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
