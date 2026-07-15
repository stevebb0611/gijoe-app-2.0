-- ============================================================
--  Migration 009: Master Collection — target quantities + the
--  per-instance star that marks a copy as a permanent keeper
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

BEGIN TRANSACTION;

-- ─────────────────────────────────────────────
--  1. master_target — how many copies of this figure/variant the
--     owner wants permanently in the Master Collection. Lives on
--     variant_lookup for figures with recorded production variants
--     (each letter gets its own target, e.g. a troop-builder wanting
--     3 of variant A); falls back to figures.master_target for
--     single-variant figures, which have no variant_lookup rows.
--     Default 1 — the baseline "one of everything" goal. Not a CHECK
--     constraint (SQLite ALTER TABLE can't express one); clamped to
--     >= 0 at the app layer, same convention as units_damaged.
-- ─────────────────────────────────────────────
ALTER TABLE figures ADD COLUMN master_target INTEGER NOT NULL DEFAULT 1;
ALTER TABLE variant_lookup ADD COLUMN master_target INTEGER NOT NULL DEFAULT 1;

-- ─────────────────────────────────────────────
--  2. is_master — the star. Marks one specific owned physical copy
--     as committed to the Master Collection (counts toward its
--     figure/variant's master_target). Free to set on any instance
--     regardless of completeness or file-card status — those stay
--     separate notations, not a gate. Copies that are never starred
--     are considered tradeable surplus; see MASTER_COLLECTION.md for
--     the (deliberately app-untracked) disposition policy.
-- ─────────────────────────────────────────────
ALTER TABLE instances ADD COLUMN is_master BOOLEAN NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────
--  3. v_master_collection_progress — reporting view, TablePlus-only
--     (the app computes this client-side in web/src/store.js). One
--     row per figure × variant (or one row per single-variant figure,
--     via the LEFT JOIN's NULL branch), target vs. starred_count.
-- ─────────────────────────────────────────────
DROP VIEW IF EXISTS v_master_collection_progress;
CREATE VIEW v_master_collection_progress AS
SELECT
    f.id                                        AS figure_id,
    f.code_name,
    f.display_name,
    vl.letter                                   AS variant_letter,
    COALESCE(vl.master_target, f.master_target)  AS target,
    COUNT(CASE WHEN i.is_master = 1 THEN 1 END)  AS starred_count
FROM figures f
LEFT JOIN variant_lookup vl ON vl.figure_id = f.id
LEFT JOIN instances i ON i.figure_id = f.id
  AND (i.variant_id = vl.id OR (vl.id IS NULL AND i.variant_id IS NULL))
GROUP BY f.id, vl.id
ORDER BY f.code_name, vl.letter;

COMMIT;

-- Verify
-- SELECT * FROM v_master_collection_progress WHERE starred_count > 0;
-- SELECT * FROM v_master_collection_progress WHERE target <> 1 LIMIT 20;
-- SELECT id, code_name, master_target FROM figures WHERE master_target <> 1;
-- SELECT id, figure_id, letter, master_target FROM variant_lookup WHERE master_target <> 1;
