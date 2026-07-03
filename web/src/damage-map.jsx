// damage-map.jsx — SHARED condition-diagram module (zone-cell edition).
// The figure is real o-ring line-art (male/female · front/rear). Damage is marked
// per NAMED ZONE over a 24-col body-cell grid, in two tabs:
//   • CONDITION — structural: cracked / damaged / broken
//   • PAINT     — wear:       mild / medium / heavy
// Both tabs share the same colours (yellow / orange / red) and feed separate grades
// (Physical from Condition, Paint from Paint). Caution-stripe fills with a black
// zone-perimeter outline. Zone presets + masks ship in assets/figure-{masks,zones}.js.
//
// Public API (all on window):
//   DamageMap({ value, onChange, genderLocked })   self-contained map UI
//   dmEmpty(gender)                                 -> blank value object
//   physicalGrade(value) / paintGrade(value)        -> { grade, score, capped, cap }
//   GradeBadge({ kind, result })                    unchanged badge
//   DM_GRADES, DM_GRADE_COLOR, DM_SEV, DM_SEV_ORDER  constants (compat)
// value shape:
//   { gender:'male'|'female',
//     condition:{ front:{ [zoneId]:1|2|3 }, rear:{…} },
//     paint:    { front:{ [zoneId]:1|2|3 }, rear:{…} } }
import React from 'react';
import { FIG_MASKS } from './assets/figure-masks.js';
import { FIG_ZONES } from './assets/figure-zones.js';

const DM_GRADES = ['Poor', 'Fair', 'Good', 'Excellent', 'Mint'];
const DM_GRADE_COLOR = { Mint: '#5d7d4d', Excellent: '#7d8a4a', Good: '#b88a2f', Fair: '#c0612f', Poor: '#8f2f24' };

// three severities, shared colours; label set depends on the tab.
const DM_SEV = {
  1: { w: 1, c: '#d4a73a', condition: 'Cracked', paint: 'Mild' },
  2: { w: 3, c: '#c0612f', condition: 'Damaged', paint: 'Medium' },
  3: { w: 6, c: '#9a2f24', condition: 'Broken',  paint: 'Heavy' },
};
const DM_SEV_ORDER = [1, 2, 3];
const DM_TABS = {
  condition: { label: 'Condition', cap: true,  sevLabel: (l) => DM_SEV[l].condition },
  paint:     { label: 'Paint',     cap: false, sevLabel: (l) => DM_SEV[l].paint },
};

const DM_VIEWS = ['front', 'rear'];
const dmKey = (gender, view) => gender + '-' + view;
const DM_FIG = FIG_MASKS || {};
const DM_ZONES = FIG_ZONES || {};

// ---------- markup layer: dilate body mask +2 cells so zones reach past the outline ----------
const _dmMaskCache = {};
function dmActiveMask(key) {
  if (_dmMaskCache[key]) return _dmMaskCache[key];
  const f = DM_FIG[key];
  if (!f) return null;
  const { rows, cols, mask } = f;
  let cur = mask.map(row => row.split('').map(ch => ch === '1' ? 1 : 0));
  for (let pass = 0; pass < 2; pass++) {
    const nxt = cur.map(row => row.slice());
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (cur[r][c]) continue;
      let near = false;
      for (let dr = -1; dr <= 1 && !near; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        if (cur[rr][cc]) { near = true; break; }
      }
      if (near) nxt[r][c] = 1;
    }
    cur = nxt;
  }
  _dmMaskCache[key] = cur;
  return cur;
}

// cell -> zoneId, and zoneId -> cell count, per gender (cached)
const _dmZoneOf = {}, _dmZoneSize = {};
function dmZoneOf(gender) {
  if (_dmZoneOf[gender]) return _dmZoneOf[gender];
  const m = {}, sz = {};
  (DM_ZONES[gender] || []).forEach(z => { sz[z.id] = z.cells.length; z.cells.forEach(c => { m[c] = z.id; }); });
  _dmZoneOf[gender] = m; _dmZoneSize[gender] = sz;
  return m;
}
function dmZoneSize(gender) { dmZoneOf(gender); return _dmZoneSize[gender] || {}; }
const dmZoneLabel = (gender, zid) => {
  const z = (DM_ZONES[gender] || []).find(z => z.id === zid);
  return z ? z.label : zid;
};

