-- ============================================================
--  G.I. JOE COLLECTION DATABASE
--  SQLite-compatible schema
--  Updated: June 2026
--
--  Changes from April 2026 version (per-instance model — 17c):
--    - figures: removed quantity_owned, condition_id, year_acquired, is_moc
--              (figures is now pure catalog / read-only reference)
--    - figure_accessories: removed quantity_owned, condition_id
--              (accessory ownership is now per-instance)
--    - figure_locations: REMOVED (replaced by instances.location free text)
--    - variant_lookup: ADDED (owner-authored production variant tells)
--    - instances: ADDED (one row per physical copy owned)
--    - instance_accessories: ADDED (one row per accessory per instance)
--    - v_figures: rewritten — ownership counts from instances
--    - v_figure_accessories: cleanup (no quantity_owned)
--    - v_incomplete_figures: replaced by v_instance_missing_accessories
--    - v_figure_completeness: ADDED (per-figure complete-now summary)
--    - v_orphan_accessories: REMOVED (concept moves to app layer)
--    - instances trigger + indexes: ADDED
-- ============================================================

PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────
--  LOOKUP / REFERENCE TABLES
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS series (
    series_id   INTEGER PRIMARY KEY,
    year        INTEGER NOT NULL,
    description TEXT    NOT NULL,
    label       TEXT
);

CREATE TABLE IF NOT EXISTS conditions (
    condition_id INTEGER PRIMARY KEY AUTOINCREMENT,
    label        TEXT NOT NULL UNIQUE,
    description  TEXT
);

