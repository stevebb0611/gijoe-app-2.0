Questions Generated while waiting on Claude to reset 

# 1 Figure misData 
✅ *Airborne* F045 and F046 pulling from F339
Issue Found: Airborne and Airborne [2] were breaking the logic. 
*Grunt v2* not showing pilot details 

# 2 Grading Conditions ✅
review condition "ungraded" - if no grading is slected figure is considered as ungraded. dev toggle 'clean figure' 

# 3 Language/ Syntax ✅
inconsistent lanaguge on figure "complete" vs "whole". complete is listed with multiple figures are presented as complete. while is listed when a single figure is presented as complete. 

# 4 Explination Text (on going effort)
across the interface, Claude use 'explination/help text' These need to be removed. *all* of them. 

# 5 Adjust Variant 
need a way to adjust variant figures. 
example: Breaker v1 A --> Breaker v1 B

# 6 Accessories Groups and Release_Context (csv data)
currently not reading bonus items 

# 7 Figure Expanded View ✅
No. 1 adjust to Breaker No. 1 
Built (July 2026): the per-copy accordion rows on the Inventory list now read "{Figure Name} No. 1" / "No. 2" instead of a bare "No. 1" (`web/src/app-inventory.jsx`, `.inv-inst__id`). Name is title-cased ("Breaker No. 1") per FRONTEND_STANDARDS.md's no-ALL-CAPS rule via a local `titleCase()` helper — scoped to just this label; the rest of the app's code-name display (rows, cards, modal headers) intentionally stays ALL CAPS (vintage file-card look, not revisited here).

# 8 Damaged Accessories ✅
incorportate a damaged accessories notation
Built (July 2026): per-instance `units_damaged` on `instance_accessories` (migration 004), clamped <= units_owned — a condition notation, not a completeness input (Complete still = owned >= required). In the detail modal's ACCESSORIES panel, a "⚠ mark as damaged" toggle opens a DAMAGED ACCESSORIES box listing only currently-owned pieces; ticking a unit flags it damaged (rust/hashed box fill, same visual language as the figure-body damage map). The completeness ring shows a hashed rust wedge sized to the damaged share of owned accessories.

# 9 Dashboard Counts
update [Complete Chip] 
update to include variants, 1982 = 43, not "16" ✅
Built (July 2026): year-header COVERAGE/COMPLETE meters (`yearParts()` in `web/src/app-detail.jsx`) now count roster + owned at the (figure, production variant) level instead of per catalog figure — a figure with 3 variants contributes 3 roster slots, and "owned" only credits the distinct variants you actually have a copy of (not raw copy count). 1982 now reads 12/43. Single-variant figures still count as one slot (catalog always carries >=1 `variants[]` entry, per `server/catalog.js`), so this degrades gracefully where variant data isn't authored yet. Scoped to the year meters only — the top KPI header and per-figure accessory-completeness % are a different axis and untouched. [Complete Chip] item still needs clarification — unclear what specifically was meant.

# 10 Refined Delete Sequence
[Remove Figure Only] (Accessories drop into PartsBin)
[Remove Figure and Accessories]

# 11 Show Collection Gaps ✅
needs to account for variants. 
Built (July 2026): a figure is now a "gap" if you own zero copies OR you own it but are missing one or more production variants (`isGap()` in `web/src/app-inventory.jsx`, used by the `status === 'gaps'` filter). Previously an accessory-complete single copy (e.g. Grunt v1, fully kitted but only 1 of 3 variants owned) silently passed as "not a gap" since the check was just `owned === 0`. Verified against the DB: figures owning every variant (Breaker v1.5, Grunt v2, Hardtop) are correctly excluded; multi-variant figures missing letters (Breaker v1, Cover Girl, Cobra) correctly show up.
Noticed in passing, not fixed: the toolbar's "N of 21" count while this filter is active compares shown-count against your *owned* unique-figure total (`t.inInventory`), which reads oddly for a filter that surfaces mostly not-yet-owned figures — pre-existing, not introduced by this change.

# 12 Add Figure — wrong "copy #" on success screen ✅
Issue Found (July 2026): adding a 2nd Doc showed "DOC · copy #3 added" on the FINALIZE success screen despite only 2 Docs existing after the add. Root cause: `instNo` (`web/src/app-add-figure.jsx`) was derived live from `JoeData.ownedCount()` on every render, including the success screen shown *after* `commit()` already persisted the new instance — so it counted the just-added copy twice. The pre-commit FINALIZE summary row wasn't affected (rendered before commit), only the post-commit success message.
Built: removed the "copy #" ordinal from both the success heading and the FINALIZE summary row (now just "first of this variant" / "additional copy") per owner request — this number never necessarily matched the real "No. N" badge shown later in Inventory anyway, since that's sorted most-complete-first, not by add order. Verified live: added a real 3rd Doc, confirmed the success screen now reads "DOC added" with no number, confirmed the DB count went 2→3, then deleted the test instance to restore the collection to its original 2 Docs.