// ---------- grade engine ----------
function dmWorseOf(a, b) { return DM_GRADES.indexOf(a) <= DM_GRADES.indexOf(b) ? a : b; }
function dmFromScore(s) {
  if (s <= 0) return 'Mint';
  if (s < 3) return 'Excellent';
  if (s < 8) return 'Good';
  if (s < 16) return 'Fair';
  return 'Poor';
}
// marks = { front:{zoneId:lvl}, rear:{…} }
function dmZoneGrade(marks, useCap) {
  let score = 0, cap = 'Mint', counts = [0, 0, 0, 0], zones = 0;
  DM_VIEWS.forEach(v => {
    const mv = (marks && marks[v]) || {};
    Object.values(mv).forEach(lvl => {
      const s = DM_SEV[lvl]; if (!s) return;
      score += s.w; counts[lvl]++; zones++;
      if (useCap && lvl === 3) cap = dmWorseOf(cap, 'Fair');
    });
  });
  const base = dmFromScore(score);
  const grade = useCap ? dmWorseOf(base, cap) : base;
  return { grade, score: Math.round(score * 10) / 10, counts, zones,
           capped: useCap && cap !== 'Mint' && DM_GRADES.indexOf(cap) < DM_GRADES.indexOf(base), cap };
}
function physicalGrade(value) { return dmZoneGrade(value && value.condition, true); }
function paintGrade(value) { return dmZoneGrade(value && value.paint, false); }

const dmEmpty = (gender) => ({ gender: gender || 'male', condition: { front: {}, rear: {} }, paint: { front: {}, rear: {} }, clean: false });

// ---------- one-time CSS inject ----------
function dmInjectCss() {
  if (typeof document === 'undefined' || document.getElementById('dmx-styles')) return;
  const css = `
  .dmx { --dmx-c1:#d4a73a; --dmx-c2:#c0612f; --dmx-c3:#9a2f24; display:flex; flex-direction:column; gap:10px; }
  .dmx__bar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .dmx__bar .dmx__sp { flex:1; }
  .dmx__seg { display:inline-flex; border:1.5px solid var(--ink); }
  .dmx__seg button { font-family:var(--font-display,sans-serif); font-weight:600; font-size:11px; letter-spacing:.4px; padding:5px 11px; background:var(--paper); color:var(--ink-soft); border:none; cursor:pointer; min-height:30px; }
  .dmx__seg button.on { background:var(--ink); color:var(--paper); }
  .dmx__seg button + button { border-left:1.5px solid var(--ink); }
  .dmx__stage { position:relative; width:100%; background:var(--card-2,#efe9dc); border:1.5px solid var(--ink); }
  .dmx__inner { position:relative; width:100%; }
  .dmx__inner img { position:relative; display:block; width:100%; height:auto; pointer-events:none; z-index:2; user-select:none; -webkit-user-drag:none; }
  .dmx__cells { position:absolute; inset:0; z-index:1; display:grid; touch-action:manipulation; }
  .dmx__cell { position:relative; }
  .dmx__cell.on { box-shadow:inset 0 0 0 .5px rgba(33,31,26,.10); cursor:pointer; }
  .dmx__cell.on.halo { box-shadow:inset 0 0 0 .5px rgba(33,31,26,.05); }
  .dmx__cell.on:hover { box-shadow:inset 0 0 0 1px var(--ink); }
  .dmx__cell.on::after { content:""; position:absolute; inset:0; }
  .dmx__cell.f1::after { background:repeating-linear-gradient(45deg, var(--dmx-c1) 0 5px, rgba(0,0,0,0) 5px 10px); background-attachment:fixed; }
  .dmx__cell.f2::after { background:repeating-linear-gradient(45deg, var(--dmx-c2) 0 5px, rgba(0,0,0,0) 5px 10px); background-attachment:fixed; }
  .dmx__cell.f3::after { background:repeating-linear-gradient(45deg, var(--dmx-c3) 0 5px, rgba(0,0,0,0) 5px 10px); background-attachment:fixed; }
  .dmx__legend { display:flex; align-items:center; gap:13px; flex-wrap:wrap; font-size:10px; color:var(--ink-soft); }
  .dmx__legend b { font-family:var(--font-display,sans-serif); font-weight:600; letter-spacing:.4px; font-size:10px; color:var(--ink-soft); }
  .dmx__legend span { display:inline-flex; align-items:center; gap:5px; }
  .dmx__legend i { width:13px; height:13px; border:1.5px solid var(--ink); display:inline-block; }
  .dmx__legend i.f1 { background:var(--dmx-c1); } .dmx__legend i.f2 { background:var(--dmx-c2); } .dmx__legend i.f3 { background:var(--dmx-c3); }
  .dmx__legend em { font-style:normal; margin-left:auto; }
  `;
  const el = document.createElement('style');
  el.id = 'dmx-styles';
  el.textContent = css;
  document.head.appendChild(el);
}

