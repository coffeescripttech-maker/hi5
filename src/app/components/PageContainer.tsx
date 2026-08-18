/**
 * PageContainer — standard page gutter + vertical rhythm.
 *
 * Mobile-first: tight `px-3` gutter and compact `space-y-4` on phones,
 * widening to the desktop `max-w-6xl` centered layout at sm/lg. Replaces the
 * ad-hoc `max-w-6xl mx-auto space-y-5` wrappers page-by-page; purely additive
 * (desktop spacing is preserved exactly: `sm:space-y-5` matches the old
 * `space-y-5`).
 */
import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={`mx-auto w-full max-w-6xl space-y-4 px-3 sm:px-4 sm:space-y-5 lg:px-6 ${className}`}>
      {children}
    </div>
  );
}
