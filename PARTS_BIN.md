# Parts Bin & Two-Way Accessory Flow

Companion to `README.md` / `INSTANCE_MODEL.md`. Specifies the **Parts Bin** — a standalone inventory of loose accessories — and the **two-way relationship** between figures and that bin. The Parts Bin is a first-class destination, peer to the main Inventory.

---

## What the Parts Bin is
A separate inventory of **loose accessories not currently attached to a figure instance** — spares, orphans, and parts you bought on their own. It is the counterpart to the figure inventory: figures consume from it, and removed figures can feed it.

```
PartsBinEntry
  accessoryId              // FK to an Accessory catalog type (see compatibility below)
  name                     // e.g. "Backpack"
  quantity: number         // how many loose copies you hold
  // future (not now): condition, notes, photos
```
The prototype keys entries by **name string** with a quantity (e.g. `Backpack ×3`). Production needs a real **Accessory catalog** so a part can be matched to the figures that use it — see the compatibility decision below.

---

## The two-way relationship

### A. Figure → Bin draws FROM the Bin  (completing a copy)
When building or repairing an instance's checklist, any **missing** accessory that **exists in the Parts Bin** offers a **"pull from bin (N) ›"** action. Pulling:
- decrements that bin entry's quantity by 1,
- marks the instance's accessory `have = true`.

This is already mocked on the Instance Detail screen. It must also drive the **Add Figure / Add Instance** flow: when a new instance is created, immediately surface which of its required accessories are available in the bin and let the user pull them in one step ("3 of this figure's 5 parts are in your Parts Bin — add them?").