// ---------- the damage map ----------
function DamageMap({ value, onChange, genderLocked }) {
  const { useState, useEffect } = React;
  useEffect(() => { dmInjectCss(); }, []);

  const val = value || dmEmpty('male');
  const gender = val.gender || 'male';
  const [tab, setTab] = useState('condition');
  const [view, setView] = useState('front');

  const f = DM_FIG[dmKey(gender, view)];
  const dm = dmActiveMask(dmKey(gender, view));
  const zoneOf = dmZoneOf(gender);
  const marks = (val[tab] && val[tab][view]) || {};

  const setGender = (g) => onChange({ ...val, gender: g });
  const cycleZone = (zid) => {
    const cur = marks[zid] || 0;
    const next = (cur + 1) % 4;
    const nextView = { ...marks };
    if (next) nextView[zid] = next; else delete nextView[zid];
    onChange({ ...val, [tab]: { ...val[tab], [view]: nextView } });
  };

  const sevAt = (r, c) => { const zid = zoneOf[r + '-' + c]; return zid ? (marks[zid] || 0) : 0; };

  const cells = [];
  if (f && dm) {
    for (let r = 0; r < f.rows; r++) {
      for (let c = 0; c < f.cols; c++) {
        const active = !!dm[r][c];
        const body = f.mask[r][c] === '1';
        const cell = r + '-' + c;
        const zid = active ? zoneOf[cell] : undefined;
        const lvl = zid ? (marks[zid] || 0) : 0;
        let cls = 'dmx__cell' + (active ? ' on' : '') + (active && !body ? ' halo' : '') + (lvl ? ' f' + lvl : '');
        let style;
        if (lvl) {
          const bd = '1.5px solid #18160f';
          style = {};
          if (sevAt(r - 1, c) !== lvl) style.borderTop = bd;
          if (sevAt(r + 1, c) !== lvl) style.borderBottom = bd;
          if (sevAt(r, c - 1) !== lvl) style.borderLeft = bd;
          if (sevAt(r, c + 1) !== lvl) style.borderRight = bd;
        }
        cells.push(React.createElement('div', {
          key: cell, className: cls, style,
          onPointerDown: (active && zid) ? () => cycleZone(zid) : undefined,
        }));
      }
    }
  }

  const tabDef = DM_TABS[tab];
  const e = React.createElement;
  return e('div', { className: 'dmx' },
    e('div', { className: 'dmx__bar' },
      e('div', { className: 'dmx__seg' },
        Object.keys(DM_TABS).map(k => e('button', { key: k, className: tab === k ? 'on' : '', onClick: () => setTab(k) }, DM_TABS[k].label))),
      e('div', { className: 'dmx__sp' }),
      e('div', { className: 'dmx__seg' },
        DM_VIEWS.map(v => e('button', { key: v, className: view === v ? 'on' : '', onClick: () => setView(v) }, v === 'front' ? 'Front' : 'Rear'))),
      !genderLocked && e('div', { className: 'dmx__seg' },
        ['male', 'female'].map(g => e('button', { key: g, className: gender === g ? 'on' : '', onClick: () => setGender(g) }, g === 'male' ? 'Male' : 'Female')))
    ),
    e('div', { className: 'dmx__stage' },
      f ? e('div', { className: 'dmx__inner', style: { aspectRatio: f.w + ' / ' + f.h } },
        e('div', { className: 'dmx__cells', style: { gridTemplateColumns: 'repeat(' + f.cols + ',1fr)', gridTemplateRows: 'repeat(' + f.rows + ',1fr)' } }, cells),
        e('img', { src: 'assets/fig/' + dmKey(gender, view) + '.png', alt: gender + ' ' + view })
      ) : e('div', { style: { padding: 18 } }, 'figure art unavailable')
    ),
    e('div', { className: 'dmx__legend' },
      e('b', null, tabDef.label.toUpperCase()),
      DM_SEV_ORDER.map(l => e('span', { key: l }, e('i', { className: 'f' + l }), tabDef.sevLabel(l))),
      e('em', null, 'click a zone · cycles severity')
    )
  );
}

// ---------- grade badge (unchanged) ----------
function GradeBadge({ kind, result }) {
  const e = React.createElement;
  return e('div', { className: 'grade' },
    e('div', { className: 'grade__kind' }, kind),
    e('div', { className: 'grade__val', style: { background: DM_GRADE_COLOR[result.grade] } }, result.grade),
    e('div', { className: 'grade__score' }, 'demerit ' + result.score + (result.capped ? ' · capped @ ' + result.cap : ''))
  );
}

// compat stub — the old per-point logger is gone (zones cycle on click)
function DamageLogger() { return null; }

export {
  DM_GRADES, DM_GRADE_COLOR, DM_SEV, DM_SEV_ORDER, DM_TABS,
  dmEmpty, dmZoneLabel, physicalGrade, paintGrade,
  DamageMap, DamageLogger, GradeBadge,
};
