-- ============================================================
--  Migration 006: parts bin damage — per-unit damaged notation
--  on loose stock (accessory_inventory)
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

BEGIN TRANSACTION;

-- ─────────────────────────────────────────────
--  1. Add units_damaged to accessory_inventory
--     Mirrors instance_accessories.units_damaged (migration 004): a subset
--     of quantity_owned, app-clamped at the server layer
--     (server/instances.js), not a CHECK constraint (SQLite ALTER TABLE ADD
--     COLUMN can't add cross-column constraints). Lets the Parts Bin
--     distinguish clean vs. damaged loose stock once the "swap for clean"
--     action starts depositing damaged units into the bin.
-- ─────────────────────────────────────────────

ALTER TABLE accessory_inventory ADD COLUMN units_damaged INTEGER NOT NULL DEFAULT 0;

COMMIT;

-- Verify
-- SELECT accessory_id, quantity_owned, units_damaged FROM accessory_inventory WHERE units_damaged > 0;
