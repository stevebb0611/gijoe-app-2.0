-- ============================================================
--  Migration 002: character_key + Snow Storm name fix
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

BEGIN TRANSACTION;

-- ─────────────────────────────────────────────
--  1. Add character_key to figures
--     NULL for most figures (code_name is already unique).
--     Set only for the four code names held by distinct people.
-- ─────────────────────────────────────────────

ALTER TABLE figures ADD COLUMN character_key TEXT;

-- Ace
UPDATE figures SET character_key = 'ACE_1' WHERE figure_id IN ('F044', 'F464');
UPDATE figures SET character_key = 'ACE_2' WHERE figure_id = 'F417';

-- Airborne
UPDATE figures SET character_key = 'AIRBORNE_1' WHERE figure_id IN ('F045', 'F046');
UPDATE figures SET character_key = 'AIRBORNE_2' WHERE figure_id = 'F339';

-- Mercer
UPDATE figures SET character_key = 'MERCER_1' WHERE figure_id = 'F211';
UPDATE figures SET character_key = 'MERCER_2' WHERE figure_id = 'F400';

-- Windchill
UPDATE figures SET character_key = 'WINDCHILL_1' WHERE figure_id = 'F338';
UPDATE figures SET character_key = 'WINDCHILL_2' WHERE figure_id = 'F629';

-- ─────────────────────────────────────────────
--  2. Fix Snow Storm full_name (typo in all three rows)
-- ─────────────────────────────────────────────

UPDATE figures SET full_name = 'Suarez, Guillermo'
WHERE figure_id IN ('F567', 'F568', 'F621');

COMMIT;

-- Verify
-- SELECT figure_id, code_name, character_key, full_name FROM figures
-- WHERE character_key IS NOT NULL OR figure_id IN ('F567','F568','F621')
-- ORDER BY code_name, figure_id;
