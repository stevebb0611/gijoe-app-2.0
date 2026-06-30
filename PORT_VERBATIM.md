# PORT VERBATIM — do NOT redesign (read before writing any code)

> **This document overrides any "recreate / rebuild / clean component tree" language
> in `CLAUDE.md`, `README.md`, and `FRONTEND_STANDARDS.md`.** The owner wants the
> EXACT look, feel, and behavior of the prototype — pixel-identical. Your job is a
> **mechanical port**, not a reinterpretation. If you find yourself renaming
> components, re-tokenizing CSS, "improving" layout, or rebuilding a screen from its
> description, STOP — that is the failure mode this file exists to prevent.

## The rule
The prototype is already real React + real CSS. Move it into a real build with the
**smallest possible diff**. Preserve verbatim:
- All JSX markup and component bodies (`inventory-app.jsx`, `add-figure.jsx`, `add-instance.jsx`, `instance-detail.jsx`, `parts-bin.jsx`, `damage-map.jsx`, etc.).
- All CSS — copy the `<style>` blocks out of the `.html` files **character-for-character** into `.css` files. Do **not** tokenize, rename classes, convert to Tailwind, or "clean up."
- Class names, unicode glyphs (`▸ ▾ ✕ ⚖ ＋ ✓`), copy/text, colors, spacing, fonts.
- Behavior and state logic exactly as written.

## What you MAY change (only this)
1. **Compilation:** drop in-browser Babel — let Vite/Next compile the JSX. (`npm create vite@latest` → React template.)
2. **Module wiring:** replace the `Object.assign(window, {...})` exports + `const {X} = window` imports with real `export` / `import`. Nothing else in those files changes.
3. **Asset loading:** import the `.css` files; load fonts via the project instead of the CDN `<link>` (optional — CDN is fine to start).

That's the entire allowed change set. Everything else stays byte-identical.

## Recommended mechanical steps (Vite)
1. `npm create vite@latest gijoe-tracker -- --template react` → `cd gijoe-tracker && npm i`.
2. Copy the prototype `.jsx` / `.js` files into `src/`.
3. For each file: at the bottom, change `Object.assign(window, { A, B })` → `export { A, B }`. At the top, change `const { A, B } = window;` → `import { A, B } from './thatFile.jsx';`. **Touch nothing else.**
4. Extract each HTML file's `<style>` block into a sibling `.css` file and `import './x.css'` from the matching component. Paste verbatim.
5. Mount the root (`InventoryApp`) in `main.jsx`. Serve with `npm run dev`.
6. **Diff against the prototype** (open both side by side). They must be visually indistinguishable. Any difference = a porting bug to fix, not a design decision to make.

## The ONE real refactor (and only when asked)
The single thing that is genuinely not portable is the **synthesized per-instance data**
in `wf-data.jsx` (`figState()` derives a fake per-copy allocation from aggregate counts).
That gets replaced by a real **Instance** entity + DB later (`OPEN_QUESTIONS.md #1/#13`).
**Do this as a separate, explicit step — after the verbatim port is confirmed pixel-identical, and only when the owner asks.** It is not part of the port.

## Why this matters
"Recreate from the description" produces a plausible *different* app. The owner spent the
design effort to get this exact result; the build's job is to preserve it, not re-derive it.
Fidelity bar: **a reviewer must not be able to tell the production build from the prototype.**
