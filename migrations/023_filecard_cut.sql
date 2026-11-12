-- ============================================================
--  Migration 023: per-copy file card cut vs full notation
--  Apply to: gijoe_collection.db
-- ============================================================

-- Companion to migration 019 (filecard_color / filecard_grade). Records whether
-- this copy's physical card is a cut-out file card or the full cardback; the
-- Poor/Good/Mint grade then describes that cut or full card. NULL = not noted.

ALTER TABLE instances ADD COLUMN filecard_cut TEXT
    CHECK(filecard_cut IN ('File Card', 'Full Card'));

-- Verify
-- SELECT id, filecard_on_file, filecard_cut, filecard_grade FROM instances WHERE filecard_on_file = 1;
