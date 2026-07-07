// accessory-groups.jsx — shared "own any one" variant-slot label and non-retail
// context label, plus the blueprint-order walk that interleaves them with solo
// items. Three mechanisms restructure a figure's flat blueprint list (see
// PARTS_BIN.md "Accessory completeness model" + ACCESSORY_GROUPS.md):
//   group_id        — interchangeable variants; owning any one satisfies the
//                      slot (store.js math)
//   match_key       — 2+ group_id slots that must resolve to the same tag
//                      together. Each slot still renders on its own (see
//                      2026-07-06 note below) — a small tag badge on every
//                      option row is the only cross-slot hint.
//   release_context — non-retail items; grouped by context, tracked but never
//                      gates Complete (store.js math already excludes them)
//
// Row-label color swatches (AccSwatch) merged in 2026-07-03 from
// acc-colors.jsx (design_handoff_inventory/accessories_sub_group_mockup.jsx's
// dependency, now archived — see _archive/). Per that mockup's locked visual
// rule #5: the swatch decorates the row label only; checkbox fill stays a
// single neutral confirm color and never echoes the accessory's own color.
//
// Layout redesign (2026-07-05, "Option 2" from the accessory-group-options
// mockup): the old boxed sgw-pillset card (bordered, centered header) took up
// too much room and broke the row-to-row flow of the plain checklist. Groups
// now render as a left-aligned micro-label followed by full-width option rows,
// same rhythm as a solo AccItem row, no card. orderedBlueprint() replaces the
// old bucket-then-concatenate rendering (all solo rows, then all groups, then
// all context rows) — the owner keys the DB head-to-toe (helmet, backpack,
// weapons, skis/fins…) and expects that order on screen, so groups/context
// buckets are now emitted at the position of their first blueprint row
// instead of being pulled to the end.
//
// 2026-07-06: matched slots (e.g. Duke's helmet + gun colorway) used to be
// merged into one combined block, anchored to whichever slot's group_id came
// first — but matched slots are often spread across the body (helmet vs.
// gun), so merging them fought the head-to-toe layout instead of respecting
// it. Each group_id — matched or not — now renders independently at its own
// blueprint position; a matched slot's options just carry a tag badge
// (A/B/…) so the owner can still tell which pieces pair up across slots.
//
// 2026-07-06 (2): wrapping option "pills" sized to their own text, so their
// checkboxes landed at a different x per option instead of lining up with
// every other row's checkbox column. Options are no longer a bespoke pill —
// each renders through the same per-row renderer (renderOption) the caller
// already uses for solo items (AccItem in app-detail.jsx, .af-acc__row in
// app-add-figure.jsx), so the checkbox sits in the exact same right-hand
// column as everywhere else in the list.
//
// 2026-07-07: a group_id slot can itself be non-retail (Zartan's single-/
// double-sided heat stickers are both 'bonus', tied by match_key — see
// ACCESSORY_GROUPS.md). Context buckets used to flatten every member to a solo row
// regardless of group_id, which hid the "pick one" relationship. ContextGroup
// now sub-clusters its items by group_id (clusterUnits) and nests a
// VariantGroup — tag badge and all — for any grouped slot, same as a retail
// group; only ungrouped context items still render as flat rows. This is
// display-only: store.js already filters non-retail out before it ever builds
// match_key buckets, so this cannot change what counts toward Complete.
import React from 'react';
import { JoeData } from './store.js';

const CTX_LABEL = { convention: 'Convention', mail_in: 'Mail-in', bonus: 'Bonus', exclusive: 'Exclusive' };

// Blueprint tuples: [name, quantity_required, accessory_id, group_id, release_context, match_key, color]
// renderOption(item): caller-supplied single-row renderer for one option —
// same idea as ContextGroup's renderRow, so the row matches whichever screen
// it's used from and lines up with that screen's own checkbox column.
export function VariantGroup({ items, renderOption }) {
  const label = JoeData.groupLabel(items);
  const matched = items.some((it) => it[5] != null);
  return (
    <div className="sgw-group">
      <div className="sgw-label"><span className="sgw-label__name">{label}</span> <em>{matched ? '· match a colorway' : '· pick one'}</em></div>
      {items.map((it) => renderOption(it))}
    </div>
  );
}

