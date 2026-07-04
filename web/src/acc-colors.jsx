// acc-colors.jsx — resolve the accessories DB `color` strings into real
// swatch colours. Handles base names, modifiers (light/dark/dull/bright/
// translucent), and two-tone "x/y" values. Unknown / junk values (where a
// category name leaked into the colour column) render as a neutral hatch so
// they read as "unmapped" rather than silently wrong.
//
// Merged into the production tree 2026-07-03, ported verbatim (logic
// untouched, window.colorFor/AccSwatch swapped for module exports) from the
// standalone acc-colors.jsx that accessories_sub_group_mockup.jsx depended on
// (owner's Downloads folder — archived post-merge, see _archive/ for the
// original file and design commentary/rationale it carried).
// Consumed by accessory-groups.jsx (VariantGroup, MatchedGroup, ContextGroup
// rows), app-detail.jsx (AccItem), and app-add-figure.jsx (afAccRow) — every
// place a blueprint row renders gets the swatch via its `color` tuple field
// (server/catalog.js blueprint tuple index 6).
// Tuned warm to sit on the blueprint paper (#f3eee2) without vibrating.
import React from 'react';

const BASE = {
  black: "#2c2a26", grey: "#8d887e", gray: "#8d887e", silver: "#b6b9bd",
  chrome: "#c7cbcd", white: "#f1ede3", cream: "#e7ddc4", tan: "#c3a97a",
  fleshtone: "#e0b48f", red: "#b8402f", maroon: "#7c3340", brown: "#7c5a3a",
  "reddish brown": "#8a4a37", bronze: "#9c7b46", orange: "#cf7a2e",
  yellow: "#d4b132", gold: "#c39a38", green: "#5f7d3f", "olive green": "#6b6f3a",
  blue: "#456290", teal: "#3f8a82", purple: "#6f4d86", pink: "#d291a2",
};
// common compound spellings worth pinning directly
const DIRECT = {
  "light green": "#8aa85f", "dull green": "#5d6b46", "dark green": "#3f5a2c",
  "bright green": "#6fa83a", "light gray": "#b3aea2", "dark gray": "#5b574e",
  "light blue": "#7fa0c4", "dark blue": "#2f456c", "light red": "#cc6a5c",
  "dark red": "#8a2c22", "light orange": "#dd9a5c", "bright orange": "#df7a23",
  "bright yellow": "#e2c12f", "dark brown": "#553a24",
};

function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgbToHex(r, g, b) { return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join(""); }
function mix(hex, tgt, amt) { const a = hexToRgb(hex), b = hexToRgb(tgt); return rgbToHex(a[0] + (b[0] - a[0]) * amt, a[1] + (b[1] - a[1]) * amt, a[2] + (b[2] - a[2]) * amt); }
const lighten = (c, a) => mix(c, "#ffffff", a);
const darken = (c, a) => mix(c, "#000000", a);
function desat(c, a) { const [r, g, b] = hexToRgb(c); const y = 0.3 * r + 0.59 * g + 0.11 * b; return mix(c, rgbToHex(y, y, y), a); }

const UNKNOWN = { css: "repeating-linear-gradient(45deg, #cfc9bb 0 3px, #ded8c9 3px 6px)", solid: "#bdb7a8", known: false };
const JUNK = /^(weapon|spring|launch|tactical|comms|swim|backpack|helmet|animal|\d+|--)/;

function resolveToken(tok) {
  tok = tok.trim();
  if (!tok) return null;
  if (DIRECT[tok]) return DIRECT[tok];
  if (BASE[tok]) return BASE[tok];
  // translucent / transparent / clear → glassy version of the base
  let glass = false, t = tok;
  t = t.replace(/\b(translucent|transparent|transulent|clear)\b/g, () => { glass = true; return ""; }).trim();
  if (t === "" && glass) return lighten(BASE.blue, 0.55); // bare "clear"
  // modifiers
  let mod = null;
  t = t.replace(/\b(light|dark|dull|bright|deep|reddish)\b/, (m) => { mod = m; return ""; }).trim();
  let base = DIRECT[t] || BASE[t];
  if (!base) return null;
  if (mod === "light") base = lighten(base, 0.24);
  else if (mod === "dark" || mod === "deep") base = darken(base, 0.26);
  else if (mod === "dull") base = darken(desat(base, 0.4), 0.05);
  else if (mod === "bright") base = lighten(desat(base, -0.0), 0.06);
  else if (mod === "reddish") base = mix(base, BASE.red, 0.28);
  if (glass) base = lighten(base, 0.4);
  return base;
}

export function colorFor(raw) {
  const name = (raw || "").trim().toLowerCase();
  if (!name || JUNK.test(name)) return UNKNOWN;
  if (name.includes("/")) {
    const parts = name.split("/").map((s) => resolveToken(s)).filter(Boolean);
    if (parts.length >= 2) {
      const stops = parts.map((c, i) => `${c} ${Math.round(i / parts.length * 100)}% ${Math.round((i + 1) / parts.length * 100)}%`).join(", ");
      return { css: `linear-gradient(135deg, ${stops})`, solid: parts[0], known: true, two: true };
    }
    if (parts.length === 1) return { css: parts[0], solid: parts[0], known: true };
    return UNKNOWN;
  }
  const c = resolveToken(name);
  if (!c) return UNKNOWN;
  return { css: c, solid: c, known: true };
}

// small swatch that takes a raw DB colour string
export function AccSwatch({ color, size = 11, title }) {
  const r = colorFor(color);
  return <span className="acc-sw" title={title || color}
    style={{ width: size, height: size, background: r.css,
             border: "1px solid " + (r.known ? "rgba(0,0,0,.32)" : "rgba(0,0,0,.18)"),
             borderRadius: 2, display: "inline-block", flex: "0 0 auto" }}></span>;
}
