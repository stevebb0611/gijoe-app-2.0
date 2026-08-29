# PLANNING.md — Parts Bin: "closest to completion" priority + starred-copy protection

> Status: **planned, not yet implemented.** This document is the design
> record; the code changes described below have not been made yet. See
> `OPEN_QUESTIONS.md`/`PARTS_BIN.md` for how this fits the rest of the app's
> design docs.

## Context

The Parts Bin's "pull to complete" suggestions (`buildSuggestions()` in
`web/src/parts-bin.jsx`) currently pick which owned copy gets a scarce loose
accessory via pure array-order luck — whichever copy `buildNeeds()` happened
to discover first. With accessories reused across a dozen-plus figures
(Breaker's helmet type, the Viper/Python Viper backpack), this means a bin
part can just as easily land on a figure that's still missing two other
things as on one where it's the *last* gap — no better than random from the
collector's point of view.

The owner wants the tool to actively route scarce shared parts to whichever
copy they'd actually complete, generalized across the whole 1982–1994
collection, so the app's "Complete" counts reflect *true* completion rather
than parts being scattered arbitrarily. Alongside this, working through a
real example (Master Collection star + raised per-variant target, e.g.
keeping a Hong Kong-COO copy intact while collecting multiple COOs of one
figure) surfaced that the *existing* same-figure ⚖ Rebalance engine has no
concept of a "protected" copy either — it would already treat a starred
keeper as fair game to strip for parts. Both get fixed here.

Confirmed scope (owner's explicit decisions):
- Fix starred-copy protection in **both** the existing Rebalance engine and
  the new logic — one consistent rule.
- Ship the **bin-stock priority ranking** now (Tier 1). Cross-figure
  reallocation of *already-attached* units (the Viper→Python Viper case) is
  an explicitly deferred fast-follow, not built this pass — noted below for
  when that's picked up.
- For that future Tier 2: never donate from a starred copy, never donate
  from a copy that's already whole.

## Part A — Protect starred copies in the existing Rebalance engine

**File:** `web/src/app-detail.jsx`, `figState()`, lines 179–190.

Today `const loose = copies.filter(c => !c.moc)` is the only thing walling a
copy off from the pooling/move machinery, and `mocWhole = owned -
loose.length` assumes every excluded copy is automatically "whole" — true
for MOC (always 100% by construction) but **not** true for a starred copy,
which can be legitimately incomplete.

Change:
```js
const loose = copies.filter(c => !c.moc && !c.masterCollection);
const excluded = copies.filter(c => c.moc || c.masterCollection);
const excludedWhole = excluded.filter(c => c.whole).length;
const looseWhole = loose.filter(c => c.whole).length;
```
and at line 190, `mocWhole` → `excludedWhole`:
```js
const optimalWhole = optimalLoose + excludedWhole;
```
`mocWhole` isn't read anywhere else in the file (verified). Every downstream
line (`pool`, `target`, `moves`, the best-partial block, `_copies: loose` in
the return) already consumes `loose` by reference, so this one redefinition
cascades correctly — a starred copy becomes fully untouchable (never donor,
never receiver) within this engine, the same treatment MOC already gets.
`currentWhole` (line 177) needs no change — it's read straight off the full
instance list, unaffected by what `loose` excludes.

`parts-bin.jsx`'s `rebalFigs` calls `figState()` directly, so it inherits
this fix with zero changes on its side.

*Not in scope:* `InvDetailModal`'s manual ⇄ move popover still lets the
owner deliberately drag a unit off a starred copy by hand — that's an
explicit single-click user action, not automated logic, and is outside what
was asked here.

## Part B — Tier-1 "closest to completion" bin-stock ranking

**File:** `web/src/parts-bin.jsx` (all of Part B lives here).

### B0/B1 — Necessary companion fix + `buildNeeds()` extension

`buildNeeds()` (lines 37–55) reads `c.acc` directly rather than trusting
`c.missing`/`c.whole`. A MOC copy's `acc` map is normally empty (accessories
aren't tracked individually while sealed), so today `buildNeeds()` silently
generates a bogus "need" entry for every blueprint row on every MOC copy.
Harmless while suggestions are unordered — but once ranking lands, a MOC
copy's `c.missing` is always `[]` (`figureSummary()` special-cases it), so
it would compute `remainingGapCount: 0` and win every contested part
outright, actually writing accessory ownership onto a sealed card. This has
to close in the same change that adds ranking:

```js
function buildNeeds() {
  const needs = [];
  const ownedIds = [...new Set(JoeStore.get().instances.map(i => i.catalogId))];
  ownedIds.forEach(id => {
    const cf = JoeData.CAT_BY_ID.get(id); if (!cf) return;
    const bp = cf.blueprint || []; if (!bp.length) return;
    const sum = JoeData.figureSummary(id); if (!sum) return;
    const fig = figLabel(cf);
    sum.copies.forEach(c => {
      if (c.moc) return; // sealed — never a candidate for bin pulls
      JoeData.bpForVariant(bp, c.variant).forEach(([name, q, accessoryId]) => {
        const have = (c.acc && c.acc[name]) || 0;
        if (have < q) needs.push({
          instanceId: c.id, catalogId: id, no: c.no, fig, accessory: name, accessoryId, missing: q - have,
          remainingGapCount: c.missing.length,   // total remaining gaps on THIS copy (all types)
          masterCollection: !!c.masterCollection,
        });
      });
    });
  });
  return needs;
}
```
Purely additive to the need shape — every existing reader (`n.instanceId`,
`n.catalogId`, `n.no`, `n.fig`, `n.accessory`, `n.accessoryId`, `n.missing`)
is untouched.

### B2 — Priority comparator

New function, placed right after `buildNeeds()`:
```js
function needPriority(a, b) {
  return (a.remainingGapCount - b.remainingGapCount)   // fewer total gaps wins outright
      || (Number(b.masterCollection) - Number(a.masterCollection)) // starred wins ties
      || a.fig.localeCompare(b.fig)
      || (a.catalogId - b.catalogId)
      || (a.no - b.no)
      || (a.instanceId - b.instanceId);
}
```
This directly reproduces the Grunt/Short-Fuze example without special-casing
it: Short-Fuze's need carries `remainingGapCount: 1`, Grunt's carries `3` —
Short-Fuze sorts first. Starred copies get a same-gap-count tiebreak boost
as *receivers* — this is the mirror image of Part A's protection (which
stops a starred copy being raided), not a contradiction: pulling from the
bin is purely additive, there's nothing to protect against on that side.

### B3 — `evaluate()`: sort `matched` for consistent display

```js
function evaluate(entry, NEEDS) {
  const matched = NEEDS.filter(n => n.accessoryId === entry.id).sort(needPriority);
  const missingUnits = matched.reduce((s, n) => s + n.missing, 0);
  return { matched, needed: matched.length, fillable: Math.min(entry.qty, missingUnits) };
}
```
`needed`/`fillable` are order-independent — only `PartRow`'s expanded
"needed by" list's render order changes, now matching actual pull priority.

### B4 — `buildSuggestions()`: sort before the existing greedy loop

```js
function buildSuggestions(bin, NEEDS) {
  const remaining = {}; bin.forEach(e => { remaining[e.id] = e.qty; });
  const ranked = [...NEEDS].sort(needPriority);
  const out = [];
  ranked.forEach(n => {
    const part = bin.find(e => e.id === n.accessoryId && remaining[e.id] > 0);
    if (part) { remaining[part.id] -= 1; out.push({ need: n, partId: part.id, accessory: n.accessory }); }
  });
  return out;
}
```
Same greedy structure, reordered input. This one change fixes both the
"Ready to Complete" intake queue (which truncates to 8) and every per-row
pull suggestion — no JSX changes needed at those call sites, `out`'s shape
and length are unchanged.

### B5 — New: simulate + group into "would this copy actually finish" recommendations

Placed after `buildSuggestions()`:
```js
// Reserves each need's FULL remaining deficit (missing, can be > 1) against
// bin stock in priority order — different from buildSuggestions(), which
// only ever advances one unit per need per pass (one physical click). This
// answers "will this copy end up whole," not "is there a next click."
function simulateRecommend(bin, NEEDS) {
  const remaining = {}; bin.forEach(e => { remaining[e.id] = e.qty; });
  const ranked = [...NEEDS].sort(needPriority);
  const covered = [];
  ranked.forEach(n => {
    const have = remaining[n.accessoryId] || 0;
    if (n.missing > 0 && have >= n.missing) { remaining[n.accessoryId] = have - n.missing; covered.push(n); }
  });
  return covered;
}

function buildRecommendations(bin, NEEDS) {
  const covered = simulateRecommend(bin, NEEDS);
  const coveredByInstance = new Map();
  covered.forEach(n => {
    if (!coveredByInstance.has(n.instanceId)) coveredByInstance.set(n.instanceId, []);
    coveredByInstance.get(n.instanceId).push(n);
  });
  const totalByInstance = new Map();
  NEEDS.forEach(n => totalByInstance.set(n.instanceId, (totalByInstance.get(n.instanceId) || 0) + 1));
  const out = [];
  coveredByInstance.forEach((needsForCopy, instanceId) => {
    if (needsForCopy.length === totalByInstance.get(instanceId)) out.push({ instanceId, needs: needsForCopy });
  });
  out.sort((a, b) => needPriority(a.needs[0], b.needs[0]));
  return out;
}
```

A copy only appears here if *every* one of its remaining need rows got
covered by the simulation — partial coverage doesn't count as "recommended."

### B6 — Wire into `PartsBin()`

- New `const [recommendOpen, setRecommendOpen] = React.useState(false);` next
  to the existing `rebalOpen` (~line 445).
- New `recommendFigs` memo next to `rebalFigs` (~line 467), resolving
  `catalogId → cf` the same way `rebalFigs` does, plus a `contested` map per
  card (other needs sharing the same `accessoryId`, sorted by `needPriority`,
  for the "also needed by…" explanation line — phrase this neutrally, not as
  a strict "beat X" claim, since `simulateRecommend`'s greedy pass can skip a
  higher-priority need it can't fully cover and let a lower one through).
- Replace the standalone `.invk--rebal` KPI button (lines 522–528) with a
  two-half segmented tile under one "COMPLETENESS" label — left half keeps
  the existing Rebalance behavior/count unchanged, right half is the new
  Recommend count/click target. Exact markup and new CSS classes
  (`.invk--completeness`, `.invk--completeness__half--rebal`/`--recommend`,
  etc.) — see the design notes; reuses the existing `--accent`/`--gold`
  tokens (both already proven against this header's dark background).
- Mount `{recommendOpen && <RecommendModal figs={recommendFigs}
  onClose={() => setRecommendOpen(false)} />}` next to the existing
  `RebalanceModal` mount (~line 617).

### B7 — New `RecommendModal` component

Inline in `parts-bin.jsx`, directly after `RebalanceModal` (mirrors its
structure exactly: card list, `modal-back`/`modal` shell, Escape-to-close).
Pure presentational (`figs` in, `onClose` out) — no store subscription of
its own; applying a card loops `JoeStore.pullPart(accessoryId, instanceId,
accessoryName)` once per unit needed (already atomic/server-validated per
call, no new mutation required), and the resulting store emit naturally
drops the now-satisfied card on re-render, same as `RebalanceModal` today.
Each card shows figure name/version/No., what's being pulled, and the
"also needed by…" contention line before an APPLY PULLS button.

### B8 — CSS

`web/src/app.css`: replace the `.invk--rebal` rule (lines 804–805, confirmed
sole usage site) with the new split-tile rules; add `.recommend-fig*`/
`.recommend-move`/`.recommend-why` card styling after `.rebal-empty`
(~line 1017), mirroring `.rebal-fig*`'s shape but keyed to `--gold` instead
of `--accent` (ties visually to the starred-copy tiebreak, distinguishes
from Rebalance's crimson ⚖); add `.mk--recommend { color: var(--gold)
!important; }` near `.mk--add` (~line 1071). `.rebal-intro`/`.rebal-list`/
`.rebal-empty` are generic enough to reuse in `RecommendModal`'s JSX as-is.

## Known limitations (not fixed this pass)

- **`group_id`/matched "plain" option groups** aren't slot-aware in
  `buildNeeds()` — it walks raw blueprint rows, not `clusterBlueprint()`'s
  solo/plain/matched output, so a 3-option interchangeable slot (own *any
  one*) generates 3 separate raw need rows even though satisfying just one
  closes the whole slot. `remainingGapCount` (sourced from `c.missing.length`
  via `missingList()`) is still correct at the slot level, but
  `buildRecommendations()`'s per-copy row-count check can therefore require
  covering more raw rows than actually needed, meaning a copy whose only
  true gap is a multi-option group might not show as "recommended" unless
  the bin happens to stock every option at once. Pre-existing behavior
  (buildNeeds already over-generates rows today, just unordered) — a real
  fix means reworking `buildNeeds()` around `clusterBlueprint()` slots, a
  materially bigger change worth a dedicated follow-up if it matters in
  practice.
- **`pullPart` has no over-fill guard** (unlike `moveInstanceAccessory`,
  which checks `dstOwnedNow + count > req`). Pre-existing, low risk for a
  single-user localhost tool, consistent with `applyRebalance`'s existing
  risk tolerance.
- Multi-quantity needs (`missing > 1`) still take one click at a time via the
  existing intake queue/per-row buttons (unchanged); only `RecommendModal`
  reserves and applies the full deficit in one action. This divergence is
  intentional (documented in code comments) — the two views answer different
  questions ("next click available" vs. "will this copy end up whole").

## Future direction (explicitly deferred — Tier 2)

Cross-figure reallocation of already-*attached* units (Viper → Python
Viper): implement as `swapAccessoryToBin` (off a non-starred, non-whole
donor) chained with `pullPart` (onto the receiver) — both existing, atomic,
already-safe operations in `server/instances.js`, composed client-side.
Never a new cross-figure move primitive — `moveInstanceAccessory` (line 502)
intentionally hard-rejects `from.figure_id !== to.figure_id` and that
invariant should stay untouched.

## Verification (once implemented)

1. `npx oxlint web/src/app-detail.jsx web/src/parts-bin.jsx` and `npm run
   build` (in `web/`) — no new errors.
2. Manual browser pass against the real running app (dev server + API,
   check for an already-running instance first per this repo's convention):
   - Star a copy of a figure that shares an accessory with others (or
     reuse the Mainframe/Steeler/Zap data already in the DB); confirm the
     ⚖ Rebalance box no longer offers to move parts off it, and that
     `optimalWhole` still counts it correctly if it's already whole.
   - Construct (or find) a real Grunt/Short-Fuze-shaped case — two figures
     short the same bin accessory, one missing only that item — and confirm
     the intake queue / per-row suggestions now route to the closer-to-done
     figure, and the new "Recommend" half of the split chip lists it with a
     sensible "also needed by…" explanation; apply it and confirm the bin
     count and both chip numbers update correctly.
   - Confirm a MOC copy of a figure with a shared accessory type never shows
     up as a need/suggestion/recommendation.
