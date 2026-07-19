-- ============================================================
--  Migration 013: Master Collection notes — a free-text note per
--  figure, shown in the Master Collection card header and exported
--  as its own "Master Collection Notes" xlsx column.
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

BEGIN TRANSACTION;

-- ─────────────────────────────────────────────
--  master_notes — lives on figures, not instances. The Master
--  Collection view groups by figure (one card per figure with >=1
--  starred copy, see MASTER_COLLECTION.md §4), and the notes this is
--  for ("Storm Shadow is yellowing — look for upgrade", "Astro-Viper,
--  China copy owned, Hong Kong not in collection") are about the
--  figure/variant slate as a whole, not a single physical copy. Free
--  text, no length limit — distinct from figures.notes (a general
--  catalog-level annotation already exported as its own column).
-- ─────────────────────────────────────────────
ALTER TABLE figures ADD COLUMN master_notes TEXT;

COMMIT;

-- Verify
-- SELECT id, code_name, master_notes FROM figures WHERE master_notes IS NOT NULL;
