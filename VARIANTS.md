# Variants — characters, versions & production variants

Companion to `README.md` and `INSTANCE_MODEL.md`. This is the spec for the **variant** dimension — the layer between a catalog Figure and a physical Instance. It is implemented across **Add Figure** (`add-figure.jsx` — the variant picker) and **Instance Detail** (`instance-detail.jsx` — the variant tag + correction affordance).

> **Update (June 2026): the UNIDENTIFIED / identify-later lifecycle was dropped — see §3.** Every copy in the app is identified to a production variant at Add time (or is single-variant). A copy you can't identify stays on the physical desk for review and isn't added. The Add Figure and Instance Detail prototypes still carry the now-dead "unidentified" UI and need it stripped (flagged in §5).

> **Why this matters.** A serious vintage collector distinguishes copies of the "same" figure by tiny production differences — a thumb mold, a paint finish, a logo error. Those differences drive rarity and value. The app already has UI for it; this doc defines the model behind that UI so it survives the move to a real codebase.

---

## 1. The four-level hierarchy (vocabulary)

The word "figure" is overloaded in collector-speak. The app uses four distinct levels — keep them straight:

| Level | What it is | Example | Stored as |
|---|---|---|---|
| **Character** | The named persona, across all years/molds | "Breaker", "Snake Eyes", "Cobra Commander" | not its own table — emerges from `name` |
| **Figure** *(catalog version)* | A character + year + wave/role — **one catalog row** | "BREAKER · 1982 · Communications"; "SNAKE EYES · 1985 · v2 commando" | a row in `figures_2.0` (654 rows) — `figureId` points here |
| **Production variant** | A minor factory variation within one Figure, told apart by a physical **tell** | Breaker **v1 · A** (thin thumbs) vs **v1 · B** (thick thumbs, glossy) vs **v1 · C** (reverse rivets) | a row in `variant_lookup`, FK → Figure |
| **Instance** | A single physical copy you own | "your Breaker No. 1" | a row in `owned_figures` (see `INSTANCE_MODEL.md`) |

**The key relationship:** one Figure → 0..N production variants → each owned as 0..N instances. A character with multiple year/wave versions shows up as **multiple Figure rows** (Snake Eyes v1 1982 and v2 1985 are two catalog entries), and **each** of those can additionally split into production variants.

> Naming note: the prototype's `variant` *string* on a Figure (`"v1 · straight-arm"`, `"Heavy MG"`, `"Communications"`) is really the **version/role descriptor** that disambiguates two Figure rows of the same character — it is **not** the production-variant layer. The production-variant layer is the `variants: []` list (letter + tell). Don't conflate the two; the field name collision is a prototype shortcut to clean up (see §6).

---

## 2. Production-variant entity (schema)

From `add-figure.jsx` (`CATALOG[].variants[]`) and `instance-detail.jsx` (`FIG_VARIANTS`):

```
ProductionVariant            // source: variant_lookup, FK → figureId
  letter   : "A" | "B" | …   // collector shorthand within a version (NOT globally unique)
  ver      : "1"             // the figure version number this variant belongs to
  tell     : string          // the PHYSICAL distinguisher — how you identify it in hand
                             //   e.g. "Straight-arm · thick thumbs · glossy paint finish"
                             //        "“Mickey Mouse” Cobra logo · mail-away"
  rare     : boolean?        // optional — flags a scarce/valuable variant (e.g. CC v1·A)
  owned    : number          // count of YOUR instances pinned to this variant (rollup, derived)
```

