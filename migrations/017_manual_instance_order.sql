-- ============================================================
--  Migration 017: instances.pinned_no — manual override for a copy's
--  displayed "No. N" position within its figure
--  Apply to: gijoe_collection.db
--  How to run: open in TablePlus → SQL editor → paste → Run
-- ============================================================

-- ─────────────────────────────────────────────
--  INSTANCE_MODEL.md originally specified display numbering as fully
--  derived (never stored) — copies sorted most-complete-first, renumbered
--  contiguously at render time (web/src/store.js figureSummary()). The
--  owner wants a manual escape hatch: pin a specific copy to a specific
--  "No." (e.g. to line copy numbers up with production-variant letters —
--  No.1 = variant A, No.2 = variant B — instead of whatever order
--  completeness happens to produce).
--
--  This is a PIN, not a full manual order: only copies the owner has
--  explicitly moved get a pinned_no. Everything else still falls back to
--  the old most-complete-first sort, filling in around the pinned copies.
--  See figureSummary()'s merge algorithm for the exact placement rule.
--
--  NULL = unpinned (the default / original derived behavior, unchanged).
--  No FK, no CHECK — it's just a display-order hint, not a slot count, so
--  it tolerates gaps/duplicates/out-of-range values gracefully (the merge
--  algorithm clamps rather than erroring).
-- ─────────────────────────────────────────────

ALTER TABLE instances ADD COLUMN pinned_no INTEGER;

-- Verify
-- SELECT id, figure_id, pinned_no FROM instances WHERE pinned_no IS NOT NULL;
