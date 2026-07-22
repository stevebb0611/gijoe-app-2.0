# Figure Splits — release editions (retail + convention/mail-in re-release of the same figure)

> Companion to `VARIANTS.md` §7.5.2 ("Release editions"), which locks the general model: a
> figure sold once at retail and again later through another channel (convention, mail-in)
> with **genuinely different gear** is two separate `figures` rows, same `code_name`,
> disjoint `figure_accessories` blueprints — not a schema change, not an override table. This
> doc is the **per-figure operational log**, the same role `ACCESSORY_GROUPS.md` plays for
> `group_id`/`match_key`/`variant_id` — every figure that's had a real release-edition split
> applied (or a colliding-pair investigation resolved some other way) gets one entry below,
> chronological by the retail figure's year then catalog id.

## The problem

`server/seed.mjs` groups the CSV's `gijoe_db_figures_2.0.csv` rows into one `figures` row per
`(code_name, version, character_key)`. A retail row and its later convention/mail-in
re-release routinely share that key (same character, same production version number, blank
`character_key`) — so on every from-scratch rebuild the seed silently kept the lower-id row
and discarded the other. This is why a real convention-exclusive figure a collector actually
owns can be entirely missing from the live catalog with no error, no log line, nothing. The
CSV's own **700-block** (`figure_id` 700–724) is the dedicated mail-in/convention/exclusive
expansion zone (`VARIANTS.md` §7.5.1) — the collision is almost always a mainline-id row vs.
its 700-block sibling.

`OPEN_QUESTIONS_Claude.md` #18 has the full audit of every code name currently showing this
collision pattern in the CSV, sorted into a starting triage (likely genuine split / likely
accidental CSV duplicate / ambiguous). **Read that table before adding a new entry here** —
it's the backlog this doc's entries are worked off of.

**This is an open-ended log, not a backlog to close out.** `TAXONOMY.md`'s Series section has
the design history: the owner tried grouping convention releases under their literal release
year and didn't like it, so the policy is now "every convention/mail-in figure buckets under
the single Convention section (`series_id 15`), regardless of year." The source CSV
(`gijoe_db_figures_2.0.csv`) still has an unknown number of figures mistagged with their
mainline `series_id` instead of 15 — each one only surfaces when the owner notices it in the
live app or confirms it against a physical copy. Expect this doc and the CSV to keep getting
new entries figure-by-figure indefinitely, not in one final audit pass.

## Not the same thing as ACCESSORY_GROUPS.md's `release_context` mechanism

Two different fixes exist for what looks like the same real-world problem, and they are
**not interchangeable**:

- **This doc (release-edition split):** the two releases become two independent `figures`
  rows. You can own a copy of each, they show up as two separate entries in Inventory/Add
  Figure/Master Collection, each with its own blueprint and its own completeness. This is
  what "I own a carded retail copy *and* a bagged convention copy, with different gear on
  each" actually requires.
- **`ACCESSORY_GROUPS.md`'s `release_context` mechanism:** the convention/mail-in accessories
  stay on the **same** catalog row, tagged `release_context: 'convention'` (or `'mail_in'`),
  which pulls them into their own group in the checklist and makes them tracked-but-never-
  blocking for Complete. There is still only **one** ownable catalog entry — you can't
  distinguish "this physical copy is the retail one" from "this physical copy is the
  convention one" at the catalog level, you just have one figure whose blueprint happens to
  list some optional/bonus pieces alongside the required ones.

**Several figures on `OPEN_QUESTIONS_Claude.md` #18's collision list already got the second
treatment, not a split** — logged in `ACCESSORY_GROUPS.md` under **Mechanism: `release_context`**:
Falcon (1987, id 139), Gung-Ho v2 (1987, id 142), Outback v1 (1987, id 152), Python Officer
(1989, id 240), Python Tele-Viper (1989, id 241), Zarana (1986, id 127). Two of those entries
(Gung-Ho v2, Outback v1) say so explicitly — *"this entry only reclassifies the accessories
already attached to the surviving row, per owner instruction"* — i.e. the deeper collision
was consciously left parked when those were touched. **Listed here so a future pass doesn't
re-flag them as still needing a split** — they're a real, intentional resolution, just a
different one than Flint's. If any of them should become a real two-row split later, that's a
fresh decision, not a bug in either doc.

