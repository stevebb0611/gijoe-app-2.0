-- ============================================================
--  Migration 022: splittable accessories (per-copy split)
--  Apply to: gijoe_collection.db
--  How to run: sqlite3 gijoe_collection.db < migrations/022_splittable_accessories.sql
-- ============================================================

-- Some accessories are one physical piece that a collector may have cut
-- apart. The first case is Gung-Ho v2's A0328 "Rank and Stripes (decal)": one
-- sheet holding both the stripes (red/yellow) and the rank (black/blue/yellow).
-- Owner, 2026-10-30: the split is per copy. A copy shows either the sheet
-- line or its two piece lines, never both.
--
--   accessories.split_of            -- a piece row points at its parent sheet
--   instance_accessory_splits       -- which copies have split which parent
--
-- Pieces are linked to the same figure with the parent's release_context
-- ('bonus' here), so they never touch completeness math. completeness.js
-- bpForVariant() hides pieces on unsplit copies and hides the parent on
-- split ones. The Parts Bin files the pieces under the figure through those
-- same figure_accessories rows.
-- Pre-migration snapshot: backups/gijoe_collection_PRE_SPLIT_20261030.db

BEGIN TRANSACTION;

ALTER TABLE accessories ADD COLUMN split_of INTEGER REFERENCES accessories(id) ON DELETE SET NULL;

CREATE TABLE instance_accessory_splits (
    instance_id  INTEGER NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
    accessory_id INTEGER NOT NULL REFERENCES accessories(id) ON DELETE CASCADE,
    PRIMARY KEY (instance_id, accessory_id)
);

-- Colors list top-left to bottom-right on the swatch diagonal. Rank's
-- primary, black, sits in the middle (owner, 2026-10-30).
INSERT INTO accessories (accessory_code, name, category_id, type, color, release_context, split_of)
SELECT 'A1751', 'Stripes (decal)', category_id, type, 'red/yellow', release_context, id
FROM accessories WHERE accessory_code = 'A0328';
INSERT INTO accessories (accessory_code, name, category_id, type, color, release_context, split_of)
SELECT 'A1752', 'Rank (decal)', category_id, type, 'blue/black/yellow', release_context, id
FROM accessories WHERE accessory_code = 'A0328';

-- Attach each piece to every figure the parent is on, with the parent's
-- context/variant scoping (only Gung-Ho v2 today).
INSERT INTO figure_accessories (figure_id, accessory_id, group_id, release_context, is_original, is_shared, quantity_required, variant_id)
SELECT fa.figure_id, c.id, NULL, fa.release_context, fa.is_original, fa.is_shared, fa.quantity_required, fa.variant_id
FROM accessories c
JOIN figure_accessories fa ON fa.accessory_id = c.split_of
WHERE c.accessory_code IN ('A1751', 'A1752');

COMMIT;

-- Verify
-- SELECT accessory_code, name, color, split_of FROM accessories WHERE split_of IS NOT NULL;
-- SELECT f.code_name, f.version, a.accessory_code, a.name, fa.release_context
--   FROM figure_accessories fa JOIN figures f ON f.id = fa.figure_id JOIN accessories a ON a.id = fa.accessory_id
--   WHERE a.accessory_code IN ('A0328', 'A1751', 'A1752');
