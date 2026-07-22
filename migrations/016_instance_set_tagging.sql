-- ============================================================
--  Migration 016: instances.set_id — tag a specific physical copy as
--  belonging to a known multi-pack set (figure_sets)
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

-- ─────────────────────────────────────────────
--  Figure Sets v1 (migration 015) could only tell you "N copies of this
--  figure are owned," capped at the pack's required quantity — it couldn't
--  say *which* specific copies actually came from a given pack if the owner
--  owns more copies of that figure than the pack needs. This column lets a
--  specific instance be explicitly tagged, matching a real MOC 2-pack/3-pack
--  as the single physical unit it is. See FIGURE_SETS.md / set-card.jsx.
--
--  Brand-new nullable column on an existing table — no FK toggling needed
--  (adding a column doesn't touch existing rows' referential integrity).
--  Precedent: instances.filecard_id already does exactly this shape
--  (REFERENCES ... ON DELETE SET NULL) and works today with
--  foreign_keys=ON (server/db.js). ON DELETE SET NULL (not CASCADE) is
--  deliberate — deleting a set definition should clear the tag on real
--  owned instances, never delete the physical-copy row itself. This is the
--  opposite of figure_set_members.set_id's ON DELETE CASCADE on purpose,
--  not a mismatch to fix.
-- ─────────────────────────────────────────────

ALTER TABLE instances ADD COLUMN set_id INTEGER REFERENCES figure_sets(set_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_instances_set ON instances(set_id);

-- Verify
-- SELECT id, figure_id, set_id FROM instances WHERE set_id IS NOT NULL;
