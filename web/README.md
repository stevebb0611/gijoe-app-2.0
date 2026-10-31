# web/ — G.I. Joe Collection front end

The live React app (Vite 8, React 19, plain JSX + one `app.css`). It talks to the
Express API in `../server/` over `/api/*`; the DB is `../gijoe_collection.db`.

```bash
npm run dev      # Vite on :5173, proxies /api to :3000 (start the server first: `npm start` at repo root)
npm run build    # -> web/dist, which `npm start` at repo root serves on :3000
npm run lint     # oxlint
```

There is no test suite — verify changes in the running app (see
`.claude/skills/verify/SKILL.md`). Read/navigation is safe against the live DB;
any write action (Add Figure, Apply Moves, Pull to Complete, …) persists to the
owner's real collection.

| File | What it holds |
|---|---|
| `main.jsx` | App root — page switch (Figures / Master Collection / Parts Bin) + Tweaks panel |
| `store.js` | `JoeStore` (API client, sync XHR by design) + `JoeData` (completeness rollups) |
| `app-inventory.jsx` | Figures page — year sections, list/gallery, filters, instance accordions |
| `app-detail.jsx` | Figure detail modal, accessory rows (`AccItem`), ⚖ rebalance/swap engine |
| `app-add-figure.jsx` | Add Figure overlay (FIND → DETAILS → CONDITION → FINALIZE) |
| `parts-bin.jsx` | Parts Bin — loose stock, reverse lookup, Hose Balance, splittable parts |
| `master-collection.jsx` | Master Collection page (star + per-variant targets, year thermometer) |
| `set-card.jsx` | Figure Sets / Special Release cards |
| `accessory-groups.jsx`, `acc-colors.jsx` | Pick-one group rendering, accessory color swatches |
| `damage-map.jsx`, `assets/figure-{masks,zones}.js` | Damage-map diagram + grade engine |
| `fig-identity.js`/`.jsx` | Shared 8-field figure identity formatter |
| `filecards.jsx` | File-card catalog display |
| `search-util.js` | `normalizeSearch()` — punctuation/`&`/`'n'` folding for search |
| `tweaks-panel.jsx` | Theme + Export/Import panel |

Completeness math shared with the server lives in `../shared/completeness.js`.
