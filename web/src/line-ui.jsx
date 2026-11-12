// line-ui.jsx — the line profile's UI pieces (LINE_PROFILES.md): the brand
// block every page header shares, the Vehicles nav link, and team-color props.
// Line-specific strings/colors come from shared/line-profile.js — never
// hard-code a brand name, team key or team color in a component.
import React from 'react';
import { LINE, factionByKey } from '../../shared/line-profile.js';

// Team color for a .wf-fac pill or a facet .chip: the profile color rides in as
// an inline --fac, and the --team modifier opts the element into app.css's
// colored + "Faction colors off" rules. Unknown keys get neither (uncolored).
export function facProps(key, base) {
  const color = factionByKey(key).color;
  return color
    ? { className: base + " " + base + "--team", style: { '--fac': color } }
    : { className: base, style: undefined };
}

// File-card outline mark + stacked wordmark. Click goes home (Figures).
export function BrandHome({ onNavigate }) {
  const [top, bottom] = LINE.brand.headerLines;
  return (
    <button type="button" className="inv-brand__home" onClick={() => onNavigate('figures')} aria-label="Go to Figures">
      <span className="inv-brand__mk" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 34 34" fill="none">
          <rect x="3.5" y="8" width="27" height="18" rx="2" stroke="#f3eee2" strokeWidth="2" strokeLinejoin="round" />
          <line x1="3.5" y1="12.5" x2="30.5" y2="12.5" stroke="#f3eee2" strokeWidth="2" />
          <rect x="6.5" y="14.5" width="7.5" height="8.5" stroke="#f3eee2" strokeWidth="2" strokeLinejoin="round" />
          <line x1="17.5" y1="16" x2="27.5" y2="16" stroke="#f3eee2" strokeWidth="2" strokeLinecap="round" />
          <line x1="17.5" y1="19" x2="27.5" y2="19" stroke="#f3eee2" strokeWidth="2" strokeLinecap="round" />
          <path d="M29 21.5 H21 L22.7 24.5 H29 Z" fill="#f3eee2" />
        </svg>
      </span>
      <span className="inv-brand__name">{top}<br/>{bottom}</span>
    </button>
  );
}

export function VehiclesNavLink() {
  if (!LINE.features.vehiclesNav) return null;
  return <a className="inv-nav__soon" href="GI Joe Tracker - Vehicles.html" title="Vehicles & Playsets — in development">Vehicles<em className="inv-nav__tag">In Dev</em></a>;
}
