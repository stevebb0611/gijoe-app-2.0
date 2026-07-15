-- ============================================================
--  Migration 008: damage notes — free-text description of what's
--  wrong with the damaged units, on both the loose bin stock and
--  an owned copy's accessory record
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

BEGIN TRANSACTION;

-- ─────────────────────────────────────────────
--  1. accessory_inventory.damage_notes — describes whatever's
--     damaged in this loose stack (units_damaged, migration 006).
--     One string per accessory_id stack, since units aren't
--     individually identified — same granularity limit as the count.
-- ─────────────────────────────────────────────
ALTER TABLE accessory_inventory ADD COLUMN damage_notes TEXT;

-- ─────────────────────────────────────────────
--  2. instance_accessories.damage_notes — same idea, scoped to one
--     owned copy's accessory row. When a damaged loose part is pulled
--     onto an instance (server/instances.js pullPart), its bin-side
--     damage_notes carries over onto this column rather than being
--     dropped — see PARTS_BIN.md / project memory 2026-07-14.
-- ─────────────────────────────────────────────
ALTER TABLE instance_accessories ADD COLUMN damage_notes TEXT;

COMMIT;

-- Verify
-- SELECT accessory_id, units_damaged, damage_notes FROM accessory_inventory WHERE damage_notes IS NOT NULL;
-- SELECT instance_id, accessory_id, units_damaged, damage_notes FROM instance_accessories WHERE damage_notes IS NOT NULL;
