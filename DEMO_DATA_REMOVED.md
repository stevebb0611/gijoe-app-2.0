# Demo / sample data removed

This is the **empty-start** edition. The working app boots with nothing owned. The **catalog**
(canonical list of real figures/accessories you search against) is intentionally kept — it is
reference data, not a fake collection.

## Removed / verified empty
- **`store.js`** — owned inventory initializes empty (`{ instances: [], bin: [] }`). The Collection
  App and Parts Bin both boot to their empty states. Verified — no seeded copies anywhere.
- **`catalog-data.js`** — `JOE_ERAS` invented year nicknames ("THE ORIGINAL RUN",
  "WOLVES & SERPENTS", "IRON GRENADIERS", etc.) → emptied to `{}`. Year-group headers show the
  factual release year only, no flavor text.

## Kept on purpose (reference data — NOT demo data)
- `catalog-data.js` (window.JOE_CATALOG, 520 figures), `parts-catalog.js`, `add-figure-catalog.js`
  — the search sources, built from the seed CSVs. Never mutated at runtime.
- `seed/*.csv` — canonical Hasbro toyline reference to load into the DB.

## Standalone screen-reference pages
Pages like `Instance Detail.html`, `Add Instance.html`, and `Accessory Sub-Groups.html` are
**design references**: they intentionally render a representative populated state so a developer
can see what a filled-in screen looks like (e.g. `instance-detail.jsx`'s `SAMPLE_ACC`). These are
documentation of the design, not data in the working app. The live app (`Collection App.html`,
`Parts Bin.html`) is what boots empty. If you want these reference pages blanked too, say so and
I'll neutralize their sample states.

## Clearing a browser that ran an older build
Old fixtures may persist in `localStorage`. Use the in-app Tweaks → Clear, or remove the key
`gi_joe_collection_v1`. Do this in your own browser only.
