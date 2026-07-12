---
name: verify
description: How to visually verify a change in the G.I. Joe Tracker web app
---

# Verifying changes in web/

The app is a Vite React SPA (`web/`) backed by a local Express/better-sqlite3
API (`server/`). Both are frequently **already running** — check before
starting your own:

```bash
lsof -nP -iTCP -sTCP:LISTEN | grep node
curl -s http://localhost:5173/ -o /dev/null -w "vite: %{http_code}\n"
curl -s http://localhost:3000/api/state -o /dev/null -w "api: %{http_code}\n"
```

If not running: `cd server && node index.js &` then `cd web && npm run dev`.
`server/*.js` has no hot-reload — restart it manually after server-side edits.
`store.js` in the browser talks to the API via **synchronous XHR** on purpose
(see the file header) — don't "fix" that.

There is no test suite (`web/package.json` has no `test` script). `npm run
build` (vite build) and `npm run lint` (oxlint) are useful smoke checks but
are not a substitute for actually looking at the running app.

## Driving the app headlessly

Playwright isn't a project dependency, but a matching Chromium is usually
already cached at `~/Library/Caches/ms-playwright/`. From a scratch dir:

```bash
npm init -y && npm install playwright@<version matching `npx playwright --version`>
```

Then a plain Node ESM script with `import { chromium } from 'playwright'`,
`chromium.launch()`, `page.goto('http://localhost:5173/')` works directly
against the SPA — no build step needed, Vite serves it live.

Useful selectors:
- Nav: `button:has-text("Figures")`, `button:has-text("Parts Bin")`
- Figures search: `input[placeholder*="search" i]`
- A roster row: `.inv-row` (click to expand instance accordion)
- An instance row inside the accordion: `.inv-inst` (click opens the detail modal)
- Parts Bin Rebalance chip: `.invk--rebal`

Always check `page.on('pageerror', ...)` / `page.on('console', m => m.type()
=== 'error')` — the app throws no server errors on bad renders, so console
errors are often the only signal something broke.

## Gotcha

The real DB (`gijoe_collection.db` at repo root) is live — read-only
navigation (search, expand rows, open modals) is safe, but don't drive any
write action (Add Figure, Apply Moves, Pull to Complete, etc.) without
confirming with the user first, since it persists to their actual collection.
