# Open Questions — G.I. Joe Collection

> **Merged 2026-08-16** from two separate docs that had drifted into overlap and mutual
> confusion: `OPEN_QUESTIONS_Claude.md` (design/architecture decisions from the original
> handoff, items below prefixed **`Q`**) and `OPEN_QUESTIONS_ISSUES_FOUND.md` (the owner's
> running bug/build log while using the app, items below prefixed **`F`**). The two files'
> numbering used to collide (a `#21` in one meant something different from `#21` in the
> other) — the `Q`/`F` prefix fixes that permanently. Resolved items are kept as **one-line
> stubs**, not deleted outright, so every existing `Q18`/`F24.b`-style citation elsewhere in
> the repo (`PARTS_BIN.md`, `VARIANTS.md`, `README.md`, etc.) still resolves to something.
> Full history for any stub is in `git log` or the linked spec doc.

---

## Open — still unresolved

### Q7. Filtering & sorting — Second pass (deferred)
The v1 toolbar shipped (multi-select facets, More Filters panel, active-filter summary line — all built). Two features were prototyped this pass but **deferred, not built**:
- **`[Sort]` control** — order figures within each year section by Code Name · % Complete · Closest to done · Copies owned · Recently added/modified. Recency needs real `added_at`/`modified_at` on instances.
- **`[＋ Save view]` chip** — save current chips + facets + sort as a named, one-tap view. Open sub-question: where do saved views live (local pref vs. server) once multi-user?
- Both must sit **alongside** the v1 chips, not replace them (a "fold into a views bar" alternative was explicitly rejected).
- Reference builds (not wired into the live bundle): `_archive/inventory-app (2nd-pass · v3 chips+sort+saved).jsx` and `_archive/inventory-app (2nd-pass · v2 folded-views).jsx`.

### Q10. Identity, branding & legal
Name is decided (**"G.I. Joe Collection,"** vintage-ARAH-file-card mark, live everywhere). **Still open:** the name uses the Hasbro G.I. Joe/Cobra trademark by deliberate choice — fine for private unpublished use, but **revisit before any public release** (an IP-attorney call; franchise names are safer as catalog *data* than as branding). A franchise-neutral fallback name set was explored and shelved for that scenario.

### Q11. Photos
Unresolved: source (own photos vs. catalog imagery — licensing), capture flow (upload, mobile camera), storage (object store + thumbnails), and per-instance vs. per-figure scope. Every image is a placeholder today.
- 🔭 Parked idea: hover/tap an accessory in the checklist to preview its `image_url` (empty in the current seed) — not scoped, not blocking.

### Q12. Persistence of view state
Unresolved: which UI state should live in the **URL** (search, filters, expanded years — shareable/bookmarkable) vs. **local prefs** (view mode, sort dir, theme). A recommended split exists in `README.md` but hasn't been decided/built.

### Q14. Typography / fonts
Role definitions are settled (display = Oswald, mono = Space Mono; `Patrick Hand` retired from Inventory as dead weight). **Still open:**
- **Hosting** — move off the Google Fonts CDN (self-host, subset, `font-display: swap`); affects offline/PWA use and FOUT.
- **Family confirmation** — is condensed Oswald the long-term display face or a stand-in? Is `Patrick Hand` worth keeping anywhere, or fully retired? Pin licenses for whatever ships.
- **Scale & accessibility** — set a real minimum legible size + type scale, confirm contrast for `--ink-soft` on `--paper`.
- **User preference?** — could font family/base size become a theme/density setting (ties to Q12)?

