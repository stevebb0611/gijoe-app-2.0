// server/export-xlsx.js — builds the full-catalog Excel export (Tweaks &
// Admin > "Export catalog (.xlsx)"). Pure server-side: reuses buildCatalog()
// and getState() (the same data /api/catalog and /api/state already expose)
// plus the shared completeness math, so there's no second implementation of
// "is this copy complete" to keep in sync with the live app.
//
// Deliberately excludes condition/paint grades and the exact damage map
// (owner-confirmed scope, 2026-07-11) — this is a completeness + notation
// roster, not a condition report.
import ExcelJS from 'exceljs';
import { buildCatalog } from './catalog.js';
import { getState } from './instances.js';
import { instWhole, bpForVariant } from '../shared/completeness.js';

// Excel's own built-in "Good"/"Neutral"/"Bad" conditional-format colors, plus a
// neutral gray for "not owned" / non-retail bonus rows (which aren't bad, just
// not gating completion).
const STYLE = {
  good:    { fill: 'FFC6EFCE', font: 'FF006100' }, // complete
  neutral: { fill: 'FFFFEB9C', font: 'FF9C6500' }, // owned, incomplete
  bad:     { fill: 'FFFFC7CE', font: 'FF9C0006' }, // missing a required accessory
  gray:    { fill: 'FFF2F2F2', font: 'FF808080' }, // unowned / non-retail, tracked only
};

function styleRow(row, key) {
  const s = STYLE[key];
  if (!s) return;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.fill } };
    cell.font = { color: { argb: s.font } };
  });
}

function setupSheet(ws, columns) {
  ws.columns = columns;
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
}

function figureLabel(fig) {
  return fig.ver ? `${fig.name} v${fig.ver}` : fig.name;
}

// Visibility only — no completeness/grading logic. Production variants
// (variant_lookup letters, e.g. Firefly's A "Black eyes" / B "Brown eyes")
// are deliberately kept independent of accessory completeness (VARIANTS.md
// §7.5); this just surfaces which letters exist and which are owned.
function knownVariantLetters(fig) {
  return (fig.variants || []).map((v) => v.letter).filter(Boolean);
}
function ownedVariantSummary(insts) {
  const counts = new Map(); // letter -> count
  for (const inst of insts) {
    if (!inst.variant) continue;
    counts.set(inst.variant, (counts.get(inst.variant) || 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, n]) => (n > 1 ? `${letter} ×${n}` : letter))
    .join(', ');
}

