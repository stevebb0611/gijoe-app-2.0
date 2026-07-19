-- ============================================================
--  Migration 012: retailer_exclusive release_context value
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

BEGIN TRANSACTION;

-- ─────────────────────────────────────────────
--  1. Widen figure_accessories.release_context CHECK to add
--     'retailer_exclusive' — a non-convention, non-mail-in, non-bonus
--     non-retail context: a retailer-exclusive pack-in (e.g. the 1982
--     JC Penney Cobra 3-pack's swapped gear), distinct from a fan
--     convention exclusive. Same "tracked, never blocks Complete"
--     behavior as convention/mail_in/bonus — see ACCESSORY_GROUPS.md.
--
--     SQLite can't ALTER an existing CHECK constraint, so this is the
--     standard rebuild: new table, copy rows, drop old, rename new,
--     recreate indexes. No other release_context value's behavior
--     changes; no view logic references the enum list directly (they
--     only ever test `= 'retail'`), so views don't need to be redefined.
-- ─────────────────────────────────────────────

CREATE TABLE figure_accessories_new (
    figure_id         INTEGER NOT NULL REFERENCES figures(id) ON DELETE CASCADE,
    accessory_id      INTEGER NOT NULL REFERENCES accessories(id) ON DELETE CASCADE,
    group_id          INTEGER REFERENCES accessory_groups(group_id) ON DELETE SET NULL,
    release_context   TEXT    NOT NULL DEFAULT 'retail'
                      CHECK(release_context IN ('retail', 'convention', 'mail_in', 'bonus', 'retailer_exclusive')),
    is_original       BOOLEAN DEFAULT 1,
    is_shared         BOOLEAN DEFAULT 0,
    quantity_required INTEGER DEFAULT 1,
    notes             TEXT, match_key TEXT, variant_id INTEGER REFERENCES variant_lookup(id) ON DELETE SET NULL,
    PRIMARY KEY (figure_id, accessory_id)
);

INSERT INTO figure_accessories_new SELECT * FROM figure_accessories;

DROP TABLE figure_accessories;
ALTER TABLE figure_accessories_new RENAME TO figure_accessories;

CREATE INDEX idx_fa_accessory             ON figure_accessories(accessory_id);
CREATE INDEX idx_fa_group                 ON figure_accessories(group_id);
CREATE INDEX idx_fa_release_context       ON figure_accessories(release_context);
CREATE INDEX idx_fa_variant ON figure_accessories(variant_id);

-- ─────────────────────────────────────────────
--  2. Reclassify 1982 Cobra v1's (figure_id 3) JC Penney 3-pack gear
--     from 'convention' to 'retailer_exclusive'. Per YoJoe.com: JC
--     Penney sold an exclusive 3-pack (two Cobras + one Cobra Officer)
--     — one Cobra got Rock 'n Roll's M-16/Bipod, the other got either
--     the thin-handle (light green, A0028) or dark-green (A0029)
--     Bazooka. A retail-channel exclusive, not a fan-club/convention
--     exclusive — 'convention' was the wrong bucket. Still non-blocking
--     for Complete either way.
-- ─────────────────────────────────────────────

UPDATE figure_accessories
SET release_context = 'retailer_exclusive'
WHERE figure_id = 3 AND accessory_id IN (13, 14, 28, 29) AND release_context = 'convention';

COMMIT;

-- Verify
-- SELECT fa.accessory_id, a.accessory_code, a.name, fa.release_context
-- FROM figure_accessories fa JOIN accessories a ON a.id = fa.accessory_id
-- WHERE fa.figure_id = 3 ORDER BY a.name;
