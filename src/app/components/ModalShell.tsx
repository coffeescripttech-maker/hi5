/**
 * ModalShell — responsive modal container that fits the mobile viewport.
 *
 * On phones it slides up as a bottom sheet (`items-end`, rounded top, full
 * width, `max-h-[88vh]` with an internal scroll so the confirm/actions area is
 * always reachable); on `sm+` it becomes the familiar centered dialog. The
 * internal panel uses `app-scroll` so long bodies scroll without moving the
 * whole page. Desktop appearance matches the app's existing
 * `rounded-2xl border shadow` modal style.
 *
 * Purely a container — the page keeps its own header/footer content, so
 * existing modal internals move over unchanged.
 */
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { registerNativeBackHandler } from '../services/nativeBack';

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  /** Tailwind max-width, e.g. "max-w-lg", "max-w-xl", "max-w-2xl". */
  maxWidth?: string;
  className?: string;
  /** Extra classes for the body wrapper — pass "p-0" when the inner markup
   *  already provides its own padded header/body/footer sections. */
  bodyClassName?: string;
  children: React.ReactNode;
}

export function ModalShell({
  open,
  onClose,
  title,
  description,
  maxWidth = 'max-w-lg',
  className = '',
  bodyClassName = 'px-5 py-4 sm:px-6 sm:py-5',
  children
}: ModalShellProps) {
  // Close the sheet/dialog on the native hardware back button.
  useEffect(() => {
    if (!open) return;
    return registerNativeBackHandler(() => {
      onClose();
      return true;
    });
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel — bottom sheet on phones, centered dialog from sm up */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`app-scroll relative flex max-h-[88vh] w-full flex-col overflow-y-auto rounded-t-2xl border border-gray-200 bg-white pb-safe shadow-2xl sm:rounded-2xl ${maxWidth} ${className}`}>
        {(title || description) && (
          <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 pb-3 pt-4 sm:px-6">
            <div className="min-w-0">
              {title && (
                <h2 className="text-base font-bold text-gray-900">{title}</h2>
              )}
              {description && (
                <p className="mt-0.5 text-xs text-gray-500">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="touch-target -mr-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300">
              <X size={18} />
            </button>
          </div>
        )}
        <div className={bodyClassName}>{children}</div>
      </div>
    </div>
  );
}
