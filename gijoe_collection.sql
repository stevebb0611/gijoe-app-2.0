-- ============================================================
--  G.I. JOE COLLECTION DATABASE
--  SQLite-compatible schema
--  Updated: April 30, 2026
--
--  Changes from previous version:
--    - figures: image_url split into image_url_primary / image_url_detail
--    - figures: added release_context ('retail' | 'convention' | 'mail_in')
--    - accessories: image_url split into image_url_primary / image_url_detail
--    - accessories: added release_context ('retail' | 'convention' | 'mail_in' | 'bonus')
--    - accessories: alt_name column added
--    - figure_accessories: is_bonus replaced by release_context
--    - figure_accessories: release_context drives completeness logic throughout
--    - vehicles: image_url split into image_url_primary / image_url_detail
--    - file_cards: image_url split into image_url_primary / image_url_detail
--    - All views updated to use release_context in completion checks
--    - New indexes on release_context for figures, accessories, figure_accessories
-- ============================================================

PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────
--  LOOKUP / REFERENCE TABLES
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS series (
    series_id   INTEGER PRIMARY KEY,
    year        INTEGER NOT NULL,            -- primary release year
    description TEXT    NOT NULL,            -- e.g. "Series 1 — straight arm"
    label       TEXT                         -- short display label e.g. "S1", "S1.5", "S2"
);

CREATE TABLE IF NOT EXISTS conditions (
    condition_id INTEGER PRIMARY KEY AUTOINCREMENT,
    label        TEXT NOT NULL UNIQUE,       -- "Mint", "Near Mint", "Good", "Fair", "Poor"
    description  TEXT
);

CREATE TABLE IF NOT EXISTS accessory_categories (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,        -- e.g. "Backpack", "Weapon", "File Card"
    description TEXT
);

CREATE TABLE IF NOT EXISTS factions (
    faction_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE         -- "G.I. Joe", "Cobra", "Oktober Guard"
);

CREATE TABLE IF NOT EXISTS sub_groups (
    sub_group_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL UNIQUE,
    faction_id   INTEGER REFERENCES factions(faction_id) ON DELETE SET NULL,
    description  TEXT
);

