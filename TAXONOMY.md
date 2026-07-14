# Taxonomy — figure classification, grouping & filters

Resolves Open Question #6 (and informs #7). Defines how figures are classified and how that maps to Inventory **grouping**, **tags**, and **filters**. All values below are the **real lookup tables** from the owner's DB.

The prototype currently hard-codes a **2-faction** binary (JOE / COBRA) and groups by **calendar year**. Both are superseded by what follows.

> **Variants are a separate axis** from everything below — within one figure version, minor production variants (letter + physical "tell") are modeled in `variant_lookup`, not here. The ~100-row gap between the canonical `figures_2.0` (654) and the older per-variant file (708) is largely that variant split. See **`VARIANTS.md`**.

---

## The dimensions (from real data, 654 figures in `figures_2.0`)

| Dimension | Field | Cardinality | UI role |
|---|---|---|---|
| **Faction** | `faction_id` | 4 | Color-coded **tag** + **filter** (primary) |
| **Series / wave** | `series_id` | 15 | **Primary grouping axis** (collapsible sections) |
| **Sub-team** | `sub_group_id` | 23 (sparse — 71% blank) | Optional **tag** + **filter**; switchable grouping |
| **Release context** | `release_context` | 12 | **Filter** (retail / exclusive / convention) |
| **Vehicle driver** | `is_vehicle_driver` + `vehicle` | 139 figures | **Filter / flag** ("came with a vehicle") |
| **Mail-away** | `is_mail_away` | 45 figures | **Filter** (overlaps release_context) |
| **Specialty** | `specialty` | 203 (freeform) | **Display only** — too granular to be a facet |

---

## Faction (`faction_id`) — promote 2 → 4
| id | Faction | # | Suggested accent (oklch, shared C/L, varied hue) |
|----|---------|---|---|
| 1 | **G.I. Joe** | 442 | olive/green — existing JOE accent |
| 2 | **Cobra** | 194 | crimson — existing COBRA accent |
| 3 | **Oktober Guard** | 3 | steel blue · `oklch(0.55 0.09 240)` |
| 4 | **Dreadnoks** | 15 | amber/mustard · `oklch(0.62 0.09 75)` |

Tune the two new hues to match the field-manual palette's chroma/lightness; vary hue only.

## Series (`series_id`) — primary grouping

> **Gap (flagged July 2026): this recommendation was never implemented.** The live Inventory
> (`web/src/app-inventory.jsx`) still groups strictly by calendar **year**, exactly as the
> original prototype did — `series_id` only powers the Convention-block sentinel-year
> formatting (`CONVENTION_YEAR` / `formatYear()` in `fig-identity.js`, so 1993 Jinx sorts
> into "Convention" instead of literal year 9999) and is not yet a grouping axis, a group-by
> switch, a filter, or a tag anywhere in the app. Series 1 (1982) and Series 1.5/2 (both
> 1983) are still merged under one "1983" year header today, which is exactly the case this
> doc's "Series > Year" argument was written to fix. Treat "Default grouping = Series" (the
> Open/recommended decisions bullet below) as **not started**, not done.
Map id → `YEAR · label` (short code for dense UI). Sort chronological; **CONV (Convention) sorts last, regardless of numeric id** — it isn't a real chronological year, so nothing interpolates its sentinel year value (see below).

| id | Year | Label | Code |
|----|------|-------|------|
| 1 | 1982 | Series 1 — straight arm | S1 |
| 2 | 1983 | Series 1.5 — swivel arm | S1.5 |
| 3 | 1983 | Series 2 | S2 |
| 4 | 1984 | Series 3 | S3 |
| 5 | 1985 | Series 4 | S4 |
| 6 | 1986 | Series 5 | S5 |
| 7 | 1987 | Series 6 | S6 |
| 8 | 1988 | Series 7 | S7 |
| 9 | 1989 | Series 8 | S8 |
| 10 | 1990 | Series 9 | S9 |
| 11 | 1991 | Series 10 | S10 |
| 12 | 1992 | Series 11 | S11 |
| 13 | 1993 | Series 12 | S12 |
| 14 | 1994 | Series 13 | S13 |
| 15 | 9999 (sentinel) | Convention & Mail-In Block — 700-block + off-cycle reissues, not a real chronological year | CONV |

Section header reads e.g. **"1988 · Series 7"**; the Convention section reads **"Convention"** (no year number — `year` 9999 is a sentinel, never displayed literally). Built (July 2026) as `CONVENTION_YEAR` / `formatYear()` in `web/src/fig-identity.js`, used everywhere a catalog figure's year is printed (Inventory year sections + search filter, Add Figure's year picker/search/summary, Parts Bin's figure search and rebalance rows) so no screen ever leaks a literal "9999". Confirmed live: 1993 Jinx v2 (both production variants) sits under this Convention section, not 1993's Series 12 — see `OPEN_QUESTIONS_ISSUES_FOUND.md` #21.

