-- ============================================================
--  Migration 018: convention_kind sub-classification of figures.release_context='convention'
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

-- ─────────────────────────────────────────────
--  1. Add convention_kind — splits the 'convention' release_context bucket
--     into two owner-confirmed sub-categories (2026-08-06):
--       'figure'      — genuinely new to the lineup, only ever available via
--                       convention (e.g. Jinx v2). Bold CONVENTION badge, unchanged.
--       'accessories' — a re-release of a version that ALSO exists at retail,
--                       where the convention release just bundles different/
--                       exclusive accessories (e.g. "Flint (convention)" pairs
--                       with retail "Flint v1"). Quiet sub-badge.
--     NULL (the default for all other release_context values too) means
--     "figure" bucket / not yet manually reviewed — same pattern as this
--     column's siblings (mail_in vs mail_order, figure_accessories.
--     release_context's retailer_exclusive): manually tagged, not derived,
--     because whether a convention row conceptually pairs with an existing
--     retail version isn't reliably encoded anywhere else — the 5 rows below
--     even had their own `version` column blanked by split-release-edition.mjs/
--     split-quick-kick-convention.mjs, so it can't be recovered by matching
--     version strings at query time.
--
--     A plain ADD COLUMN (not the migration 012/014-style full rebuild) is
--     safe here: SQLite allows a CHECK on ADD COLUMN as long as it doesn't
--     reference other columns, which this doesn't — no existing CHECK is
--     being widened, so there's nothing to rebuild.
-- ─────────────────────────────────────────────

ALTER TABLE figures ADD COLUMN convention_kind TEXT
    CHECK(convention_kind IN ('figure', 'accessories'));

CREATE INDEX idx_figures_convention_kind ON figures(convention_kind);

-- ─────────────────────────────────────────────
--  2. Backfill the 5 confirmed "accessories" rows (owner-confirmed via
--     AskUserQuestion, 2026-08-06) — each pairs with an existing retail
--     version of the same figure (see FIGURE_SPLITS.md for the retail↔
--     convention id pairing on each):
--       525 Flint            (F701) ↔ retail Flint v1        (id 78)
--       524 Quick Kick       (F404) ↔ retail Quick Kick v1   (id 85)
--       526 Roadblock        (F707) ↔ retail Roadblock v2    (id 115)
--       527 Snow Serpent     (F710) ↔ retail Snow Serpent v1 (id 89)
--       528 Stalker v1.5     (F711) ↔ retail Stalker v1.5    (id 42)
--     The other 12 convention rows are left NULL (see comment above) —
--     they are already correctly "figure" per the owner's default-bucket
--     decision, no explicit write needed.
-- ─────────────────────────────────────────────

UPDATE figures SET convention_kind = 'accessories'
WHERE id IN (524, 525, 526, 527, 528);

-- Verify
-- SELECT id, figure_id, code_name, version, release_context, convention_kind
-- FROM figures WHERE release_context = 'convention' ORDER BY id;
