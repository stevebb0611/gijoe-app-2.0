// accessory-groups.jsx — shared "own any one" variant-slot box and non-retail
// context box, ported verbatim from the locked reference subgroup-wire-v2.jsx
// (GI Joe Tracker - Accessory Sub-Groups v2.html → GroupCard). Two mechanisms
// restructure a figure's flat blueprint list (see PARTS_BIN.md "Accessory
// completeness model"):
//   group_id        — interchangeable variants; box with "or" between options,
//                      owning any one satisfies the slot (store.js math)
//   release_context — non-retail items; boxed by context, tracked but never
//                      gates Complete (store.js math already excludes them)
import React from 'react';
import { JoeData } from './store.js';

const CTX_LABEL = { convention: 'Convention', mail_in: 'Mail-in', bonus: 'Bonus', exclusive: 'Exclusive' };

// Blueprint tuples: [name, quantity_required, accessory_id, group_id, release_context]
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
                <span className="sgw-opt__box">{on ? "✓" : ""}</span>{JoeData.optLabel(name)}
              </button>
            </React.Fragment>
          );
        })}
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
