-- ============================================================
--  Migration 004: accessory damage — per-unit damaged notation
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

BEGIN TRANSACTION;

-- ─────────────────────────────────────────────
--  1. Add units_damaged to instance_accessories
--     Tracks how many of the OWNED units are damaged — a subset of
--     units_owned (a broken part is still "had", just condition-flagged).
--     Damage is an orthogonal condition axis, same as the instances.damage
--     JSON for the figure body: it does NOT affect completeness (Complete
--     still = units_owned >= quantity_required). Clamped to
--     units_damaged <= units_owned at the app layer (server/instances.js);
--     not a CHECK constraint here because SQLite's ALTER TABLE ADD COLUMN
--     can't add cross-column constraints.
-- ─────────────────────────────────────────────

ALTER TABLE instance_accessories ADD COLUMN units_damaged INTEGER NOT NULL DEFAULT 0;

COMMIT;

-- Verify
-- SELECT instance_id, accessory_id, units_owned, units_damaged FROM instance_accessories WHERE units_damaged > 0;
