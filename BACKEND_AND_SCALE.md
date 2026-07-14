# Backend, Auth & Scale — decisions for Open Questions #3 + #4

> **Update (July 2026 — what actually got built, see `OPEN_QUESTIONS_Claude.md` #17a/17b):**
> the stack call below (**Next.js App Router + Turso/libSQL**) was the right read of the
> owner's sample `route.js` at the time, but the real build shipped as a **local Express
> server (`server/index.js`) + `better-sqlite3`** reading `gijoe_collection.db` directly,
> with the frontend as a **Vite SPA** (`web/`), not Next.js. No hosting/Turso migration has
> happened — it's a single-machine local app today. The **data model in §2** (table/column
> shapes) is still accurate and is what's live in `gijoe_collection.sql`; the **API shape in
> §3** is also different in practice — the live API is a small **single-payload** surface
> (`GET /api/catalog` and `GET /api/state` each return the whole table, no pagination/query
> params) rather than the paginated `GET /api/figures?...` routes sketched below. That's a
> reasonable simplification at the current ~650-figure scale; revisit pagination if the
> §6 scale ceiling is actually approached. **Auth (§4) is unchanged** — still no `user_id`
> anywhere, genuinely single-user. Treat §1/§3's Next.js-specific framing as historical
> record of the decision process, not the current architecture.

Resolves the load-bearing parts of `OPEN_QUESTIONS_Claude.md` **#3 (data source / backend / auth / sync)** and **#4 (scale & performance)**, grounded in the owner's answers (June 2026) and the real `route.js` the owner shared.

