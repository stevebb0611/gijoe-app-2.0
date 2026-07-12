// fig-identity.jsx — shared atoms for figure-identity display (version chip,
// variant badge, vehicle tag). Every screen (Inventory, Detail, Add Figure,
// Parts Bin) renders these identically via one component instead of
// hand-rolling the markup, so field order/markup can't drift between screens
// the way it had (see OPEN_QUESTIONS_ISSUES_FOUND.md).
import React from 'react';

export function VersionChip({ version, lg }) {
  if (!version) return null;
  return <em className={"idver" + (lg ? " idver--lg" : "")}>{version}</em>;
}

// .idvar is shared by both states: a resolved single-copy variant letter, or
// a "N variants" count badge when browsing a catalog entry with none chosen
// yet — these are mutually exclusive (see fig-identity.js's priority notes),
// never both passed at once.
export function VariantBadge({ letter, count, onClick, title }) {
  const label = letter || (count > 1 ? count + " variants" : null);
  if (!label) return null;
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag type={onClick ? "button" : undefined} className="idvar" onClick={onClick}
         title={title || (letter ? undefined : count + " production variants")}>
      <span className="lyr"><b></b></span>{label}
    </Tag>
  );
}

export function VehicleTag({ vehicle, modal, inline }) {
  if (!vehicle) return null;
  return (
    <span className={"idveh" + (modal ? " idveh--modal" : "") + (inline ? " idveh--inline" : "")} title={"Vehicle driver — packaged with the " + vehicle}>
      <b>VEHICLE</b> {vehicle}
    </span>
  );
}