-- ─────────────────────────────────────────────
--  CORE TABLES
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS figures (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,  -- auto-assigned, never displayed
    figure_id         TEXT    UNIQUE,                     -- user-defined reference code, e.g. "F001"
    code_name         TEXT    NOT NULL,                   -- character name, e.g. "Duke" — groups all variants
    alt_name          TEXT,                               -- alternate spelling for search, e.g. "Rock & Roll" for "Rock 'N Roll"
    version           TEXT,                               -- release version, e.g. "1", "2"
    variant           TEXT,                               -- body variant within version, e.g. "A", "B", "C"
    variant_lookup    TEXT,                               -- plain-English physical description identifying this variant
    display_name      TEXT,                               -- app-facing label, e.g. "Duke v1A"
    full_name         TEXT,                               -- real name from file card, e.g. "Conrad S. Hauser"
    specialty         TEXT,                               -- MOS / role, e.g. "Airborne Infantryman"
    faction_id        INTEGER REFERENCES factions(faction_id) ON DELETE SET NULL,
    sub_group_id      INTEGER REFERENCES sub_groups(sub_group_id) ON DELETE SET NULL,
    series_id         INTEGER REFERENCES series(series_id) ON DELETE SET NULL,
    year_promoted     INTEGER,                            -- first appeared in catalog / card backs / advertising
    year_released     INTEGER,                            -- actually available for retail or mail-order purchase
    year_discontinued INTEGER,                            -- last year of availability
    condition_id      INTEGER REFERENCES conditions(condition_id) ON DELETE SET NULL,
    quantity_owned    INTEGER NOT NULL DEFAULT 1,         -- how many copies of this exact variant you own (drives the ×2 badge)
    year_acquired     INTEGER,                            -- year you obtained this figure
    release_context   TEXT    NOT NULL DEFAULT 'retail'   -- 'retail' | 'convention' | 'mail_in'
                      CHECK(release_context IN ('retail', 'convention', 'mail_in')),
    is_moc            BOOLEAN DEFAULT 0,                  -- Mint On Card (sealed on original card)
    is_mail_away      BOOLEAN DEFAULT 0,                  -- mail-order exclusive release
    mail_in_notes     TEXT,                               -- release channel detail, e.g. "Mail order, Sears" or "1992 Convention"
    is_vehicle_driver BOOLEAN DEFAULT 0,                  -- figure was originally packaged with a vehicle
    vehicle           TEXT,                               -- vehicle this figure originally came with, e.g. "VAMP"
    notes             TEXT,
    image_url_primary TEXT,                               -- main photo used in roster / card view
    image_url_detail  TEXT,                               -- close-up shot for variant identification (color, mold, stamp differences)
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accessories (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,  -- auto-assigned, never displayed
    accessory_code        TEXT    NOT NULL UNIQUE,   -- user-defined reference code, e.g. "A0001"
    name                  TEXT    NOT NULL,           -- plain English name, e.g. "Submachine gun"
    alt_name              TEXT,                       -- alternate name or spelling for search
    category_id           INTEGER REFERENCES accessory_categories(category_id) ON DELETE SET NULL,
    type                  TEXT,                       -- sub-type within category, e.g. "pistol", "storage"
    color                 TEXT,                       -- e.g. "tan", "black", "olive drab"
    pack_quantity         INTEGER DEFAULT 1,           -- pieces making one complete accessory, e.g. 2 for swim fins
    variant_notes         TEXT,                       -- what makes this variant distinct, e.g. "holes present"
    release_context       TEXT    NOT NULL DEFAULT 'retail'  -- 'retail' | 'convention' | 'mail_in' | 'bonus'
                          CHECK(release_context IN ('retail', 'convention', 'mail_in', 'bonus')),
    is_electronic_working INTEGER DEFAULT NULL
                          CHECK(is_electronic_working IN (0, 1, NULL)),  -- 1=working, 0=not working, NULL=N/A
    notes                 TEXT,
    image_url_primary     TEXT,                       -- main catalog / identification photo
    image_url_detail      TEXT,                       -- close-up for color / mold variant identification
    created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
--  RELATIONSHIP TABLES
-- ─────────────────────────────────────────────

-- Named accessory slots on a figure. Multiple accessory variants in the same
-- group are interchangeable — any one of them satisfies the slot requirement.
-- Example: Duke's "Helmet" group contains A0001 (holes) and A0002 (no holes).
-- The slot is complete if SUM(quantity_owned) >= quantity_required across the group.
CREATE TABLE IF NOT EXISTS accessory_groups (
    group_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    figure_id         INTEGER NOT NULL REFERENCES figures(id) ON DELETE CASCADE,
    slot_name         TEXT    NOT NULL,   -- e.g. "Helmet", "Backpack", "Rifle"
    quantity_required INTEGER DEFAULT 1  -- how many of this slot the figure needs
);

CREATE TABLE IF NOT EXISTS figure_accessories (
    figure_id          INTEGER NOT NULL REFERENCES figures(id) ON DELETE CASCADE,
    accessory_id       INTEGER NOT NULL REFERENCES accessories(id) ON DELETE CASCADE,
    group_id           INTEGER REFERENCES accessory_groups(group_id) ON DELETE SET NULL,
    -- NULL = standalone required accessory
    -- non-NULL = interchangeable slot member (any one variant satisfies the slot)
    release_context    TEXT    NOT NULL DEFAULT 'retail'
                       CHECK(release_context IN ('retail', 'convention', 'mail_in', 'bonus')),
    -- 'retail'     → included in primary completeness check
    -- 'convention' → visible via global toggle; completeness checked independently
    -- 'mail_in'    → visible via global toggle; completeness checked independently
    -- 'bonus'      → always tracked, never factors into any completeness check
    --                (stickers, decal sheets, display stands, accessory trees, VHS/cassettes)
    is_original        BOOLEAN DEFAULT 1,    -- came with the figure vs. aftermarket replacement
    is_shared          BOOLEAN DEFAULT 0,    -- shared across multiple figures in a pack (e.g. Tomax/Xamot skyhook)
    quantity_required  INTEGER DEFAULT 1,    -- used when group_id IS NULL; groups use accessory_groups.quantity_required
    quantity_owned     INTEGER DEFAULT 0,    -- how many you have assigned to this figure (0 = not yet verified/acquired)
    condition_id       INTEGER REFERENCES conditions(condition_id) ON DELETE SET NULL,
    notes              TEXT,
    PRIMARY KEY (figure_id, accessory_id)
);

CREATE TABLE IF NOT EXISTS locations (
    location_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,    -- e.g. "Shelf A", "Display Case 1", "Box 3"
    description TEXT
);

CREATE TABLE IF NOT EXISTS figure_locations (
    figure_id   INTEGER NOT NULL REFERENCES figures(id) ON DELETE CASCADE,
    location_id INTEGER NOT NULL REFERENCES locations(location_id) ON DELETE CASCADE,
    placed_on   DATE DEFAULT CURRENT_DATE,
    PRIMARY KEY (figure_id, location_id)
);

CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,          -- e.g. "VAMP", "Cobra HISS", "Skystriker"
    vehicle_type  TEXT,                      -- e.g. "jeep", "tank", "jet", "boat"
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
    is_original BOOLEAN DEFAULT 1,           -- figure was originally packaged with this vehicle
    notes       TEXT,
    PRIMARY KEY (figure_id, vehicle_id)
);

-- ─────────────────────────────────────────────
--  ACCESSORY INVENTORY
-- ─────────────────────────────────────────────

-- Global accessory stock — tracks total owned regardless of figure assignment.
-- Unassigned surplus = quantity_owned minus the sum of figure_accessories.quantity_owned
-- across all figures. Useful for loose accessories without a figure home.
CREATE TABLE IF NOT EXISTS accessory_inventory (
    accessory_id    INTEGER PRIMARY KEY REFERENCES accessories(id) ON DELETE CASCADE,
    quantity_owned  INTEGER NOT NULL DEFAULT 0,  -- total copies owned across all figures and loose stock
    notes           TEXT
);

-- ─────────────────────────────────────────────
--  FILE CARDS
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS file_cards (
    file_card_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    file_card_code  TEXT    NOT NULL UNIQUE,  -- human-readable ID, e.g. "FC-DUKE-001"
    code_name       TEXT    NOT NULL,          -- character this card belongs to
    series_id       INTEGER REFERENCES series(series_id) ON DELETE SET NULL,
    release_type    TEXT,                      -- "carded", "mail-away", "foreign", "vehicle pack-in"
    card_back       TEXT,                      -- "black back", "red back", "white mailer", "14-back"
    card_color      TEXT,                      -- overall card color, e.g. "red", "black", "white"
    logo_version    TEXT,                      -- e.g. "straight logo", "tilted logo", "no logo"
    text_version    TEXT,                      -- e.g. "v1 original", "v2 revised wording"
    country         TEXT,                      -- "USA", "Canada", "UK", "Brazil", "France"
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
    is_original     BOOLEAN DEFAULT 1,         -- came with this specific figure
    notes           TEXT,
    PRIMARY KEY (figure_id, file_card_id)
);

CREATE TABLE IF NOT EXISTS wishlist (
    wish_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    code_name    TEXT    NOT NULL,
    series_id    INTEGER REFERENCES series(series_id) ON DELETE SET NULL,
    faction_id   INTEGER REFERENCES factions(faction_id) ON DELETE SET NULL,
    priority     INTEGER DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),  -- 1 = highest
    notes        TEXT,
    added_on     DATE DEFAULT CURRENT_DATE
);