> **TL;DR**
> - **Hosted web app, server + cloud DB. Online-assumed — no offline-write/sync engine.** (Removes the single biggest architectural fork.) *Refinement (June 2026, OPEN_QUESTIONS #9): the PWA **install shell** (manifest + add-to-home-screen, full-screen) is back in scope as a cheap later layer; only the **offline-write/sync engine** stays out. See §5.*
> - **Stack confirmed from `route.js`: Next.js App Router + SQLite** (`@/lib/db`, `db.get`/`db.run`, `?` params). For *hosted* SQLite use **Turso / libSQL** — same driver surface, zero query rewrites.
> - **Single-user now, multi-user-*ready*.** Every owned-* row carries `user_id` from day one; ship with one implicit owner and no login UI. Adding accounts later is purely additive.
> - **Desktop-first; mobile responsive later, not native.**
> - **Scale target 1,500–2,000+ figures** → server-side paginated/queryable catalog, server search+filter, and client-side **virtualization + lazy images with skeletons** (the gallery is the primary browse mode, so image loading is the real cost).

---

## 1. What `route.js` tells us (the ground truth)

The shared handler is the **upsert for a per-instance accessory quantity**:

```js
// POST  — body: { owned_figure_id, accessory_id, quantity_owned }
// SELECT 1 FROM owned_accessories WHERE owned_figure_id=? AND accessory_id=?
// → UPDATE quantity_owned   (if exists)
// → INSERT (...)            (if not)
```

Confirmed facts we build on, **not** around:
- **Framework**: Next.js **App Router** route handlers (`NextResponse`, `export async function POST`).
- **DB access**: a thin async wrapper `getDatabaseConnection()` from `@/lib/db` exposing `db.get` / `db.run` with positional `?` params — i.e. the **SQLite** family (node `sqlite`/`better-sqlite3`/libSQL).
- **Per-instance model is real**: `owned_accessories` is keyed by **`(owned_figure_id, accessory_id)`** carrying `quantity_owned`. This is exactly the per-copy checklist from `INSTANCE_MODEL.md` — so `owned_figures` = **one row per owned copy (instance)**, and `owned_figure_id` is the instance id.
- **No `user_id`, no auth, no `created_at/updated_at`** yet — to be added (below) without breaking this handler.

### Two fixes to fold into this exact handler
1. **Make the upsert atomic.** Replace SELECT-then-write with a single statement (also removes a race + a round-trip):
   ```sql
   INSERT INTO owned_accessories (owned_figure_id, accessory_id, quantity_owned, user_id)
   VALUES (?, ?, ?, ?)
   ON CONFLICT(owned_figure_id, accessory_id)
   DO UPDATE SET quantity_owned = excluded.quantity_owned;
   ```
   Requires a **composite PK / UNIQUE index** on `(owned_figure_id, accessory_id)` (see schema). This is the single most impactful change to the file as written.
2. **`quantity_owned = 0` semantics.** Decide once: **delete the row when quantity hits 0** (keeps the table sparse — a missing row = "don't have it", which is the common case across 2,893 blueprint links) rather than storing thousands of explicit zeros. Mutation endpoint should `DELETE` on 0, `upsert` otherwise.

---

## 2. Data model (multi-user-ready, online-assumed)

Two layers: **reference catalog (read-only seed)** and **ownership (born in-app)**. Naming preserves what `route.js` already uses.

### Reference catalog — seeded from the three validated CSVs, never user-written
```
figures                 (654 rows — gijoe_db_figures_2.0, canonical)
  figure_id      TEXT PK            -- 'F001'
  code_name      TEXT               -- row1 display name
  full_name      TEXT NULL          -- row2
  specialty      TEXT NULL          -- row3 (always mono/soft per TYPOGRAPHY rule)
  year           INTEGER
  series         INTEGER            -- primary grouping axis (TAXONOMY.md)
  faction        TEXT               -- joe | cobra | oktober | dreadnok
  sub_team       TEXT NULL
  role_variant   TEXT NULL          -- the legacy free 'variant' string (version/role)
  rare           INTEGER DEFAULT 0

accessories             (803 rows — gijoe_db_accessories)
  accessory_id   TEXT PK            -- 'A0042'
  name           TEXT
  category       TEXT               -- one of 52

figures_accessories     (2,893 rows — the blueprint join; validated 100%, zero orphans)
  figure_id          TEXT  FK→figures
  accessory_id       TEXT  FK→accessories
  quantity_required  INTEGER DEFAULT 1   -- partials ×2–×6
  PRIMARY KEY (figure_id, accessory_id)
  -- IGNORE the CSV's empty is_shared / is_original / quantity_owned + accessories.host_figure (admin-only).
  -- SHARED vs SINGLE + compatibility derive from COUNT(DISTINCT figure_id) per accessory in THIS join.
```

### Ownership — empty on deploy, accrues one figure at a time
```
users                   (future — exists now with a single seeded row)
  user_id        TEXT PK
  -- auth fields added when accounts ship; nothing else references auth today

owned_figures           (one row per OWNED COPY / instance)
  owned_figure_id  TEXT PK
  user_id          TEXT FK→users   NOT NULL          -- <-- multi-user seam
  figure_id        TEXT FK→figures NOT NULL
  variant_id       TEXT NULL                          -- VARIANTS.md production-variant FK (NULL = single-variant figure only; no UNIDENTIFIED state — §3)
  is_primary       INTEGER DEFAULT 0                  -- the pinned copy
  grade_physical   TEXT NULL                          -- derived from damage map (INSTANCE_MODEL.md)
  grade_paint      TEXT NULL
  damage_map       TEXT NULL                          -- JSON blob of point states
  location         TEXT NULL                          -- bin / box
  notes            TEXT NULL
  created_at       TEXT DEFAULT (datetime('now'))
  updated_at       TEXT DEFAULT (datetime('now'))

owned_accessories       (per-instance accessory quantities — EXACTLY route.js)
  owned_figure_id  TEXT FK→owned_figures NOT NULL
  accessory_id     TEXT FK→accessories   NOT NULL
  quantity_owned   INTEGER NOT NULL
  user_id          TEXT FK→users         NOT NULL     -- denormalized for cheap per-user scoping
  PRIMARY KEY (owned_figure_id, accessory_id)         -- <-- enables ON CONFLICT upsert

parts_bin               (loose accessories not assigned to any copy — PARTS_BIN.md)
  user_id          TEXT FK→users      NOT NULL
  accessory_id     TEXT FK→accessories NOT NULL
  quantity_owned   INTEGER NOT NULL
  PRIMARY KEY (user_id, accessory_id)
```

**Surplus auto-deposit** (OPEN_QUESTIONS #5): when an instance's `quantity_owned` would exceed `quantity_required × copies`, the overflow is moved to `parts_bin` in the same transaction. Keep this in the mutation layer, not the DB.

### Indexes that matter at 2,000 figures
```
owned_figures (user_id, figure_id)        -- "what do I own of X", per-user lists
owned_figures (user_id, is_primary)
owned_accessories (user_id, accessory_id) -- reverse lookup: which copies use accessory A
figures (series), figures (year), figures (faction)   -- grouping/filter axes
figures_accessories (accessory_id)        -- compatibility / SHARED count
```

---

## 3. API shape (Next.js App Router route handlers)

Keep the owner's REST-handler style. One resource per route folder; the verb is the HTTP method. Every owned-* query is **scoped by the current `user_id`** (a constant today, the session user later).

```
GET   /api/figures?series=&faction=&q=&status=&page=&pageSize=   -- catalog + ownership rollup, PAGINATED
GET   /api/figures/[figureId]                                    -- one figure + its instances + blueprint
POST  /api/owned-figures                                         -- Add Figure / Add Instance
PATCH /api/owned-figures/[id]                                    -- grade, location, notes, primary, variant_id
DELETE/api/owned-figures/[id]                                    -- Remove copy (+ accessory disposition)
POST  /api/owned-accessories        <-- the shared route.js, hardened (atomic upsert, delete-on-0)
GET   /api/parts-bin                                             -- loose parts + reverse lookup
POST  /api/parts-bin                                             -- deposit / withdraw loose parts
POST  /api/rebalance/[figureId]                                  -- compute moves; APPLY mutates have-flags
```

Conventions: JSON in/out, `{ error }` + status on failure (matches the handler), optimistic-friendly responses (return the mutated row), `204` on delete. Completeness math (`figParts`/`figState`/`yearParts`) stays **server-derivable but client-cached** — pure functions in shared TS, fed by the query cache.

---

## 4. Auth posture — single now, multi-user-ready

- **Now**: no login UI. A single seeded `users` row; the app reads `user_id` from a server constant (`CURRENT_USER_ID`). Every owned-* write/read already carries `user_id`, so data is *born* scoped.
- **Later (additive only)**: drop in auth (NextAuth / Lucia / framework default), replace the constant with `session.user.id`, add a `WHERE user_id = ?` guard in a shared query helper. **No schema migration, no data backfill** — that's the whole point of carrying `user_id` from day one.
- **Not now**: sharing, roles, per-record ACLs, public read links. Revisit only if "beyond myself" becomes real.

---

## 5. Sync & offline — offline *writes* OUT; PWA *install shell* back IN (June 2026)

Owner: *"Not needed — assume connection."* Refined alongside the mobile decision (OPEN_QUESTIONS #9 — *responsive web now, PWA later, never native*). The fork that was the real cost — an offline-write/sync engine — stays out; the cheap install layer comes back. So:

- **PWA install shell — ✅ back IN (cheap, later).** A web-app manifest (name/icon/theme color) + `display: standalone` for tap-to-home-screen, full-screen launch — the flea-market "real app icon." No architectural impact; added once the app is responsive. *(This is the one item carved back out of the original blanket "PWA out" call below.)*
- **Offline reads — deferred, gated on real pain.** A service worker caching the app shell + read responses so it loads on dead signal. Add only if a phone-at-shows workflow proves painful. Contained task, not pre-built.
- **Offline writes / sync — still explicitly OUT.** **No** IndexedDB write-mirror / offline queue / conflict resolution (last-write-wins or CRDT). This is the expensive fork and it remains a **separate future project**, deferred indefinitely.
- We **do** keep the cheap online resilience already in `FRONTEND_STANDARDS.md`: a **query cache** (TanStack Query) + **optimistic mutations** so toggling an accessory feels instant and rolls up to completeness live, with rollback on error. This is *latency hiding*, not offline support — no extra infra.

---

## 6. Scale & performance plan (#4) — target 1,500–2,000+

The owner hasn't tested at real scale and browses **primarily by scanning the gallery**. So the gallery's image loading is the dominant cost, not row count alone.

### Server-side
- **Paginated, queryable catalog API** (`GET /api/figures` above). Never ship all ~2,000 figures (× instances × accessories) in one payload. Page or cursor by the active grouping axis (series/year).
- **Server-side search + filter** at this scale: push `q`, `faction`, `series`, `status` into the query, return only matching pages. Add the indexes in §2.
- **Debounce** the search input ~150–250ms before hitting the server.

### Client-side
- **Virtualize** long lists *and* the gallery grid (`@tanstack/react-virtual`) — fully-expanded "All" or a broad search can otherwise mount hundreds–thousands of nodes. Render only the visible window + overscan.
- **Lazy images with skeletons** (the load-bearing one for gallery browsing):
  - `loading="lazy"` + `decoding="async"` on every figure photo; reserve the box with a fixed aspect ratio so the grid never reflows as images arrive.
  - Show the existing **hatched placeholder as the skeleton**, swap to the photo on load (fade), keep the hatch as the permanent state for figures with no photo.
  - Serve **thumbnails** (object store + a thumb derivative), not full-res, in grid/list. Full-res only in the modal.
- **Memoize** derived sections/filter results (`useMemo`) and card/row components (`React.memo`); keep completeness math cheap + cached.
- **Code-split** the modal and secondary flows.

### Measure before optimizing further
Virtualization + lazy thumbnails + server paging cover 2,000 comfortably. Only revisit (cursor pagination, server-rendered first page, CDN image transforms) if real-device profiling shows a problem — don't pre-build a search cluster for a personal tool.

---

## 7. What changed in the other docs
- `OPEN_QUESTIONS_Claude.md` **#3** → backend/stack/auth/sync now decided (this doc). **#4** → performance plan consolidated here; `FRONTEND_STANDARDS.md` "Performance at scale" stays the implementation checklist.
- `FRONTEND_STANDARDS.md` already specifies virtualization, debounce, query-cache, optimistic mutations — unchanged and consistent with the above.
- See **`GI Joe Tracker - Inventory (Scale States).html`** for the mocked gallery loading/skeleton/lazy-image states this plan produces.

## 8. Still open (non-blocking)
- Confirm hosting target for Turso/libSQL vs. a managed Postgres if the owner later wants stronger multi-user/relational guarantees (SQLite is fine for single + small multi-user).
- Object-store choice + thumbnail pipeline for photos (#11) — needed before the lazy-image plan has real images to load.
- Grade-rule tuning still feeds `grade_physical`/`grade_paint` (INSTANCE_MODEL #1).
