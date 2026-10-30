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
  {
    // Roadblock v2 — 1986 retail (F167) vs. 1992 Convention (F707).
    // Previously logged in ACCESSORY_GROUPS.md/OPEN_QUESTIONS_Claude.md #18 as
    // a "likely accidental duplicate" and given the release_context-on-one-row
    // treatment instead (both source CSV rows shared the same "1992
    // Convention" text). Owner instruction, 2026-07-21, reverses that call:
    // the source gijoe_db_figures_accessories.csv already links F167 to only
    // A0264/A0265 and F707 to only A0787/A0793 — a clean, disjoint split, not
    // a leaked-accessory case like Flint's F701 — so this is a genuine second
    // edition after all. F167's own release_context was mislabeled "1992
    // Convention" despite being the real 1986 retail release (series_id 6) —
    // corrected to retail, same bug shape as Flint's F125.
    retailFigureId: 'F167',
    newFigureId: 'F707',
    codeName: 'Roadblock',
    retailReleaseContext: 'retail',
    newDisplayName: 'Roadblock (convention)',
    newFullName: 'Hinton, Marvin F.',
    newSpecialty: 'Infantry Heavy Weapons',
    newFactionId: 1,
    newSeriesId: 15,
    newReleaseContext: 'convention',
    newNotes: 'Convention',
    accessories: [
      { code: 'A0787', qty: 1 }, // Machine Gun — shared w/ S.A.W.-Viper, Snake Eyes (convention)
      { code: 'A0793', qty: 1 }, // Mine Launcher — shared w/ Salvo, Tripwire (convention)
    ],
  },
  {
    // Snow Serpent v1 — 1985 retail (F137) vs. 1992 Convention (F710).
    // Same shape as Roadblock v2 above, same owner instruction (2026-07-21):
    // previously logged as a "likely accidental duplicate" and given the
    // release_context-on-one-row treatment instead, but
    // gijoe_db_figures_accessories.csv already links F137 to only
    // A0206-A0211 and F710 to only A0701/A0702 — a clean, disjoint split, not
    // a leaked-accessory case. F137's release_context was mislabeled "1992
    // Convention" despite being the real 1985 retail release (series_id 5) —
    // corrected to retail, same bug shape as Flint's F125/Roadblock's F167.
    retailFigureId: 'F137',
    newFigureId: 'F710',
    codeName: 'Snow Serpent',
    retailReleaseContext: 'retail',
    newAltName: 'Cobra Snow Viper',
    newDisplayName: 'Snow Serpent (convention)',
    newFullName: 'Classified',
    newSpecialty: 'Arctic Operations',
    newFactionId: 2,
    newSeriesId: 15,
    newReleaseContext: 'convention',
    newNotes: 'Convention',
    accessories: [
      { code: 'A0701', qty: 1 }, // Missile Launcher
      { code: 'A0702', qty: 1 }, // Missile
    ],
  },
  {
    // Stalker v1.5 — 1983 retail (F076) vs. 1992 Convention (F711).
    // Owner-confirmed: two real releases, different gear (Pulverizer alone vs.
    // Handgun + Machine Gun). Unlike Flint/Roadblock/Snow Serpent's clean
    // 2-way collisions, the CSV has a 3-way tie here: F076 (mainline, letter
    // A), F077 (mainline, letter B, same "lighter flat green camo" tell as
    // F711, but its own accessories.csv row only lists A0023 — a dupe/leak of
    // F076's own gear, not real data), and F711 (700-block, letter B, the
    // real convention accessories). seed.mjs's dedup folded all three into
    // one figures row (id 42): F076 as canon, F077 contributing a "B"
    // variant_lookup letter (F711 lost the letter tie-break and was dropped
    // entirely, per the skippedDupeLetters path), and F711's own accessories
    // (A0533/A0534) still leaking onto figure 42 via the shared
    // csvFigureIdToDb collision mapping — same leaked-accessory shape as
    // Flint's F701/F125, just via the "duplicate letter" path instead of the
    // "blank variant" path.
    retailFigureId: 'F076',
    newFigureId: 'F711',
    codeName: 'Stalker',
    newDisplayName: 'Stalker v1.5 (convention)',
    newFullName: 'Wilkinson, Lonzo R.',
    newSpecialty: 'Infantry',
    newFactionId: 1,
    newSeriesId: 15,
    newReleaseContext: 'convention',
    newNotes: 'Convention',
    // Both variants were only ever a retail-vs-convention tell, not a real
    // second production variant of the same release — once split into two
    // rows there's nothing left to bracket. Drop the A/B lettering on the
    // retail row entirely (owner instruction).
    retailDisplayName: 'Stalker v1.5',
    clearRetailVariants: true,
    accessories: [
      { code: 'A0533', qty: 1 }, // Handgun
      { code: 'A0534', qty: 1 }, // Machine Gun (attached)
    ],
  },
  // ---- 2026-10-30 convention sweep (owner: "CONVENTION accessories are
  // different than CONVENTION figures"). Each retail row below had its 1992
  // Convention gear folded in by the seed collision with its 700-block row;
  // the source CSV's 700-block links (gijoe_db_figures_accessories.csv) name
  // exactly that gear. None of the owner's copies had convention gear checked
  // off, so every owned copy stays on the retail row. newConventionKind
  // 'accessories' = a retail figure re-released at a convention with different
  // gear (quiet CONV. ACCESSORIES badge, migration 018).
  {
    // Gung-Ho v2 (Dress Blues) — 1987 retail (F203): Non-Com Dress Sabre +
    // Rank and Stripes decal (bonus). 1992 Convention (F702): Kris + Sword.
    retailFigureId: 'F203', newFigureId: 'F702', codeName: 'Gung-Ho',
    retailReleaseContext: 'retail',
    newAltName: 'Dress Blues Gung-Ho', newDisplayName: 'Gung-Ho v2 (convention)',
    newFullName: 'La Fitte, Etienne R.', newSpecialty: 'Recondo Instructor', newFactionId: 1,
    newSeriesId: 15, newReleaseContext: 'convention', newConventionKind: 'accessories', newNotes: 'Convention',
    accessories: [
      { code: 'A0758', qty: 1 }, // Kris (wavy)
      { code: 'A0759', qty: 1 }, // Sword (barbed)
    ],
  },
  {
    // Falcon v1 — 1987 retail (F199) vs 1992 Convention (F700). Same Rifle +
    // Flare Gun as Flint's convention edition (see F701 above).
    retailFigureId: 'F199', newFigureId: 'F700', codeName: 'Falcon',
    retailReleaseContext: 'retail',
    newAltName: 'Lt. Falcon', newDisplayName: 'Falcon v1 (convention)',
    newFullName: 'Falcone, Vincent R.', newSpecialty: 'Infantry', newFactionId: 1,
    newSeriesId: 15, newReleaseContext: 'convention', newConventionKind: 'accessories', newNotes: 'Convention',
    accessories: [
      { code: 'A0692', qty: 1 }, // Rifle
      { code: 'A0807', qty: 1 }, // Flare Gun
    ],
  },
  {
    // Outback v1 — 1987 retail (F213) vs 1992 Convention (F703). The CSV's
    // black flashlight A0463 was replaced in the live DB by the owner's green
    // A1746 (added 2026-07-13) — the live DB is followed.
    retailFigureId: 'F213', newFigureId: 'F703', codeName: 'Outback',
    retailReleaseContext: 'retail',
    newDisplayName: 'Outback v1 (convention)',
    newFullName: 'Selkirk, Stuart R.', newSpecialty: 'Infantry', newFactionId: 1,
    newSeriesId: 15, newReleaseContext: 'convention', newConventionKind: 'accessories', newNotes: 'Convention',
    accessories: [
      { code: 'A0647', qty: 1 }, // Rifle
      { code: 'A0652', qty: 1 }, // Machine Gun
      { code: 'A1746', qty: 1 }, // Flashlight (green)
    ],
  },
  {
    // Skystriker v1 (Tiger Force) — 1988 retail (F272/F273, A/B map-grid
    // variants) vs 1992 Convention "Thunder" (F712/F713 — the same A/B
    // variants). copyVariants carries the A/B lettering onto the new row.
    retailFigureId: 'F272', newFigureId: 'F712', codeName: 'Skystriker',
    retailReleaseContext: 'retail',
    newAltName: 'Tiger Force Skystriker or Thunder', newDisplayName: 'Skystriker v1 (convention)',
    newFullName: 'Russo, Alexander P.', newSpecialty: 'Tiger Rat Pilot', newFactionId: 1,
    newSeriesId: 15, newReleaseContext: 'convention', newConventionKind: 'accessories', newNotes: 'Convention',
    copyVariants: true,
    accessories: [
      { code: 'A0784', qty: 1 }, // Pistol
      { code: 'A0785', qty: 1 }, // Rifle
    ],
  },
  {
    // Python Officer v1 — 1989 retail (F316, Dragunov) vs 1992 Convention (F704).
    retailFigureId: 'F316', newFigureId: 'F704', codeName: 'Python Officer',
    newAltName: 'Cobra Viper', newDisplayName: 'Python Officer v1 (convention)',
    newFactionId: 2,
    newSeriesId: 15, newReleaseContext: 'convention', newConventionKind: 'accessories', newNotes: 'Convention',
    accessories: [
      { code: 'A0626', qty: 1 }, // Pistol
      { code: 'A0614', qty: 1 }, // Rifle
    ],
  },
  {
    // Python Tele-Viper v1 — 1989 retail (F317) vs 1992 Convention (F705).
    // Both releases include the long hose A1902 (source CSV), so it's copied,
    // not moved.
    retailFigureId: 'F317', newFigureId: 'F705', codeName: 'Python Tele-Viper',
    newAltName: 'Cobra Tele-Viper', newDisplayName: 'Python Tele-Viper v1 (convention)',
    newFactionId: 2,
    newSeriesId: 15, newReleaseContext: 'convention', newConventionKind: 'accessories', newNotes: 'Convention',
    accessories: [
      { code: 'A0552', qty: 1 }, // Pistol
      { code: 'A0778', qty: 1 }, // Knife
      { code: 'A1902', qty: 1, keepOnRetail: true }, // Hose 6" Long — on both releases
    ],
  },
  // ---- 2026-10-30 sweep, round 2 (owner answers) ----
  {
    // Zarana v1 — 1986 retail (F182; A/B/C are all retail paint variants,
    // owner-confirmed — the CSV's "1992 Convention" tag on variant C F184 is
    // wrong). 1992 Convention (F716) gear: white Submachine Gun + Sword (barbed).
    retailFigureId: 'F182', newFigureId: 'F716', codeName: 'Zarana',
    newDisplayName: 'Zarana v1 (convention)', newFactionId: 4,
    newSeriesId: 15, newReleaseContext: 'convention', newConventionKind: 'accessories', newNotes: 'Convention',
    accessories: [
      { code: 'A0822', qty: 1 }, // Submachine Gun (white)
      { code: 'A0759', qty: 1 }, // Sword (barbed)
    ],
  },
  {
    // Python Trooper v1 — 1989 retail (F318, black AK-47 A0006). Owner-confirmed
    // 1992 Convention release with the white AK-47 (A0610). The source CSV has
    // no 700-block row for it, so F725 is a new code (next free after F724).
    retailFigureId: 'F318', newFigureId: 'F725', codeName: 'Python Trooper',
    newDisplayName: 'Python Trooper v1 (convention)', newFactionId: 2,
    newSeriesId: 15, newReleaseContext: 'convention', newConventionKind: 'accessories', newNotes: 'Convention',
    accessories: [
      { code: 'A0610', qty: 1 }, // AK-47 Assault Rifle (white)
    ],
  },
  {
    // Heavy Metal v1 — 1985 retail driver (F129: Microphone + Submachine Gun).
    // 1992 Convention "Rampage" (F706) is a convention FIGURE (owner) — its
    // own name, built on the Heavy Metal mold, with Snake Eyes v3's Uzi and
    // Dee-Jay's Laser Rifle — so the new row keeps the bold CONVENTION badge
    // (convention_kind NULL), not CONV. ACCESSORIES. The "Rampage" alt name
    // moves to the new row.
    retailFigureId: 'F129', newFigureId: 'F706', codeName: 'Heavy Metal',
    retailReleaseContext: 'retail', retailAltName: null,
    newAltName: 'Rampage', newDisplayName: 'Heavy Metal (convention)',
    newFullName: 'Guderian, Sherman R.', newFactionId: 1,
    newSeriesId: 15, newReleaseContext: 'convention', newNotes: 'Convention',
    accessories: [
      { code: 'A0633', qty: 1 }, // Uzi Submachine Gun — Snake Eyes v3's
      { code: 'A0556', qty: 1 }, // Laser Rifle — Dee-Jay's
    ],
  },
  {
    // Rumbler v1 — 1987 retail (F219: Helmet + Submachine Gun). 1992
    // Convention "Footloose" Rumbler (F721) is a convention FIGURE (owner),
    // with Recoil's Rifle + Pistol. The "Footloose" alt name moves to the
    // new row.
    retailFigureId: 'F219', newFigureId: 'F721', codeName: 'Rumbler',
    retailReleaseContext: 'retail', retailAltName: null,
    newAltName: 'Footloose', newDisplayName: 'Rumbler (convention)',
    newFullName: 'Swilley, Earl-Bob', newFactionId: 1,
    newSeriesId: 15, newReleaseContext: 'convention', newNotes: 'Convention',
    accessories: [
      { code: 'A0614', qty: 1 }, // Rifle — Recoil's
      { code: 'A0615', qty: 1 }, // Pistol (Double Submachine Gun) — Recoil's
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
      if ('retailAltName' in split) {
        db.prepare('UPDATE figures SET alt_name = ? WHERE id = ?').run(split.retailAltName, retail.id);
      }
      if (split.retailDisplayName) {
        db.prepare('UPDATE figures SET display_name = ? WHERE id = ?').run(split.retailDisplayName, retail.id);
      }
      // Drop an existing A/B variant_lookup bracket on the retail row when
      // the split reveals it was never a same-release production variant —
      // Flint/Roadblock/Snow Serpent never had letters on their retail row
      // to begin with, so only Stalker needs this so far.
      if (split.clearRetailVariants) {
        db.prepare('DELETE FROM variant_lookup WHERE figure_id = ?').run(retail.id);
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
          figure_id, code_name, version, variant, variant_lookup, alt_name,
          display_name, full_name, specialty, faction_id, series_id,
          release_context, is_mail_in, notes, convention_kind
        ) VALUES (
          @figure_id, @code_name, NULL, NULL, NULL, @alt_name,
          @display_name, @full_name, @specialty, @faction_id, @series_id,
          @release_context, 0, @notes, @convention_kind
        )
      `).run({
        figure_id: split.newFigureId,
        code_name: split.codeName,
        alt_name: split.newAltName || null,
        display_name: split.newDisplayName,
        full_name: split.newFullName || null,
        specialty: split.newSpecialty || null,
        faction_id: split.newFactionId || null,
        series_id: split.newSeriesId,
        release_context: split.newReleaseContext,
        notes: split.newNotes || null,
        convention_kind: split.newConventionKind || null,
      });
      const newId = info.lastInsertRowid;

      const insertOnNew = db.prepare(
        'INSERT INTO figure_accessories (figure_id, accessory_id, quantity_required, release_context) VALUES (?, ?, ?, ?)'
      );
      for (const { code, qty, keepOnRetail } of split.accessories) {
        const acc = getAccByCode.get(code);
        if (!acc) throw new Error(`${split.codeName}: accessory ${code} not found.`);
        if (!keepOnRetail) deleteFromRetail.run(retail.id, acc.id); // no-op if it wasn't there
        insertOnNew.run(newId, acc.id, qty || 1, 'retail'); // 'retail' *within this row's own blueprint* — see split-quick-kick-convention.mjs precedent
      }

      // Same A/B production variants on both releases (Skystriker) — copy the
      // lettering onto the new row.
      if (split.copyVariants) {
        db.prepare(`INSERT INTO variant_lookup (figure_id, letter, tell)
                    SELECT ?, letter, tell FROM variant_lookup WHERE figure_id = ? ORDER BY letter`).run(newId, retail.id);
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
