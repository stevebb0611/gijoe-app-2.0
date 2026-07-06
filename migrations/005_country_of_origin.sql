-- ============================================================
--  Migration 005: country of origin — where a figure/version was
--  manufactured (catalog-level), and which one a given copy is
--  (instance-level)
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

BEGIN TRANSACTION;

-- ─────────────────────────────────────────────
--  1. figure_coo — which countries a figure/version is known to have
--     been produced in (a figure can have more than one, e.g. an early
--     China run and a later Hong Kong run of the same mold/version).
--     Sourced from gijoe_db_figures_coo.csv via server/import-coo.mjs.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS figure_coo (
    figure_id INTEGER NOT NULL REFERENCES figures(id) ON DELETE CASCADE,
    country   TEXT NOT NULL CHECK(country IN ('China', 'Hong Kong', 'Indonesia')),
    PRIMARY KEY (figure_id, country)
);

-- ─────────────────────────────────────────────
--  2. instances.country_of_origin — which of the figure's known
--     origins THIS physical copy actually is. A notation, like
--     filecard_printing — optional, doesn't affect completeness.
-- ─────────────────────────────────────────────

ALTER TABLE instances ADD COLUMN country_of_origin TEXT
    CHECK (country_of_origin IN ('China', 'Hong Kong', 'Indonesia'));

COMMIT;

-- Verify
-- SELECT f.code_name, f.version, fc.country FROM figure_coo fc JOIN figures f ON f.id = fc.figure_id ORDER BY f.code_name;
-- SELECT id, figure_id, country_of_origin FROM instances WHERE country_of_origin IS NOT NULL;
