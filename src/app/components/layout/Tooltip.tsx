/**
 * Accessible tooltip for icon-only controls.
 *
 * Replaces the original hover-only NavTooltip: shows on both mouse hover and
 * keyboard focus (focus/blur bubble from the wrapped button), is rendered in
 * a portal at `position: fixed` so it is never clipped by the sidebar's
 * `overflow` scroll containers, and announces via `role="tooltip"`.
 */
import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  label: string;
  children: React.ReactNode;
}

export function Tooltip({ label, children }: TooltipProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
  }, []);

  const hide = useCallback(() => setPos(null), []);

  return (
    <div
      ref={ref}
      className="relative flex w-full items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}>
      {children}
      {pos &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[100] -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-xl animate-fade-in"
            style={{ top: pos.top, left: pos.left }}>
            {label}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-gray-900" />
          </div>,
          document.body
        )}
    </div>
  );
}
