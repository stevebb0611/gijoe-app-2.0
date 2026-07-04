// accessory-groups.jsx — shared "own any one" variant-slot box and non-retail
// context box, ported verbatim from the locked reference subgroup-wire-v2.jsx
// (GI Joe Tracker - Accessory Sub-Groups v2.html → GroupCard). Three mechanisms
// restructure a figure's flat blueprint list (see PARTS_BIN.md "Accessory
// completeness model" + match_key.md):
//   group_id        — interchangeable variants; box with "or" between options,
//                      owning any one satisfies the slot (store.js math)
//   match_key       — 2+ group_id slots that must resolve to the same tag
//                      together (MatchedGroup below); one merged box per
//                      bucket instead of one box per slot (2026-07-03, see
//                      match_key.md "Considered, not applicable" for the
//                      Blowtorch case this does NOT apply to)
//   release_context — non-retail items; boxed by context, tracked but never
//                      gates Complete (store.js math already excludes them)
//
// Row-label color swatches (AccSwatch) merged in 2026-07-03 from
// acc-colors.jsx (design_handoff_inventory/accessories_sub_group_mockup.jsx's
// dependency, now archived — see _archive/). Per that mockup's locked visual
// rule #5: the swatch decorates the row label only; checkbox fill stays a
// single neutral confirm color and never echoes the accessory's own color.
import React from 'react';
import { JoeData } from './store.js';
import { AccSwatch } from './acc-colors.jsx';

const CTX_LABEL = { convention: 'Convention', mail_in: 'Mail-in', bonus: 'Bonus', exclusive: 'Exclusive' };

// Blueprint tuples: [name, quantity_required, accessory_id, group_id, release_context, match_key, color]
export function VariantGroup({ items, acc, onSet, live }) {
  const label = JoeData.groupLabel(items);
  return (
    <div className="sgw-pillset">
      <div className="sgw-vhead"><span className="sgw-vhead__lbl">{label}</span></div>
      <div className="sgw-voptrow">
        {items.map((it, i) => {
          const name = it[0];
          const on = (acc[name] || 0) > 0;
          return (
            <React.Fragment key={name}>
              {i > 0 && <span className="sgw-or">or</span>}
              <button type="button" className={"sgw-opt" + (on ? " is-on" : "")} disabled={!live}
                      onClick={live ? () => onSet(name, on ? 0 : 1) : undefined}>
                <span className="sgw-opt__box">{on ? "✓" : ""}</span>
                <AccSwatch color={it[6]} />{JoeData.optLabel(name)}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// One box for an entire match_key bucket (see match_key.md), instead of one
// box per group_id slot — the slots aren't independent choices, they're one
// "own a matching colorway" requirement, so they shouldn't cost a header+
// border each. Rows are grouped by match_key tag (the owner-chosen short
// code, e.g. "A"/"B") with the slot name folded into each row instead of
// repeated as a big centered header.
// groups: array of group_id member-arrays that all carry a match_key (JoeData.clusterBlueprint's `matched`).
// Row-level slot tag is just the last word of the full slot name (the header
// above already spells the whole thing out) — keeps rows on one line even
// when a slot name is as long as `M-32 "Pulverizer" Submachine Gun`.
function shortSlot(slot) { const w = slot.trim().split(/\s+/); return w[w.length - 1]; }
export function MatchedGroup({ groups, acc, onSet, live }) {
  const label = groups.map((g) => shortSlot(JoeData.groupLabel(g))).join(' + ');
  const tagOrder = [];
  const byTag = new Map();
  groups.forEach((g) => {
    const slot = shortSlot(JoeData.groupLabel(g));
    g.forEach((m) => {
      const tag = m[5];
      if (tag == null) return;
      if (!byTag.has(tag)) { byTag.set(tag, []); tagOrder.push(tag); }
      byTag.get(tag).push({ slot, member: m });
    });
  });
  return (
    <div className="sgw-pillset sgw-matched">
      <div className="sgw-vhead"><span className="sgw-vhead__lbl">{label}</span></div>
      <div className="sgw-mbody">
        {tagOrder.map((tag) => (
          <div className="sgw-mset" key={tag}>
            <span className="sgw-mtag">{tag}</span>
            <div className="sgw-mopts">
              {byTag.get(tag).map(({ slot, member }) => {
                const name = member[0];
                const on = (acc[name] || 0) > 0;
                return (
                  <button type="button" key={name} className={"sgw-mopt" + (on ? " is-on" : "")} disabled={!live}
                          onClick={live ? () => onSet(name, on ? 0 : 1) : undefined}>
                    <span className="sgw-opt__box">{on ? "✓" : ""}</span>
                    <AccSwatch color={member[6]} />
                    <span className="sgw-mopt__slot">{slot}</span>{JoeData.optLabel(name)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// context: 'convention' | 'mail_in' | 'bonus' | 'exclusive'.
// renderRow(item): caller-supplied single-row renderer, so the box matches
// whichever screen it's used from (app-detail.jsx's AccItem vs. app-add-figure.jsx's row).
export function ContextGroup({ context, items, renderRow }) {
  return (
    <div className="sgw-pillset">
      <div className="sgw-vhead"><span className="sgw-vhead__lbl">{CTX_LABEL[context] || context}</span></div>
      {items.map((it) => renderRow(it))}
    </div>
  );
}

// Buckets non-retail blueprint items by release_context, first-seen order.
export function clusterContexts(bp) {
  const extras = (bp || []).filter((a) => a[4] && a[4] !== 'retail');
  const order = [], byCtx = new Map();
  for (const a of extras) {
    if (!byCtx.has(a[4])) { byCtx.set(a[4], []); order.push(a[4]); }
    byCtx.get(a[4]).push(a);
  }
  return order.map((context) => ({ context, items: byCtx.get(context) }));
}