### B. Bin ← Figure feeds INTO the Bin  (removing a copy)
When **removing** an instance (the action is labeled **Remove**), prompt (per the owner's "ask each time"):
> "This copy has **N** accessories. **Keep them → move to Parts Bin**, or **remove them with the figure**?"
- **Keep → Parts Bin** (built button label: **Add to Inventory**): each present (`have`) accessory **increments** its Parts Bin entry quantity (creating the entry if new). The figure record is then removed.
- **Remove with figure** (built button label: **Remove from Inventory**): accessories are discarded along with the instance.

### Manual edits
The bin is also directly editable: add a part you bought loose (＋ quantity) or remove one (－ quantity).

### C. Overflow auto-deposit  (confirmed May 2026 — OPEN_QUESTIONS #5)
A copy never counts more than its required quantity. Any accessory where `owned > required × copies` overflows, and the extra units are **deposited as loose parts in the bin automatically** — that overflow is precisely what the Parts Bin holds. The figure-side `figState` still exposes this overflow list per figure (the field is named `surplus` in code); the bin ingests it as plain loose stock that can then fill gaps on other copies (or other figures, if compatible). **The Parts Bin itself no longer labels or counts a part as “surplus”** — once in the bin a part is just loose stock that either fills a gap or doesn't (see the page spec below). The **rebalance recommender** (see `INSTANCE_MODEL.md`) draws from this same pool: when a copy can't be completed from sibling copies alone, the missing remainder becomes a **pull-from-bin** suggestion.

### Rebalance Accessories — entry point lives on the Parts Bin (May 2026)
Per owner request, the rebalance affordance was **removed from the Inventory header** and **relocated to the Parts Bin header**: a `⚖ REBALANCE` tag (with a count of completable-by-moving figures) opens a panel listing each figure, its move list (*"Move Backpack from No. 3 → No. 1"*), and an APPLY MOVES action. This puts rebalancing where the loose parts live. The Inventory still shows the inline `⚖ REBALANCE` hint on multi-copy rows and the move list inside the row accordion / modal — only the header tag + filter chip moved. (Inventory toolbar chips are now two bracketed groups: **[ Complete · Incomplete ]** and **[ Show Duplicates · Show Collection Gaps ]**.)

---

## Parts Bin page (as built — `GI Joe Tracker - Parts Bin.html` / `parts-bin.jsx`)
A standalone page, peer to Inventory, in the same field-manual style:
- **Header:** brand + the **INVENTORY / PARTS BIN** nav (with part-count badge) + search (part name *or* a figure it fits) + KPIs, in order: **⚖ Rebalance** (count of figures completable by moving parts between copies — opens the rebalance panel; only shown when there are any), **Fills Gaps** (Σ fillable), **Loose Parts** (Σ qty). *(The old **Surplus** KPI was removed June 2026.)*
- **Toolbar:** filter chips — `Fills Gaps` · `Shared` · `Single-use` (single-select, click to clear) — a `shown / total` count, a **GROUP BY** segmented control (`Category` / `Home Figure` / `Status` / `A–Z`), and **expand / collapse all**. *(June 2026: dropped the `Surplus` filter chip; renamed `Fills a gap`→`Fills Gaps`, `Shared part`→`Shared`.)*
- **A two-way explainer banner** + the **BIN INTAKE** queue (import-pull suggestions + removal-sort cards) + an **＋ Add a loose part** action. Adding a part **requires a category** — a part you can't categorize stays off the shelf (there is no “unassigned” / “desk” state).
- **Part rows** are grouped into collapsible **group sections** (per the active GROUP BY). Each row, one per accessory type: a big **×qty**, the **name** + its **category** + a **SHARED/SINGLE-USE** tag, the **home:** figure, and a computed **status**:
  - green **“fills N gaps · needed by N copies”** (expandable to the specific owned copies, each a **pull-to-complete** link to that Instance Detail), or
  - **“no current need.”**
  - A green left-border = fills a gap.
  - Row actions: **＋ / －** quantity.

### Reverse-lookup math (per entry)
```
needs    = NEEDS where acc === entry.name AND entry.fits includes the copy's figure
needed   = needs.length
fillable = min(qty, needed)
shared   = entry.fits.length > 1
```
The **Fills Gaps** KPI sums `fillable`; **Loose Parts** sums `qty`. (`NEEDS` is derived from instance checklists in production; hand-built in the prototype.) The Parts Bin no longer computes a per-entry surplus — overflow is handled figure-side (see **C** above).

---

## Reverse lookup (the other half of "two-way")
From a Parts Bin entry, the user should see **which owned copies are missing that part** ("Backpack ×3 — needed by: STALKER No. 1, BREAKER No. 1"), with a jump to that copy to pull it in. This closes the loop: the bin doesn't just hold parts, it actively tells you where they're wanted. This requires the compatibility model below.

---

## KEY OPEN DECISION — accessory identity & compatibility
This is the one modeling choice that gates "recommend from bin" and reverse-lookup, and it needs the owner's input:

- **Are accessories generic or figure-specific?** Vintage Joe accessories are mostly **unique molds** tied to a figure, but some are **shared/reused** across figures (common rifles, backpacks). 
- Options:
  1. **Figure-specific parts** — a "Backpack" in the bin belongs to one figure; only that figure's instances can pull it. Simple, but a generic backpack can't satisfy another figure even when it physically would.
  2. **Catalog accessory types with compatibility** — each accessory is a catalog item with a list of **compatible figures**; a bin part can be pulled by any compatible figure. More accurate, more data to maintain.
  3. **Hybrid** — parts default to their origin figure but can be flagged "generic / fits any."
- **Recommendation:** option 2 (catalog accessory + compatibility set) is the most useful for completion and reverse-lookup, but it depends on having catalog data that maps accessories ↔ figures. Confirm before building the bin's matching/recommend logic.

Related: do you track accessory **condition** in the bin (a beat-up vs mint loose backpack)? Deferred for now.

---

## DATA MODEL — canonical source (resolves the open decision above)

The compatibility question above is **answered by the real schema** (`route.js`): accessories are **catalog types with a compatibility set** (option 2). `accessory_id` is the join key throughout — names repeat and must NOT be used as identity.

**Tables (`route.js`):**
- `accessories` — the catalog. `id` (= `accessory_id`), `name`, `group_id` (= category). Source CSV: `gijoe_db_accessories.csv` (803 rows, 52 categories → 9 display groups). **IDs are stable keys with intentional gaps + semantic blocks** (like the figures catalog — see VARIANTS.md §7.5.1; never treat as sequential, never `max(id)+1`):
  - **0001–1745** — accessories (weapons / gear, the main pool)
  - **1800–1822** — battle stands (display bases)
  - **1850–1871** — accessory trees (multi-piece sprues)
  - **1900–1906** — support pieces (commonly **shared** across figures)
  - **1925–1930** — soft-goods / patches
  - Gaps between blocks are deliberate headroom; new parts are allocated into the matching block by hand.
- `figures` — the catalog of figures. Canonical file: **`gijoe_db_figures_2.0`** — the older per-variant file (708 rows) is **dropped** (confirmed June 2026). IDs are stable keys with intentional gaps: **001–629** main roster + **700–724** mail-in/convention/exclusive block; owner-extensible (see VARIANTS.md §7.5.1).
- `figures_accessories` (**THE JOIN — pending export**) — `figure_id × accessory_id × quantity_required × group_id × release_context`. This is the source of truth for: which figures an accessory fits (compatibility / SHARED-vs-SINGLE = `count(distinct figure_id) > 1`), and required quantities per pairing.
- `owned_figures` — instances (`id`, `figure_id`, `notes`).
- `owned_accessories` — per-instance marks (`owned_figure_id`, `accessory_id`, `quantity_owned`).

**Derived facts (replace the prototype's hand-built data):**
- A figure's **blueprint** = its `figures_accessories` rows.
- A **gap** (the bin's reverse-lookup `NEEDS`) = blueprint rows where `quantity_owned < quantity_required` for an owned instance.
- **Shared vs single-use** = distinct `figure_id` count per accessory (NOT the `relationship_count` column, which is a fuzzy convenience that was only used to seed the prototype's SHARED tag).
- A **bin entry** should reference `accessory_id`, not a name string.

**Status / what's still needed before grounding the prototype on real data:**
- ⏳ **Holding for the `figures_accessories` export.** It is the *only* real link between figures and accessories. There is **no usable interim link** in the current exports — the accessories file's `host_figure` column is **ignored in the database (admin-only metadata)** and must not be used for matching. So until the join lands, none of the two-way logic can run on real data; the prototype stays on sample data.
- The **home figure** shown per bin entry should also derive from `figures_accessories` (the primary/origin pairing), NOT from `host_figure`.
- Optional: `owned_figures` + `owned_accessories` exports to make fills-a-gap / import-removal recommendations reflect the real collection.

**Deployment / data lifecycle (confirmed):** No legacy import — on deploy the collection is **empty** and grows **one figure at a time** via Add Figure. So the Parts Bin, gaps, and all two-way intake **start at zero** and accrue from: (a) figures imported with missing accessories → gaps; (b) the removal/sort flow depositing kept parts; (c) manual ＋ Add a loose part. **First-run / empty states are first-class** — the prototype's seeded bin is a *populated-later* illustration, not day one. Open UX question: at Add-Figure time, does the user immediately check off which blueprint accessories are present (gaps known at once, import-pull suggestions fire) or is the instance created bare and marked later?

**Figures catalog note:** `figures_2.0` is confirmed canonical and the 708-row per-variant file is dropped (June 2026). The catalog is **knowingly incomplete** for later years (1987–94) and for mail-in/convention figures **by design** — it is owner-extensible reference data, grown into the intentional ID gaps (incl. the 700-block) as figures are discovered missing. See VARIANTS.md §7.5.1.

**Prototype note:** all three pages (Inventory, Instance Detail, Parts Bin) currently run on name-keyed *sample* data. Swapping to `accessory_id` + the real tables is a **data-layer change, not a UI rebuild** — the components already think in "blueprint required vs owned."

---

## Accessory completeness model — group_id variants & release_context (LOCKED · June 2026)

How a figure's accessory checklist is structured and what counts toward **Complete**. Locked reference: **`GI Joe Tracker - Accessory Sub-Groups v2.html`** + `subgroup-wire-v2.jsx`. A figure owns a **flat list** of `figures_accessories` rows — `accessory_id`, `quantity_required`, `group_id`, `release_context` — and exactly two fields restructure that flat list:

### 1. `group_id` → a variant group ("own any one")
Two or more accessories that **share a `group_id`** are interchangeable variants: owning **any one** satisfies the group. **(Redesigned July 2026 — see below.)** They render as a left-aligned micro-label ("Helmet · pick one") followed by one full-width row per option, using the exact same row component (bold name, checkbox, `owned/required` count) as any plain accessory — no bordered card, no centered "or" pill row. The group's position in the checklist matches wherever its first blueprint row falls (owner keys the DB head-to-toe: helmet, backpack, weapons, skis/fins…), not pulled to the end.
- Examples (group_ids supplied by the owner; the join's `group_id` column is otherwise blank in current exports): Scrap-Iron's **Remote Activator** thin/thick handles = **`8401`**; A.V.A.C.'s **Parachute pack** soft/hard plastic = **`8601`**.
- Generalises: *any* set of accessories inside one `group_id` renders this same way — nothing is special-cased per figure.
- **`match_key` slots (see `ACCESSORY_GROUPS.md`)** — when 2+ `group_id` slots must resolve to the same tag together (a matched colorway, e.g. Duke's Helmet + Gun), each slot still renders as its own independent group at its own position — they are **not** merged into one block, since matched slots are often spread across the body. Each option row carries a small tag badge (A/B/…) so the owner can tell which pieces pair up despite being visually apart. Completeness math (`matchedSetSatisfied`) is unaffected — this is a rendering decision, not a scoring one.

### 2. No `group_id` → a plain row (qty-aware)
Every ungrouped accessory is its own row: a single checkbox at `quantity_required = 1`, or **N tick boxes** when `quantity_required > 1` (e.g. Scrap-Iron Missile System **Legs ×2**, **Missiles ×2**). **Multi-piece sets are NOT a special "assembly" construct** — the Missile System is just six individual accessory rows, because the data carries no grouping binding them. (Reverted in review — the assembly box was "too extra.")

### 3. `release_context` → an independent completion axis
`release_context` is orthogonal to `group_id`. Values: **`retail`** (default — **counts** toward completion) vs **`convention` · `bonus` · `mail-in` · `exclusive` · `retailer_exclusive`** (tracked, but **excluded** from completion). `retailer_exclusive` added migration `012_retailer_exclusive_context.sql` — a retail-channel exclusive pack-in (e.g. a JC Penney/Toys R Us-only 3-pack's swapped gear), distinct from `convention` (a fan-club/con exclusive); see ACCESSORY_GROUPS.md's 1982 Cobra entry. Non-retail accessories pull into their own per-context group (label = the context name, e.g. **Bonus**, same flush micro-label + row treatment as a `group_id` slot) and **never block a Complete**. Positioned at the point its first context row falls in the blueprint, same as `group_id`.
- Demo: **Cobra trooper (figure 7)** — retail **Dragunov rifle** (`A0004`) is the only thing required for Complete; the JC Penney 3-pack pieces (M-16 Heavy MG `A0013`, Bipod `A0014`, Bazooka thin/thick handles `A0028`/`A0029`, `release_context: 'retailer_exclusive'`) sit in a "Retailer Exclusive" group and stay optional.
- Real data (July 2026): every "Accessory Tree" accessory (bare + the Raft/Parachute/Sea Sled/Bunker-piece variants — 107 pairings, 100 figures) was reclassified `retail` → `bonus`, the first bulk use of this axis beyond the hand-picked Firefly/Duke examples below.
- The two axes compose: a context group could itself hold a `group_id` variant pair (the thin/thick Bazooka would qualify) once those ids are assigned.

### 4. Completeness rule (LOCKED)
A figure instance is **Complete** when **every retail accessory is owned at its `quantity_required`** *and* **every retail `group_id` has ≥1 member owned**. Non-retail contexts are ignored entirely. The card footer is **binary: `Complete` / `Incomplete`** — no detail/reason string, sentence case (per `FRONTEND_STANDARDS.md` → no ALL CAPS).

### 5. Visual rules carried from review
- **Checkboxes fill a single neutral confirm color** — they do **not** echo the accessory's color (that was overstimulating). The accessory's **color swatch lives only on the row label**; two-tone swatches are supported (e.g. `silver/purple`).
- **Alt-names** ride in the card header as an **A.K.A.** line, from the `alt_name` list (e.g. "Scrap-Iron" / "Scrap Iron").

### Open / deferred
- ~~A better in-card **notation for `release_context`**~~ — ✅ resolved (July 2026): non-retail items get their own labeled group (context name as a small muted caption), same as before, now flush with the rest of the checklist rather than a bordered box.
- Whether owning **both** members of a `group_id` should flag a **"variant spare"** (currently silent).
- `group_id` / `release_context` values are **not yet in the join export** — they live in the live DB; the mockup hard-codes the owner-supplied ids (`8401`, `8601`) and contexts for illustration.
