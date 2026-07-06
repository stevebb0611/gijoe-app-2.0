// fig-identity.js — plain-string form of the name+version identity order
// used everywhere else via <VersionChip> (fig-identity.jsx), for the one
// place that needs inline sentence text rather than JSX (Parts Bin).
export function figIdentityText({ name, version } = {}) {
  return [name, version].filter(Boolean).join(' ');
}
