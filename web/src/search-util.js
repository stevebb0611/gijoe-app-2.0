// search-util.js — normalize free-text search input so punctuation
// differences don't cause false misses. Periods are dropped (so acronym
// names collapse together: "H.E.A.T. Viper" / "HEAT Viper" / "H.E.A.T.-Viper"
// all normalize the same), dashes become spaces ("Dr Mindbender" / "Dr.
// Mindbender", "Rock Viper" / "Rock-Viper"), and apostrophes are dropped
// ("T'Jbang" / "TJbang"). "&" and the word "and" both collapse to "n" so
// cross-release joiner spelling doesn't matter — catalog names for the same
// pairing aren't consistent release to release (e.g. "Rock 'N Roll" v1/v3/v4
// vs "Rock & Roll" v2; also affects real two-name pairs like "Law & Roll"—
// er, "Law & Order", "Mutt & Junkyard") — while real word boundaries are
// otherwise preserved.
export function normalizeSearch(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[.']/g, '')
    .replace(/&/g, ' and ')
    .replace(/-/g, ' ')
    .replace(/\band\b/g, 'n')
    .replace(/\s+/g, ' ')
    .trim();
}