-- ─────────────────────────────────────────────
--  TRIGGERS — keep updated_at current
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

-- ─────────────────────────────────────────────
--  INDEXES
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_figures_faction          ON figures(faction_id);
CREATE INDEX IF NOT EXISTS idx_figures_sub_group        ON figures(sub_group_id);
CREATE INDEX IF NOT EXISTS idx_figures_series           ON figures(series_id);
CREATE INDEX IF NOT EXISTS idx_figures_condition        ON figures(condition_id);
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

-- ─────────────────────────────────────────────
--  VIEWS
-- ─────────────────────────────────────────────

-- Full figure details with all FK labels resolved.
-- Completion logic uses release_context = 'retail' only.
-- Convention / mail-in completeness is queried separately via the global toggle.
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
    fac.name       AS faction,
    sg.name        AS sub_group,
    s.year         AS series_year,
    s.label        AS series_label,
    s.description  AS series,
    f.year_promoted,
    f.year_released,
    f.year_discontinued,
    c.label        AS condition,
    f.year_acquired,
    f.quantity_owned,
    f.release_context,
    f.is_moc,

    -- RETAIL ACCESSORY COMPLETENESS
    -- Ungrouped retail accessories: each row must have quantity_owned >= quantity_required.
    -- Grouped retail accessories: SUM(quantity_owned) across the group >= accessory_groups.quantity_required.
    -- bonus / convention / mail_in rows are excluded entirely.
    CASE WHEN
        NOT EXISTS (
            SELECT 1 FROM figure_accessories fa2
            WHERE fa2.figure_id        = f.id
              AND fa2.release_context  = 'retail'
              AND fa2.group_id         IS NULL
              AND fa2.quantity_owned   < fa2.quantity_required
        )
        AND NOT EXISTS (
            SELECT 1 FROM accessory_groups ag
            WHERE ag.figure_id = f.id
              AND (
                SELECT COALESCE(SUM(fa3.quantity_owned), 0)
                FROM figure_accessories fa3
                WHERE fa3.figure_id       = f.id
                  AND fa3.group_id        = ag.group_id
                  AND fa3.release_context = 'retail'
              ) < ag.quantity_required
        )
    THEN 1 ELSE 0 END                                               AS is_accessory_complete,

    -- FULLY COMPLETE (accessories + file card)
    CASE WHEN
        EXISTS (SELECT 1 FROM figure_file_cards ffc WHERE ffc.figure_id = f.id)
        AND NOT EXISTS (
            SELECT 1 FROM figure_accessories fa2
            WHERE fa2.figure_id       = f.id
              AND fa2.release_context = 'retail'
              AND fa2.group_id        IS NULL
              AND fa2.quantity_owned  < fa2.quantity_required
        )
        AND NOT EXISTS (
            SELECT 1 FROM accessory_groups ag
            WHERE ag.figure_id = f.id
              AND (
                SELECT COALESCE(SUM(fa3.quantity_owned), 0)
                FROM figure_accessories fa3
                WHERE fa3.figure_id       = f.id
                  AND fa3.group_id        = ag.group_id
                  AND fa3.release_context = 'retail'
              ) < ag.quantity_required
        )
    THEN 1 ELSE 0 END                                               AS is_complete,

    -- COMPLETION STATUS LABEL
    CASE
        WHEN EXISTS (
            SELECT 1 FROM figure_accessories fa2
            WHERE fa2.figure_id       = f.id
              AND fa2.release_context = 'retail'
              AND fa2.group_id        IS NULL
              AND fa2.quantity_owned  < fa2.quantity_required
        ) OR EXISTS (
            SELECT 1 FROM accessory_groups ag
            WHERE ag.figure_id = f.id
              AND (
                SELECT COALESCE(SUM(fa3.quantity_owned), 0)
                FROM figure_accessories fa3
                WHERE fa3.figure_id       = f.id
                  AND fa3.group_id        = ag.group_id
                  AND fa3.release_context = 'retail'
              ) < ag.quantity_required
        )                        THEN 'Incomplete'
        WHEN NOT EXISTS (
            SELECT 1 FROM figure_file_cards ffc WHERE ffc.figure_id = f.id
        )                        THEN 'Complete — no file card'
        ELSE                          'Complete with file card'
    END                                                             AS completion_status,

    -- RETAIL COMPLETION PERCENTAGE (ungrouped + groups)
    (
        (
            SELECT COALESCE(SUM(CASE WHEN fa2.quantity_owned >= fa2.quantity_required THEN 1 ELSE 0 END), 0)
            FROM figure_accessories fa2
            WHERE fa2.figure_id       = f.id
              AND fa2.release_context = 'retail'
              AND fa2.group_id        IS NULL
        ) + (
            SELECT COALESCE(SUM(CASE
                WHEN (
                    SELECT COALESCE(SUM(fa3.quantity_owned), 0)
                    FROM figure_accessories fa3
                    WHERE fa3.figure_id       = f.id
                      AND fa3.group_id        = ag.group_id
                      AND fa3.release_context = 'retail'
                ) >= ag.quantity_required THEN 1 ELSE 0
            END), 0)
            FROM accessory_groups ag WHERE ag.figure_id = f.id
        )
    ) * 100 / NULLIF(
        (
            SELECT COUNT(*) FROM figure_accessories fa2
            WHERE fa2.figure_id       = f.id
              AND fa2.release_context = 'retail'
              AND fa2.group_id        IS NULL
        ) + (
            SELECT COUNT(*) FROM accessory_groups ag WHERE ag.figure_id = f.id
        ), 0
    )                                                               AS accessory_completion_pct,

    -- HAS FILE CARD (computed, never stored)
    (CASE WHEN EXISTS (
        SELECT 1 FROM figure_file_cards ffc WHERE ffc.figure_id = f.id
    ) THEN 1 ELSE 0 END)                                            AS has_file_card,

    f.is_mail_away,
    f.is_vehicle_driver,
    f.vehicle,
    f.notes,
    f.image_url_primary,
    f.image_url_detail
