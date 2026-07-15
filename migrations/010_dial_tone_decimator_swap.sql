-- ============================================================
--  Migration 010: fix Dial-Tone v3 / Decimator v1 accessory swap
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

-- Root cause: gijoe_db_figures_accessories.csv labels each figure's
-- accessory block with a code_name + F-code only on the block's first row
-- (blank on continuation rows). For the Dial-Tone v3 / Decimator v1 pair the
-- F-code column got swapped between the two adjacent blocks while the
-- code_name text stayed correct — i.e. the row correctly labeled "Decimator"
-- carried F-code F347 (Dial-Tone's real F-code) instead of F348, and vice
-- versa. The live DB was originally seeded off that F-code column, so it
-- inherited the swap: figure catalog id 266 (F347, Dial-Tone v3) ended up
-- with Decimator's Helmet+Speargun, and id 267 (F348, Decimator v1) ended up
-- with Dial-Tone's Sonic Backpack + weapons set. gijoe_db_accessories.csv's
-- independent `host_figure` column (never touched by the F-code bug) had it
-- right all along: A0707/A0708 -> "Decimator (v1)", A0709-A0716 -> "Dial-Tone
-- (v3)". Owner-confirmed 2026-07-15 against the physical figure (Sonic
-- Fighter Dial-Tone carries the backpack + swap-weapon set, not a helmet and
-- speargun).
--
-- This does NOT touch instances/instance_accessories — neither figure has an
-- owned instance on file, so there is no ownership data to reconcile.

BEGIN TRANSACTION;

-- Move Decimator's real gear (Helmet, Speargun) off Dial-Tone v3 (266) onto
-- Decimator v1 (267).
UPDATE figure_accessories SET figure_id = 267
WHERE figure_id = 266 AND accessory_id IN (707, 708);

-- Move Dial-Tone's real gear (Sonic Backpack x2 mold variants, Battery Cover,
-- Pistol, Machine Gun, Flamethrower, Grenade Launcher, Grenade Launcher
-- Cylinder) off Decimator v1 (267) onto Dial-Tone v3 (266).
UPDATE figure_accessories SET figure_id = 266
WHERE figure_id = 267 AND accessory_id IN (709, 710, 711, 712, 713, 714, 715, 716);

-- accessory_groups.id 28 (the Sonic Backpack "own any one" slot, set by
-- server/migrate-accessory-groups.mjs on 2026-07-15) followed the accessory
-- rows, so its figure_id pointer needs the same correction.
UPDATE accessory_groups SET figure_id = 266 WHERE group_id = 28;

COMMIT;

-- Verify
-- SELECT fa.figure_id, f.code_name, f.version, a.accessory_code, a.name, fa.group_id
-- FROM figure_accessories fa
-- JOIN figures f ON f.id = fa.figure_id
-- JOIN accessories a ON a.id = fa.accessory_id
-- WHERE fa.figure_id IN (266, 267)
-- ORDER BY fa.figure_id, a.accessory_code;