### Q15. Expansion to Vehicles (+ Playsets) — 🔭 direction set, not built
A planned major expansion (~3× the figures/accessories experience). Direction agreed in design review:
- **Model `itemType` as first-class data now** — `figure | vehicle | playset` on one shared "collectible" shape reusing the same completeness model. Cheap today, expensive to retrofit later.
- **Nav:** one `[Vehicles]` tab first, with Playsets as an in-tab modifier chip (promoting it to its own tab later is a one-line nav change, not a refactor).
- **Header stats:** the 3 stat boxes go contextual per active tab (Figures/Vehicles/Playsets), not a growing grid.
- **Cross-type "By Year" overview:** a separate mode aggregating all item types by year/Series — hosts the whole-collection rollup the contextual header deliberately drops.
- **Knock-on:** Parts Bin will need an item-type filter once vehicle parts (missiles, stickers, canopies, panels) enter the pool.
- **Scale prep, checked 2026-09-03 (see `BACKEND_AND_SCALE.md` §6/§8 for the fuller plan):** row count is a non-issue at any scale this expansion could plausibly reach (DB is 1.2MB today at ~800 instances). What actually needs doing before/while building this:
  - `vehicles` + `figure_vehicles` tables already exist in the schema (migration already ran) but have **0 rows** and are **not wired into `buildCatalog()`** (`server/catalog.js`) or any API route yet. There's no `vehicle_accessories` join table analogous to `figure_accessories` — building the vehicle parts list means adding that table + a blueprint query, mirroring the existing figure pattern, not inventing a new one.
  - Give vehicles (and playsets) their **own fetched-once endpoint** (`/api/vehicles`), not nested into every figure row via `buildCatalog()` — same split as today's `/api/catalog` vs `/api/accessories`. The app fetches everything in one shot with no pagination (`web/src/store.js` `CAT`/`ACC`/`state`), so keep new entity types additive to that pattern, not folded into the existing payload.
  - **No image storage exists yet** — `vehicles.image_url_primary`/`file_cards.image_url_primary` are ready as TEXT path columns, but there's no upload directory or static-serving route in the repo. Decide the local `images/`-folder-plus-static-route plan *before* attaching real vehicle/playset photography, since vehicles and file cards are inherently more photo-heavy than figures (which are still hatched placeholders).
  - No virtualization library is installed (`web/package.json` has only `react`/`react-dom`) — the §6 gallery-virtualization plan was never built. Not urgent, but worth a look once Vehicles/Playsets roughly double the browsable item count.

### Q16. Sub-Team "chase" view — 🔭 parked idea, low priority
Beyond sub-team as a filter/grouping axis (resolved, see `TAXONOMY.md`), an early prototype explored sub-teams (Tiger Force, Night Force, Battle Corps, etc.) as **collectible sets to chase to completion** — tile of member chips by owned-state, a SET FOCUS overlay, large-roster collapse. Low priority because it's a presentation layer only, addable anytime without schema work. If revived: needs an authored set→members table (rosters aren't in the seed catalog), a decision on whether "chase" status reuses complete-now logic, and a nav slot. Reference build (archived): `_archive/GI Joe Tracker - Sub-Team Chase.html` + `_archive/subteam-chase.jsx`.

### Q18. CSV data quality — `full_name` field review (flagged July 2026, mostly still open)
An audit of `gijoe_db_figures_2.0.csv` found code names shared by multiple `full_name` values. 4 genuine distinct-character cases were resolved via `character_key` (migration 002). The rest — mostly typos, a few real file-card variation — need owner verification against physical cards or a trusted reference (YoJoe, HissTank) before correcting; **do not bulk-correct**.

**Flint (F125/F701) is fully resolved** — worked end-to-end as the concrete case: three spellings (Faireborn/Faireborne/Fairborne) confirmed as real era-correct file-card text, not a typo; F125's `release_context` corrected `"1992 Convention"` → `retail`; F701 (the real 1992 Convention-exclusive Flint, previously silently dropped by `server/seed.mjs`'s dedup logic) recreated as its own catalog row with an owner-confirmed accessory blueprint.

**Still open / un-audited** — 11 straightforward name-typo rows (General Flagg, Gung-Ho, Heavy Duty, Lightfoot, Low-Light, Lt. Falcon, Mutt, Ozone, Sci-Fi — plus Snake-Eyes and Storm Shadow, both intentional name-obfuscation, no fix needed) and a larger **systemic mainline/convention collision** affecting ~19 more code-name pairs, triaged but not resolved:

