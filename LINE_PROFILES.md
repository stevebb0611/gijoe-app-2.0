# Line Profiles — multi-line groundwork

The app is built for G.I. Joe, but its engine (catalog → owned copies → accessory
completeness, damage map, Parts Bin, Master Collection, Figure Sets) doesn't depend on
the franchise. The long-term idea is a **top layer where a collector picks a line**
(G.I. Joe, TMNT, Star Wars, ThunderCats, …), with each line reskinned and re-worded.

## Decisions (2026-11-12)
- **One DB per line** (`gijoe_collection.db`, later e.g. `tmnt_collection.db`), plus a small
  registry for the home screen. The live Joe DB stays untouched, and nothing threads a
  `line_id` through every query. Cost: cross-line totals on the home screen need the
  server to open each DB.
- **No pilot line yet.** Exploring only.
- **Completeness rules:** the slot/group math (`shared/completeness.js`) is already
  data-driven. The one concrete idea so far is **packaging extras** (cardbacks, inserts,
  comics, mini-posters) counting toward complete. Likely shape: model them as accessories
  in a `Packaging` category, plus a profile switch for whether they count toward the
  completion %. Loose-only collectors would leave it off. Not built. It could pilot on Joe.

## The profile
`shared/lines/gijoe.js` holds every line-specific value. Read it only through
`shared/line-profile.js`, which exports the active `LINE` plus lookups. Both the client
and the server import it.

| Field | Drives |
|---|---|
| `brand.name` / `headerLines` / `tool` | Header wordmark (`BrandHome` in `web/src/line-ui.jsx`), xlsx creator, server log |
| `factions[]` (`key`, `dbName`, `label`, `tag`, `color`) | Catalog faction code (`server/catalog.js`), Figures facet chips + filter tokens, `FactionTag` pills, Add Figure pills, `add-figure.mjs` help |
| `labels.team` / `subTeam` / `codeName` | Facet headings, column heads, filter tokens, sub-team tag tooltip, "… colors" tweak |
| `features.fileCards` | "+ File Card" badges; File Card panel in the detail modal and Add Figure |
| `features.vehiclesNav` | "Vehicles · In Dev" nav link |
| `features.hoseBalance.codes` | Parts Bin [Hose Balance] chip + panel. Absent = no chip |

**Team colors:** `color` names an `app.css` palette token (`var(--olive)`). `facProps(key, base)`
puts it on the element as an inline `--fac` and adds the `--team` modifier. `app.css` has one
rule each for `.wf-fac--team` / `.chip--team` and the "colors off" override. Adding a team
needs no new CSS. `<html data-line="gijoe">` is set at boot as the hook for a per-line
palette (`:root[data-line="…"]`), which isn't used yet.

**Rule:** components never hard-code a brand string, team key or team color, or line
vocabulary. Add it to the profile.

## Still G.I. Joe-shaped (later phases)
- Damage-map body silhouettes (`web/src/damage-map.jsx`, `assets/`): O-ring body only.
- `web/index.html` title + `web/public/manifest.json`: static until there's a picker.
- `release_context` CHECK values (schema): retail / convention / mail_in / mail_order.
- Code comments and the root-level frozen prototype.

## Roadmap
- **Phase 0 — done 2026-11-12.** Joe hard-codes moved into the Joe profile. Verified as no
  visible change: screen-by-screen screenshot comparison, byte-identical `/api/catalog`.
- **Phase 1.** Line registry + home/line-picker screen. Joe is the only tile. `line-profile.js`
  resolves the active line from the registry, and the server opens that line's DB.
- **Phase 2.** First real second line: profile, palette, seed CSV, silhouettes, and any new
  completeness rules (e.g. packaging extras).
