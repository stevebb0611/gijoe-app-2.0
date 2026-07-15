-- ============================================================
--  Migration 011: Flak-Viper v1 (1992) missile quantity fix
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

-- Flak-Viper v1 (figure catalog id 346, F433, 1992) ships with two High
-- Altitude Tail-Biter Missiles (A1088) for the Dual Missile Launcher
-- Backpack (A1087) — quantity_required was 1, owner-confirmed it should be
-- 2. One owned copy (instance 126) already has units_owned=2 recorded for
-- this accessory, so this just lets Complete reflect what's actually there.

UPDATE figure_accessories SET quantity_required = 2
WHERE figure_id = 346 AND accessory_id = (SELECT id FROM accessories WHERE accessory_code = 'A1088');

-- Verify
-- SELECT fa.figure_id, a.accessory_code, a.name, fa.quantity_required
-- FROM figure_accessories fa JOIN accessories a ON a.id = fa.accessory_id
-- WHERE fa.figure_id = 346;
