-- ============================================================
--  Migration 001: Per-instance model (17c)
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
--  Requires: SQLite 3.35+ (ALTER TABLE DROP COLUMN)
--  Safe to run on the live DB — catalog rows are preserved.
-- ============================================================

PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

-- ─────────────────────────────────────────────
--  1. Drop views that reference columns being removed
-- ─────────────────────────────────────────────

DROP VIEW IF EXISTS v_figures;
DROP VIEW IF EXISTS v_figure_accessories;
DROP VIEW IF EXISTS v_incomplete_figures;
DROP VIEW IF EXISTS v_orphan_accessories;

-- ─────────────────────────────────────────────
--  2. Drop index on figures.condition_id (required before drop column)
-- ─────────────────────────────────────────────

DROP INDEX IF EXISTS idx_figures_condition;

-- ─────────────────────────────────────────────
--  3. Drop figure_locations (replaced by instances.location free text)
-- ─────────────────────────────────────────────

DROP TABLE IF EXISTS figure_locations;

-- ─────────────────────────────────────────────
--  4. Strip ownership fields from figures
--     figures is now pure catalog — read-only reference data
-- ─────────────────────────────────────────────

ALTER TABLE figures DROP COLUMN quantity_owned;
ALTER TABLE figures DROP COLUMN condition_id;
ALTER TABLE figures DROP COLUMN year_acquired;
ALTER TABLE figures DROP COLUMN is_moc;

-- ─────────────────────────────────────────────
--  5. Strip ownership fields from figure_accessories
--     figure_accessories is now blueprint-only (what a figure requires)
-- ─────────────────────────────────────────────

ALTER TABLE figure_accessories DROP COLUMN quantity_owned;
ALTER TABLE figure_accessories DROP COLUMN condition_id;

-- ─────────────────────────────────────────────
--  6. Add variant_lookup
--     Owner-authored table of production variant tells.
--     Multi-variant figures require a variant at Add time.
--     Single-variant figures have no rows here.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS variant_lookup (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    figure_id   INTEGER NOT NULL REFERENCES figures(id) ON DELETE CASCADE,
    letter      TEXT    NOT NULL,   -- 'A', 'B', 'C' …
    tell        TEXT    NOT NULL,   -- e.g. "thin thumbs"
    notes       TEXT,
    UNIQUE (figure_id, letter)
);

