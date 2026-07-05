# match_key — matched-color accessory sets

> Companion to `PARTS_BIN.md` → "Accessory completeness model." That doc locks two axes on
> `figure_accessories`: `group_id` (own any one member of a slot) and `release_context`
> (retail vs tracked-but-non-blocking). `match_key` is a third, narrower mechanism layered
> on top of `group_id` for a specific case those two don't cover.

## The problem

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
light-green set, or the full dull-green set, never a mix.

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

## Scope discipline

**Do not bulk-apply this from a duplicate-name or duplicate-color scan.** A repeated
accessory name is not reliable signal on its own — some duplicates are genuinely
independent required items that happen to share a name (Alley Viper's two *different*
orange Submachine Guns; Chun Li's three separate yellow Swords), not a matched-color set.
Every figure below was confirmed individually by the owner before being added. Treat this
list as owner-reviewed ground truth, not a pattern to extrapolate from.

## Considered, not applicable

Figures that look like match_key candidates (duplicate-colored accessories across two
group_id slots) but were confirmed by the owner to be independent "or" choices instead —
listed here so they aren't re-flagged by a future duplicate-color scan.

- **Blowtorch (1984, v1, figure catalog id 50 — F086/F087/F088, variants A/B/C):** Helmet
  (no holes / with holes, both yellow, group 1) and Flamethrower (light green / dark green,
  group 2) are each independently "own any one" — no color/mold pairing ties a specific
  helmet to a specific flamethrower. Existing plain group_id slots (imported pre-match_key,
  ext groups 8401/8402) are correct as-is. Confirmed with owner and visually verified
  in-app, 2026-07-03.

## Figures (chronological by year of release)

### 1984 — Firefly (v1, figure catalog id 56 — source F-codes F096 / F097)

- **Variants:** F096 · A "Black eyes" / F097 · B "Brown eyes" — folded into one catalog row (id 56) with both letters in `variant_lookup`, per the standard variant-collapse rule (`VARIANTS.md`)
- **Matched pieces:** Submachine Gun + Walkie-Talkie, light green (tag `A`) or dull green (tag `B`)
- **Unaffected (plain, independently required):** Demolition Backpack, Demolition Backpack Cover
- **Status:** ✅ implemented and verified via API round-trip and in-app (2026-07-03).

### 1983 — Duke (v1, figure catalog id 27 — source F-codes F057–F061)

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
