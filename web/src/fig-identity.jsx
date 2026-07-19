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
export function VariantBadge({ letter, count, onClick, title, lg }) {
  const label = letter || (count > 1 ? count + " variants" : null);
  if (!label) return null;
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag type={onClick ? "button" : undefined} className={"idvar" + (lg ? " idvar--lg" : "")} onClick={onClick}
         title={title || (letter ? undefined : count + " production variants")}>
      <span className={"lyr" + (lg ? " lyr--lg" : "")}><b></b></span>{label}
    </Tag>
  );
}

// Non-retail catalog rows (a convention/mail-in re-release sharing a
// code_name + version with a retail edition — see VARIANTS.md §7.5.2) look
// identical to the retail row everywhere else in the identity stack, so this
// is the one thing that distinguishes them on screen.
export function EditionTag({ context, lg }) {
  if (!context || context === 'retail') return null;
  const label = context === 'mail_in' ? 'MAIL-IN' : context.toUpperCase();
  return (
    <em className={"idedition" + (lg ? " idedition--lg" : "")}
        title={"Release edition — " + label.toLowerCase() + ", not the standard retail release"}>
      {label}
    </em>
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
