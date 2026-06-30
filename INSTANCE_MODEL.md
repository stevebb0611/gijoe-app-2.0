# Instance Model & Damage-Map Condition System

Companion to `README.md`. This specifies what a single owned **copy** (instance) stores, and the **derived-condition** system (the damage map → grades). Reference prototype: `GI Joe Tracker - Instance Detail.html` + `instance-detail.jsx`.

---

## Core idea
Condition is **not a field the user picks** — it is **derived** from damage the user maps onto a generic figure. Two independent axes are produced: a **Physical** grade and a **Paint** grade, each on the scale **Mint › Excellent › Good › Fair › Poor**. Completeness (accessories) is tracked separately, **per instance**.

---

## Instance entity (schema)
```
Instance
  id
  figureId                 // FK to the catalog Figure (version-level row in figures_2.0)
  variantId                // FK to a production variant (variant_lookup). NULL only when the
                           //   figure is single-variant (nothing to pin). Multi-variant figures
                           //   require a variant at Add time — there is NO "unidentified" state
                           //   (dropped June 2026; unknown copies stay off-app for review). See VARIANTS.md.
  // DISPLAY NUMBER ("No. 1", "No. 2" …) is NOT stored — it is derived at render
  // time: copies are sorted most-complete-first and numbered contiguously, so
  // No. 1 is always the most complete copy and removing a copy never leaves a gap
  // (the remaining copies renumber). The old "instanceIndex" field is gone.
  isPrimary: boolean       // optional manual pin; if unset, No. 1 (most complete) is the de-facto primary shown in list/gallery summaries
  bodyType: 'male'|'female'// which diagram template the damage map uses

  accessories: [{ name, have: boolean }]   // per-instance checklist, seeded from the
                                            // figure's required accessory blueprint.
                                            // "have" = the ORIGINAL part is present.
                                            // complete = every required accessory.have === true

  damage: {
    physical: [{ id, side:'front'|'back', point, type, severity }]
    paint:    [{ side:'front'|'back', region, severity }]   // ≤1 entry per region+side
  }

  location: string         // free-text bin/box label, e.g. "BIN C-04 · long-box"
  notes: string

  // derived (not stored): physicalGrade, paintGrade  — computed from damage
```
No acquisition / disposition / per-instance pricing fields — out of scope. **Remove** is a lifecycle action (see PARTS_BIN.md), not a stored status — a removed copy's record is deleted (after the accessory-disposition prompt).

### O-ring points (physical damage anchors)
`head · chest · elbowL · elbowR · oring(waist) · wristL · wristR · kneeL · kneeR · ankleL · ankleR`
(These are the points the owner chose to track. Each point can hold multiple physical marks; the node shows the count and is colored by its worst severity.)

### Physical damage types
`break (break / missing piece) · crack (crack / stress) · loose (loose joint) · brittle (brittle / discolored)`

### Paint regions (paint-wear anchors)
`head · chest · armL · armR · waist · legL · legR` — one severity per region per side; clicking cycles **minor → moderate → severe → (off)**.

### Severity
`minor · moderate · severe` (applies to both physical marks and paint marks).

---

## Grade engine (DEFAULT rules — editable)
These are sensible starting weights; the owner wants to tune them, and a rules-editor is a future feature. Treat them as **config**, not hard-code.

**Weights**
- Severity demerit: `minor = 1`, `moderate = 3`, `severe = 6`
- Physical type multiplier: `break ×2.0`, `crack ×1.0`, `loose ×0.6`, `brittle ×1.0`

**Physical grade**
1. `score = Σ (severityDemerit × typeMultiplier)` over all physical marks (both sides).
2. Base grade by score: `0 → Mint`, `<3 → Excellent`, `<8 → Good`, `<16 → Fair`, `≥16 → Poor`.
3. **Cap rules (break only):** any `break` of `severe → cap Fair`, `moderate → cap Good`, `minor → cap Excellent`. Final = the **worse** of base grade and the strictest cap.
   - *Example:* a moderate break alone (score 6 → "Good") with a "Good" cap stays Good; a severe break (score 12 → "Fair" by score, capped further by "Fair") = Fair; pile on more and score pushes to Poor.

**Paint grade**
1. `score = Σ severityDemerit` over all paint marks.
2. Same score→grade thresholds as physical. (No type multipliers or caps.)

**Grade order & display colors**
`Poor < Fair < Good < Excellent < Mint`.
`Mint #5d7d4d · Excellent #7d8a4a · Good #b88a2f · Fair #c0612f · Poor #8f2f24`.
Each grade badge shows the word, the demerit score, and the cap reason when capped.

---