FROM figures f
LEFT JOIN factions    fac ON fac.faction_id   = f.faction_id
LEFT JOIN sub_groups   sg ON  sg.sub_group_id = f.sub_group_id
LEFT JOIN series        s ON   s.series_id    = f.series_id
LEFT JOIN conditions    c ON   c.condition_id = f.condition_id;


-- Each figure with its full accessory list and ownership status
CREATE VIEW IF NOT EXISTS v_figure_accessories AS
SELECT
    f.code_name                AS figure,
    f.specialty,
    f.release_context          AS figure_release_context,
    a.accessory_code,
    a.name                     AS accessory,
    ac.name                    AS category,
    a.type,
    a.color,
    a.release_context          AS accessory_release_context,
    a.image_url_primary        AS accessory_image,
    fa.release_context         AS pairing_release_context,
    fa.is_original,
    fa.is_shared,
    fa.quantity_required,
    fa.quantity_owned,
    CASE
        WHEN fa.release_context = 'bonus'      THEN 'Bonus — not required'
        WHEN fa.release_context = 'convention' THEN 'Convention accessory'
        WHEN fa.release_context = 'mail_in'    THEN 'Mail-in accessory'
        WHEN fa.is_shared = 1                  THEN 'Shared accessory'
        WHEN fa.quantity_owned >= fa.quantity_required THEN 'Complete'
        ELSE 'Missing ' || (fa.quantity_required - fa.quantity_owned)
    END                        AS quantity_status,
    fa.notes