-- ─────────────────────────────────────────────
--  7. Add instances
--     One row = one physical copy you own.
--     "How many do you own" = COUNT(*) FROM instances WHERE figure_id = X.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS instances (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    figure_id   INTEGER NOT NULL REFERENCES figures(id) ON DELETE RESTRICT,
    variant_id  INTEGER REFERENCES variant_lookup(id) ON DELETE RESTRICT,
                -- NULL = single-variant figure only
    is_primary  BOOLEAN DEFAULT 0,
    body_type   TEXT NOT NULL DEFAULT 'male'
                CHECK(body_type IN ('male', 'female')),
    is_moc      BOOLEAN DEFAULT 0,
    damage      TEXT,   -- JSON: { physical: [...], paint: [...] }
    location    TEXT,   -- free-text, e.g. "BIN C-04 · long-box"
    notes       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
--  8. Add instance_accessories
--     One row per accessory per copy.
--     Seeded from figure_accessories blueprint when a copy is added.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS instance_accessories (
    instance_id  INTEGER NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
    accessory_id INTEGER NOT NULL REFERENCES accessories(id) ON DELETE RESTRICT,
    have         BOOLEAN NOT NULL DEFAULT 0,
    PRIMARY KEY (instance_id, accessory_id)
);

-- ─────────────────────────────────────────────
--  9. New indexes
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_instances_figure      ON instances(figure_id);
CREATE INDEX IF NOT EXISTS idx_instances_variant     ON instances(variant_id);
CREATE INDEX IF NOT EXISTS idx_inst_acc_instance     ON instance_accessories(instance_id);
CREATE INDEX IF NOT EXISTS idx_inst_acc_accessory    ON instance_accessories(accessory_id);
CREATE INDEX IF NOT EXISTS idx_variant_lookup_figure ON variant_lookup(figure_id);

-- ─────────────────────────────────────────────
--  10. New trigger
-- ─────────────────────────────────────────────

CREATE TRIGGER IF NOT EXISTS trg_instances_updated
    AFTER UPDATE ON instances
BEGIN
    UPDATE instances SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ─────────────────────────────────────────────
--  11. Recreate updated views
-- ─────────────────────────────────────────────

CREATE VIEW IF NOT EXISTS v_figures AS
SELECT
    f.id,
    f.figure_id,
    f.display_name,
    f.code_name,
    f.version,
    f.variant,
    f.full_name,
    f.specialty,
    fac.name        AS faction,
    sg.name         AS sub_group,
    s.year          AS series_year,
    s.label         AS series_label,
    s.description   AS series,
    f.year_promoted,
    f.year_released,
    f.year_discontinued,
    f.release_context,
    f.is_mail_away,
    f.is_vehicle_driver,
    f.vehicle,
    f.notes,
    f.image_url_primary,
    f.image_url_detail,
    COUNT(i.id)                            AS copies_owned,
    SUM(CASE WHEN i.is_moc = 1 THEN 1 ELSE 0 END) AS copies_moc,
    (CASE WHEN EXISTS (
        SELECT 1 FROM figure_file_cards ffc WHERE ffc.figure_id = f.id
    ) THEN 1 ELSE 0 END)                   AS has_file_card
FROM figures f
LEFT JOIN factions    fac ON fac.faction_id   = f.faction_id
LEFT JOIN sub_groups   sg ON  sg.sub_group_id = f.sub_group_id
LEFT JOIN series        s ON   s.series_id    = f.series_id
LEFT JOIN instances     i ON   i.figure_id    = f.id
GROUP BY f.id;


CREATE VIEW IF NOT EXISTS v_figure_completeness AS
SELECT
    f.id            AS figure_id,
    f.code_name,
    f.display_name,
    COUNT(DISTINCT i.id) AS copies_owned,
    MAX(CASE
        WHEN i.id IS NULL THEN 0
        WHEN i.is_moc = 1 THEN 1
        WHEN NOT EXISTS (
            SELECT 1 FROM figure_accessories fa
            WHERE fa.figure_id       = f.id
              AND fa.release_context = 'retail'
              AND NOT EXISTS (
                SELECT 1 FROM instance_accessories ia
                WHERE ia.instance_id  = i.id
                  AND ia.accessory_id = fa.accessory_id
                  AND ia.have         = 1
              )
        ) THEN 1
        ELSE 0
    END) AS is_complete_now
FROM figures f
LEFT JOIN instances i ON i.figure_id = f.id
GROUP BY f.id;


CREATE VIEW IF NOT EXISTS v_instance_missing_accessories AS
SELECT
    i.id            AS instance_id,
    f.id            AS figure_id,
    f.code_name,
    f.display_name,
    a.accessory_code,
    a.name          AS accessory,
    ac.name         AS category,
    fa.quantity_required,
    fa.release_context,
    fa.group_id
FROM instances i
JOIN figures            f  ON f.id           = i.figure_id
JOIN figure_accessories fa ON fa.figure_id   = f.id
JOIN accessories        a  ON a.id           = fa.accessory_id
LEFT JOIN accessory_categories ac ON ac.category_id = a.category_id
LEFT JOIN instance_accessories ia ON ia.instance_id  = i.id
                                 AND ia.accessory_id = fa.accessory_id
WHERE fa.release_context = 'retail'
  AND i.is_moc           = 0
  AND (ia.have IS NULL OR ia.have = 0)
ORDER BY f.code_name, i.id, a.name;


CREATE VIEW IF NOT EXISTS v_figure_accessories AS
SELECT
    f.code_name,
    f.specialty,
    f.release_context       AS figure_release_context,
    a.accessory_code,
    a.name                  AS accessory,
    ac.name                 AS category,
    a.type,
    a.color,
    a.release_context       AS accessory_release_context,
    a.image_url_primary     AS accessory_image,
    fa.release_context      AS pairing_release_context,
    fa.is_original,
    fa.is_shared,
    fa.quantity_required,
    fa.group_id,
    fa.notes
FROM figures f
JOIN figure_accessories fa ON fa.figure_id    = f.id
JOIN accessories        a  ON a.id            = fa.accessory_id
LEFT JOIN accessory_categories ac ON ac.category_id = a.category_id
ORDER BY f.code_name, fa.release_context, ac.name, a.name;

-- ─────────────────────────────────────────────

COMMIT;
PRAGMA foreign_keys = ON;

-- Verify: run these after the migration to confirm the result.
-- SELECT COUNT(*) FROM figures;           -- should still be 654
-- SELECT COUNT(*) FROM instances;         -- should be 0 (empty — no copies owned yet)
-- SELECT name FROM pragma_table_info('figures');  -- should NOT include quantity_owned / condition_id / year_acquired / is_moc
-- SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