- **`tell` is the heart of it.** Variants are identified by inspection, not by a code on the box. The tell is the human-readable rule ("thick thumbs · glossy finish") the owner matches against the figure in hand. Production stores it as text; it is searchable (Add Figure's search matches against tells).
- **`letter` is scoped to the version**, not global — "v1 · A" and "v2 · A" are unrelated. Always display and key as `v{ver} · {letter}`.
- **`owned` is a derived rollup**, not authored — count of instances whose `variantId` resolves to this variant. Drives the "×N / not owned" tag in the picker and `catOwned()` (a figure's total owned = Σ its variants' owned).
- A Figure with **no** `variants` list is **single-variant** — every copy is unambiguous and no variant pick is offered.

### Display formats (canonical — reuse everywhere)
| Context | Format | Example |
|---|---|---|
| Variant tag / chip | `v{ver} · {letter}` | `v1 · B` |
| Full line | `{tell} · {role} · {year}` | `thick thumbs · glossy finish · Communications · 1982` |

> There is **no "unidentified" display state** — see §3. Every copy in the app is identified to a variant (or is single-variant).

---

## 3. Variant identification happens at Add time — and is required (no UNIDENTIFIED state)

> **Decided June 2026 — the UNIDENTIFIED lifecycle is dropped entirely.** Earlier drafts made "I'm not sure yet" a first-class state you could log and pin later. The owner's rule overrides that: **if you can't identify the figure/variant in hand, it does not go into the collection** — it stays on the physical desk for review and is added only once identified. The app therefore **only ever contains identified copies.** There is no `null`-means-unknown, no defer, no "identify later," and no review queue inside the app (the review pile is physical and never touches the application).

Consequences:

- **Add Figure, FIND step.** Selecting a **multi-variant** catalog row expands a **WHICH VARIANT?** picker. Each option is a radio: `v{ver} · {letter}` · the tell · owned count. **A specific variant must be chosen to advance** — `NEXT` stays disabled until one is picked. There is **no "? UNIDENTIFIED" option.** (Single-variant figures skip the picker entirely.)
- **Carry-through.** The chosen variant threads through Details, Confirm, and the success toast — always a concrete `v{ver} · {letter}` + tell, never a flag.
- **Instance Detail — correction, not identification.** The copy page still lets you **change ›** a copy's variant (you mis-identified it and want to fix it) — but this is a plain edit of an already-set value, not an "identify an unknown" flow. It re-opens the same tell list and re-points `variantId`. No unidentified state ever shows.

> **Identity vs. condition stay independent.** A copy is always identified to a variant, but may still be **ungraded** (Add Figure leaves every new copy ungraded — see `INSTANCE_MODEL.md`). The two are separate; only the *unidentified-variant* idea is gone.

---

## 4. NEW VARIANT vs NEW FIGURE vs NEW INSTANCE

Add Figure computes ownership **at the variant level**, which changes the language it shows (from `add-figure.jsx`):

| Situation | Condition | Label shown |
|---|---|---|
| First copy of a single-variant figure you don't own | `!multi && owned == 0` | **NEW FIGURE · creating INSTANCE #1** |
| First copy of a *specific production variant* you don't own (multi-variant figure) | `multi && variant.owned == 0` | **NEW VARIANT · creating INSTANCE #1** |
| Another copy of a variant you already own | `owned > 0` | **already own ×N of this variant · this adds INSTANCE #{N+1}** |

(There is no "logged without choosing a variant" row — a variant is always chosen; see §3.) The distinction is real: owning Breaker **v1·A** does **not** mean you own **v1·B** — adding v1·B is a *new variant* milestone even though you "have a Breaker." Instance numbering (`No. 1…N`) is still **per Figure**, not per variant (see `INSTANCE_MODEL.md` — numbers are derived, most-complete-first).

---

## 5. Where variants surface (per-screen inventory)

| Screen | Treatment | Status |
|---|---|---|
| **Add Figure** (`add-figure.jsx`) | The variant **picker** (tell-matching radios, **required** pick — no UNIDENTIFIED option), the NEW VARIANT/FIGURE labels, variant in Confirm + success. Search matches tells. | ✅ built — required pick, no UNIDENTIFIED option |
| **Instance Detail** (`instance-detail.jsx`) | Variant tag + tell subtitle + a **change ›** affordance to *correct* the pinned variant. | ✅ built — correction only, no identify-later state |
| **Inventory** (`inventory-app.jsx` / `wf-data.jsx`) | **Variant-aware:** per-variant **pips** on rows + gallery cards (owned / whole / gap), a `v{ver}·{letter}` **grouped accordion** with per-variant tells + rebalance, and a full **variant rail** in the modal. | ✅ built (never surfaced unidentified — nothing to strip) |
| **Parts Bin** | Variant-agnostic (accessories attach to the Figure blueprint, not the variant). | n/a |

The Inventory already shows variants on rows, gallery cards, and the detail modal and **never** surfaced an unidentified state — so it needs no change. **Add Figure** and **Instance Detail** carry now-dead UNIDENTIFIED UI that must be stripped (flagged above). What otherwise remains is data-layer cleanup (§6–§7).

---

## 6. Open questions & decisions

1. **Resolve the `variant` field-name collision (do this first).** Today `variant` is a free string serving as the *version/role* descriptor, while production variants live in a separate `variants: []` list. In the real schema, separate them cleanly: keep the version/role on the Figure (or derive from `series_id` + role), and model production variants only via `variant_lookup`. Pick unambiguous names (e.g. `figure.versionLabel` vs `variant_lookup` rows).
2. **Reconcile the two source files.** `figures_2.0` (654 rows) is **"normalized to version level"** and is canonical; the older **per-variant file (708 rows)** carried the finer production-variant granularity. The ~100-row divergence (see `PARTS_BIN.md` / `TAXONOMY.md`) is largely the variant split. Decide: does `variant_lookup` get seeded from that 708-row file, and how are the orphan rows reconciled? **Blocks** populating real tells.
3. **Add the instance ↔ variant FK.** `INSTANCE_MODEL.md`'s `Instance.figureId` is "variant-level" in prose but stores no variant. Add a nullable **`variantId`** (null = single-variant figure; the UNIDENTIFIED meaning is dropped — see §7.3). Confirm cardinality.
4. **Surface variants in Inventory.** ✅ **DONE** — per-variant pips (rows + cards), a grouped accordion, and a variant rail in the modal. (No unidentified group/filter — that state is dropped, §3/§7.3.)
5. **Rarity treatment.** `rare: true` exists on the data (e.g. Cobra Commander v1·A "Mickey Mouse" logo). A ★ RARE tag was prototyped across the Inventory but **pulled back as an oversteer** — the field is retained in the data, just not surfaced. Open: decide a lighter-touch rare treatment (e.g. only on the copy detail / wanted-list), and whether rare gets a filter or a wanted-list boost.
6. **Completeness × variant.** Accessory blueprints currently attach to the Figure, not the variant. Confirm whether any variant has a *different* required-accessory set (e.g. a mail-away variant shipped bagged with no gear) — if so, the blueprint must key on `variantId`, not `figureId`.
7. **Figures not in the catalog — ✅ RESOLVED (June 2026).** Only one path: **append a real missing figure** (a mail-away/convention/exclusive not in `figures_2.0` yet) as a normal catalog row. The **custom / homemade path was dropped** (doesn't fit completionism) and `isCustom` is retired. Designed in `GI Joe Tracker - Add Missing Figure.html` — see 7.6 / `OPEN_QUESTIONS_Claude.md` #8.

---

## 7. Deepened model — resolving the open decisions (June 2026)

This section works each decision in §6 to a concrete, build-ready recommendation, grounded in the actual prototype data shapes. Items marked **🔒 owner-confirm** are product calls that need the owner's domain judgment before they harden; everything else is a defaulted engineering decision the build can proceed on.

### 7.0 The collision, stated precisely

One word — *variant* — is doing **five different jobs** in the prototype data. This is the root of decision #1. Enumerated from the real files:

| Field as written | Lives in | Real example values | What it actually means |
|---|---|---|---|
| `variant` *(free string)* | `wf-data.jsx` early years; `add-figure-catalog.js` single-variant rows | `"v1 · straight-arm"`, `"Communications"`, `"v2 · w/ Timber"`, `"Trooper"` | a hand-mashed blend of **version + specialty + (sometimes) a tell** |
| `version` / `ver` | `wf-data.jsx` 1984 live data; `add-figure-catalog.js` | `"v1"`, `"v2"`, `"v1.5"` | the catalog **version** axis |
| `role` / `specialty` | `add-figure-catalog.js`; `wf-data.jsx` 1984 | `"Infantry"`, `"Transportation"` | the **specialty** (display-only) |
| `variants` *(number)* | `wf-data.jsx` 1984 live data | `3`, `2` | a **count** of production molds |
| `variants` *(array)* | `add-figure-catalog.js`; `instance-detail.jsx` `FIG_VARIANTS` | `[{letter, ver, tell, owned}]` | the **production-variant entities** |

The cleanup is to give each job its own name and home, and **retire the free `variant` string entirely.**

### 7.1 Canonical schema (decision #1 — RESOLVED, naming locked)

Three persistent levels + one derived count. Names chosen to be unambiguous:

```
Figure                       // catalog row — source: figures_2.0 (654)
  id            : "F00x"
  characterName : string     // was name / code_name — the persona (NOT its own table)
  versionLabel  : "v1"|"v2"|"v1.5"   // was version / ver — the catalog-version axis
  specialty     : string     // was role / the role half of the old `variant` string
  year, seriesId, faction, fullName, altName, blueprint, …
  // NO `isCustom` flag — the custom/homemade path was dropped (7.6); every Figure is a real catalog entry.
  // NO free `variant` string. NO stored `variants` count.

ProductionVariant            // source: variant_lookup, FK → figureId
  id
  figureId      : "F00x"     // FK → Figure
  letter        : "A"|"B"|…  // scoped to the figure; display as v{figure.versionLabel}·{letter}
  tell          : string     // the physical distinguisher — searchable free text
  rare          : boolean?    // retained; lightly surfaced (see 7.4)
  // NO `ver` field — it's the parent figure's versionLabel (a Figure IS one version)
  // `owned` is DERIVED, never stored

Instance                     // source: owned_figures (see INSTANCE_MODEL.md)
  …
  variantId : FK → ProductionVariant, NULLABLE
    // null = single-variant figure (nothing to pin). NOT "unidentified" — that
    // state is dropped (§3): a multi-variant figure's variantId is always set at
    // Add time. No identify-later, no audit/timestamp fields.

  // DERIVED, never stored:
  //   variantCount(figure) = figures_2.0's mold-count column (NOT count(variant_lookup) —
  //     a figure can have variantCount=3 with zero authored tells yet; see 7.2)
  //   multi = variantCount > 1
```

**Field-rename / migration map** (one-time, applied when seeding from the prototype + CSVs):

- `name` / `code_name` → **`characterName`**.
- `version` / `ver` → **`versionLabel`**.
- `role` → **`specialty`**.
- `variants:N` (count) → **dropped**; recompute as `variantCount` from `variant_lookup`.
- `variants:[]` (array) → rows in **`variant_lookup`**.
- The legacy free `variant` string → triaged per this rule:
  1. **Starts with `v<digit>`** (e.g. `"v1 · straight-arm"`, `"v2 · w/ Timber"`): the `vN` token → `versionLabel`. The remainder after `·` is then classified:
     - a **mold/paint tell** ("straight-arm", "thick thumbs") → seed a `variant_lookup` tell;
     - an **accessory/pack note** ("w/ Timber") → **discard** (it belongs to the blueprint / is what makes it a distinct Figure row, not a production variant).
  2. **No `vN` token** (e.g. `"Communications"`, `"Trooper"`, `"Mercenary"`): it's a **specialty** → move to `specialty`, default `versionLabel = "v1"`.

### 7.2 Seeding `variant_lookup` (decision #2 — RESOLVED: 708 dropped)

**The 708-row per-variant file is dropped.** `figures_2.0` (654, version-level) is the **sole** catalog source, and it will live as a reference table in the app's database, not as a loose CSV. This removes the whole reconciliation/orphan problem — there is nothing to match.

But it has a consequence worth stating plainly:

- `figures_2.0` carries a **production-variant count** per figure (the `variants:N` the prototype's 1984 live data already reads — e.g. Blowtorch `3`, Firefly `2`), **but not the per-variant tells.** It tells us *how many* molds exist, not *how to tell them apart*.
- So `variant_lookup` is **not seeded from catalog CSV data at all.** It becomes **owner-authored reference data** — the tells ("thin thumbs", "glossy finish", "Mickey-Mouse logo") are knowledge the owner adds, not something imported.

Resulting model:

1. **`variantCount`** comes straight from `figures_2.0` → drives `multi = variantCount > 1` and how many empty variant slots a figure exposes.
2. A figure with `variantCount > 1` but **no authored tells yet** shows its molds as **`v1·A / v1·B / …` with an empty/“tell not recorded” state** — the count is known, the distinguisher is a fill-in-later field. (This dovetails with the ⚑ UNIDENTIFIED lifecycle: you can own and pin to "variant B" even before its tell is written, and add the tell when you learn it.)
3. ⚠️ The thin/thick-thumbs strings in `add-figure-catalog.js` and `FIG_VARIANTS` were **demo placeholders** — with 708 gone they have no source and should be treated as throwaway sample text, replaced by owner-authored tells over time.

Net: decision #2 is no longer a data-merge task. It's a small product decision — **`variant_lookup` is a thin owner-editable table** (FK→figure, letter, tell, rare), pre-populated only with empty lettered slots up to `variantCount`, filled in by the owner as they go. Needs a lightweight "edit tell" affordance somewhere (Instance Detail's VARIANT IDENTITY panel is the natural home). ✅ **CONFIRMED (June 2026): everything is manually added** — tells are owner-authored, no import from any other source.

### 7.3 Instance ↔ Variant FK (decision #3 — RESOLVED)

- Add nullable **`variantId`** to `owned_figures`. **`null` means only one thing: a single-variant figure** (nothing to pin) — it does **not** mean "unidentified" (that state is dropped, §3). For a multi-variant figure `variantId` is **always set** at Add time.
- **Cardinality:** one Instance → 0..1 ProductionVariant; one ProductionVariant → 0..N Instances.
- **Integrity rules:**
  - If the Instance's Figure has `variantCount > 1`, `variantId` is **NOT NULL** and MUST resolve to a variant whose `figureId` equals the Instance's `figureId`. (Enforced at Add — you can't advance without picking one.)
  - If `variantCount ≤ 1`, `variantId` is **always null** — single-variant figures have nothing to pin, so the picker is never offered and the field stays null (don't auto-pin the lone variant; there is no variant to point at).
- **No resolution audit.** With the identify-later lifecycle gone, there's no guess-history to keep: a variant is chosen once at Add time and can be **corrected** via Instance Detail's `change ›` (a plain overwrite). No `variantIdentifiedAt/From` fields, no change log — the row simply holds the current `variantId`.
- **On catalog delete of a ProductionVariant:** prefer `ON DELETE RESTRICT` (block deleting a variant that owned copies point at) — since copies are always identified, silently nulling them would manufacture exactly the unknown state we just banned. If a variant must be removed, re-point its instances first.

### 7.4 Rarity (decision #5 — RESOLVED, restated)

Keep `rare` in the data. Surface it **only** on Instance Detail and the modal's variant rail as a small ★ next to the tell — **no collection-wide RARE filter or list tag** (the earlier all-over treatment was pulled back as an oversteer, see §6.5). A wanted-list boost is parked until the wanted-list feature exists.

### 7.5 Completeness × variant (decision #6/#3 — RESOLVED for the channel case; amended 2026-07-12 for the same-channel hardware case)

The mail-in / convention question is settled by how the catalog is structured (see 7.2.1): **whole-figure mail-in/convention/exclusive releases get their own catalog row** (the 700-block), so a release with different gear is simply a *different Figure* with its own blueprint. Therefore:

- **Blueprint keys on `figureId`, full stop — for channel differences.** All production variants of one Figure still share its required-accessory set *by default*. There is **no `variant_blueprint_override` table** — the earlier escape hatch is dropped, because the case it guarded against (one row, two channel-different gear sets, e.g. retail vs. mail-away) doesn't occur: each channel release is its own row.
- **A lone accessory that only came via a channel** (a single bonus piece, mail-in only, on an otherwise-retail figure) stays handled by the existing **`release_context`** flag on the accessory (`retail` counts toward completion; `convention`/`mail-in`/`bonus`/`exclusive` tracked but excluded) — see `PARTS_BIN.md` / OQ#5. That's an accessory-level concern, not a variant-level one.

**Amendment (Blocker, 1987, 2026-07-12):** the case above assumed the only way a blueprint could legitimately differ *within one catalog row* was a channel difference — it didn't anticipate two **same-channel (both retail)** production variants shipping with different hardware. Blocker v1 B ("With visor") included a Visor; v1 A ("No visor") never did — confirmed by the owner, not a channel/mail-in distinction. A plain, unscoped blueprint row had no way to express "required for B, doesn't exist for A" and was marking every v1 A copy permanently incomplete for a part it can't physically have.

Resolution: a fourth, narrow, optional axis — nullable `figure_accessories.variant_id` (FK → `variant_lookup.id`; `NULL` = applies to every variant, unchanged default for every pre-existing row). Full mechanism, data model, and the completeness-engine wiring (still per-instance, not a figure-level override — each *copy* filters its own blueprint by its own pinned variant at read time) are in `ACCESSORY_GROUPS.md` → "`variant_id` mechanism". The "no override needed" framing above still holds for the channel case; it just isn't the only case that exists.

So completeness mostly doesn't need to know about production variants — but per-copy checks now do, when a variant-scoped row is present (the common case remains untouched).

### 7.5.1 Catalog ID scheme & owner-extensibility (new — from the real CSV)

Two facts about `figures_2.0` that the whole model now depends on:

- **IDs are stable keys with intentional gaps, not a sequence or a count.** The CSV runs **001–629**, then a page break, then **700–724**, with the gap left deliberately as headroom. The 700-block is the **mail-in / convention / exclusive expansion zone**. ⇒ **Never** treat figure IDs as contiguous, never use `max(id)` as a count, never assume "next id = last + 1." Allocate new IDs into the appropriate range by hand.
- **The catalog is owner-extensible reference data, not frozen seed data.** `figures_2.0` does **not** list every mail-in/convention figure; the owner adds rows as they discover figures missing from the database. This refines the BACKEND "catalog = read-only seed" line: it's read-only to the *Add-Figure ownership flow*, but the **owner (= admin, single-user)** can append catalog rows. Two distinct add-paths fall out of this — see 7.6.

### 7.6 One add-path: "missing real figure" (decision #7 — custom path dropped June 2026)

The catalog is owner-extensible (7.5.1), so "this figure isn't a clean pick" originally split into two actions. **The owner cut the custom path (June 2026)** — a fantasy/kitbash has no "complete" state to chase, so it doesn't fit a completionist collection. **One action remains:**

1. **Add a real figure missing from the catalog** (a mail-in/convention/exclusive the owner discovered isn't in `figures_2.0` yet). This **appends a real catalog row** (owner-as-admin), allocated into the right ID range by hand — the 700-block for mail-in/convention/exclusive, or a gap. It is a *normal* Figure thereafter: real F-code, real blueprint, can carry a `variantCount` and authored tells like any other.

~~2. Add a custom / homemade figure~~ — **DROPPED.** No `isCustom` figures; the flag is **retired from the data model** (see 7.1 schema). Every Figure is a real catalog entry.

**Designed** — `GI Joe Tracker - Add Missing Figure.html` (`add-missing-figure.jsx`): a single owner-as-admin "append catalog row" form (hand-allocated 700-block ID + blueprint + variant count), handing off to Details → Condition. It's a **rare** action — the seed catalog is assumed essentially complete, and the same rows can be added by editing the reference DB directly (both write the same catalog table). Build follow-ups (wire the FIND link, gate the admin form, persist the row) live in `OPEN_QUESTIONS_Claude.md` #8.

### 7.7 Inventory wiring follow-up (decision #4 — make it data-driven)

The Inventory's variant UI is built but runs on synthetic per-figure counts. To ground it on the real FK:

- `variantCount` ← `figures_2.0`'s mold-count column (not a count of `variant_lookup` rows).
- per-variant **owned / whole / gap** pips ← group `owned_figures` by `variantId`.
- **null-variant instances are single-variant figures** — they roll into the figure-level totals without their own per-variant pip (there is no variant to attribute them to). No "unidentified" bucket exists (§3).
- deep-link `?figure=F00x&variant=v1·B` resolves `(figureId, versionLabel·letter)` → a `variantId`.

### 7.8 Build order

1. Land the **schema rename** (7.1) + the migration map — unblocks everything, removes the field collision.
2. Add **`variantId`** to `owned_figures` (7.3) — nullable, null = single-variant only; no audit fields.
3. **Stand up `variant_lookup`** as a thin owner-editable table — pre-fill empty lettered slots up to each figure's `variantCount` (from `figures_2.0`), tells filled in by the owner over time (7.2). No CSV merge.
4. Re-wire **Add Figure / Instance Detail / Inventory** off the synthetic data onto the real tables (7.7). Variant pick is a hard gate for multi-variant figures.
5. *(No override table.)* Completeness keys on `figureId` only (7.5); mail-in/convention releases are their own catalog rows.

---

## 8. Reference

- **Prototypes:** `GI Joe Tracker - Add Figure.html` + `add-figure.jsx` (variant picker, defer path); `GI Joe Tracker - Instance Detail.html` + `instance-detail.jsx` (VARIANT IDENTITY panel).
- **Source data:** `variant_lookup` (the tells), `figures_2.0` (654, version-level, canonical), the superseded 708-row per-variant file. See `PARTS_BIN.md` → *Tables* and `TAXONOMY.md` → *Series*.
- **Related model:** `INSTANCE_MODEL.md` (the Instance entity that gains `variantId`); `README.md` → *Data Model* (where `variant` is described as a flat string — superseded by this doc).