FROM figures f
JOIN figure_accessories fa ON fa.figure_id    = f.id
JOIN accessories        a  ON a.id            = fa.accessory_id
LEFT JOIN accessory_categories ac ON ac.category_id = a.category_id
ORDER BY f.code_name, fa.release_context, ac.name, a.name;


-- Figures with any required retail accessory where quantity_owned < quantity_required
CREATE VIEW IF NOT EXISTS v_incomplete_figures AS
SELECT
    f.id,
    f.code_name,
    f.specialty,
    fac.name            AS faction,
    f.release_context   AS figure_release_context,
    a.accessory_code,
    a.name              AS accessory,
    ac.name             AS category,
    fax.quantity_required,
    fax.quantity_owned,
    (fax.quantity_required - fax.quantity_owned) AS missing_count,
    fax.notes
FROM figures f
LEFT JOIN factions             fac ON fac.faction_id  = f.faction_id
JOIN      figure_accessories   fax ON fax.figure_id   = f.id
JOIN      accessories          a   ON a.id            = fax.accessory_id
LEFT JOIN accessory_categories ac  ON ac.category_id  = a.category_id
WHERE fax.quantity_owned    < fax.quantity_required
  AND fax.release_context   = 'retail'
  AND fax.is_shared         = 0
ORDER BY f.code_name, a.name;


-- Figure-to-vehicle assignments
CREATE VIEW IF NOT EXISTS v_vehicle_drivers AS
SELECT
    f.code_name    AS figure,
    f.specialty,
    fac.name       AS faction,
    v.name         AS vehicle,
    v.vehicle_type,
    fv.is_original,
    fv.notes
FROM figure_vehicles fv
JOIN figures   f  ON f.id          = fv.figure_id
JOIN vehicles  v  ON v.vehicle_id  = fv.vehicle_id
LEFT JOIN factions fac ON fac.faction_id = f.faction_id
ORDER BY f.code_name;


-- All owned file cards with figure and variant detail
CREATE VIEW IF NOT EXISTS v_figure_file_cards AS
SELECT
    f.display_name                  AS figure,
    f.version,
    f.variant,
    fc.file_card_code,
    fc.release_type,
    fc.card_back,
    fc.card_color,
    fc.logo_version,
    fc.text_version,
    fc.country,
    s.label                         AS series_label,
    c.label                         AS condition,
    ffc.is_original,
    ffc.notes
FROM figure_file_cards ffc
JOIN figures    f   ON f.id            = ffc.figure_id
JOIN file_cards fc  ON fc.file_card_id = ffc.file_card_id
LEFT JOIN series     s ON s.series_id   = fc.series_id
LEFT JOIN conditions c ON c.condition_id = fc.condition_id
ORDER BY f.code_name, fc.file_card_code;


-- Figures with no file card linked
CREATE VIEW IF NOT EXISTS v_figures_missing_file_card AS
SELECT
    f.id,
    f.display_name,
    f.code_name,
    f.version,
    f.variant,
    f.release_context,
    fac.name  AS faction,
    s.label   AS series_label