| Code name | Likely shape | Notes |
|---|---|---|
| Ice Viper | Likely genuine split | Same shape as Flint/Quick Kick |
| Steeler | Likely genuine split | Same shape as Flint/Quick Kick |
| Python Officer | Likely split candidate | Already got `ACCESSORY_GROUPS.md`'s `release_context` treatment instead — a split would need to undo that |
| Python Tele-Viper | Likely split candidate | Same caveat as Python Officer |
| Motor Viper | Likely genuine split (variant A only) | |
| Outback | Likely accidental duplicate | Already has an `ACCESSORY_GROUPS.md` entry; deeper collision left parked per owner instruction |
| Undercover Scarlett | Likely accidental duplicate | Convention-exclusive, never had a retail counterpart to split from |
| Falcon | Likely accidental duplicate | Already has an `ACCESSORY_GROUPS.md` entry |
| Rumbler | Likely accidental duplicate | |
| Heavy Metal | Likely accidental duplicate | Vehicle-driver flag only on the mainline row — needs a look |
| Snow Serpent (v1 pair) | ✅ Resolved 2026-07-21 | Genuine split — see `FIGURE_SPLITS.md` |
| Tripwire | Likely accidental duplicate | |
| Shortfuse | Likely accidental duplicate | `faction_id` flips between rows — real data-corruption tell, verify which is right |
| Zarana | Likely accidental duplicate | Same faction-flip tell as Shortfuse; already has an `ACCESSORY_GROUPS.md` entry |
| Snake Eyes (convention pair) | Likely accidental duplicate | Distinct from the numbered v1–v4 retail lineage, which is fine |
| Roadblock (v2 pair) | ✅ Resolved 2026-07-21 | Genuine split — see `FIGURE_SPLITS.md` |
| Gung-Ho (v2 pair) | Likely accidental duplicate | Left parked per owner instruction |
| Stalker (v1.5 B pair) | ✅ Resolved 2026-07-22 | Genuine split (3-way tie) — see `FIGURE_SPLITS.md` |
| Skystriker / Starduster | Likely accidental duplicates (per-letter) | 3–4 rows per figure, same shape as the pairs above |
| Fighter Pilot | Ambiguous — needs real research | Could be two real events or a mislabel |

`FIGURE_SPLITS.md` is the per-figure log once any of these get resolved (split via `server/split-release-edition.mjs`, or confirmed as a duplicate). The systemic silent-drop bug that caused the Flint gap is fixed (dropped rows now log explicitly on every reseed).

### Q19. CSV data quality — `is_vehicle_driver` / `vehicle` review (flagged July 2026)
Grunt v1.5 (F065) shows `is_vehicle_driver = 0` while its sibling v2 (F066) = 1 and the same-series Grand Slam carries the flag on all three of its rows — worth confirming whether Grunt v1.5 should too, or genuinely shipped standalone. Not independently verified; flagged from the data pattern alone.

### Q21. Live DB backup — remaining gap
Local-only periodic backups are built (`npm run backup` → `backups/`, 30 kept) plus a catalog-only readable snapshot (`npm run export-catalog` → `exports/`). **Still open:** these are single-machine, same-disk — a drive failure loses both the live DB and every snapshot. Real off-machine backup needs either the GitHub repo going private (reopening "commit the DB" as an option) or pointing backups at some off-machine location. Also parked: replacing the root seed CSVs so `server/seed.mjs` could re-import them faithfully (a lossy, field-by-field design problem, not mechanical).

### Q23. Figure body-parts tracking — 🔭 parked idea, not scoped
A separate loose-parts concept from the Parts Bin (which is accessories-only, keyed to `accessory_id`/`figures_accessories` — see `PARTS_BIN.md`): tracking figure **body parts** acquired without a complete figure attached — via mixed collection-lot purchases, kit-bashed/disassembled figures, or breakage at common failure points (thumbs, waist) that make swaps with spare/damaged parts possible.