CREATE TABLE IF NOT EXISTS accessory_categories (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS factions (
    faction_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS sub_groups (
    sub_group_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL UNIQUE,
    faction_id   INTEGER REFERENCES factions(faction_id) ON DELETE SET NULL,
    description  TEXT
);

-- ─────────────────────────────────────────────
--  CATALOG — figures (read-only reference)
-- ─────────────────────────────────────────────
-- Ownership fields (quantity_owned, condition_id, year_acquired, is_moc)
-- have been removed. This table is reference data only — seed it from
-- the CSVs and edit via the admin form or directly in TablePlus.
-- Do not add per-copy tracking fields here.

CREATE TABLE IF NOT EXISTS figures (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    figure_id         TEXT    UNIQUE,
    code_name         TEXT    NOT NULL,
    character_key     TEXT,               -- disambiguates reused code names (e.g. AIRBORNE_1 vs AIRBORNE_2);
                                          -- NULL for the vast majority of figures where code_name is unique
    alt_name          TEXT,
    version           TEXT,
    variant           TEXT,
    variant_lookup    TEXT,
    display_name      TEXT,
    full_name         TEXT,
    specialty         TEXT,
    faction_id        INTEGER REFERENCES factions(faction_id) ON DELETE SET NULL,
    sub_group_id      INTEGER REFERENCES sub_groups(sub_group_id) ON DELETE SET NULL,
    series_id         INTEGER REFERENCES series(series_id) ON DELETE SET NULL,
    year_promoted     INTEGER,
    year_released     INTEGER,
    year_discontinued INTEGER,
    release_context   TEXT    NOT NULL DEFAULT 'retail'
                      CHECK(release_context IN ('retail', 'convention', 'mail_in')),
    is_mail_away      BOOLEAN DEFAULT 0,
    mail_in_notes     TEXT,
    is_vehicle_driver BOOLEAN DEFAULT 0,
    vehicle           TEXT,
    notes             TEXT,                -- catalog-level annotation (not per-copy)
    image_url_primary TEXT,
    image_url_detail  TEXT,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
--  CATALOG — accessories (read-only reference)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accessories (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    accessory_code        TEXT    NOT NULL UNIQUE,
    name                  TEXT    NOT NULL,
    alt_name              TEXT,
    category_id           INTEGER REFERENCES accessory_categories(category_id) ON DELETE SET NULL,
    type                  TEXT,
    color                 TEXT,
    pack_quantity         INTEGER DEFAULT 1,
    variant_notes         TEXT,
    release_context       TEXT    NOT NULL DEFAULT 'retail'
                          CHECK(release_context IN ('retail', 'convention', 'mail_in', 'bonus')),
    is_electronic_working INTEGER DEFAULT NULL
                          CHECK(is_electronic_working IN (0, 1, NULL)),
    notes                 TEXT,
    image_url_primary     TEXT,
    image_url_detail      TEXT,
    created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
--  CATALOG — variant lookup (owner-authored)
-- ─────────────────────────────────────────────
-- Thin table of production variants per figure. Multi-variant figures
-- require a variant_id on each instance. Single-variant figures have
-- no rows here and instance.variant_id is NULL.
-- All rows are manually authored — there is no import for this table.
-- See VARIANTS.md for the full model.

CREATE TABLE IF NOT EXISTS variant_lookup (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    figure_id   INTEGER NOT NULL REFERENCES figures(id) ON DELETE CASCADE,
    letter      TEXT    NOT NULL,   -- 'A', 'B', 'C' …
    tell        TEXT    NOT NULL,   -- plain-English physical description, e.g. "thin thumbs"
    notes       TEXT,
    UNIQUE (figure_id, letter)
);

-- ─────────────────────────────────────────────
--  INVENTORY — instances (one row per owned copy)
-- ─────────────────────────────────────────────
-- This is the heart of the per-instance model. One row = one physical
-- figure in your possession. quantity_owned on figures is gone —
-- "how many do you own" = COUNT(*) FROM instances WHERE figure_id = X.
--
-- damage JSON shape:
-- {
--   "physical": [
--     { "id": "...", "side": "front|back", "point": "head|chest|elbowL|elbowR|
--                oring|wristL|wristR|kneeL|kneeR|ankleL|ankleR",
--       "type": "break|crack|loose|brittle", "severity": "minor|moderate|severe" }
--   ],
--   "paint": [
--     { "side": "front|back",
--       "region": "head|chest|armL|armR|waist|legL|legR",
--       "severity": "minor|moderate|severe" }
--   ]
-- }
-- Grades (Physical + Paint) are derived from this JSON by the app — not stored.

CREATE TABLE IF NOT EXISTS instances (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    figure_id   INTEGER NOT NULL REFERENCES figures(id) ON DELETE RESTRICT,
    variant_id  INTEGER REFERENCES variant_lookup(id) ON DELETE RESTRICT,
                -- NULL = single-variant figure. Multi-variant figures require
                -- a variant at Add time — there is no "unidentified" state.
    is_primary  BOOLEAN DEFAULT 0,
                -- optional manual pin; if unset, the most-complete copy
                -- is treated as the de-facto primary at render time
    body_type   TEXT NOT NULL DEFAULT 'male'
                CHECK(body_type IN ('male', 'female')),
    is_moc      BOOLEAN DEFAULT 0,
                -- Mint On Card — sealed copy. When true, all accessories are
                -- assumed present and the damage map is replaced by a sealed-card
                -- placeholder in the UI.
    damage      TEXT,   -- JSON (see shape above); NULL = no damage logged
    location    TEXT,   -- free-text bin/box label, e.g. "BIN C-04 · long-box"
    notes       TEXT,
    filecard_on_file  BOOLEAN DEFAULT 0,  -- this copy's file card is on hand (a notation, not a completeness gate)
    filecard_printing TEXT,               -- legacy free-text printing tag ('A'/'B'/'C'); superseded by filecard_id below
    filecard_id INTEGER REFERENCES file_cards(file_card_id) ON DELETE SET NULL,
                -- which real printing (FILE_CARDS.md) this copy's card is. Nullable — NULL is
                -- a legitimate "not identified yet" state, not a data gap.
    country_of_origin TEXT CHECK (country_of_origin IN ('China', 'Hong Kong', 'Indonesia')),
                -- which of the figure's known origins (figure_coo) this physical copy is.
                -- A notation, like filecard_printing — optional, doesn't affect completeness.
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
--  INVENTORY — instance accessories
-- ─────────────────────────────────────────────
-- One row per accessory per instance. Seeded when a copy is added
-- (from the figure's blueprint in figure_accessories). The app manages
-- this table; TablePlus is read-only / admin override.
--
-- units_owned is a count, not a boolean — some blueprint lines require more
-- than one unit of an accessory (e.g. a figure needing two of the same
-- weapon). A line is satisfied when units_owned >= figure_accessories.quantity_required.
-- units_owned = 0 → this copy is missing this accessory entirely.
-- units_damaged (migration 004) is a subset of units_owned — a condition
-- notation, not a completeness input. Clamped to <= units_owned at the app
-- layer (SQLite ALTER TABLE can't add cross-column CHECK constraints).

CREATE TABLE IF NOT EXISTS instance_accessories (
    instance_id    INTEGER NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
    accessory_id   INTEGER NOT NULL REFERENCES accessories(id) ON DELETE RESTRICT,
    units_owned    INTEGER NOT NULL DEFAULT 0,
    units_damaged  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (instance_id, accessory_id)
);

-- ─────────────────────────────────────────────
--  CATALOG — accessory blueprint per figure
-- ─────────────────────────────────────────────

-- Named accessory slots (interchangeable variant groups).
-- The slot is satisfied if SUM(units_owned) >= quantity_required across the group
-- for a given instance.
CREATE TABLE IF NOT EXISTS accessory_groups (
    group_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    figure_id         INTEGER NOT NULL REFERENCES figures(id) ON DELETE CASCADE,
    slot_name         TEXT    NOT NULL,
    quantity_required INTEGER DEFAULT 1
);

-- Blueprint: which accessories a figure requires and in what quantity.
-- quantity_owned removed — ownership is tracked in instance_accessories.
CREATE TABLE IF NOT EXISTS figure_accessories (
    figure_id         INTEGER NOT NULL REFERENCES figures(id) ON DELETE CASCADE,
    accessory_id      INTEGER NOT NULL REFERENCES accessories(id) ON DELETE CASCADE,
    group_id          INTEGER REFERENCES accessory_groups(group_id) ON DELETE SET NULL,
    release_context   TEXT    NOT NULL DEFAULT 'retail'
                      CHECK(release_context IN ('retail', 'convention', 'mail_in', 'bonus')),
    is_original       BOOLEAN DEFAULT 1,
    is_shared         BOOLEAN DEFAULT 0,
    quantity_required INTEGER DEFAULT 1,
    notes             TEXT,
    match_key         TEXT,
                      -- cross-slot matched-color tag (see ACCESSORY_GROUPS.md): when two or
                      -- more of a figure's group_id slots have members sharing a match_key,
                      -- those slots must resolve to the SAME key together for Complete.
    PRIMARY KEY (figure_id, accessory_id)
);

-- ─────────────────────────────────────────────
--  PARTS BIN — loose accessory inventory
-- ─────────────────────────────────────────────
-- Global loose-accessory stock. Unassigned surplus = quantity_owned
-- minus the sum of instance_accessories.units_owned across all instances
-- that require this accessory. Useful for accessories without a figure home.

CREATE TABLE IF NOT EXISTS accessory_inventory (
    accessory_id    INTEGER PRIMARY KEY REFERENCES accessories(id) ON DELETE CASCADE,
    quantity_owned  INTEGER NOT NULL DEFAULT 0,
    units_damaged   INTEGER NOT NULL DEFAULT 0,   -- subset of quantity_owned; app-clamped (migration 006)
    notes           TEXT
);

-- ─────────────────────────────────────────────
--  LOCATIONS (optional reference lookup)
-- ─────────────────────────────────────────────
-- Named physical storage locations. instances.location is a free-text
-- field for quick entry; this table is an optional normalized lookup
-- for structured storage management.

CREATE TABLE IF NOT EXISTS locations (
    location_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    description TEXT
);

-- ─────────────────────────────────────────────
--  VEHICLES
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    vehicle_type  TEXT,
    faction_id    INTEGER REFERENCES factions(faction_id) ON DELETE SET NULL,
    series_id     INTEGER REFERENCES series(series_id) ON DELETE SET NULL,
    condition_id  INTEGER REFERENCES conditions(condition_id) ON DELETE SET NULL,
    is_complete   BOOLEAN DEFAULT 1,
    notes         TEXT,
    image_url_primary TEXT,
    image_url_detail  TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS figure_vehicles (
    figure_id   INTEGER NOT NULL REFERENCES figures(id) ON DELETE CASCADE,
    vehicle_id  INTEGER NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    is_original BOOLEAN DEFAULT 1,
    notes       TEXT,
    PRIMARY KEY (figure_id, vehicle_id)
);

-- ─────────────────────────────────────────────
--  FILE CARDS
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS file_cards (
    file_card_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    file_card_code  TEXT    NOT NULL UNIQUE,
    code_name       TEXT    NOT NULL,
    series_id       INTEGER REFERENCES series(series_id) ON DELETE SET NULL,
    release_type    TEXT,
    card_back       TEXT,
    card_color      TEXT,
    logo_version    TEXT,
    text_version    TEXT,
    country         TEXT,
    condition_id    INTEGER REFERENCES conditions(condition_id) ON DELETE SET NULL,
    notes           TEXT,
    image_url_primary TEXT,
    image_url_detail  TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS figure_file_cards (
    figure_id       INTEGER NOT NULL REFERENCES figures(id) ON DELETE CASCADE,
    file_card_id    INTEGER NOT NULL REFERENCES file_cards(file_card_id) ON DELETE CASCADE,
    is_original     BOOLEAN DEFAULT 1,
    notes           TEXT,
    PRIMARY KEY (figure_id, file_card_id)
);

-- ─────────────────────────────────────────────
--  COUNTRY OF ORIGIN
-- ─────────────────────────────────────────────
-- Which countries a figure/version is known to have been produced in (a figure
-- can have more than one, e.g. an early China run and a later Hong Kong run of
-- the same mold/version). Sourced from gijoe_db_figures_coo.csv via
-- server/import-coo.mjs. Companion to instances.country_of_origin (which of
-- these a given physical copy actually is).

CREATE TABLE IF NOT EXISTS figure_coo (
    figure_id INTEGER NOT NULL REFERENCES figures(id) ON DELETE CASCADE,
    country   TEXT NOT NULL CHECK(country IN ('China', 'Hong Kong', 'Indonesia')),
    PRIMARY KEY (figure_id, country)
);

-- ─────────────────────────────────────────────
--  WISHLIST
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wishlist (
    wish_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    code_name    TEXT    NOT NULL,
    series_id    INTEGER REFERENCES series(series_id) ON DELETE SET NULL,
    faction_id   INTEGER REFERENCES factions(faction_id) ON DELETE SET NULL,
    priority     INTEGER DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),
    notes        TEXT,
    added_on     DATE DEFAULT CURRENT_DATE
);

-- ─────────────────────────────────────────────
--  TRIGGERS
-- ─────────────────────────────────────────────

CREATE TRIGGER IF NOT EXISTS trg_figures_updated
    AFTER UPDATE ON figures
BEGIN
    UPDATE figures SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_accessories_updated
    AFTER UPDATE ON accessories
BEGIN
    UPDATE accessories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_instances_updated
    AFTER UPDATE ON instances
BEGIN
    UPDATE instances SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ─────────────────────────────────────────────
--  INDEXES
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_figures_faction          ON figures(faction_id);
CREATE INDEX IF NOT EXISTS idx_figures_sub_group        ON figures(sub_group_id);
CREATE INDEX IF NOT EXISTS idx_figures_series           ON figures(series_id);
CREATE INDEX IF NOT EXISTS idx_figures_code             ON figures(figure_id);
CREATE INDEX IF NOT EXISTS idx_figures_release_context  ON figures(release_context);
CREATE INDEX IF NOT EXISTS idx_acc_category             ON accessories(category_id);
CREATE INDEX IF NOT EXISTS idx_acc_release_context      ON accessories(release_context);
CREATE INDEX IF NOT EXISTS idx_fa_accessory             ON figure_accessories(accessory_id);
CREATE INDEX IF NOT EXISTS idx_fa_group                 ON figure_accessories(group_id);
CREATE INDEX IF NOT EXISTS idx_fa_release_context       ON figure_accessories(release_context);
CREATE INDEX IF NOT EXISTS idx_acc_groups_figure        ON accessory_groups(figure_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_faction         ON vehicles(faction_id);
CREATE INDEX IF NOT EXISTS idx_file_cards_code          ON file_cards(code_name);
CREATE INDEX IF NOT EXISTS idx_file_cards_series        ON file_cards(series_id);
CREATE INDEX IF NOT EXISTS idx_instances_figure         ON instances(figure_id);
CREATE INDEX IF NOT EXISTS idx_instances_variant        ON instances(variant_id);
CREATE INDEX IF NOT EXISTS idx_inst_acc_instance        ON instance_accessories(instance_id);
CREATE INDEX IF NOT EXISTS idx_inst_acc_accessory       ON instance_accessories(accessory_id);
CREATE INDEX IF NOT EXISTS idx_variant_lookup_figure    ON variant_lookup(figure_id);

-- ─────────────────────────────────────────────
--  VIEWS
-- ─────────────────────────────────────────────

-- Full catalog with ownership counts derived from instances.
-- Completeness logic (complete-now, completable, rebalance) runs in the
-- app/backend layer — not replicated here.
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
    COUNT(i.id)                                                     AS copies_owned,
    SUM(CASE WHEN i.is_moc = 1 THEN 1 ELSE 0 END)                  AS copies_moc,
    (CASE WHEN EXISTS (
        SELECT 1 FROM figure_file_cards ffc WHERE ffc.figure_id = f.id
    ) THEN 1 ELSE 0 END)                                            AS has_file_card
FROM figures f
LEFT JOIN factions    fac ON fac.faction_id   = f.faction_id
LEFT JOIN sub_groups   sg ON  sg.sub_group_id = f.sub_group_id
LEFT JOIN series        s ON   s.series_id    = f.series_id
LEFT JOIN instances     i ON   i.figure_id    = f.id
GROUP BY f.id;


-- Per-instance completeness summary.
-- A copy is "whole" when every required retail accessory line has
-- units_owned >= quantity_required.
-- The app's rebalance engine uses the raw instance_accessories rows, not this view.
CREATE VIEW IF NOT EXISTS v_figure_completeness AS
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


-- Per-instance view of missing/partial retail accessories.
-- Useful for the needs list and the rebalance engine input.
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
  AND COALESCE(ia.units_owned, 0) < fa.quantity_required
ORDER BY f.code_name, i.id, a.name;


-- Full accessory blueprint per figure (catalog reference).
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


-- Figure-to-vehicle assignments.
CREATE VIEW IF NOT EXISTS v_vehicle_drivers AS
SELECT
    f.code_name     AS figure,
    f.specialty,
    fac.name        AS faction,
    v.name          AS vehicle,
    v.vehicle_type,
    fv.is_original,
    fv.notes
FROM figure_vehicles fv
JOIN figures   f   ON f.id         = fv.figure_id
JOIN vehicles  v   ON v.vehicle_id = fv.vehicle_id
LEFT JOIN factions fac ON fac.faction_id = f.faction_id
ORDER BY f.code_name;


-- All linked file cards with figure detail.
CREATE VIEW IF NOT EXISTS v_figure_file_cards AS
SELECT
    f.display_name      AS figure,
    f.version,
    f.variant,
    fc.file_card_code,
    fc.release_type,
    fc.card_back,
    fc.card_color,
    fc.logo_version,
    fc.text_version,
    fc.country,
    s.label             AS series_label,
    c.label             AS condition,
    ffc.is_original,
    ffc.notes
FROM figure_file_cards ffc
JOIN figures    f  ON f.id             = ffc.figure_id
JOIN file_cards fc ON fc.file_card_id  = ffc.file_card_id
LEFT JOIN series     s ON s.series_id   = fc.series_id
LEFT JOIN conditions c ON c.condition_id = fc.condition_id
ORDER BY f.code_name, fc.file_card_code;


-- Figures with no file card linked.
CREATE VIEW IF NOT EXISTS v_figures_missing_file_card AS
SELECT
    f.id,
    f.display_name,
    f.code_name,
    f.version,
    f.variant,
    f.release_context,
    fac.name    AS faction,
    s.label     AS series_label
FROM figures f
LEFT JOIN factions fac ON fac.faction_id = f.faction_id
LEFT JOIN series    s  ON   s.series_id  = f.series_id
WHERE NOT EXISTS (
    SELECT 1 FROM figure_file_cards ffc WHERE ffc.figure_id = f.id
)
ORDER BY f.release_context, f.code_name;


-- Loose accessory stock (Parts Bin).
CREATE VIEW IF NOT EXISTS v_accessory_inventory AS
SELECT
    a.accessory_code,
    a.name                  AS accessory,
    ac.name                 AS category,
    a.color,
    a.release_context,
    ai.quantity_owned       AS total_owned,
    ai.units_damaged        AS damaged_owned,
    ai.quantity_owned - ai.units_damaged AS clean_owned,
    ai.notes
FROM accessory_inventory ai
JOIN accessories            a  ON a.id          = ai.accessory_id
LEFT JOIN accessory_categories ac ON ac.category_id = a.category_id
ORDER BY a.name;


-- ─────────────────────────────────────────────
--  SEED DATA — reference values
-- ─────────────────────────────────────────────

INSERT OR IGNORE INTO conditions(label, description) VALUES
    ('Mint',      'Perfect, factory-fresh condition'),
    ('Near Mint', 'Tiny flaws, barely noticeable'),
    ('Good',      'Light wear, fully intact'),
    ('Fair',      'Visible wear or minor damage'),
    ('Poor',      'Heavy damage, missing parts');

INSERT OR IGNORE INTO series(series_id, year, description, label) VALUES
    (1,  1982, 'Series 1 — straight arm',  'S1'),
    (2,  1983, 'Series 1.5 — swivel arm',  'S1.5'),
    (3,  1983, 'Series 2',                 'S2'),
    (4,  1984, 'Series 3',                 'S3'),
    (5,  1985, 'Series 4',                 'S4'),
    (6,  1986, 'Series 5',                 'S5'),
    (7,  1987, 'Series 6',                 'S6'),
    (8,  1988, 'Series 7',                 'S7'),
    (9,  1989, 'Series 8',                 'S8'),
    (10, 1990, 'Series 9',                 'S9'),
    (11, 1991, 'Series 10',                'S10'),
    (12, 1992, 'Series 11',                'S11'),
    (13, 1993, 'Series 12',                'S12'),
    (14, 1994, 'Series 13',                'S13'),
    (15, 9999, 'Convention & Mail-In Block — 700-block + off-cycle reissues, not a real chronological year', 'CONV');

INSERT OR IGNORE INTO factions(name) VALUES
    ('G.I. Joe'),
    ('Cobra'),
    ('Oktober Guard'),
    ('Dreadnoks');

INSERT OR IGNORE INTO sub_groups(name, faction_id, description) VALUES
    ('Tiger Force',             (SELECT faction_id FROM factions WHERE name='G.I. Joe'), 'Tiger-stripe camouflage elite unit — 1988'),
    ('Night Force',             (SELECT faction_id FROM factions WHERE name='G.I. Joe'), 'Night operations unit in dark colorways — 1988'),
    ('Slaughter''s Marauders',  (SELECT faction_id FROM factions WHERE name='G.I. Joe'), 'Sgt. Slaughter''s personal squad — 1989'),
    ('Sky Patrol',              (SELECT faction_id FROM factions WHERE name='G.I. Joe'), 'Airborne specialists with parachutes — 1990'),
    ('Eco Warriors',            (SELECT faction_id FROM factions WHERE name='G.I. Joe'), 'Environmental combat unit — 1991'),
    ('Ninja Force',             (SELECT faction_id FROM factions WHERE name='G.I. Joe'), 'Joe ninja specialists — 1992'),
    ('DEF',                     (SELECT faction_id FROM factions WHERE name='G.I. Joe'), 'Drug Elimination Force — 1992'),
    ('Battle Force 2000',       (SELECT faction_id FROM factions WHERE name='G.I. Joe'), 'Futuristic weapons development unit — 1987'),
    ('Star Brigade',            (SELECT faction_id FROM factions WHERE name='G.I. Joe'), 'Joe space combat unit — 1993'),
    ('Battle Corps',            (SELECT faction_id FROM factions WHERE name='G.I. Joe'), 'Core combat unit — 1993'),
    ('Mega Marines',            (SELECT faction_id FROM factions WHERE name='G.I. Joe'), 'Bio-armor anti-Mega Monster unit — 1993'),
    ('Dino Hunters',            (SELECT faction_id FROM factions WHERE name='G.I. Joe'), 'Dinosaur capture and containment unit — 1993'),
    ('Street Fighter II',       (SELECT faction_id FROM factions WHERE name='G.I. Joe'), 'Joe-aligned Street Fighter II crossover figures — 1993–1994'),
    ('Python Patrol',           (SELECT faction_id FROM factions WHERE name='Cobra'), 'Elite Cobra unit in python camouflage — 1989'),
    ('Crimson Guard',           (SELECT faction_id FROM factions WHERE name='Cobra'), 'Cobra''s elite political soldiers'),
    ('Iron Grenadiers',         (SELECT faction_id FROM factions WHERE name='Cobra'), 'Destro''s personal army — 1988'),
    ('Cobra Ninja Force',       (SELECT faction_id FROM factions WHERE name='Cobra'), 'Cobra ninja operatives — 1992'),
    ('Cobra Eco Warriors',      (SELECT faction_id FROM factions WHERE name='Cobra'), 'Cobra environmental warfare unit — 1991'),
    ('Headhunters',             (SELECT faction_id FROM factions WHERE name='Cobra'), 'Drug cartel enforcers — 1992'),
    ('Cobra Star Brigade',      (SELECT faction_id FROM factions WHERE name='Cobra'), 'Cobra space unit — 1993'),
    ('Mega Monsters',           (SELECT faction_id FROM factions WHERE name='Cobra'), 'Cobra bio-engineered monster creatures — 1993'),
    ('Cobra Street Fighter II', (SELECT faction_id FROM factions WHERE name='Cobra'), 'Cobra-aligned Street Fighter II crossover figures — 1993–1994'),
    ('Dreadnoks',               (SELECT faction_id FROM factions WHERE name='Dreadnoks'), 'Zartan''s biker gang — affiliated with Cobra');

INSERT OR IGNORE INTO accessory_categories(category_id, name) VALUES
    (1,  'Helmet'),
    (2,  'Helmet accessory'),
    (3,  'Backpack'),
    (4,  'Backpack with battery'),
    (5,  'Backpack accessory'),
    (6,  'Weapon — pistol'),
    (7,  'Weapon — shotgun'),
    (8,  'Weapon — rifle'),
    (9,  'Weapon — submachine gun'),
    (10, 'Weapon — machine gun'),
    (11, 'Weapon — flamethrower'),
    (12, 'Weapon — blaster / laser'),
    (13, 'Weapon — bazooka / launcher'),
    (14, 'Weapon — knife'),
    (15, 'Weapon — blade'),
    (16, 'Weapon — machete'),
    (17, 'Weapon — sword'),
    (18, 'Weapon — melee'),
    (19, 'Weapon — bow / crossbow'),
    (20, 'Weapon — harpoon / javelin / spear'),
    (21, 'Weapon — specialized'),
    (22, 'Weapon accessory'),
    (23, 'Missile'),
    (24, 'Spring-loaded launcher'),
    (25, 'Spring-loaded missile'),
    (26, 'Animal'),
    (27, 'Animal accessory'),
    (28, 'Ammo / Belt'),
    (29, 'Armor / Shield'),
    (30, 'Comms / Radio / Tech'),
    (31, 'Explosive ordnance disposal (EOD)'),
    (32, 'Grappling hook'),
    (33, 'Medical equipment'),
    (34, 'Ski / Snow equipment'),
    (35, 'Specialized equipment'),
    (36, 'Swim / Scuba equipment'),
    (37, 'Tactical gear'),
    (38, 'Parachute case / Parachute'),
    (39, 'Decal'),
    (40, 'Soft goods'),
    (41, 'Cord / Pull / Strap'),
    (42, 'Launch system'),
    (43, 'Playset feature'),
    (44, 'Transportation'),
    (45, 'Standard hose'),
    (46, 'Specialized hose'),
    (47, 'Water hose'),
    (48, 'Putty'),
    (49, 'Accessory'),
    (50, 'Accessory tree'),
    (51, 'Stand / Base'),
    (52, 'Cassette / VHS'),
    (60, 'File card — carded release'),
    (61, 'File card — mail-away'),
    (62, 'File card — variant');
