-- ============================================================
--  Migration 015: figure_sets — multi-pack grouping display
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

BEGIN TRANSACTION;

-- ─────────────────────────────────────────────
--  1. figure_sets / figure_set_members — a fun bonus completionist display:
--     some figures were originally sold bundled as a 2-pack/3-pack "set"
--     rather than individually. This is a pure grouping/display layer over
--     already-ownable catalog figures — no new ownable entries, no schema
--     change to figures/instances. A many-to-many junction (not a single
--     figures.set_id column) since a figure could in principle belong to
--     more than one set, mirroring this schema's existing junction-table
--     convention (figure_accessories, figure_coo, figure_file_cards) rather
--     than the single-FK sub_group_id convention. See FIGURE_SETS.md.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS figure_sets (
    set_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    year        INTEGER,
    description TEXT
);

CREATE TABLE IF NOT EXISTS figure_set_members (
    set_id             INTEGER NOT NULL REFERENCES figure_sets(set_id) ON DELETE CASCADE,
    figure_id          INTEGER NOT NULL REFERENCES figures(id) ON DELETE CASCADE,
    quantity_required  INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (set_id, figure_id)
);
CREATE INDEX IF NOT EXISTS idx_fsm_figure ON figure_set_members(figure_id);

-- ─────────────────────────────────────────────
--  2. First confirmed set: the 1982 JC Penney Cobra 3-Pack. Already
--     documented at the accessory level in ACCESSORY_GROUPS.md's 1982 Cobra
--     / Cobra Officer entries (migration 012_retailer_exclusive_context.sql)
--     — two Cobra v1 (figure id 3, one with Rock 'n Roll's M-16/Bipod, one
--     with a Bazooka) + one Cobra Officer v1 (figure id 5, Mortar + Bipod
--     Stand). Source: YoJoe.com, cited 2026-07-16/19 in ACCESSORY_GROUPS.md.
-- ─────────────────────────────────────────────

INSERT OR IGNORE INTO figure_sets (set_id, name, year, description) VALUES
    (1, '1982 JC Penney Cobra 3-Pack', 1982,
     'Retail-exclusive 3-pack: two Cobra v1 (one with M-16/Bipod, one with a Bazooka) + one Cobra Officer v1 (Mortar + Bipod Stand). See ACCESSORY_GROUPS.md.');

INSERT OR IGNORE INTO figure_set_members (set_id, figure_id, quantity_required) VALUES
    (1, 3, 2),
    (1, 5, 1);

COMMIT;

-- Verify
-- SELECT fs.name, f.code_name, f.version, fsm.quantity_required
-- FROM figure_set_members fsm
-- JOIN figure_sets fs ON fs.set_id = fsm.set_id
-- JOIN figures f ON f.id = fsm.figure_id
-- ORDER BY fs.set_id, f.id;
