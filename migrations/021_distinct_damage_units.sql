-- ============================================================
--  Migration 021: distinct per-unit damage notes
--  Replaces the single damage_notes string on accessory_inventory /
--  instance_accessories (shared across however many units of that
--  accessory happen to be damaged — see migration 008's own comment
--  acknowledging "same granularity limit as the count") with one row
--  per damaged unit, each carrying its own optional note. units_damaged
--  is no longer a stored counter — it's COUNT(*) of the matching rows
--  below (see server/instances.js).
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

BEGIN TRANSACTION;

-- ─────────────────────────────────────────────
--  1. bin_damage — one row per damaged LOOSE unit. Clean loose units stay a
--     plain count (accessory_inventory.quantity_owned) since they're fully
--     interchangeable; only damaged ones need individual identity to carry
--     a distinct note.
-- ─────────────────────────────────────────────
CREATE TABLE bin_damage (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  accessory_id INTEGER NOT NULL REFERENCES accessories(id) ON DELETE CASCADE,
  notes        TEXT
);
CREATE INDEX idx_bin_damage_accessory ON bin_damage(accessory_id);

-- ─────────────────────────────────────────────
--  2. instance_accessory_damage — same idea, scoped to one owned copy's
--     accessory row. Matters most for a quantity_required > 1 blueprint
--     slot (e.g. 2 Missiles) where only some units are damaged.
-- ─────────────────────────────────────────────
CREATE TABLE instance_accessory_damage (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id  INTEGER NOT NULL,
  accessory_id INTEGER NOT NULL,
  notes        TEXT,
  FOREIGN KEY (instance_id, accessory_id) REFERENCES instance_accessories(instance_id, accessory_id) ON DELETE CASCADE
);
CREATE INDEX idx_iad_instance_accessory ON instance_accessory_damage(instance_id, accessory_id);

-- ─────────────────────────────────────────────
--  3. Backfill — one row per already-damaged unit. The old shared
--     damage_notes string (if any) carries onto the FIRST generated row
--     only; any additional units for that same accessory/instance come in
--     blank (in the live data today every existing row has units_damaged
--     = 1, so this is a plain 1:1 carry-over — the generality is just
--     defensive). seq caps at 20, comfortably above any real damaged count.
-- ─────────────────────────────────────────────
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 20)
INSERT INTO bin_damage (accessory_id, notes)
SELECT ai.accessory_id, CASE WHEN seq.n = 1 THEN ai.damage_notes ELSE NULL END
FROM accessory_inventory ai JOIN seq ON seq.n <= ai.units_damaged
WHERE ai.units_damaged > 0;

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 20)
INSERT INTO instance_accessory_damage (instance_id, accessory_id, notes)
SELECT ia.instance_id, ia.accessory_id, CASE WHEN seq.n = 1 THEN ia.damage_notes ELSE NULL END
FROM instance_accessories ia JOIN seq ON seq.n <= ia.units_damaged
WHERE ia.units_damaged > 0;

-- ─────────────────────────────────────────────
--  4. v_accessory_inventory reads accessory_inventory.units_damaged directly
--     — repoint it at bin_damage's per-unit count FIRST. SQLite validates
--     every view in the schema on any ALTER TABLE ... DROP COLUMN, so doing
--     this after dropping the column (instead of before) breaks EVERY later
--     DROP COLUMN in this migration, not just this table's.
-- ─────────────────────────────────────────────
DROP VIEW v_accessory_inventory;
CREATE VIEW v_accessory_inventory AS
SELECT
    a.accessory_code,
    a.name                  AS accessory,
    ac.name                 AS category,
    a.color,
    a.release_context,
    ai.quantity_owned       AS total_owned,
    COALESCE(bd.damaged_count, 0) AS damaged_owned,
    ai.quantity_owned - COALESCE(bd.damaged_count, 0) AS clean_owned,
    ai.notes
FROM accessory_inventory ai
JOIN accessories            a  ON a.id          = ai.accessory_id
LEFT JOIN accessory_categories ac ON ac.category_id = a.category_id
LEFT JOIN (SELECT accessory_id, COUNT(*) AS damaged_count FROM bin_damage GROUP BY accessory_id) bd
       ON bd.accessory_id = ai.accessory_id
ORDER BY a.name;

-- ─────────────────────────────────────────────
--  5. Drop the superseded scalar columns.
-- ─────────────────────────────────────────────
ALTER TABLE accessory_inventory DROP COLUMN units_damaged;
ALTER TABLE accessory_inventory DROP COLUMN damage_notes;
ALTER TABLE instance_accessories DROP COLUMN units_damaged;
ALTER TABLE instance_accessories DROP COLUMN damage_notes;

COMMIT;

-- Verify
-- SELECT * FROM bin_damage;
-- SELECT * FROM instance_accessory_damage;
-- SELECT accessory_id, COUNT(*) FROM bin_damage GROUP BY accessory_id;
