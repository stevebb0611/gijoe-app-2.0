-- ============================================================
--  Migration 019: per-copy file card color + grade notation
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

-- Companion fields to instances.filecard_on_file / filecard_id (INSTANCE_MODEL.md,
-- FILE_CARDS.md): a hand-typed color note ("Peach", "Gray", ...) and a coarse
-- 3-point grade for the physical file card this copy actually has on hand.
-- Deliberately independent of the file_cards catalog (card_back/card_color) and
-- of file_cards.condition_id — those describe a *printing*, not what condition
-- THIS owner's card is in; the full per-printing catalog (FILE_CARDS.md) is a
-- slower-moving effort the owner is still working through figure-by-figure, and
-- ownership/grade tracking shouldn't be gated on it being fully populated.
--
-- A plain ADD COLUMN is safe here, per the same reasoning as migration 018:
-- SQLite allows a CHECK on ADD COLUMN as long as it doesn't reference other
-- columns.

ALTER TABLE instances ADD COLUMN filecard_color TEXT;
ALTER TABLE instances ADD COLUMN filecard_grade TEXT
    CHECK(filecard_grade IN ('Poor', 'Good', 'Mint'));

-- Verify
-- SELECT id, filecard_on_file, filecard_id, filecard_color, filecard_grade
-- FROM instances WHERE filecard_on_file = 1;
