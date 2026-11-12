// shared/lines/gijoe.js — the G.I. Joe line profile (LINE_PROFILES.md).
// Every line-specific value the app shows (brand, team names + colors,
// vocabulary, Joe-only features) lives here instead of in components, so a
// future line (TMNT, Star Wars, …) is a new profile file + its own DB, not a
// code hunt. Read it through shared/line-profile.js, never import this directly.
// Pure data — imported by both the Vite client and the Node server.

export default {
  key: 'gijoe',

  brand: {
    name: 'G.I. Joe Collection',
    headerLines: ['G.I. JOE', 'COLLECTION'], // stacked wordmark beside the file-card mark
    tool: 'G.I. Joe Tracker',                // xlsx creator + server log line
  },

  // Teams ("factions" table). Order = facet chip order on Figures.
  //   key    — catalog code the API sends as fig.faction (server/catalog.js)
  //   dbName — factions.name in the DB
  //   label  — facet chip + active-filter token text
  //   tag    — FactionTag pill text (uppercase, spelled out)
  //   color  — CSS color for the pill/chip; points at an app.css palette token
  factions: [
    { key: 'JOE',      dbName: 'G.I. Joe',      label: 'G.I. Joe',      tag: 'G.I. JOE',      color: 'var(--olive)' },
    { key: 'COBRA',    dbName: 'Cobra',         label: 'Cobra',         tag: 'COBRA',         color: 'var(--crimson)' },
    { key: 'OKTOBER',  dbName: 'Oktober Guard', label: 'Oktober Guard', tag: 'OKTOBER GUARD', color: 'var(--oktober)' },
    { key: 'DREADNOK', dbName: 'Dreadnoks',     label: 'Dreadnoks',     tag: 'DREADNOK',      color: 'var(--dreadnok)' },
  ],

  // Line vocabulary — what this line calls its classification fields.
  labels: {
    team: 'Faction',      // factions table
    subTeam: 'Sub-team',  // sub_groups table (TAXONOMY.md)
    codeName: 'Code Name',
  },

  // Line-only features. Absent/false = the UI for it is not rendered.
  features: {
    fileCards: true,   // FILE_CARDS.md — "+ File Card" badges + the modal's File Card panel
    vehiclesNav: true, // "Vehicles · In Dev" nav link (OPEN_QUESTIONS.md Q15)
    // Parts Bin [Hose Balance] — generic shared parts tallied per figure
    hoseBalance: {
      codes: [
        { code: 'A1900', label: 'SHORT HOSE · 1½"', short: 'short' },
        { code: 'A1901', label: 'MEDIUM HOSE · 3"', short: 'med' },
        { code: 'A1902', label: 'LONG HOSE · 6"', short: 'long' },
      ],
    },
  },
};