**Physical model as described by the owner:**
- 6 main parts: head · chest · left arm · right arm · waist · left leg · right leg.
- 12 total sub-parts: head · chest (front) · chest (rear) · left arm · right arm · waist · left leg (upper outside) · left leg (upper inside) · left leg (knee to foot) · right leg (upper outside) · right leg (upper inside) · right leg (knee to foot).
- Hardware (assembly documentation only, not intended as trackable stock): 1 rear screw (holds head/arms/chest), 2 leg screws (hold each leg's 3 segments together), 1 j-hook (holds legs together), 1 o-ring (through the waist, joins assembled torso to assembled legs).

**Scope for if/when this gets built:** primary target is a **loose body-parts inventory** — parts not currently attached to any complete figure — as a third bucket alongside the `Instance` entity (`INSTANCE_MODEL.md`) and the Parts Bin (`PARTS_BIN.md`). Per-instance provenance/mismatch tracking (flagging that an assembled copy's leg is a swapped-in spare) is a possible later extension, not a decided companion feature.

**Explicitly out of scope for now** (the reason this is parked, not designed): swap/compatibility recommendations, any damage-map retooling to support them, and color/paint-fade matching across candidate swap parts — all flagged by the owner as real complications worth a dedicated future discussion, not to be guessed at now.

**Standout exceptions:** some figures don't fit this breakdown at all — e.g. Deep-Six v1 has a non-interchangeable body. No master exception list exists; these get flagged figure-by-figure as discovered, the same pattern used elsewhere in this app for other per-figure exceptions (variant splits, `release_context`).

**Still undecided:** whether this becomes its own spec doc alongside `PARTS_BIN.md`/`INSTANCE_MODEL.md` or stays a parked idea until scoped; whether a body part needs its own catalog/identity concept (parallel to `accessory_id`) or reuses/extends the damage map's existing `bodyType` template + o-ring point model (`INSTANCE_MODEL.md`).

### Q24. Selling-lot recommendations — 🔭 parked idea, owner likes the direction, not committed to build
Recommend lots of surplus copies to sell (owner's example: lots of 10 or 15), driven by the Master Collection goal (`MASTER_COLLECTION.md`) — and strip anything the kept collection still needs off outgoing copies before they ship (owner's example: hoses).

**Proposed approach (talked through 2026-10-27, not built):**
1. **Keeper vs surplus per figure** — the first `master_target` copies are keepers, ranked by the existing instance order (manual pin first, then completeness — see migration 017 `pinned_no`); every copy beyond that is surplus. Raised per-variant targets (wanting multiple copies) shrink the surplus automatically, so targets need to be accurate before trusting a recommendation.
2. **Pull-before-ship list** — walk each surplus copy's attached accessories; anything a keeper is still missing gets flagged to move first (e.g. "Lot 3: pull A1902 hose off Barbecue No.3 → Barbecue No.1"). Should reuse the shared completeness/group clustering (`shared/completeness.js`), not the raw `v_instance_missing_accessories` view, which ignores pick-one `group_id` slots.
3. **Lot assembly** — group surplus copies into N-sized lots; candidate axes: year/wave, faction/sub-team, complete vs. parts-figure, condition (damage data already exists).
4. **Damaged option (owner request 2026-10-27)** — a per-lot condition mode, chosen when building the lot:
   - **Damaged only** — a "damaged lot": damaged surplus figures together with damaged accessories (both ones still attached to outgoing copies and loose damaged units in the Parts Bin).
   - **Mixed** — clean and damaged figures and accessories in the same lot, the lot's condition makeup listed alongside it.

   Condition data already exists to drive this: figure physical/paint grades from the damage map (`instances.phys`/`paint`, `marks`), damaged attached units (`instance_accessory_damage`, one row + note per unit), and damaged loose units (`bin_damage`, same). Per-unit damage notes should print on the lot's listing so the buyer-facing description matches what ships — the same notes already travel with units through `pullPart` / `swapAccessoryForClean` / `swapAccessoryToBin`, so they'll be accurate by the time a lot is built.

**Snapshot at time of discussion (live DB, 2026-10-27):** 937 instances across 292 figures; Master Collection = 528 starred figures / 532 target units; ~641 surplus copies across 193 figures (upper bound against current targets); 236 figures still short of target. Hose shortfall on keepers is real — A1900 short 29 units (20 copies), A1901 short 19 (18), A1902 short 76 (56) — vs. only 8 / 7 / 31 units attached anywhere — so every hose on an outgoing copy likely stays.

**Known gaps / still undecided:**
- **No price/value data** — lots can't be value-balanced or optimized without at least rough values per figure.
- **Form factor** — one-off generated report (suggested first step: one sample lot with keeper/surplus reasoning + pull list) vs. a "Selling Lots" screen alongside Parts Bin.
- Lot size and preferred grouping axis — not chosen.
- Whether sold copies get a disposition record or are just deleted (Master Collection deliberately has no disposition tracking — see `MASTER_COLLECTION.md`).
- **Damaged option — undecided details:**
  - **Damage threshold** — what makes a *figure* "damaged" for lot purposes: any damage mark, or below a grade cutoff (e.g. physical or paint grade under some level)? An accessory is simpler — it has a damage row or it doesn't.
  - **Ungraded copies** — copies whose damage map was never filled in (no marks, not confirmed clean) aren't known to be clean *or* damaged; exclude them from both modes, or flag them as "condition unknown"?
  - **Clean-for-damaged swap before shipping** — should a damaged lot first trade clean accessories on outgoing copies onto keepers that hold damaged units (same idea as `swapAccessoryForClean`, but copy → copy instead of bin → copy), so the damaged unit ships and the keeper gets the clean one? Fits naturally beside step 2's pull-before-ship list.
  - **Loose damaged parts with no figure** — can a damaged lot include Parts Bin units alone (no figure attached), or are bin parts only ever added to lots that already contain figures?

### F4. Explanation/help text — ongoing effort
Standing rule, not a one-time fix: strip in-app "explanation/help text" wherever it appears, across every screen. Keep checking against this when adding new UI.

### F14. Figure "mark for upgrade"
Idea, not started: a way to flag an owned figure as wanting a condition/completeness upgrade later.

### F22. Dashboard "Complete" doesn't reflect duplicate whole copies
`JoeData.totals()` counts "Complete" at the unique-figure level — owning 2 whole copies of Firefly still only contributes +1, same as owning 1. Confirmed same semantics in the original prototype (not a port bug). **Owner hasn't decided** whether that's the intended semantic or whether a separate "whole copies" stat (counting every complete instance, duplicates included) should be added alongside it.

### F23. Add Figure search — same-name figures, remaining sort gap
The chronological tiebreak (year, then version) is built and verified. **Still open:** a differently-worded row for the same character (e.g. "Tripwire 'Listen 'n Fun'" for the Tripwire family) doesn't sort near its version-mates, because the sort's primary key is still alphabetical `name`. A real fix needs a "same character family" grouping key independent of display name. The schema already has an unused `figures.character_key` column that looks intended for this but is empty for all 528 catalog entries — populating it (and switching FIND's grouping/sort to it) is a bigger job than the tiebreak fix. Holding for owner review.

---

## Resolved — one-line log

Kept so existing `Q#`/`F#` citations elsewhere in the repo keep resolving to something. Full detail is in `git log` or the linked spec doc, not repeated here.

### Q — design/architecture track (from the original handoff)
- **Q1.** Instance model resolved — per-instance accessory checklist, derived Physical/Paint grades via damage map, primary pin, bin/box location, Parts-Bin pull. Full spec: `INSTANCE_MODEL.md`. (Minor unbuilt loose end, not blocking: a grade-weight tuning/rules editor.)
- **Q2.** Removed-copy lifecycle resolved — buy/sell out of scope; Add/Remove only, with an accessory-disposition prompt (keep → Parts Bin) on remove.
- **Q3.** Backend/data-source decided June 2026 (originally: Next.js + Turso/libSQL) — **superseded by Q17a**, which is what actually got built (local Express + better-sqlite3). Catalog = 3 read-only reference CSVs; app starts clean, no legacy import; single-user only. See `BACKEND_AND_SCALE.md`.
- **Q4.** Scale/performance resolved — ceiling 1,500–2,000+; server-paginated catalog, debounced search, virtualization, lazy thumbnails. See `BACKEND_AND_SCALE.md` §6.
- **Q5.** Completeness & accessory semantics resolved — complete-now vs. completable distinguished, rebalance recommender, spares overflow to Parts Bin, `group_id`/`release_context` locked. See `README.md` → Completeness math, `INSTANCE_MODEL.md`, `PARTS_BIN.md`. (Not blocking: a future per-instance "stored loose / assembled" flag.)
- **Q6.** Taxonomy resolved — 4 factions, Series as primary grouping axis, sub-teams as optional filter, faction hues set. See `TAXONOMY.md`.
- **Q8.** Undesigned flows resolved/built: Add Figure (3-step modal + MOC flag), Add Instance, the missing-figure catalog-append form, in-modal Edit Notes + editable accessory checklist with live rollup. Bulk operations (multi-select rows) explicitly **dropped** — not worth the complexity for a single-user tool.
- **Q9.** Mobile scope resolved June 2026 — responsive web now, PWA later, never native; mobile is a property carried from day one. Three habits enforced while building desktop: no hard-coded pixel widths, 44px minimum hit targets, modal→full-screen-sheet on narrow viewports. PWA lands in two independent stages (install-shell manifest first; offline-read service worker only if flea-market use proves painful). Offline **writes**/sync stay out of scope (separate future project, maybe never).
- **Q13.** Variant model resolved June 2026 — production-variant layer (character → figure → variant → instance) fully specified, the "unidentified" lifecycle dropped entirely. Full spec: `VARIANTS.md` §7.
- **Q17a.** Backend built — local Express + `better-sqlite3`, not Next.js/Turso. `server/index.js` + `server/*.js` read/write `gijoe_collection.db` directly.
- **Q17b.** Vite port built — real Vite build in `web/`, confirmed pixel-identical to the prototype at port time. (The root-level prototype files' dual-maintenance risk flagged here is now closed out: as of 2026-08-16 they carry an explicit "frozen mirror, don't edit" header pointing at their `web/src` counterpart.)
- **Q17c.** Per-instance data model built — `instances`, `instance_accessories`, `variant_lookup` are live; `figures` is pure read-only catalog. Migration: `migrations/001_per_instance_model.sql`.
- **Q17d.** catalog-data.js → DB sync resolved — `server/catalog.js` computes the catalog live from the DB on every request; the root `catalog-data.js`/`wf-data.jsx`/`add-figure-catalog.js` are historical, not read by the live app.
- **Q20.** TablePlus/live-server concurrent-write bug fixed July 2026 — switched `gijoe_collection.db` to WAL journal mode (`server/db.js`) so TablePlus and the running server can read/write concurrently without lock contention.
- **Q22.** Master Collection starred-row layout fixed August 2026 — new scoped `.mc-inst` row layout (flex, not the Figures page's shared 5-column grid) to remove dead space next to the stock bar. See `MASTER_COLLECTION.md`.

### F — build/issues track (the owner's running log while using the app)
- **F1.** Figure misdata (Airborne F045/F046, Grunt/Grand Slam v1.5-v2 pilot details) fixed.
- **F2.** "Ungraded" condition review resolved — a dev toggle exists to mark a figure clean/ungraded.
- **F3.** "Complete" vs. "whole" language inconsistency fixed.
- **F5.** Adjust-variant control built (July 2026) — the "N variants" badge is a button opening an inline A/B/C picker that PATCHes the instance's variant live.
- **F6.** Accessory groups/`release_context` fixed (July 2026) — bonus items (Accessory Tree family) reclassified in the data; group rendering reworked to render at each item's natural blueprint position.
- **F7/F7.b.** Per-copy row labeling built ("Breaker No. 1," then "+ variant name") — **superseded by F19**'s unified identity formatter.
- **F8/F8.b/F8.c/F8.d.** Damaged-accessory tracking built in stages (Figure modal → Add Figure intake → Parts Bin → per-row flag column) — **all four mechanisms later unified, superseded by F24**.
- **F9.** Dashboard year meters fixed to count at the (figure, variant) level, not per catalog figure; "Coverage"/"Complete" labeling and totals refined across 3 follow-ups.
- **F10.** Refined delete sequence built (July 2026) — 4-button in-card confirm: Remove Figure Only / Remove Figure + Selected Accessories / Remove Figure + All / Cancel.
- **F11/F11.b.** Show Collection Gaps fixed to account for missing production variants, with an inline "⚠ Missing variants" callout on expand.
- **F12.** Add Figure's incorrect post-commit "copy #N" fixed — the ordinal was removed from the success/summary text entirely.
- **F13.** Figure display cleanup — dropped borders around version/variant chips; vehicle tag moved inline with the figure name.
- **F15.** Catalog/Ghost Figure View fixed (accessory checklist styling, modal scroll) — **later eliminated entirely, superseded by F26**.
- **F16.** Add Figure's redundant duplicate commit button removed.
- **F17.** Country-of-origin tagging built (July 2026) — `figure_coo` + per-instance `instances.country_of_origin`, surfaced in the ghost modal, Add Figure DETAILS, and the owned Detail modal.
- **F18.** Safari card-flip percentage "leakage" (CONDITION face painting over FIGURE face) fixed via explicit `z-index` backstop to `backface-visibility`.
- **F19.** Figure identity format unified across all screens — shared `fig-identity.jsx`/`.js`, confirmed 8-field priority order (name → version → variant → year → faction → specialty → vehicle → copy ordinal).
- **F20.** Master/Personal Collection star + target-quantity built (July 2026, migration 009). See `MASTER_COLLECTION.md`.
- **F21.** 1993 Jinx wrong-series bug fixed — `series_id` corrected to the Convention block; surfaced a larger reseed-safety gap, since fixed (`server/seed.mjs` now refuses to run against a DB with owned instances without `--force`, always backs up first).
- **F24/F24.b.** Accessory input unified into one shared `AccItem` row + `DmgPopover` across all four surfaces (Figure modal, Add Figure, Parts Bin ×2); added a "swap to Parts Bin" option for a damaged/spare unit with nowhere else to go.
- **F25.** Add Figure's variant picker relocated to the DETAILS step everywhere (removed the FIND-step dropdown) and now defaults instead of hard-gating NEXT.
- **F26.** The separate ghost/catalog-gap preview modal eliminated — clicking an unowned figure now opens the same Add Figure overlay, locked to that figure, landing on DETAILS.