## Completeness & the rebalance engine
Completeness is **per-instance** (decided May 2026 — see `OPEN_QUESTIONS.md` #5). An instance is **whole** when, for every required accessory, `have-quantity ≥ required-quantity` (partials give proportional credit: 1 of 2 skis = 1 of the 2 needed). A **figure** is **complete-now** when **≥ 1 of its copies is whole**.

### Two states
- **complete-now** — a copy is whole *as parts are currently assigned to copies*.
- **completable** — the parts owned across all copies *could* make a copy whole if accessories were reassigned. Equals the aggregate `Σ min(owned, required) ÷ Σ required = 100%`.

A figure can be *completable* without being *complete-now* (parts are scattered across copies). That gap is what the rebalance engine closes.

### Rebalance engine (the recommender)
Goal: **maximize the number of whole copies** from the parts on hand, then tell the user how to get there.

1. **Optimal allocation (greedy):** for each accessory, fill copies one at a time — give copy #1 its full required quantity before putting any in copy #2, etc. Filling sequentially (rather than spreading) maximizes how many copies end up whole. `optimalWholeCount` = copies that are whole under this allocation.
2. **Current allocation:** the real per-instance `have` flags (in the prototype, a synthesized scattered arrangement).
3. **If `optimalWholeCount > currentWholeCount`** the figure is *completable but not complete-now* → produce a **move list**: for each copy that should become whole, pull each missing accessory from a donor copy that won't be whole anyway (preferring the copies you're "sacrificing"). Each move is `{ part, from: #d, to: #t }`, rendered as *"Move {part} from copy #d → copy #t."* If parts are still short after exhausting copies, the remainder becomes a **pull-from-Parts-Bin** suggestion.

> The engine is advisory — it never moves parts automatically. Accepting a recommendation updates the per-instance `have` flags (and may pull from / deposit to the Parts Bin).

### Overflow → Parts Bin
Any accessory where `owned > required × copies` overflows. The extra units are **deposited as loose parts in the Parts Bin** (see `PARTS_BIN.md`); a copy never counts more than its required quantity toward completeness. *(The figure-side overflow field is still named `surplus` in code; the Bin itself no longer surfaces a "surplus" label.)*

### Year meters (two)
Year headers show **COVERAGE** (`ownedFigures ÷ rosterFigures`) and **COMPLETE** (`completeNowFigures ÷ ownedFigures`) — coverage answers "how much of the year do I have," completion answers "how many of those are whole."

---

## Instance Detail screen (layout)
A **dedicated full page** (not a modal — the damage map needs room). Two columns:
- **Left (sticky):** the **damage map** — Front/Back + Male/Female toggles, the schematic figure, clickable o-ring **nodes** (open a Log-Damage panel: pick type × severity) and clickable **paint regions** (cycle severity), plus a severity legend.
- **Right:** `CONDITION` (Physical + Paint grade badges + derivation note) · a contextual `LOG DAMAGE` panel when a node is selected · the `DAMAGE LOG` table (every mark: side · location · category · severity; removable) · `ACCESSORIES` checklist with **pull-from-Parts-Bin** on missing parts · `PARTS BIN` strip · `LOCATION` field · **Remove** action.

Header: breadcrumb back to Inventory · figure name + faction + variant/year · copy tabs (No. 1 / No. 2 / ＋) · **★ Primary** toggle. The breadcrumb's variant tag reads `v{ver} · {letter}`; the right column carries a **change ›** affordance to *correct* a mis-identified variant (a plain overwrite — not an identify-later flow; the unidentified state was dropped, see `VARIANTS.md` §3). The per-copy lifecycle action is **Remove** (asks the accessory-disposition question — see PARTS_BIN.md).

### Production note on the figure diagram
The prototype renders the figure as a **geometric schematic** (circle head, trapezoid torso, thick rounded-line limbs) — intentionally, to stay on-brand and avoid sloppy illustration. In production this can stay schematic, or be swapped for a normalized figure-outline template per body type; either way the **node/region coordinates are data** (percent positions) layered over the art, so the art can change without touching the logic.

---

## Open questions specific to the instance model
1. **Grade-rule tuning** — the weights/thresholds/caps above are a first guess. Tune to how the owner actually grades, then build the rules editor.
2. **Diagram templates** — confirm the male/female set is enough, or whether bulky/child/non-humanoid molds need their own templates + point maps.
3. **Per-instance photos** — deferred ("decide for me"); recommended: one primary photo per instance with room to add more. Confirm.
4. **Paint vs physical overlap** — "brittle/discolored" is currently physical; discoloration could read as paint/plastic. Confirm which axis it feeds.
5. **Accessory identity / compatibility** — see PARTS_BIN.md (this is the key cross-cutting modeling decision).
