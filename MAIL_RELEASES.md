# Mail Releases — mail-in vs. mail-order classification

> Companion to `TAXONOMY.md`'s Series section and `FIGURE_SPLITS.md` (the sibling
> operational log for release-edition splits and `series_id` miscategorizations). This doc
> is the per-figure log for the **`figures.release_context` mail classification** — which
> figures are `mail_in` vs. `mail_order`, and why — the same role `ACCESSORY_GROUPS.md` plays
> for accessory-level `release_context` and `FIGURE_SPLITS.md` plays for whole-figure splits.

## The distinction

"Mail-in", "mail-away", and "mail-order" were used interchangeably across the schema and
docs, but vintage G.I. Joe collectors mean two genuinely different things by them:

- **Mail-in** (a.k.a. mail-away — same concept, one term now): clip proofs-of-purchase from
  packaging and mail them in for a premium figure sent back at no separate retail sale (Cobra
  Commander v2, The Fridge, Sgt. Slaughter, etc.).
- **Mail-order**: ordering directly from a catalog/order form — a different acquisition
  channel, not a proof-of-purchase premium.

**"Mail-away" is retired as a term** (2026-07-20) — `figures.is_mail_away` renamed
`is_mail_in`, matching `release_context`'s existing `mail_in` value and `mail_in_notes`
(both already used "mail_in", only the boolean column still said "away"). `release_context`
gained a new, separate `mail_order` value (`migrations/014_mail_order_context.sql`) rather
than folding mail-order releases into `mail_in` — see the reclassification below for why.

