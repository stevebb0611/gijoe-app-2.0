// shared/line-profile.js — the active line profile + lookups (LINE_PROFILES.md).
// Phase 0: G.I. Joe is the only line, so this is hard-wired to it. Phase 1 (line
// picker) replaces the import below with a registry lookup; call sites stay put.
// Imported by both the Vite client and the Node server.
import gijoe from './lines/gijoe.js';

export const LINE = gijoe;

const BY_KEY = new Map(LINE.factions.map(f => [f.key, f]));
const BY_DB_NAME = new Map(LINE.factions.map(f => [f.dbName, f]));

// Faction by catalog code (fig.faction). Unknown codes get a neutral stand-in
// that shows the raw code, matching the old FAC_LABELS[k] || k fallbacks.
export function factionByKey(key) {
  return BY_KEY.get(key) || { key, dbName: key, label: key, tag: key, color: null };
}

// Team color for a .wf-fac pill or a facet .chip (client only): the profile
// color rides in as an inline --fac, and the --team modifier opts the element
// into app.css's colored + "Faction colors off" rules. Unknown keys get neither.
export function facProps(key, base) {
  const color = factionByKey(key).color;
  return color
    ? { className: base + ' ' + base + '--team', style: { '--fac': color } }
    : { className: base, style: undefined };
}

// factions.name → catalog code (server/catalog.js). Unknown names pass through.
export function factionCodeForDbName(name) {
  return BY_DB_NAME.get(name)?.key || name;
}