// context: 'convention' | 'mail_in' | 'bonus' | 'exclusive'.
// units: this context's items, already sub-clustered by group_id (see
// clusterUnits below) — a group_id slot inside a context (e.g. Zartan's
// single-/double-sided stickers, both 'bonus') renders as its own nested
// VariantGroup with an A/B tag, same as a retail matched set; an ungrouped
// context item still renders via renderRow.
// renderRow(item): caller-supplied single-row renderer, so the row matches
// whichever screen it's used from (app-detail.jsx's AccItem vs. app-add-figure.jsx's row).
export function ContextGroup({ context, units, renderRow, renderOption }) {
  return (
    <div className="sgw-group">
      <div className="sgw-label sgw-label--cap">{CTX_LABEL[context] || context}</div>
      {units.map((u, i) => u.type === 'group'
        ? <VariantGroup key={'cg' + i} items={u.items} renderOption={renderOption} />
        : renderRow(u.item))}
    </div>
  );
}

// Sub-clusters a flat item list by group_id, in first-appearance order —
// same rule as orderedBlueprint's own pass, just scoped to one bucket
// (a single release_context's items) instead of the whole blueprint.
function clusterUnits(items) {
  const groupMembers = new Map();
  items.forEach((a) => { if (a[3] != null) { if (!groupMembers.has(a[3])) groupMembers.set(a[3], []); groupMembers.get(a[3]).push(a); } });
  const units = [];
  const seenGroups = new Set();
  items.forEach((a) => {
    if (a[3] != null) {
      if (seenGroups.has(a[3])) return;
      seenGroups.add(a[3]);
      units.push({ type: 'group', items: groupMembers.get(a[3]) });
      return;
    }
    units.push({ type: 'solo', item: a });
  });
  return units;
}

// Walks a blueprint in its authored (head-to-toe) order and buckets each item
// only at the position where its kind first appears — a group_id's members,
// or a release_context's items, are each emitted once, as a unit, then
// skipped on later occurrences. This is what keeps e.g. "Helmet, Backpack,
// Gun, Binocular" in DB order instead of the old solo-then-groups-then-context
// concatenation, and what keeps a matched colorway's slots (Helmet, Gun) each
// at their own position instead of merged into one combined block.
export function orderedBlueprint(bp) {
  const list = bp || [];
  const groupMembers = new Map();   // group_id -> retail members
  const contextMembers = new Map(); // release_context -> non-retail members
  list.forEach((a) => {
    const ctx = a[4] && a[4] !== 'retail' ? a[4] : null;
    if (ctx) { if (!contextMembers.has(ctx)) contextMembers.set(ctx, []); contextMembers.get(ctx).push(a); return; }
    if (a[3] != null) { if (!groupMembers.has(a[3])) groupMembers.set(a[3], []); groupMembers.get(a[3]).push(a); }
  });

  const order = [];
  const seenGroups = new Set();
  const seenContexts = new Set();
  list.forEach((a) => {
    const ctx = a[4] && a[4] !== 'retail' ? a[4] : null;
    if (ctx) {
      if (seenContexts.has(ctx)) return;
      seenContexts.add(ctx);
      order.push({ type: 'context', context: ctx, units: clusterUnits(contextMembers.get(ctx)) });
      return;
    }
    if (a[3] != null) {
      if (seenGroups.has(a[3])) return;
      seenGroups.add(a[3]);
      order.push({ type: 'group', items: groupMembers.get(a[3]) });
      return;
    }
    order.push({ type: 'solo', item: a });
  });
  return order;
}

// Renders an orderedBlueprint() list end to end.
// renderSolo(item, key): draws one solo/context row using the item's full
// name (e.g. "American Flag (decal)").
// renderOption(item): draws one variant-slot option using its short label
// (e.g. "no holes", via JoeData.optLabel) — its own shape (AccItem vs. the
// Add Figure step's .af-acc__row) is the caller's call, same as
// ContextGroup's renderRow always was.
export function AccessoryList({ ordered, renderSolo, renderOption }) {
  return ordered.map((u, i) => {
    if (u.type === 'solo') return renderSolo(u.item, i);
    if (u.type === 'group') return <VariantGroup key={'g' + i} items={u.items} renderOption={renderOption} />;
    if (u.type === 'context') return <ContextGroup key={'c' + i} context={u.context} units={u.units} renderOption={renderOption}
                                                    renderRow={(a) => renderSolo(a, u.context + '-' + a[0])} />;
    return null;
  });
}