FROM figures f
LEFT JOIN factions fac ON fac.faction_id = f.faction_id
LEFT JOIN series    s  ON   s.series_id  = f.series_id
WHERE NOT EXISTS (
    SELECT 1 FROM figure_file_cards ffc WHERE ffc.figure_id = f.id
)
ORDER BY f.release_context, f.code_name;


-- Total owned vs. assigned vs. unassigned surplus per accessory
CREATE VIEW IF NOT EXISTS v_accessory_inventory AS
SELECT
    a.accessory_code,
    a.name                                              AS accessory,
    ac.name                                             AS category,
    a.color,
    a.release_context,
    ai.quantity_owned                                   AS total_owned,
    COALESCE(SUM(fa.quantity_owned), 0)                 AS assigned_to_figures,
    ai.quantity_owned - COALESCE(SUM(fa.quantity_owned), 0) AS unassigned
FROM accessory_inventory ai
JOIN accessories           a  ON a.id          = ai.accessory_id
LEFT JOIN accessory_categories ac ON ac.category_id = a.category_id
LEFT JOIN figure_accessories   fa ON fa.accessory_id = ai.accessory_id
GROUP BY ai.accessory_id
ORDER BY a.name;


-- Accessories assigned to a figure that exceed the slot's requirement.
-- These arise when multiple interchangeable variants are present (e.g. Duke has
-- both A0001 helmet-with-holes and A0002 helmet-without-holes, but only needs one).
-- Orphans should be moved to accessory_inventory as loose unassigned stock.
CREATE VIEW IF NOT EXISTS v_orphan_accessories AS
SELECT
    f.figure_id,
    f.display_name                                          AS figure,
    ag.slot_name,
    ag.quantity_required                                    AS slot_requires,
    SUM(fa.quantity_owned)                                  AS slot_total_owned,
    SUM(fa.quantity_owned) - ag.quantity_required           AS orphan_count,
    GROUP_CONCAT(a.accessory_code || ' ' || a.name, ' / ') AS variants_present
FROM accessory_groups ag
JOIN figures           f  ON f.id           = ag.figure_id
JOIN figure_accessories fa ON fa.figure_id  = ag.figure_id
                           AND fa.group_id  = ag.group_id
                           AND fa.release_context = 'retail'
JOIN accessories       a  ON a.id           = fa.accessory_id
GROUP BY ag.group_id
HAVING SUM(fa.quantity_owned) > ag.quantity_required
ORDER BY f.code_name, ag.slot_name;


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
    (14, 1994, 'Series 13',                'S13');

INSERT OR IGNORE INTO factions(name) VALUES
    ('G.I. Joe'),
    ('Cobra'),
    ('Oktober Guard'),
    ('Dreadnoks');

INSERT OR IGNORE INTO sub_groups(name, faction_id, description) VALUES
    -- G.I. Joe sub-groups
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
    -- Cobra sub-groups
    ('Python Patrol',           (SELECT faction_id FROM factions WHERE name='Cobra'), 'Elite Cobra unit in python camouflage — 1989'),
    ('Crimson Guard',           (SELECT faction_id FROM factions WHERE name='Cobra'), 'Cobra''s elite political soldiers'),
    ('Iron Grenadiers',         (SELECT faction_id FROM factions WHERE name='Cobra'), 'Destro''s personal army — 1988'),
    ('Cobra Ninja Force',       (SELECT faction_id FROM factions WHERE name='Cobra'), 'Cobra ninja operatives — 1992'),
    ('Cobra Eco Warriors',      (SELECT faction_id FROM factions WHERE name='Cobra'), 'Cobra environmental warfare unit — 1991'),
    ('Headhunters',             (SELECT faction_id FROM factions WHERE name='Cobra'), 'Drug cartel enforcers — 1992'),
    ('Cobra Star Brigade',      (SELECT faction_id FROM factions WHERE name='Cobra'), 'Cobra space unit — 1993'),
    ('Mega Monsters',           (SELECT faction_id FROM factions WHERE name='Cobra'), 'Cobra bio-engineered monster creatures — 1993'),
    ('Cobra Street Fighter II', (SELECT faction_id FROM factions WHERE name='Cobra'), 'Cobra-aligned Street Fighter II crossover figures — 1993–1994'),
    -- Dreadnoks
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
    -- 53–59 reserved for future physical accessory categories
    (60, 'File card — carded release'),
    (61, 'File card — mail-away'),
    (62, 'File card — variant');
