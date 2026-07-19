#!/usr/bin/env node
// server/split-release-edition.mjs — reusable, idempotent tool for splitting a
// mainline/700-block CSV collision into two real catalog rows: the retail
// edition stays on its existing figure_id, the convention/mail-in edition
// becomes its own `figures` row with its own accessory blueprint. Generalizes
// server/split-quick-kick-convention.mjs (kept as-is; this is the same
// pattern for future confirmed splits, so they don't each need a bespoke
// one-off file).
//
// Per VARIANTS.md §7.5.1: same character + same production version,
// re-released through a different channel with different gear = a separate
// catalog row, full stop. No schema change, no blueprint-override table.
//
// IMPORTANT — do not add an entry here from CSV data alone. The seed
// collision (seed.mjs, "Flint|1|"-style key) affects ~20 code names
// (OPEN_QUESTIONS_Claude.md #18), and several of those pairs are accidental
// CSV duplicates, not real second editions (both rows already tagged
// "convention" with near-identical data). Only add a SPLITS entry once a
// human has confirmed, against a real reference or a physically-owned copy,
// that the two releases are genuinely distinct.
import db from './db.js';

const SPLITS = [
  {
    // Flint v1 — 1985 retail (F125) vs. 1992 Convention (F701).
    // Owner-confirmed: two real releases, physically owned, different gear.
    retailFigureId: 'F125',
    newFigureId: 'F701',
    codeName: 'Flint',
    // F125's release_context was mislabeled "1992 Convention" in the source
    // CSV despite being the real 1985 retail release (series_id 5) —
    // OPEN_QUESTIONS_Claude.md #18. Correct it as part of the split.
    retailReleaseContext: 'retail',
    newDisplayName: 'Flint (convention)',
    newFullName: 'Faireborn, Dashiell R.',
    newSpecialty: 'Infantry',
    newFactionId: 1,
    newSeriesId: 15,
    newReleaseContext: 'convention',
    newNotes: 'Convention',
    // Accessory codes to end up on the NEW row's blueprint. Any of these
    // codes currently sitting on the RETAIL figure's blueprint are moved
    // (DELETE + INSERT), not duplicated. A0680/A0681 are explicitly NOT
    // listed here — they're leftover from F701 colliding into F125 on a
    // past reseed and resolve to Ambush's gear (see host_figure on
    // gijoe_db_accessories.csv), not Flint's. They're removed from F125's
    // blueprint unconditionally by this script, whether or not they appear
    // in this list.
    removeFromRetail: ['A0680', 'A0681'],
    // Owner-confirmed, from the physically-owned copy: a shared rifle (also
    // used by Bullhorn, Cross-Country, Roadblock v4/v5, Shipwreck v2, and
    // Falcon's own 1992 Convention release) and a shared flare gun (also
    // used by Stretcher, and again Falcon's convention release).
    accessories: [
      { code: 'A0692', qty: 1 }, // Rifle — shared w/ Bullhorn
      { code: 'A0807', qty: 1 }, // Flare Gun — shared w/ Stretcher
    ],
  },
];

function run() {
  for (const split of SPLITS) {
    const retail = db.prepare('SELECT id, figure_id, code_name FROM figures WHERE figure_id = ?').get(split.retailFigureId);
    if (!retail) { console.error(`✕ ${split.retailFigureId} (${split.codeName} retail) not found — skipping.`); continue; }

    const already = db.prepare('SELECT id FROM figures WHERE figure_id = ?').get(split.newFigureId);
    if (already) { console.log(`✓ ${split.newFigureId} (${split.codeName} ${split.newReleaseContext}) already exists — nothing to do.`); continue; }

    if (!split.accessories.length && !split.removeFromRetail?.length) {
      console.warn(`⚠ ${split.codeName}: no accessories configured — skipping until the real list is filled in.`);
      continue;
    }

    const txn = db.transaction(() => {
      if (split.retailReleaseContext) {
        db.prepare('UPDATE figures SET release_context = ? WHERE id = ?').run(split.retailReleaseContext, retail.id);
      }

      const getAccByCode = db.prepare('SELECT id FROM accessories WHERE accessory_code = ?');
      const deleteFromRetail = db.prepare('DELETE FROM figure_accessories WHERE figure_id = ? AND accessory_id = ?');

      // Drop any known-wrong leftovers from the retail blueprint first,
      // regardless of whether they're being re-added to the new row.
      for (const code of split.removeFromRetail || []) {
        const acc = getAccByCode.get(code);
        if (!acc) continue;
        deleteFromRetail.run(retail.id, acc.id);
      }

      if (!split.accessories.length) {
        console.warn(`⚠ ${split.codeName}: cleaned up ${split.removeFromRetail?.length || 0} wrong accessory row(s) on the retail figure, but no new-row accessory list was provided — not creating ${split.newFigureId} yet. Re-run once the list is filled in.`);
        return null;
      }

      const info = db.prepare(`
        INSERT INTO figures (
          figure_id, code_name, version, variant, variant_lookup,
          display_name, full_name, specialty, faction_id, series_id,
          release_context, is_mail_away, notes
        ) VALUES (
          @figure_id, @code_name, NULL, NULL, NULL,
          @display_name, @full_name, @specialty, @faction_id, @series_id,
          @release_context, 0, @notes
        )
      `).run({
        figure_id: split.newFigureId,
        code_name: split.codeName,
        display_name: split.newDisplayName,
        full_name: split.newFullName || null,
        specialty: split.newSpecialty || null,
        faction_id: split.newFactionId || null,
        series_id: split.newSeriesId,
        release_context: split.newReleaseContext,
        notes: split.newNotes || null,
      });
      const newId = info.lastInsertRowid;

      const insertOnNew = db.prepare(
        'INSERT INTO figure_accessories (figure_id, accessory_id, quantity_required, release_context) VALUES (?, ?, ?, ?)'
      );
      for (const { code, qty } of split.accessories) {
        const acc = getAccByCode.get(code);
        if (!acc) throw new Error(`${split.codeName}: accessory ${code} not found.`);
        deleteFromRetail.run(retail.id, acc.id); // no-op if it wasn't there
        insertOnNew.run(newId, acc.id, qty || 1, 'retail'); // 'retail' *within this row's own blueprint* — see split-quick-kick-convention.mjs precedent
      }

      return newId;
    });

    const newId = txn();
    if (newId) {
      console.log(`✓ ${split.codeName} split: ${split.retailFigureId} (retail, id ${retail.id}) stays; ` +
        `created ${split.newFigureId} (id ${newId}, ${split.newReleaseContext}) with ${split.accessories.length} accessories.`);
    }
  }
  console.log('\nRestart the backend (npm start) — it does not hot-reload — for /api/catalog to pick this up.');
}

run();