function buildFiguresSheet(wb, catalog, instancesByFigure) {
  const ws = wb.addWorksheet('Figures');
  setupSheet(ws, [
    { header: 'Code Name', key: 'name', width: 26 },
    { header: 'Version', key: 'version', width: 9 },
    { header: 'Faction', key: 'faction', width: 12 },
    { header: 'Year', key: 'year', width: 8 },
    { header: 'Specialty', key: 'role', width: 22 },
    { header: 'Vehicle', key: 'vehicle', width: 16 },
    { header: 'Release Context', key: 'context', width: 26 },
    { header: 'Known Variants', key: 'knownVariants', width: 16 },
    { header: 'Owned Variants', key: 'ownedVariants', width: 16 },
    { header: 'Owned Copies', key: 'ownedCopies', width: 13 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Country of Origin', key: 'coo', width: 20 },
    { header: 'Card On File', key: 'card', width: 28 },
    { header: 'Notes', key: 'notes', width: 44 },
  ]);

  for (const fig of catalog) {
    const insts = instancesByFigure.get(fig.id) || [];
    const bp = fig.blueprint || [];
    // Each copy only owes accessories scoped to its own production variant
    // (e.g. Blocker's v1 B-only Visor) — see bpForVariant + ACCESSORY_GROUPS.md
    // "variant_id".
    const wholeCount = insts.filter((inst) => inst.moc || instWhole(bpForVariant(bp, inst.variant), inst.acc || {})).length;
    const status = insts.length === 0 ? 'unowned' : (wholeCount > 0 ? 'complete' : 'incomplete');

    const cooVals = [...new Set(insts.map((i) => i.coo).filter(Boolean))];

    const cardVals = insts.map((inst, idx) => {
      if (!inst.filecard || !inst.filecard.onFile) return null;
      const match = inst.filecard.fileCardId
        ? (fig.fileCards || []).find((fc) => fc.file_card_id === inst.filecard.fileCardId)
        : null;
      const label = insts.length > 1 ? `Copy ${idx + 1}: ` : '';
      return `${label}${match ? match.file_card_code : 'on file, unidentified'}`;
    }).filter(Boolean);

    const noteVals = [];
    if (fig.notes) noteVals.push(fig.notes);
    insts.forEach((inst, idx) => {
      if (inst.notes) noteVals.push(insts.length > 1 ? `Copy ${idx + 1}: ${inst.notes}` : inst.notes);
    });

    let context = fig.releaseContext === 'retail' ? 'Retail' : fig.releaseContext;
    if (fig.mailAway) context += fig.mailInNotes ? ` — ${fig.mailInNotes}` : ' (mail-away)';

    const row = ws.addRow({
      name: fig.name,
      version: fig.ver,
      faction: fig.faction,
      year: fig.year,
      role: fig.role,
      vehicle: fig.vehicle,
      context,
      knownVariants: knownVariantLetters(fig).join(', '),
      ownedVariants: ownedVariantSummary(insts),
      ownedCopies: insts.length,
      status,
      coo: cooVals.join('; '),
      card: cardVals.join('; '),
      notes: noteVals.join('; '),
    });
    styleRow(row, status === 'complete' ? 'good' : status === 'incomplete' ? 'neutral' : 'gray');
  }
}

function buildAccessoriesSheet(wb, catalog, instancesByFigure) {
  const ws = wb.addWorksheet('Accessories');
  setupSheet(ws, [
    { header: 'Figure', key: 'figure', width: 26 },
    { header: 'Copy #', key: 'copy', width: 8 },
    { header: 'Variant', key: 'variant', width: 10 },
    { header: 'Accessory', key: 'accessory', width: 34 },
    { header: 'Slot', key: 'slot', width: 22 },
    { header: 'Match Tag', key: 'matchTag', width: 11 },
    { header: 'Context', key: 'context', width: 14 },
    { header: 'Owned', key: 'owned', width: 9 },
  ]);

  // group_id -> members, per figure, so a Slot label can be derived the same
  // way groupLabel() does (text before the first "(" of the first member).
  for (const fig of catalog) {
    const insts = instancesByFigure.get(fig.id) || [];
    if (insts.length === 0) continue;
    const bp = fig.blueprint || [];
    const groupFirstMember = new Map(); // group_id -> first member name seen
    for (const [name, , , groupId] of bp) {
      if (groupId != null && !groupFirstMember.has(groupId)) groupFirstMember.set(groupId, name);
    }
    const slotLabel = (name) => { const m = name.match(/^(.*?)\s*\(/); return m ? m[1].trim() : name; };

    insts.forEach((inst, idx) => {
      const acc = inst.acc || {};
      // Only list accessories this copy's own production variant actually
      // calls for — see bpForVariant + ACCESSORY_GROUPS.md "variant_id".
      for (const [name, , , groupId, releaseContext, matchKey] of bpForVariant(bp, inst.variant)) {
        const context = releaseContext || 'retail';
        const owned = inst.moc || (acc[name] || 0) > 0;
        const row = ws.addRow({
          figure: figureLabel(fig),
          copy: idx + 1,
          variant: inst.variant || '',
          accessory: name,
          slot: groupId != null ? slotLabel(groupFirstMember.get(groupId)) : '',
          matchTag: matchKey || '',
          context,
          owned: owned ? 'Yes' : 'No',
        });
        if (context !== 'retail') styleRow(row, 'gray');
        else styleRow(row, owned ? 'good' : 'bad');
      }
    });
  }
}

function buildFileCardsSheet(wb, catalog, instancesByFigure) {
  const ws = wb.addWorksheet('File Cards');
  setupSheet(ws, [
    { header: 'Figure', key: 'figure', width: 26 },
    { header: 'File Card Code', key: 'code', width: 16 },
    { header: 'Release Type', key: 'releaseType', width: 16 },
    { header: 'Card Back', key: 'cardBack', width: 12 },
    { header: 'Card Color', key: 'cardColor', width: 12 },
    { header: 'Country', key: 'country', width: 12 },
    { header: 'Original / Reprint', key: 'original', width: 16 },
    { header: 'Notes', key: 'notes', width: 34 },
    { header: 'Confirmed Owned', key: 'confirmed', width: 15 },
  ]);

  for (const fig of catalog) {
    const cards = fig.fileCards || [];
    if (cards.length === 0) continue;
    const insts = instancesByFigure.get(fig.id) || [];
    for (const fc of cards) {
      const confirmed = insts.some((inst) => inst.filecard && inst.filecard.fileCardId === fc.file_card_id);
      const row = ws.addRow({
        figure: figureLabel(fig),
        code: fc.file_card_code,
        releaseType: fc.release_type,
        cardBack: fc.card_back,
        cardColor: fc.card_color,
        country: fc.country,
        original: fc.is_original === 0 ? 'Reprint' : 'Original',
        notes: fc.notes || '',
        confirmed: confirmed ? 'Yes' : '',
      });
      if (confirmed) styleRow(row, 'good');
    }
  }
}

export function buildWorkbook() {
  const catalog = buildCatalog();
  const { instances } = getState();

  const instancesByFigure = new Map();
  for (const inst of instances) {
    if (!instancesByFigure.has(inst.catalogId)) instancesByFigure.set(inst.catalogId, []);
    instancesByFigure.get(inst.catalogId).push(inst);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'G.I. Joe Tracker';
  wb.created = new Date();

  buildFiguresSheet(wb, catalog, instancesByFigure);
  buildAccessoriesSheet(wb, catalog, instancesByFigure);
  buildFileCardsSheet(wb, catalog, instancesByFigure);

  return wb;
}
