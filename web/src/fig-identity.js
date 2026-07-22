// fig-identity.js — plain-string form of the name+version identity order
// used everywhere else via <VersionChip> (fig-identity.jsx), for the one
// place that needs inline sentence text rather than JSX (Parts Bin).
export function figIdentityText({ name, version } = {}) {
  return [name, version].filter(Boolean).join(' ');
}

// series_id 15's sentinel "year" (gijoe_collection.sql) — the Special
// Release bucket (convention exclusives, mail-in premiums, mail-order
// releases), not a real chronological year. Every screen that prints a
// catalog figure's year must go through this instead of interpolating the
// raw number, or a sentinel-block figure shows a literal "9999". The
// heading is deliberately generic — the per-figure EditionTag badge
// (CONVENTION / MAIL-IN / MAIL-ORDER) is what disambiguates within it.
export const SPECIAL_RELEASE_YEAR = 9999;
export function formatYear(year) {
  return year === SPECIAL_RELEASE_YEAR ? 'Special Release' : String(year);
}
