// search-util.js — normalize free-text search input so punctuation
// differences don't cause false misses. Periods are dropped (so acronym
// names collapse together: "H.E.A.T. Viper" / "HEAT Viper" / "H.E.A.T.-Viper"
// all normalize the same), and dashes become spaces (so "Dr Mindbender" /
// "Dr. Mindbender" and "Rock Viper" / "Rock-Viper" line up too) while real
// word boundaries are preserved.
export function normalizeSearch(s) {
  return (s || '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
