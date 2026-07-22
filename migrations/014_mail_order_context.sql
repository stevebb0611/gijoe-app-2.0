-- ============================================================
--  Migration 014: mail_order release_context + mail-away → mail-in rename
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

-- ─────────────────────────────────────────────
--  1. Rebuild figures: widen release_context CHECK to add 'mail_order'
--     (distinct from 'mail_in' — mail-in/mail-away is a clip-and-send-in
--     proof-of-purchase premium, mail-order is a catalog/order-form
--     purchase, a different acquisition channel for vintage collectors).
--     Also rename is_mail_away → is_mail_in, retiring "mail-away" as a
--     term everywhere in favor of "mail-in" (the two were used
--     interchangeably; is_mail_away was the only column still using the
--     retired word — release_context and mail_in_notes already said
--     "mail_in").
--
--     figures has incoming FKs with ON DELETE RESTRICT (instances) —
--     unlike migration 012's figure_accessories rebuild (no incoming
--     FKs), dropping figures with foreign_keys=ON would trigger an
--     implicit delete that RESTRICT aborts on the first owned instance.
--     PRAGMA foreign_keys = OFF for the duration, same as migration 001.
-- ─────────────────────────────────────────────

PRAGMA foreign_keys = OFF;

CREATE TABLE figures_new (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    figure_id         TEXT    UNIQUE,
    code_name         TEXT    NOT NULL,
    character_key     TEXT,
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
                      CHECK(release_context IN ('retail', 'convention', 'mail_in', 'mail_order')),
    is_mail_in        BOOLEAN DEFAULT 0,
    mail_in_notes     TEXT,
    is_vehicle_driver BOOLEAN DEFAULT 0,
    vehicle           TEXT,
    notes             TEXT,
    image_url_primary TEXT,
    image_url_detail  TEXT,
    master_target     INTEGER NOT NULL DEFAULT 1,
    master_notes      TEXT,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO figures_new (
    id, figure_id, code_name, character_key, alt_name, version, variant, variant_lookup,
    display_name, full_name, specialty, faction_id, sub_group_id, series_id,
    year_promoted, year_released, year_discontinued, release_context, is_mail_in,
    mail_in_notes, is_vehicle_driver, vehicle, notes, image_url_primary, image_url_detail,
    master_target, master_notes, created_at, updated_at
)
SELECT
    id, figure_id, code_name, character_key, alt_name, version, variant, variant_lookup,
    display_name, full_name, specialty, faction_id, sub_group_id, series_id,
    year_promoted, year_released, year_discontinued, release_context, is_mail_away,
    mail_in_notes, is_vehicle_driver, vehicle, notes, image_url_primary, image_url_detail,
    master_target, master_notes, created_at, updated_at
FROM figures;

DROP TABLE figures;
ALTER TABLE figures_new RENAME TO figures;

CREATE INDEX idx_figures_faction          ON figures(faction_id);
CREATE INDEX idx_figures_sub_group        ON figures(sub_group_id);
CREATE INDEX idx_figures_series           ON figures(series_id);
CREATE INDEX idx_figures_code             ON figures(figure_id);
CREATE INDEX idx_figures_release_context  ON figures(release_context);

CREATE TRIGGER trg_figures_updated
    AFTER UPDATE ON figures
BEGIN
    UPDATE figures SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────
--  2. Recreate v_figures — referenced f.is_mail_away, now f.is_mail_in.
--     DROP TABLE figures above already dropped this view's dependency;
--     SQLite doesn't auto-drop views on table rebuild, but the view body
--     still names the old column, so it must be redefined regardless.
-- ─────────────────────────────────────────────

DROP VIEW IF EXISTS v_figures;

CREATE VIEW v_figures AS
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
    f.is_mail_in,
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

-- ─────────────────────────────────────────────
--  3. First confirmed mail_order reclassification: Snow Serpent v3
--     ("Arctic Commando Snow Serpent", figure_id F566, catalog id 466).
--     Owner-confirmed (physically-owned copy, 2026-07-20): a mail-order
--     catalog purchase, not a mail-in premium, not a convention
--     exclusive — see MAIL_RELEASES.md. Also corrects series_id 13→15
--     (mainline 1993/Series 12 → the sentinel "Special Release" bucket),
--     the same miscategorization FIGURE_SPLITS.md already fixed once for
--     Jinx v2 — see that doc's new Snow Serpent v3 entry.
--
--     This is a single confirmed figure, not a bulk reclassification —
--     the ~25 other mail_in figures with similarly generic "Mail order"
--     notes text stay mail_in until individually verified.
-- ─────────────────────────────────────────────

UPDATE figures
SET release_context = 'mail_order', is_mail_in = 0, series_id = 15
WHERE id = 466;

-- Verify
-- SELECT id, figure_id, code_name, version, display_name, series_id,
--        release_context, is_mail_in, mail_in_notes
-- FROM figures WHERE id = 466;