Flint itself used to be in that list (`ACCESSORY_GROUPS.md`'s old 1985 Flint entry,
2026-07-10) — **superseded 2026-07-16** by the real split below; that entry now says so and
points here instead of describing stale data. Roadblock v2 and Snow Serpent v1 were also in
that list (`ACCESSORY_GROUPS.md`'s old 1986 Roadblock and 1985 Snow Serpent entries,
2026-07-12 and 2026-07-10) — both **superseded 2026-07-21** by the real splits below, same
reason: the "likely accidental duplicate" call in `OPEN_QUESTIONS_Claude.md` #18's triage
turned out to be wrong once the owner confirmed both against the source data.

## Data model

No schema change — `figures.release_context` (`retail`/`convention`/`mail_in`/`mail_order`,
the last two distinguished per `MAIL_RELEASES.md`), `series_id 15` (the sentinel non-retail
bucket, heading "Special Release" as of 2026-07-20 — see `MAIL_RELEASES.md`), and
`figure_accessories` keyed on `figure_id` already do the whole job (`VARIANTS.md` §7.5). What
a split entry actually sets on the new row:

```
figure_id  code_name   version  series_id  release_context  (blueprint)
---------  ----------  -------  ---------  ---------------  -----------
F701       Flint       NULL     15         convention       own, disjoint from F125's
```

`version` is deliberately blanked (or left distinct from the retail row's) on the new row —
that's what stops the two from colliding on `seed.mjs`'s dedup key on the next from-scratch
rebuild, the same fix `server/split-quick-kick-convention.mjs` established first.

## Tooling

1. **`server/seed.mjs`** now logs the identity (`code_name`/`version`/`figure_id`/
   `release_context`) of any row dropped by the blank-variant collision path, instead of only
   an aggregate counter — so a future collision can't vanish silently again.
2. **`server/split-release-edition.mjs`** — the reusable split tool, generalized from
   `server/split-quick-kick-convention.mjs`. A small array of confirmed split specs; applying
   a newly-verified split means appending an entry, not writing a new script. Each spec:
   retail `figure_id`, new 700-block `figure_id`, the fields that differ, the accessory codes
   that belong on the new row's own blueprint (and any wrong accessory codes to strip off the
   retail row first — see Flint below).
3. Companion edits to the source CSVs (`gijoe_db_figures_2.0.csv`,
   `gijoe_db_figures_accessories_group_id.csv`, `gijoe_db_figures_accessories.csv`) are
   required alongside every live-DB split, same precedent Quick Kick's script established —
   otherwise a future from-scratch reseed re-collides the pair.
