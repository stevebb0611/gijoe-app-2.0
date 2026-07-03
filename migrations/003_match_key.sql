-- ============================================================
--  Migration 003: match_key — cross-slot matched-color sets
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

BEGIN TRANSACTION;

-- ─────────────────────────────────────────────
--  1. Add match_key to figure_accessories
--     NULL for almost every row. Only set when a figure has
--     multiple accessory_groups slots (see migration 001's
--     accessory_groups table) that must resolve to the SAME
--     tag together for completion — e.g. Firefly's light-green
--     Submachine Gun only counts toward Complete alongside the
--     light-green Walkie-Talkie, never the dull-green one.
--     See match_key.md for the running catalogue of figures
--     this has been applied to and why.
-- ─────────────────────────────────────────────

ALTER TABLE figure_accessories ADD COLUMN match_key TEXT;

COMMIT;

-- Verify
-- SELECT f.code_name, a.accessory_code, a.name, a.color, fa.group_id, fa.match_key
-- FROM figure_accessories fa
-- JOIN figures f ON f.id = fa.figure_id
-- JOIN accessories a ON a.id = fa.accessory_id
-- WHERE fa.match_key IS NOT NULL
-- ORDER BY f.code_name, fa.match_key;