## Sub-team (`sub_group_id`) — optional tag, faction-scoped
71% of figures have **no** sub-team, so this is never a required field and **not** the default grouping (would yield a huge "—none—" bucket). It is: a small **tag** on rows that have one, a **filter**, and an **optional** group-by mode. Each sub-team belongs to a faction:

- **G.I. Joe (1):** Tiger Force, Night Force, Slaughter's Marauders, Sky Patrol, Eco Warriors, Ninja Force, DEF, Battle Force 2000, Star Brigade, Battle Corps, Mega Marines, Dino Hunters, Street Fighter II
- **Cobra (2):** Python Patrol, Crimson Guard, Iron Grenadiers, Cobra Ninja Force, Cobra Eco Warriors, Headhunters, Cobra Star Brigade, Mega Monsters, Cobra Street Fighter II
- **Dreadnoks (4):** Dreadnoks *(redundant with faction 4 — ignore the sub-group row, classify via `faction_id`)*

## Release context / vehicle / mail-away — filters

> **Naming collision (flagged July 2026, unresolved — same shape as the `variant` collision
> `VARIANTS.md` §7.0 fixed): `release_context` is two different columns on two different
> tables with two different value sets.** This section's `figures.release_context` is a
> **per-figure release channel** (`retail` / `convention` / `mail_in`, CHECK-constrained in
> `gijoe_collection.sql`) — e.g. "this whole figure was a 1992 convention exclusive." A
> *separate* `figure_accessories.release_context` (`retail` / `convention` / `mail_in` /
> `bonus`) is a **per-accessory-pairing completion flag** — "this one accessory in an
> otherwise-retail figure's blueprint doesn't count toward Complete" — see `PARTS_BIN.md` →
> *Accessory completeness model* and `ACCESSORY_GROUPS.md`. They are read by different code
> (`server/catalog.js`'s `f.release_context` vs. `fa.release_context`), serve unrelated
> purposes, and one is actively used (the accessory-level one, extensively) while the other
> (the figure-level one below) still drives nothing but a disabled filter mock (see the
> status note just below). Don't conflate the two when reading either doc; renaming one is
> an open decision, same as `variant` was.
>
> **Status of the filter described below: still a disabled mock.** `OPEN_QUESTIONS_Claude.md`
> §7's "More Filters" panel confirms the **Release** facet (Retail · Mail-away · Convention ·
> Store exclusive, i.e. `figures.release_context`) is rendered greyed-out with a "not tracked
> yet" note (`web/src/app-inventory.jsx`, `NOT TRACKED YET` footer row) — even though the
> column exists and is populated in the live schema. It hasn't been wired live; treat this
> section as the target shape, not current behavior.

- **Release context** (`release_context`): Retail (545), Mail order (42), 1992 Convention (35), Toys R Us (19), + small store-exclusive tail (Sears, Target, Kellogg's…). Collapse to a facet: **Retail · Mail-away · Convention · Store exclusive.**
- **Vehicle driver** (`is_vehicle_driver` / `vehicle`): 139 figures shipped with a vehicle (Clutch→VAMP…). Filter "came with a vehicle"; show the vehicle name on the detail.
- **Mail-away** (`is_mail_away`): 45 figures; folds into the release-context facet.

## Specialty — display only
203 distinct, freeform, 193 blank (Infantry 95, Artillery 15, …). Long tail → **never a filter**; show on the figure/instance detail as a descriptor.

---

## Open / recommended decisions
- **Default grouping = Series** (chronological), with a **group-by switch** → Series / Faction / Sub-team / Completeness (ties to #7).
- **Filters become multi-dimensional** (ties to #7): Status (existing) + **Faction** + **Sub-team** + **Acquisition** (retail/exclusive/convention) + **Vehicle-pack** flag. Decide single- vs multi-select then.
- Confirm the two new faction accent hues.

## Implementation note
This is a **shared-data-layer** change, not Inventory-only: `wf-data.jsx` (the `DATA` model + `FactionTag`, currently 2 factions / year groups) feeds Inventory, Add Figure, and the modals. Swap `faction` string → `faction_id` (4), add `series_id` / `sub_group_id` / `release_context` / `is_vehicle_driver`, and extend `FactionTag` to 4 colorways. The Parts Bin's category grouping already proves the collapsible-section + group-by pattern to reuse here.
