// shared/completeness.js — accessory completeness math, shared by the browser
// client (web/src/store.js) and the server (server/export-xlsx.mjs). Pure
// functions over plain arrays/objects only — no DOM/XHR/Node dependencies — so
// the same file imports cleanly from both a Vite bundle and a Node ESM module.
//
// Blueprint items are [name, quantity_required, accessory_id, group_id, release_context, match_key, color, variantLetter].
// Three axes restructure the flat list (see PARTS_BIN.md "Accessory completeness model" + ACCESSORY_GROUPS.md):
//   group_id    — interchangeable variants ("own any one" satisfies the slot)
//   match_key   — when 2+ group_id slots have members sharing a match_key, those
//                 slots must resolve to the SAME key together (e.g. Firefly's
//                 light-green gun only counts alongside the light-green radio)
//   release_context — only 'retail' counts toward completion; convention/mail_in/
//                      bonus items are tracked but never block Complete
// variantLetter (index 7) is a fourth, orthogonal axis: when set, the row only
// applies to instances pinned to that production variant (e.g. Blocker's Visor
// is 'B'-only — see ACCESSORY_GROUPS.md "variant_id"). Unlike the three axes
// above, this isn't handled inside clusterBlueprint() — it's instance-specific,
// so callers filter with bpForVariant() BEFORE handing bp to any function below.
// Scope a figure's full blueprint down to the rows that apply to one instance's
// production variant — rows with no variantLetter apply everywhere. Call this
// before bpReq/instOwn/instPct/instWhole/missingList/clusterBlueprint/orderedBlueprint
// whenever bp is being used for a specific owned (or about-to-be-added) copy.
export function bpForVariant(bp, variantLetter) {
  return (bp || []).filter((a) => !a[7] || a[7] === variantLetter);
}
export function clusterBlueprint(bp) {
  const retail = (bp || []).filter((a) => !a[4] || a[4] === 'retail');
  const groupMap = new Map(); // group_id -> items[]
  const solo = [];
  for (const a of retail) {
    if (a[3] != null) {
      if (!groupMap.has(a[3])) groupMap.set(a[3], []);
      groupMap.get(a[3]).push(a);
    } else solo.push(a);
  }
  const groups = [...groupMap.values()];
  const matched = groups.filter((members) => members.some((m) => m[5] != null));
  const plain = groups.filter((members) => !members.some((m) => m[5] != null));
  return { solo, groups, matched, plain };
}
// Is there one match_key value K such that every matched slot's K-tagged member is owned?
export function matchedSetSatisfied(matched, acc) {
  if (matched.length === 0) return true;
  const keys = new Set();
  matched.forEach((members) => members.forEach((m) => { if (m[5] != null) keys.add(m[5]); }));
  for (const k of keys) {
    if (matched.every((members) => members.some((m) => m[5] === k && (acc[m[0]] || 0) > 0))) return true;
  }
  return false;
}
export function bpReq(bp) {
  const { solo, plain, matched } = clusterBlueprint(bp);
  return solo.reduce((s, a) => s + a[1], 0) + plain.length + (matched.length > 0 ? 1 : 0);
}
export function instOwn(bp, acc) {
  const { solo, plain, matched } = clusterBlueprint(bp);
  const soloOwn = solo.reduce((s, [n, q]) => s + Math.min(acc[n] || 0, q), 0);
  const plainOwn = plain.reduce((s, members) => s + (members.some(([n]) => (acc[n] || 0) > 0) ? 1 : 0), 0);
  return soloOwn + plainOwn + (matched.length > 0 && matchedSetSatisfied(matched, acc) ? 1 : 0);
}
export function instPct(bp, acc) { const r = bpReq(bp); return r ? Math.round(instOwn(bp, acc) / r * 100) : 100; }
export function instWhole(bp, acc) {
  const { solo, plain, matched } = clusterBlueprint(bp);
  return solo.every(([n, q]) => (acc[n] || 0) >= q)
    && plain.every((members) => members.some(([n]) => (acc[n] || 0) > 0))
    && matchedSetSatisfied(matched, acc);
}
// Shared label rule (matches the locked reference subgroup-wire-v2.jsx):
// text before the first "(" is the slot label, text inside "(...)" is the option label.
// disambiguateNames (blueprint-names.js) can append a second "(color)" paren on
// top of an existing one (e.g. "Helmet (with holes)" -> "Helmet (with holes)
// (bright green)") — join every paren so two options never collapse onto the
// same displayed label.
export function groupLabel(items) { const m = items[0][0].match(/^(.*?)\s*\(/); return m ? m[1].trim() : items[0][0]; }
export function optLabel(name) {
  const parts = [...name.matchAll(/\(([^)]+)\)/g)].map((m) => m[1]);
  return parts.length ? parts.join(' · ') : name;
}
// Damaged share across the FULL blueprint (retail + group + non-retail alike) —
// condition is orthogonal to what counts toward Complete, so it isn't run
// through clusterBlueprint. 0 when nothing's owned yet.
export function accDamagePct(bp, acc, accDamage) {
  let owned = 0, damaged = 0;
  (bp || []).forEach(([n]) => { owned += acc[n] || 0; damaged += (accDamage && accDamage[n]) || 0; });
  return owned ? damaged / owned : 0;
}
export function missingList(bp, acc) {
  const { solo, plain, matched } = clusterBlueprint(bp);
  const soloMissing = solo.filter(([n, q]) => (acc[n] || 0) < q).map(([n, q]) => q > 1 ? `${n} ${acc[n] || 0}/${q}` : n);
  const plainMissing = plain.filter((members) => !members.some(([n]) => (acc[n] || 0) > 0))
    .map((members) => members.map((m) => optLabel(m[0])).join(' or '));
  const matchedMissing = (matched.length > 0 && !matchedSetSatisfied(matched, acc))
    ? [matched.map((members) => groupLabel(members)).join(' & ') + ' (matching color)']
    : [];
  return [...soloMissing, ...plainMissing, ...matchedMissing];
}
