# server/one-off/

Single-use data fixes that have **already been applied** to the live
`gijoe_collection.db`. Kept for provenance (each header comment records what was
wrong, who confirmed it, and when) and because each is idempotent / re-runnable
— e.g. if a reseed from CSV ever reintroduces the original bug.

Run from the repo root: `node server/one-off/<script>.mjs`.

For the reusable tools (add a figure/set, split a release edition, tag
release_context / match_key, import accessory groups, sync file cards, backup,
export), see the scripts directly under `server/`.
