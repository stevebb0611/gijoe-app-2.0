Damage Map update — drop-in patch
=================================

Copy these over the same paths in your workspace. Nothing else is touched.

  GI Joe Tracker - Damage Map.html   the edit page (per-view zones)
  DAMAGE_MAP.md                      docs for this screen
  assets/figure-zones.js             zone definitions, now PER VIEW
  assets/figure-masks.js             body-cell grid (unchanged this round,
                                     included only so the page runs standalone)
  assets/fig/*.png                   figure art (unchanged this round, same reason)

If assets/figure-masks.js and assets/fig/*.png already exist in your workspace,
you can skip them. The two files that actually changed are the HTML and
assets/figure-zones.js, plus the new DAMAGE_MAP.md.