**Inventory heading:** both `mail_in` and `mail_order` figures (and `convention`) share the
single `series_id 15` sentinel bucket — the owner previously decided against grouping
non-retail releases by their literal chronological year (see `TAXONOMY.md`). That bucket's
heading was renamed from the literal string **"Convention"** to **"Special Release"**
(`web/src/fig-identity.js`'s `formatYear()`) so it no longer misdescribes mail-in/mail-order
figures sitting in it — the per-figure `EditionTag` badge (CONVENTION / MAIL-IN /
MAIL-ORDER) is what actually disambiguates within the section.

## Not the same thing as retailer-exclusive notations

Two other "special release model" patterns turned up while auditing this — neither belongs
in this doc:

- **JC Penney** (1982 Cobra v1, catalog id 3): an accessory-level
  `figure_accessories.release_context = 'retailer_exclusive'` tag (`migrations/012_retailer_exclusive_context.sql`,
  see `ACCESSORY_GROUPS.md`) — one bonus accessory pairing flagged retailer-exclusive on an
  otherwise-normal retail figure. Not a figure-level mail concept at all.
- **Toys R Us (19 figures) / Target (1 figure)**: sitting in `mail_in_notes` despite the
  column name, these are plain `release_context = 'retail'` figures exclusive to one retail
  chain — not mail-anything. Left alone; `mail_in_notes` doubling as a general
  distribution-channel note field is a separate, future cleanup, out of scope here.

## Data model

No new column beyond the rename — `release_context` (`retail`/`convention`/`mail_in`/
`mail_order`, CHECK-constrained in `gijoe_collection.sql`), `is_mail_in` (BOOLEAN, renamed
from `is_mail_away`), `mail_in_notes` (TEXT, unchanged) already do the whole job.

## Tooling

`server/seed.mjs`'s `normalizeReleaseContext()` regex-matches the source CSV's free-text
`release_context` column and buckets anything matching `/mail order/i` to `mail_in` — that
rule is **not** touched, because the CSV uses identical "Mail order" text for every mail-in
figure, and widening the regex would silently reclassify all of them to `mail_order` on the
next from-scratch reseed. Instead, `seed.mjs` has an explicit, small, append-only override:

```js
const MAIL_ORDER_FIGURE_IDS = new Set([
  'F566', // Snow Serpent v3 ("Arctic Commando Snow Serpent") — owner-confirmed, 2026-07-20
]);
```

— same idiom as `server/split-release-edition.mjs`'s confirmed-specs array. Promoting a
figure from `mail_in` to `mail_order` means appending its `figure_id` here (plus a new entry
below), never editing the regex. Restart the backend after any live-DB change here (`npm
start` — no hot-reload).

## Scope discipline

**Do not reclassify a figure from `mail_in` to `mail_order` from notes text alone.** The
source CSV's generic "Mail order" free text doesn't distinguish the two mechanisms — same
discipline `FIGURE_SPLITS.md` already established for its collision backlog: every
reclassification below was confirmed against a real reference or the owner's own
physically-owned copy first.

## Confirmed reclassifications

### Snow Serpent v3 (figure catalog id 466 — F566, "Arctic Commando Snow Serpent")

- **Was:** `release_context = 'mail_in'`, `is_mail_away = 1`, `mail_in_notes = 'Mail order'`,
  `series_id = 13` (mainline 1993/Series 12) — rendered under the "1993 · Series 12" section
  next to that year's retail figures, with no mail badge distinguishing it.
- **Now:** `release_context = 'mail_order'`, `is_mail_in = 0`. The `series_id` 13→15
  miscategorization (same root cause as Jinx v2) is a different mechanism — logged in
  `FIGURE_SPLITS.md`'s own new entry, not duplicated here.
- **Source:** owner (physically-owned copy), 2026-07-20 — a mail-order catalog purchase, not
  a clip-and-send-in premium, not a convention exclusive.
- **Status:** ✅ `migrations/014_mail_order_context.sql` applied to the live DB; companion
  edits to `gijoe_db_figures_2.0.csv` (series_id) and `server/seed.mjs`
  (`MAIL_ORDER_FIGURE_IDS`) so both a live fix and a from-scratch reseed agree. Verified via
  `/api/catalog`.

## Contradictions — needs research

Two figures carry `release_context = 'retail'` but `is_mail_in = 1` — internally
inconsistent, not resolved here, logged so they aren't lost:

- **Tollbooth v1** (catalog id 66, F109) — `mail_in_notes = 'Sears'`. Possibly a Sears
  mail-in/mail-order figure mistagged retail, possibly a Sears retail-exclusive with the
  mail flag set in error. Needs a real reference or the owner's own copy to resolve.
- **Salvo v1** (catalog id 284, F366) — no notes at all, no textual hint either way.

## Audit backlog — remaining `mail_in` figures

All still `release_context = 'mail_in'`, unconfirmed either way — generic "Mail order" notes
text can't distinguish mail-in from mail-order, so these stay as-is until individually
checked. Two rows have a more specific sub-channel hint worth checking first.

| Code name | Version | figure_id | catalog id | mail_in_notes | series_id | status |
|---|---|---|---|---|---|---|
| Cobra Commander | v1 A | F009 | 4 | Mail order, Sears | 1 | unconfirmed — check Sears angle first |
| Lifeline | v3 | F395 | 310 | Kellog's cereal Mail order | 11 | unconfirmed — check cereal-premium angle first |
| Big Bear | v2 | F476 | 383 | Mail order | 13 | unconfirmed — mail_in (default) |
| Big Ben | v2 | F477 | 384 | Mail order | 13 | unconfirmed — mail_in (default) |
| Budo | v2 | F482 | 389 | Mail order | 13 | unconfirmed — mail_in (default) |
| Cobra Commander | v2 | F090 | 52 | Mail order | 4 | unconfirmed — mail_in (default) |
| Dee-Jay | v2 | F496 | 402 | Mail order | 13 | unconfirmed — mail_in (default) |
| Deep Six | v4 | F497 | 403 | Mail order | 13 | unconfirmed — mail_in (default) |
| Duke | v1 A | F057 | 27 | Mail order | 3 | unconfirmed — mail_in (default) |
| G.I. Joe | v1 | F598 | 498 | Mail order | 14 | unconfirmed — mail_in (default) |
| General Hawk | v5 | F509 | 415 | Mail order | 13 | unconfirmed — mail_in (default) |
| Interrogator | v2 | F521 | 427 | Mail order | 13 | unconfirmed — mail_in (default) |
| Major Altitude | v2 | F537 | 439 | Mail order | 13 | unconfirmed — mail_in (default) |
| Major Bludd | v1 | F070 | 36 | Mail order | 3 | unconfirmed — mail_in (default) |
| Name Your Own "Create a Cobra" | v1 | F543 | 445 | Mail order | 13 | unconfirmed — mail_in (default) |
| Ninja Viper | v1 A | F441 | 354 | Mail order | 12 | unconfirmed — mail_in (default) |
| Rampage | v1 | F320 | 244 | Mail order | 9 | unconfirmed — mail_in (default) |
| Sgt. Slaughter | v1 A | F171 | 118 | Mail order | 6 | unconfirmed — mail_in (default) |
| Spirit | v4 | F569 | 469 | Mail order | 13 | unconfirmed — mail_in (default) |
| Stalker | v4 | F570 | 470 | Mail order | 13 | unconfirmed — mail_in (default) |
| Starduster | v1 A | F138 | 90 | Mail order | 5 | unconfirmed — mail_in (default) |
| Steel Brigade | v1 A | F224 | 162 | Mail order | 7 | unconfirmed — mail_in (default) |
| Steel Brigade | v2 | F455 | 364 | Mail order | 12 | unconfirmed — mail_in (default) |
| Sub-Zero | v2 | F571 | 471 | Mail order | 13 | unconfirmed — mail_in (default) |
| Super Trooper | v1 | F281 | 207 | Mail order | 8 | unconfirmed — mail_in (default) |
| The Fridge | v1 A | F227 | 165 | Mail order | 7 | unconfirmed — mail_in (default) |

Note `series_id` above is each row's **current** (mostly mainline) value — none of these have
had the Snow Serpent v3 / Jinx v2 `series_id`→15 fix applied yet; that's a separate,
also-unaudited backlog (see `TAXONOMY.md`'s design-history note and `FIGURE_SPLITS.md`).