4. Restart the backend (`npm start` — it doesn't hot-reload) so `catalog.js` picks up the new
   row.

## Scope discipline

**Do not add an entry here from CSV data alone.** Per the Quick Kick precedent, some
colliding pairs are genuine second editions and some are accidental CSV duplicates (both rows
tagged the same non-retail context with near-identical data) — splitting a duplicate would
manufacture a second ownable catalog entry for something that was only ever sold once. Every
entry below was confirmed against a real reference or, ideally, the owner's own physically-
owned copy before being split. `OPEN_QUESTIONS_Claude.md` #18's triage table flags which
un-audited figures currently look like which case — verify before promoting one into this
doc.

## Figures (chronological by the retail figure's year, then catalog id)

### 1985 — Flint (v1 retail, figure catalog id 78 — source F-code F125; convention edition, id 525 — F701)

- **Mechanism:** release-edition split — two independent `figures` rows.
- **Collision:** F125 (retail, id 78) and F701 (700-block) shared `code_name`+`version` in
  the CSV with a blank `variant` on both, so `seed.mjs` silently kept F125 and dropped F701 on
  every rebuild — F701 didn't exist in the live DB at all until this fix.
- **Data-quality fixes bundled into the split:** F125's `release_context` was mislabeled
  `"1992 Convention"` in the source CSV despite being the real 1985 retail release
  (`series_id` 5) — corrected to `retail`. F125's live blueprint also had two accessories
  (Rifle A0680, Grenade Launcher (Pistol) A0681, tagged `convention`) that didn't belong to
  Flint at all — they were F701's own (also-wrong) CSV linkage leaking onto F125 via the
  collision, resolving to **Ambush's** gear per the accessories master, not Flint's. Removed
  outright, not reused.
- **New row (F701, id 525):** `series_id` 15, `release_context` convention, `version` NULL
  (disambiguates the dedup key). `display_name` "Flint (convention)", `full_name`/`specialty`
  carried over from retail Flint ("Faireborn, Dashiell R." / Infantry) — owner-confirmed, same
  character.
- **Accessories (owner-confirmed, from the physically-owned copy):** Rifle (A0692) — shared
  with Bullhorn — and Flare Gun (A0807) — shared with Stretcher. Both already existed as
  accessory rows (Falcon's own convention blueprint uses the same two — see
  `ACCESSORY_GROUPS.md`'s 1987 Falcon entry), just newly linked to F701.
- **Source:** owner (physically-owned copy), 2026-07-16.
- **Status:** ✅ split applied via `server/split-release-edition.mjs`, companion edits applied
  to all three source CSVs, verified via `/api/catalog` and visually in-app (headless
  Chromium/Playwright) — Flint renders twice: 1985 retail section (no edition badge, Field
  Pack + Riot Shotgun) and its own Convention section (CONVENTION badge, Rifle + Flare Gun),
  both in Inventory rows/modal and Add Figure's FIND results. 2026-07-16.

### 1985 — Quick Kick (v1 retail, figure catalog id 85 — source F-code F133; convention edition, id 524 — F404)

- **Mechanism:** release-edition split — two independent `figures` rows. This is the
  original precedent the model + tooling above were generalized from.
- **Collision:** F133 (retail) and F404 (mail order/convention) shared `code_name`+`version`
  in the CSV; `seed.mjs`'s dedup folded them into one catalog figure whose blueprint wrongly
  required all 6 accessories (both colorways) at once.
- **New row (F404, id 524):** `series_id` 15, `release_context` convention, `version` NULL.
  `display_name` "Quick Kick (convention)". Peach-colored skin, dark gray backpack, flimsy
  sword/nunchuks — distinct from retail's gear, owner-confirmed not a same-release paint
  variant.
- **Accessories:** dark gray Backpack, flimsy Sword, flimsy Nunchuks — moved off the retail
  row's blueprint onto F404's own (`server/split-quick-kick-convention.mjs`).
- **Side fix:** the "silver (flimsy)" color note on two of those accessories was split into a
  proper `accessories.color` value + `variant_notes`, same session.
- **Source:** owner-confirmed, 2026-07-12.
- **Status:** ✅ split applied via `server/split-quick-kick-convention.mjs` (the one-off
  script this doc's generalized tool was built from), verified via API round-trip, 2026-07-12.

### 1985 — Snow Serpent (v1 retail, figure catalog id 89 — source F-code F137; convention edition, id 527 — F710)

- **Mechanism:** release-edition split — two independent `figures` rows.
- **Collision:** F137 (retail, id 89) and F710 (700-block) shared `code_name`+`version` in
  the CSV with a blank `variant` on both, so `seed.mjs` silently kept F137 and dropped F710 on
  every rebuild — F710 didn't exist in the live DB at all until this fix.
- **Reopened call:** same shape as Roadblock v2 immediately below — `OPEN_QUESTIONS_Claude.md`
  #18's July 2026 triage read this pair as a "likely accidental duplicate" (both CSV rows
  tagged the same "1992 Convention" text) and it got `ACCESSORY_GROUPS.md`'s `release_context`
  treatment instead — Missile Launcher/Missile reclassified `convention` on F137's own
  blueprint, 2026-07-10. Owner instruction, 2026-07-21, overturned that call: unlike a true
  accidental duplicate, `gijoe_db_figures_accessories.csv` already linked F137 to only
  A0206–A0211 and F710 to only A0701/A0702 — a clean, disjoint split baked into the source
  data, not a leaked/wrong linkage like Flint's F701.
- **Data-quality fix bundled into the split:** F137's `release_context` was mislabeled "1992
  Convention" in the source CSV despite being the real 1985 retail release (`series_id` 5) —
  corrected to `retail`, same bug shape as Flint's F125.
- **New row (F710, id 527):** `series_id` 15, `release_context` convention, `version` NULL
  (disambiguates the dedup key). `display_name` "Snow Serpent (convention)", `alt_name`
  "Cobra Snow Viper", `full_name`/`specialty` carried over from retail Snow Serpent v1
  ("Classified" / Arctic Operations) — same character, same production version.
- **Accessories:** Missile Launcher (A0701) and Missile (A0702) — moved off F137's blueprint
  onto F710's own. Survival Backpack (A0206), Parachute Pack (A0207), AK-47 Assault Rifle
  (A0208), Snow Shoe (A0209, ×2), Anti-Tank EK99 Missile (A0210), and Missile Stand (A0211)
  stay required on F137.
- **Source:** owner, 2026-07-21.
- **Status:** ✅ split applied via `server/split-release-edition.mjs` (extended this session to
  also carry `alt_name` onto the new row — Flint/Roadblock didn't need it), companion
  `release_context` fix applied to `gijoe_db_figures_2.0.csv` for both F137 and F710
  (`gijoe_db_figures_accessories.csv` needed no change — already clean/disjoint), verified via
  direct DB read and `/api/catalog` round-trip (F137: 6-item retail blueprint, `retail`; F710:
  Missile Launcher + Missile, `convention`, year 9999/Special Release), 2026-07-21. Not yet
  visually verified in-app.

### 1986 — Roadblock (v2 retail, figure catalog id 115 — source F-code F167; convention edition, id 526 — F707)

- **Mechanism:** release-edition split — two independent `figures` rows.
- **Collision:** F167 (retail, id 115) and F707 (700-block) shared `code_name`+`version` in
  the CSV with a blank `variant` on both, so `seed.mjs` silently kept F167 and dropped F707 on
  every rebuild — F707 didn't exist in the live DB at all until this fix.
- **Reopened call:** `OPEN_QUESTIONS_Claude.md` #18's July 2026 triage read this pair as a
  "likely accidental duplicate" (both CSV rows tagged the same "1992 Convention" text) and it
  got `ACCESSORY_GROUPS.md`'s `release_context` treatment instead — Machine Gun/Mine Launcher
  reclassified `convention` on F167's own blueprint, 2026-07-12. Owner instruction, 2026-07-21,
  overturned that call: unlike a true accidental duplicate, `gijoe_db_figures_accessories.csv`
  already linked F167 to only A0264/A0265 and F707 to only A0787/A0793 — a clean, disjoint
  split baked into the source data, not a leaked/wrong linkage like Flint's F701. The CSV
  triage table's "likely" was just wrong for this one.
- **Data-quality fix bundled into the split:** F167's `release_context` was mislabeled "1992
  Convention" in the source CSV despite being the real 1986 retail release (`series_id` 6) —
  corrected to `retail`, same bug shape as Flint's F125.
- **New row (F707, id 526):** `series_id` 15, `release_context` convention, `version` NULL
  (disambiguates the dedup key). `display_name` "Roadblock (convention)", `full_name`/
  `specialty` carried over from retail Roadblock v2 ("Hinton, Marvin F." / Infantry Heavy
  Weapons) — same character, same production version.
- **Accessories:** Machine Gun (A0787, shared with S.A.W.-Viper) and Mine Launcher (A0793,
  shared with Salvo) — moved off F167's blueprint onto F707's own. L7A21 GPMG Heavy Machine
  Gun (A0264) and Tripod (A0265) stay required on F167.
- **Source:** owner, 2026-07-21.
- **Status:** ✅ split applied via `server/split-release-edition.mjs`, companion `release_context`
  fix applied to `gijoe_db_figures_2.0.csv` for both F167 and F707 (`gijoe_db_figures_accessories.csv`
  needed no change — already clean/disjoint), verified via direct DB read and `/api/catalog`
  round-trip (F167: L7A21 GPMG + Tripod, `retail`; F707: Machine Gun + Mine Launcher,
  `convention`, year 9999/Special Release), 2026-07-21. Not yet visually verified in-app.

### 1987 — Jinx (v1 retail, figure catalog id 146 — source F-code F207; v2 convention edition, id 428 — F522/F523, variants A/B)

- **Mechanism:** miscategorization fix, **not** a split — Jinx v2 was already its own
  distinct catalog row (different `version` from v1, no dedup-key collision with it); the bug
  was that its **series/channel tagging was wrong**, not that a second edition was missing.
- **Collision (a different shape from Flint/Quick Kick):** the CSV carried *two* conflicting
  pairs for Jinx v2's A/B variants — F522/F523 tagged `series_id` 13 (mainline Series 12,
  1993) and F718/F719 tagged 15 (Convention & Mail-In block). `seed.mjs`'s dedup kept the
  series-13 pair (F522/F523) and dropped F718/F719 as duplicate variant letters — so Jinx
  rendered under the 1993 retail section instead of Convention, and the 700-block pair was
  never restored (owner-confirmed it wasn't needed — F522/F523 already carried the complete,
  correct data once its `series_id` was fixed; F718/F719 was the redundant CSV entry, not a
  second real release).
- **Fix:** corrected `series_id` 13→15 on F522/F523 directly — no new `figures` row, no
  accessory move. `CONVENTION_YEAR` sentinel handling in `web/src/fig-identity.js` needed no
  code change, just the data fix.
- **Blueprint (id 428):** Naginata Staff (A0336, shared with v1's own blueprint) + Cape
  (A1364) — both `retail` context on this row (i.e. required for *this* catalog entry's own
  completeness, same convention Quick Kick/Flint's own blueprints use).
- **Recovery note:** fixing this uncovered that a from-scratch reseed doesn't preserve owned
  `instances`/`instance_accessories` and was, separately, missing several DB fixes that had
  only ever been applied ad hoc to the live DB — 231 owned instances had to be recovered live
  from the still-running old server process. Unrelated to the split-vs-not question itself,
  but see `OPEN_QUESTIONS_ISSUES_FOUND.md` #21 for the full incident — `server/seed.mjs` now
  refuses to run against a DB with owned instances without `--force`, and always writes a
  timestamped `.bak` first.
- **Source:** owner-confirmed, 2026-07-10 (`ee42034`; see `OPEN_QUESTIONS_ISSUES_FOUND.md` #21).
- **Status:** ✅ `series_id` corrected directly in the root CSV + live DB, verified — Jinx v2
  (both variants) now joins to `series_id` 15 / "Convention & Mail-In Block".

### 1993 — Snow Serpent (v3 mail-order edition, figure catalog id 466 — source F-code F566)

- **Mechanism:** miscategorization fix, **not** a split — a single catalog row, no dedup-key
  collision with any other Snow Serpent row (unlike Jinx's A/B pair above, there's no
  competing 700-block sibling for v3 to collide with). Same shape as the Jinx v2 fix:
  `series_id` was wrong, not the release_context/mail classification itself.
- **Bug:** `series_id` was 13 (mainline 1993/Series 12) despite the row's own data already
  correctly flagging it non-retail (`mail_in_notes` "Mail order", mail flag set) — so
  "Arctic Commando Snow Serpent" rendered under the 1993 retail section instead of the
  sentinel non-retail bucket (renamed "Special Release" — see `MAIL_RELEASES.md`).
- **Fix:** corrected `series_id` 13→15 directly on figure id 466 (root CSV
  `gijoe_db_figures_2.0.csv` + live DB). No new `figures` row, no accessory move — the
  existing blueprint (Submachine Gun, Action Figure Battle Stand) is unaffected.
- **Related, separately-logged fix:** this figure's `release_context` was also reclassified
  `mail_in` → `mail_order` the same session — a different mechanism (mail-in vs. mail-order
  classification, not series/grouping), logged in `MAIL_RELEASES.md`'s "Confirmed
  reclassifications" section, not duplicated here.
- **Source:** owner-confirmed (physically-owned copy), 2026-07-20.
- **Status:** ✅ `series_id` corrected in the root CSV + live DB via
  `migrations/014_mail_order_context.sql` — Snow Serpent v3 now joins to `series_id` 15 /
  "Special Release". Verified via `/api/catalog`.

### 1992 — Snake Eyes, Tripwire, Undercover Scarlett (convention editions, catalog ids 361/368/369 — F452/F460/F461)

- **Mechanism:** miscategorization fix, **not** a split — same shape as Jinx v2 and Snow
  Serpent v3 above: each figure's own row already carried correct convention data
  (`release_context = 'convention'`, `display_name` "(convention)", `mail_in_notes`/`notes`
  "1992 Convention"); only `series_id` was wrong.
- **Bug:** all three sat at `series_id` 12 (mainline 1992/Series 11), so they rendered under
  the "1992 · Series 11" section next to that year's retail figures instead of the sentinel
  non-retail bucket.
- **Collision noted, not acted on:** the CSV also carries a 700-block duplicate of each
  (F709/F714/F715, ids 709/714/715) already correctly tagged `series_id` 15 — same
  near-identical-duplicate shape as Jinx v2's F718/F719. `seed.mjs`'s dedup keeps the
  lower-id mainline row and drops the 700-block sibling on every rebuild (confirmed: only
  361/368/369 exist in the live DB), so per the Jinx precedent the fix is correcting the
  surviving row's `series_id`, not restoring the duplicate.
- **Fix:** corrected `series_id` 12→15 directly on figure ids 361, 368, 369 (root CSV
  `gijoe_db_figures_2.0.csv` + live DB). No new `figures` row, no accessory move, no title
  change — `display_name` stays "Snake Eyes (convention)" / "Tripwire (convention)" /
  "Undercover Scarlett (convention)" per owner instruction to retain the Convention titles.
- **Source:** owner instruction, 2026-07-21.
- **Status:** ✅ `series_id` corrected in the root CSV + live DB, verified via `/api/catalog`
  (`year: 9999` → renders "Special Release" per `web/src/fig-identity.js`). No owned
  `instances` existed on any of the three rows, so no recovery step was needed.
