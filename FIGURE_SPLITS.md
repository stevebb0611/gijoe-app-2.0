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
(1989, id 240), Python Tele-Viper (1989, id 241), Roadblock v2 (1986, id 115), Snow Serpent
(1985, id 89), Zarana (1986, id 127). Two of those entries (Gung-Ho v2, Outback v1) say so
explicitly — *"this entry only reclassifies the accessories already attached to the
surviving row, per owner instruction"* — i.e. the deeper collision was consciously left
parked when those were touched. **Listed here so a future pass doesn't re-flag them as still
needing a split** — they're a real, intentional resolution, just a different one than Flint's.
If any of them should become a real two-row split later, that's a fresh decision, not a bug
in either doc.

Flint itself used to be in that list (`ACCESSORY_GROUPS.md`'s old 1985 Flint entry,
2026-07-10) — **superseded 2026-07-16** by the real split below; that entry now says so and
points here instead of describing stale data.

## Data model

No schema change — `figures.release_context` (`retail`/`convention`/`mail_in`), `series_id
15` (the Convention & Mail-In Block sentinel year), and `figure_accessories` keyed on
`figure_id` already do the whole job (`VARIANTS.md` §7.5). What a split entry actually sets
on the new row:

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
