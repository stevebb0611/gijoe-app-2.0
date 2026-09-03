# Damage Map — how it works and how to get back to editing it

The Damage Map is the screen where you mark a figure's condition on a picture of the
figure itself, and it turns those marks into a grade and a holding decision.

- **In this project (design source):** `Damage Map.html` at the project root.
- **In this handoff:** `GI Joe Tracker - Damage Map.html` (identical copy).
- Both need `assets/figure-masks.js`, `assets/figure-zones.js`, and `assets/fig/*.png`
  as siblings. Open the HTML directly in a browser — no build step.

## The three layers

**Layer 1 — the body-cell grid (`assets/figure-masks.js`).**
Each figure view is a 24-column grid over the art. `FIG_MASKS["male-rear"]` holds
`w`, `h`, `cols`, `rows` and a `mask` array of `"0"/"1"` strings marking which cells sit
on the figure. Generated once from the PNG's alpha channel; the app dilates it by 2 cells
(`DILATE`) so edge cells are clickable. Grid and art share the same box, so a cell's
coordinates mean the same thing in both.

**Layer 2 — zones (`assets/figure-zones.js`).**
Named body regions (Head, Torso, Left elbow, …) built from lists of `"row-col"` cells.
Keys are **per view**: `male-front`, `male-rear`, `female-front`, `female-rear`.
`FIG_ZONES.male` / `.female` remain as aliases of that gender's *front* set for older code.
Current committed state: 17 zones per view.

**Layer 3 — damage (localStorage, per figure copy at runtime).**
A severity per zone per view, rendered as caution stripes or solid fill.

## Editing zones (the part you keep coming back to)

Open the Damage Map, pick **Male/Female** and **Front/Rear**, then switch the mode
control to **Zones**:

1. Select a zone in the right-hand *Zone presets* panel.
2. Click-drag cells on the figure to add them to that zone. Clicking a cell already in the
   selected zone removes it. A cell belongs to exactly one zone, so adding it moves it.
3. **↑ ↓ ← →** shift the whole current view's zone set by one cell — the fix for a set that
   is correctly shaped but sitting a row too high or low. Cells pushed off the body are dropped.
4. **Copy from front/rear** replaces the current view's set with the other view's.
5. **Reset <view>** restores that one view from `assets/figure-zones.js`.

Front and rear are independent. Nothing you do on rear can change front, and vice versa.

## Persistence keys (localStorage)

| Key | Contents |
| --- | --- |
| `dm_zones2` | zone sets, keyed `male-front` / `male-rear` / `female-front` / `female-rear` |
| `dm_zonedmg` | per-gender, per-view severity per zone |
| `dm_gender` | last gender viewed |
| `dm_fill` | fill style: `solid` or `stripes` |
| `dm_layer` | self-describing note of the zone layer's dilation + colour map |

`dm_zones` (no `2`) is the older per-gender store. On first load the app migrates it: the
shared set seeds **both** views, then it is left alone.

## Committing in-app zone edits back to the file

Zone edits live in `localStorage.dm_zones2` until you write them to
`assets/figure-zones.js`. To promote them, in the browser console on the Damage Map page:

```js
copy(JSON.stringify(JSON.parse(localStorage.dm_zones2), null, 1))
```

Paste the result as the `window.FIG_ZONES = { … }` object in `assets/figure-zones.js`,
keeping the two alias lines at the bottom of that file. Then clear `dm_zones2` so the file
becomes the source of truth again:

```js
delete localStorage.dm_zones2; location.reload()
```

## Recalibrating a mask or checking alignment

Zone/art alignment is verified by overlaying the zone cells on the PNG rather than by
screenshotting the page (the capture tooling does not always composite the art). The
overlay renders each zone in a distinct tint on top of `assets/fig/<gender>-<view>.png`
at the mask's `cols`×`rows` resolution; the last renders are in `scratch/zonecheck-male-front.png`
and `scratch/zonecheck-male-rear.png`. If the art itself is replaced, regenerate that view's
entry in `figure-masks.js` from the new PNG's alpha channel before touching zones.

## Grading

Physical demerit is the sum of zone severity weights (1 / 3 / 6) across both views, with
`broken` capping the overall grade at Fair. The Holding decision panel compares this copy's
grade against the best copy on hand and returns Release candidate / Keep–promote / Hold.

## Change log

- **2026-09-02** — Zones split from per-gender to **per-view** (`dm_zones2`). Added nudge
  arrows, Copy-from-other-view, per-view Reset. Grade engine, JSON export and the on-screen
  hint updated. `assets/figure-zones.js` rewritten in per-view form from the live edits
  (male-front 574 cells, male-rear 571, female-front 583, female-rear 599); male-front was
  reset to the previously committed set first.
