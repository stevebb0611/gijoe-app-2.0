-- ============================================================
--  Migration 020: Capt. Grid-Iron — remove mis-modeled A/B variant,
--  re-home as a Football Helmet "choose variant" accessory group
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

-- Root cause: Capt. Grid-Iron (figure catalog id 264, F345, 1990) was
-- modeled with a whole-figure A/B production variant in variant_lookup
-- ("Soft helmet" / "Hard helmet") — but the two helmets aren't a
-- distinguishing trait of which release you own, they're just two molds of
-- the same accessory. The figure's blueprint already carries both as
-- separate accessory rows (A0695 "Football Helmet (soft plastic)", A0696
-- "Football Helmet (hard plastic)"), which the group_id "choose variant"
-- mechanism (see ACCESSORY_GROUPS.md) exists to cover — same pattern as
-- A.V.A.C.'s and Countdown's soft/hard-plastic helmets. Owner-corrected
-- 2026-08-16.
--
-- No owned instance is pinned to either variant_lookup row (instance 593,
-- the only owned Grid-Iron copy, has variant_id NULL already), so this is
-- a clean delete — no instance data to reconcile.
--
-- The group_id side (accessory_groups row + figure_accessories.group_id on
-- A0695/A0696) is handled by server/migrate-accessory-groups.mjs (re-run
-- after adding the Capt. Grid-Iron entry there) — this migration only
-- removes the incorrect variant_lookup rows.

BEGIN TRANSACTION;

DELETE FROM variant_lookup WHERE figure_id = 264 AND letter IN ('A', 'B');

COMMIT;

-- Verify
-- SELECT * FROM variant_lookup WHERE figure_id = 264; -- expect 0 rows
-- SELECT a.accessory_code, a.name, fa.group_id FROM figure_accessories fa
-- JOIN accessories a ON a.id = fa.accessory_id
-- WHERE fa.figure_id = 264 AND a.accessory_code IN ('A0695', 'A0696');
