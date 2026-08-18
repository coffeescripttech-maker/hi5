/**
 * HybridTable — desktop `<table>` + mobile stacked cards from the SAME rows.
 *
 * Wraps the existing desktop table markup (unchanged) inside a
 * `.hidden md:block` container and renders the `.md:hidden` card list beside
 * it, so mobile gets a compact touch-first list while the desktop table stays
 * pixel-identical. The card list is supplied by the page (each page has its
 * own column set and badge/action styling), so this is a thin, additive shell
 * rather than a full table abstraction.
 *
 * `countLabel`/`empty` slot in as the shared header, e.g.
 *   <HybridTable countLabel={...} empty={...} desktop={<table>…</table>}
 *                 mobile={<ul>…</ul>} />
 */
import React from 'react';

interface HybridTableProps {
  /** Existing desktop table wrapped in its own overflow-x-auto, if needed. */
  desktop: React.ReactNode;
  /** Mobile stacked-card list. */
  mobile: React.ReactNode;
  /** Optional header strip shown above both variants (count, actions). */
  header?: React.ReactNode;
  /** Optional empty state shown when there is no data. */
  empty?: React.ReactNode;
}

export function HybridTable({ desktop, mobile, header, empty }: HybridTableProps) {
  return (
    <div>
      {header}
      {empty ?? (
        <>
          <div className="hidden md:block">{desktop}</div>
          <div className="md:hidden">{mobile}</div>
        </>
      )}
    </div>
  );
}
