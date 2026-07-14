# Navigation & Information Architecture

How the screens connect. Companion to `README.md`. Defines top-level destinations, how the **Instance Detail** page is reached, and where the **Parts Bin** lives.

---

## Top-level destinations
The app has a small set of peer destinations, surfaced in the dark header (left = brand, right = nav). Recommended set:

1. **Figures** *(home / default, was “Inventory”)* — the “All” collection grouped by year. The spine of the app.
2. **Parts Bin** — the loose-accessory inventory (see `PARTS_BIN.md`). Header nav item (the **count badge was removed** in the June 2026 header pass — it read as clutter). Its own page: searchable, groupable by accessory type, with quantities and reverse-lookup to the instances that need each part.
3. *(future)* **Vehicles (+ Playsets)** — planned major expansion; a non-functional **[Vehicles] “In Dev”** placeholder chip (dashed/striped) already sits between Figures and Parts Bin as a visual reminder. Direction set in `OPEN_QUESTIONS_Claude.md` §15.
4. *(future)* **Wanted list** — the figures and loose parts you still need to complete the collection (graduates from the existing “needs” / catalog-gap data). Optional.

Header nav (June 2026): `G.I. Joe Collection` · `[ Figures ] [ Vehicles · In Dev ] [ Parts Bin ]` · centered search + **＋ Add Figure** · three KPI stat boxes (Unique / Total / Complete). All nav/chip labels are Title case (no ALL CAPS) — see `FRONTEND_STANDARDS.md`. Keep nav to a few items; this is a focused tool, not a portal.

---

## Reaching Instance Detail from Inventory

> **Update (July 2026 — built differently than specced below.)** The real app never built
> a separate Instance Detail **page**. Instead, `web/src/app-detail.jsx` implements a single
> **flip-card detail modal** — the same modal, front face **FIGURE** / back face
> **CONDITION** — that flips in place (`.inv-cardwrap.is-flipped`, see
> `OPEN_QUESTIONS_ISSUES_FOUND.md` #18 for the Safari flip-rendering bug fix, which confirms
> this is how it actually renders). The damage map, grade badges, per-copy accessories,
> location, notes, and Remove all live on that back face — there is no dedicated route, no
> breadcrumb, and no `instance-detail.jsx` counterpart under `web/src/`. The **"modal =
> glance, page = instance-level work"** rule below was the original design intent but isn't
> what shipped; read this section as history of the plan, not the current architecture. If
> the page-based version is still wanted, it's a real gap between the design docs
> (`INSTANCE_MODEL.md` → *Instance Detail screen*) and the build, not just a doc lag.

Two levels of detail, deliberately separated:

- **Figure-level → quick-look modal.** Clicking a figure (single-owned row, or a gallery card) opens the existing **detail modal**: a fast summary — instance overview, accessory rollup, and primary actions. Good for triage without leaving the list.
- **Instance-level → full Instance Detail page.** Drilling into a *specific copy* opens the dedicated **Instance Detail** page (the damage map needs the room; it doesn't belong in a modal). Entry points:
  - In the **List** view, expanding a multi-instance figure's inline accordion and clicking an **instance sub-row**.
  - In the quick-look **modal**, clicking an **instance tab's "open full detail"** affordance.
  - Any single-instance figure can offer a direct "open detail" from the modal.

The Instance Detail page carries a **breadcrumb back to Inventory** (`‹ INVENTORY`) and instance tabs to switch copies without returning. It also hosts the **VARIANT IDENTITY** panel — used to **correct** a copy's production variant (a variant is always set at Add; there is no unidentified state — see `VARIANTS.md`).

> Rule of thumb: **modal = glance/intake; page = instance-level work.** Two modals now launch over the Inventory — the **figure quick-look** and the **Add Figure pop-out** (below). The condition/damage system on an *existing* copy, per-copy accessories, location, and remove action all live on the Instance Detail **page**.

---

## Parts Bin access & cross-links (two-way)
- **Get to it:** the header **Parts Bin** nav item (with count). 
- **From an instance → bin:** the Instance Detail accessory checklist shows **pull-from-bin** on missing parts; the **Add Figure/Instance** flow recommends pulling available parts on creation; the **Remove** flow offers to deposit accessories into the bin.
- **From the bin → instances:** each Parts Bin entry offers **reverse lookup** — "needed by: STALKER No. 1, BREAKER No. 1" — linking straight to those Instance Detail pages to complete them.
- **Rebalance Accessories (bin header):** a `⚖ REBALANCE` tag in the Parts Bin header opens a panel of figures that can be made whole by **moving parts between their own copies** (with the move list + APPLY MOVES). This affordance lives on the Parts Bin (not Inventory) since rebalancing is loose-part work; the Inventory keeps only the inline `⚖` hint on multi-copy rows. See `PARTS_BIN.md`.

This makes the relationship genuinely bidirectional: the figure flows feed and draw from the bin, and the bin points back at the figures that want its parts.

---

## Flow summary
```
Inventory (All, by year)
  └─ figure row / card ──▶ Quick-look modal (figure level)
        └─ instance tab "open" ──▶ Instance Detail (copy level)
  └─ List accordion ▸ instance sub-row ──▶ Instance Detail
        ├─ pull-from-Parts-Bin  ◀─▶  Parts Bin
        └─ Remove ──▶ "accessories → Parts Bin?" prompt ──▶ Parts Bin

Parts Bin (loose accessories)
  └─ entry ▸ "needed by …" ──▶ Instance Detail (jump to complete)

Add Figure (pop-out modal, launched from Figures header ＋)
  └─ FIND (search ‖ Year→Figure) → DETAILS (accessories + bin pull + location) → CONDITION (damage map + ＋ADD)
        └─ on create ──▶ "these parts are in your Parts Bin — add them?" ──▶ pulls from Parts Bin
```

---

## Undesigned but referenced here (see OPEN_QUESTIONS_Claude.md)
- **Add Figure** — ✅ built, and **reworked June 2026 into a pop-out modal** launched from the header **＋ Add Figure** button (no longer a full-page navigation — it opens over the Inventory; Esc / ✕ / backdrop closes). Three steps: **FIND → DETAILS → CONDITION** (the old FINALIZE step was dropped; ＋ ADD lives on Condition). FIND offers two **independent** paths — a fuzzy catalog **search** (matches `alt_name`, so “Snake-Eyes”≈“Snake Eyes”, “Rock & Roll”≈“Rock 'N Roll”) and a **Year → Figure** dropdown that resolves to a single figure (no long scrollable year list). The standalone `GI Joe Tracker - Add Figure.html` remains as a thin host that renders the same modal and returns to Figures on close. The **custom / not-in-catalog** path is still open.
- **Add Instance** — ✅ built (`GI Joe Tracker - Add Instance.html`): the lighter two-step copy-adder (This copy → Condition) launched from a figure you already own; bin matches appear as a quiet hint.
- **Remove** flow confirmation (the deposit-to-bin branch).
- The **Parts Bin** page — ✅ built (`GI Joe Tracker - Parts Bin.html`); see `PARTS_BIN.md`.
