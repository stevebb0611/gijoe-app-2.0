-- ============================================================
--  Migration 007: variant-scoped accessories + Blocker cleanup
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

BEGIN TRANSACTION;

-- ─────────────────────────────────────────────
--  1. Blocker (figure catalog id 132, F190/F191, 1987) data cleanup
--     Green Mouthpiece (A0297) and DK-528 Infra-Green Laser Pistol (A0298)
--     were duplicated onto Blocker's blueprint — both already correctly
--     belong to Blaster (figure id 131, also 1987). No owned Blocker
--     instance has ever recorded units_owned for either (checked
--     instance_accessories before writing this), so no instance data is
--     orphaned by the delete.
-- ─────────────────────────────────────────────

DELETE FROM figure_accessories WHERE figure_id = 132 AND accessory_id IN (297, 298);

-- ─────────────────────────────────────────────
--  2. variant_id — scope a blueprint row to one production variant
--     New nullable FK on figure_accessories, same "structuring field on the
--     flat blueprint" pattern as group_id/match_key (see ACCESSORY_GROUPS.md).
--     NULL (the default, and every pre-existing row) = the accessory applies
--     to every variant of the figure, unchanged behavior. Set = the row only
--     applies to instances pinned to that variant_lookup letter.
--
--     Needed because production variants fold into one catalog row
--     (VARIANTS.md's variant-collapse rule) — a real hardware difference
--     between variants (e.g. a part only molded/packed with one colorway)
--     has nowhere else to live on the flat blueprint.
-- ─────────────────────────────────────────────

ALTER TABLE figure_accessories ADD COLUMN variant_id INTEGER REFERENCES variant_lookup(id) ON DELETE SET NULL;
CREATE INDEX idx_fa_variant ON figure_accessories(variant_id);

-- Blocker's Visor (A0299) only shipped on v1 B ("With visor, red inner arm" —
-- variant_lookup.id 109). v1 A ("No visor, black inner arm" — id 108) never
-- had one. Scoping this row means v1 A copies stop being asked for it.
UPDATE figure_accessories SET variant_id = 109 WHERE figure_id = 132 AND accessory_id = 299;

-- ─────────────────────────────────────────────
--  3. Views — respect variant_id
-- ─────────────────────────────────────────────

DROP VIEW IF EXISTS v_figure_completeness;
CREATE VIEW v_figure_completeness AS
SELECT
    f.id            AS figure_id,
    f.code_name,
    f.display_name,
    COUNT(DISTINCT i.id)                                            AS copies_owned,
    -- complete_now: at least one copy has all required retail accessories present
    MAX(CASE
        WHEN i.id IS NULL THEN 0
        WHEN i.is_moc = 1 THEN 1   -- MOC copies count as complete
        WHEN NOT EXISTS (
            SELECT 1 FROM figure_accessories fa
            WHERE fa.figure_id       = f.id
              AND fa.release_context = 'retail'
              AND (fa.variant_id IS NULL OR fa.variant_id = i.variant_id)
              AND fa.quantity_required > COALESCE((
                SELECT ia.units_owned FROM instance_accessories ia
                WHERE ia.instance_id  = i.id
                  AND ia.accessory_id = fa.accessory_id
              ), 0)
        ) THEN 1
        ELSE 0
    END)                                                            AS is_complete_now
FROM figures f
LEFT JOIN instances i ON i.figure_id = f.id
GROUP BY f.id;

DROP VIEW IF EXISTS v_instance_missing_accessories;
CREATE VIEW v_instance_missing_accessories AS
SELECT
    i.id            AS instance_id,
    f.id            AS figure_id,
    f.code_name,
    f.display_name,
    a.accessory_code,
    a.name          AS accessory,
    ac.name         AS category,
    fa.quantity_required,
    COALESCE(ia.units_owned, 0) AS units_owned,
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
  AND i.is_moc           = 0          -- MOC copies have no missing accessories
  AND (fa.variant_id IS NULL OR fa.variant_id = i.variant_id)
  AND COALESCE(ia.units_owned, 0) < fa.quantity_required
ORDER BY f.code_name, i.id, a.name;

-- Catalog reference view — surfaces which variant (if any) a row is scoped
-- to, rather than filtering, since this view isn't tied to an owned instance.
DROP VIEW IF EXISTS v_figure_accessories;
CREATE VIEW v_figure_accessories AS
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
    vl.letter                AS variant_letter,
    fa.notes
FROM figures f
JOIN figure_accessories fa ON fa.figure_id    = f.id
JOIN accessories        a  ON a.id            = fa.accessory_id
LEFT JOIN accessory_categories ac ON ac.category_id = a.category_id
LEFT JOIN variant_lookup vl ON vl.id = fa.variant_id
ORDER BY f.code_name, fa.release_context, ac.name, a.name;

COMMIT;

-- Verify
-- SELECT fa.figure_id, a.accessory_code, a.name, fa.variant_id, vl.letter
-- FROM figure_accessories fa JOIN accessories a ON a.id = fa.accessory_id
-- LEFT JOIN variant_lookup vl ON vl.id = fa.variant_id WHERE fa.figure_id = 132;
