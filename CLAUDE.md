# CLAUDE.md — G.I. Joe Collection

A personal **inventory + condition tracker** for a large vintage G.I. Joe collection
(target **700–800 figures**; ~940 owned copies as of October 2026). Single user,
localhost only. Read this, then `README.md`, then `OPEN_QUESTIONS.md`.

**The current task is always extending the live app in `web/` + `server/`.** The
repo began as a design-handoff bundle. The port to a real build (`OPEN_QUESTIONS.md`
Q17a/Q17b) finished in July 2026, and dozens of features have shipped since. The
root-level HTML/JSX files are the **frozen prototype**: design reference only.

## Run it

```bash
(cd web && npm run build) && npm start   # http://localhost:3000 — live app + /api/*
cd web && npm run dev                    # :5173 with hot reload, proxies /api to :3000
```

- `server/*.js` has **no hot reload**. Restart `npm start` after server edits.
- Both servers are often **already running** against the real DB. Check with
  `lsof -nP -iTCP -sTCP:LISTEN | grep node` before starting your own.
- There is no test suite. Smoke-check with `cd web && npm run build && npm run lint`,
  then look at the running app (`web/.claude/skills/verify/SKILL.md`).
- `npm run backup` snapshots the DB into `backups/` (keeps 30). `npm run export-catalog`
  writes a readable catalog CSV snapshot into `exports/`.

## Ground rules

- **The DB is live data.** `gijoe_collection.db` is the owner's real collection.
  Read-only navigation is fine. Confirm before driving any write action (Add Figure,
  Apply Moves, Pull to Complete, …) or running a mutating script. Run `npm run backup`
  before bulk data edits.
- **Never commit the DB.** The GitHub repo is public and the DB holds bin/box
  locations. `*.db`, `backups/` and `exports/` are gitignored. Keep it that way.
- **`npm run seed` is destructive.** It rebuilds from the root CSVs, which lag the
  live DB (`release_context` tags, splits, groups were applied live only). It refuses to
  run over owned instances without `--force`. Don't regenerate the seed CSVs without the
  owner — see `OPEN_QUESTIONS.md` Q21.
- **An auto-commit hook** (`.claude/hooks/git-auto-push.sh`, PostToolUse on
  Edit/Write/NotebookEdit/Bash) commits *and pushes* once 5+ files are dirty. Expect
  mid-task commits.
- **Schema changes** go in a new numbered file in `migrations/` (next: `023_…`), applied
  to the live DB, and mirrored into `gijoe_collection.sql`.
- **`web/src/store.js` uses synchronous XHR on purpose** (see its header). Don't convert
  it to async without also reworking every `JoeStore.*` call site.
- **The catalog is fetched once per page load.** A writable catalog field needs an
  in-place cache patch in the `store.js` setter, not a refetch.
- **Don't edit the root-level prototype files.** Each carries a "frozen prototype"
  header pointing at its live counterpart.
- **No helper language in the UI.** New UI gets labels and data only, with no
  explanatory sub-lines or intro copy (`OPEN_QUESTIONS.md` F4).

## Map

| Path | What it is |
|---|---|
| `web/src/` | The live React app. Per-file map in `web/README.md` |
| `server/index.js` | Express entry — serves `web/dist`, the `/api/*` routes, and (fallback) the raw repo root for the prototypes |
| `server/catalog.js`, `accessories.js`, `instances.js`, `export-xlsx.js`, `db.js` | API handlers over `gijoe_collection.db` (`better-sqlite3`, WAL mode) |
| `server/*.mjs` | Reusable owner CLI tools: `add-figure`, `add-figure-set`, `split-release-edition`, `set-accessory-context`, `set-match-key`, `migrate-accessory-groups` (append-only group list), `migrate-file-cards`, `seed`, `backup-db`, `export-catalog-snapshot` |
| `server/one-off/` | Data fixes already applied to the live DB — kept for provenance, idempotent |
| `shared/completeness.js` | Completeness/group clustering math used by both server and client |
| `migrations/`, `gijoe_collection.sql` | Numbered schema history + base schema |
| `gijoe_db_*.csv` (root) | Seed sources `server/seed.mjs` reads. `seed/` is the original handoff copy, used only for cross-checks |
| `assets/` | Prototype damage-map assets + `assets/design/color-panel.png` (re-render it when tokens change) |
| Root `*.html` / `*.jsx` / `*.js` / `*.css` | Frozen prototype — `index.html` (at `/index.html`) links every screen |
| `_archive/` | Superseded mockups and the original handoff docs (`PORT_VERBATIM.md`, `START_HERE.md`, …) |

### Specs
`README.md` (design language, tokens, what's built) · `OPEN_QUESTIONS.md` (open items +
resolved log) · `FRONTEND_STANDARDS.md` · `INSTANCE_MODEL.md` · `DAMAGE_MAP.md` ·
`VARIANTS.md` · `PARTS_BIN.md` · `ACCESSORY_GROUPS.md` · `FIGURE_SPLITS.md` ·
`FIGURE_SETS.md` · `MAIL_RELEASES.md` · `MASTER_COLLECTION.md` · `FILE_CARDS.md` ·
`TAXONOMY.md` · `NAVIGATION.md` · `BACKEND_AND_SCALE.md` · `PLANNING.md` (planned,
unbuilt Parts Bin work — Q25).

Per-figure data decisions (splits, groups, release context) are logged in the spec
docs, figure by figure. Check the relevant log before changing a figure's data.

## Fidelity

**High-fidelity.** Colors, typography, spacing, borders and interactions are
final-intent. The look is a deliberate **vintage field-manual / cardback**: paper and
ink, hard edges, offset shadows, zero border-radius, Oswald + Space Mono. It is not a
generic admin table. See "Design Language" and "Design Tokens" in `README.md`, and
`FRONTEND_STANDARDS.md` for UI conventions. Dashed outlines mean missing/to-do.

Still-open production swaps: unicode-glyph icons (`▸ ▾ ✕ ⚖ ＋ ✓` …) → a real icon set,
and self-hosted fonts (Q14).

## Brand

**"G.I. Joe Collection"** (decided June 2026) with a vintage-ARAH-file-card outline
mark, live on every surface. The name uses the Hasbro mark by choice — fine for private
use; revisit before any public release (`OPEN_QUESTIONS.md` Q10).
