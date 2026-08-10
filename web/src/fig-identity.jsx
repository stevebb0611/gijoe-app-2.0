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

// Production-variant summary "[A|B|C]" — one letter per variant, solid-filled
// when the collection owns a copy of that letter, outlined/dim when it
// doesn't. Replaces the old "N variants" count text everywhere it appeared.
// Static display only — VariantBadge's clickable single-letter mode (above)
// remains the control for changing which variant a specific copy is pinned to.
export function VariantBracket({ variants, owned, lg }) {
  if (!variants || variants.length < 2) return null;
  return (
    <span className={"idvarbr" + (lg ? " idvarbr--lg" : "")}
          title={variants.length + " production variants — filled = in your collection"}>
      {variants.map((v, i) => (
        <span key={v.letter || i} className={"idvarbr__l" + (owned && owned.has(v.letter) ? " is-owned" : "")}>{v.letter}</span>
      ))}
    </span>
  );
}

// Non-retail catalog rows (a convention/mail-in re-release sharing a
// code_name + version with a retail edition — see VARIANTS.md §7.5.2) look
// identical to the retail row everywhere else in the identity stack, so this
// is the one thing that distinguishes them on screen.
//
// Within 'convention', a second owner-confirmed split (migration 018)
// further distinguishes a genuinely convention-only figure (conventionKind
// 'figure', or unset/NULL — the default bucket for unreviewed rows) from a
// retail figure re-released at a convention with different bundled
// accessories only (conventionKind 'accessories') — the latter gets a
// quieter sub-badge since it isn't a standalone new figure.
export function EditionTag({ context, conventionKind, lg }) {
  if (!context || context === 'retail') return null;
  const quiet = context === 'convention' && conventionKind === 'accessories';
  const label = context === 'mail_in' ? 'MAIL-IN'
    : context === 'mail_order' ? 'MAIL-ORDER'
    : quiet ? 'CONV. ACCESSORIES'
    : context.toUpperCase();
  const title = quiet
    ? "Convention release — same figure as retail, bundled with different/exclusive accessories"
    : "Release edition — " + label.toLowerCase() + ", not the standard retail release";
  return (
    <em className={"idedition" + (quiet ? " idedition--quiet" : "") + (lg ? " idedition--lg" : "")}
        title={title}>
      {label}
    </em>
  );
}

// Multi-pack "set" grouping (migration 015/016) — a fun bonus completionist
// display over already-owned figures, not a new ownable entity. Fixed "SET"
// label (there will be dozens of different set names over time, so keeping
// row chrome uniform matters more than showing the name inline). A static
// pointer tooltip only — the live owned/required progress now lives solely
// in the Special Release set card (set-card.jsx), not recomputed here too.
export function SetTag({ sets, lg }) {
  if (!sets || !sets.length) return null;
  const title = "Part of " + sets.map((s) => s.name).join('; ') + " — see Special Release";
  return (
    <em className={"idset" + (lg ? " idset--lg" : "")} title={title}>
      SET
    </em>
  );
}

// Sub-team tag (TAXONOMY.md "Sub-team" — sub_group_id, ~31% of figures).
// Sparse and optional by design, so styled as a quieter mono outline rather
// than a bold accent pill like EditionTag/SetTag — it's a bonus classification,
// not core identity. 23 possible values means no per-team color scheme.
export function SubGroupTag({ subGroup, lg }) {
  if (!subGroup) return null;
  return (
    <em className={"idsubteam" + (lg ? " idsubteam--lg" : "")} title={subGroup + " — sub-team"}>
      {subGroup.toUpperCase()}
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
