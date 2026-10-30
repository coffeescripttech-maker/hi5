/**
 * Edited-fields menu for the school forms (docs/MAJOR_CHANGES_IN_FORMS.txt
 * rules 11-13, Phase 3).
 *
 * A compact dropdown in each form's header bar that lists every stored or
 * unsaved edit with a human label and offers, per rule:
 *  - rule 11: per-item **Reset** (removes the stored edit so the form shows
 *    the system value again — carried-over prefills are hidden with an
 *    explicit empty edit instead) + an "Reset all" action.
 *  - rule 12: items whose underlying system value changed since the edit
 *    carry a "system value changed" tag, with **Keep** (accept the new
 *    baseline) or Reset.
 *  - rule 13: if a save was refused because someone else edited the same
 *    field after this form was opened, a banner offers
 *    [Overwrite changes] / [Reload saved values].
 *
 * The open panel is portaled to <body> with fixed positioning: the form
 * header cards are overflow-hidden and the printable sheets live in
 * transformed (scaled) boxes, so a plain absolutely-positioned dropdown
 * would be clipped or hidden beneath them.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, RotateCcw, ListChecks } from 'lucide-react';
import type { UseFormEditsApi, EditedItem } from '../hooks/useFormEdits';

export function FormEditsMenu({
  api,
  canSave,
}: {
  api: UseFormEditsApi;
  canSave: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'reset' | 'keep' | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  if (!canSave) return null;
  const items = api.listEdits();
  if (items.length === 0 && !api.hasConflict) return null;
  const sysChangedCount = items.filter(i => i.sysChanged).length;

  const run = async (
    kind: 'reset' | 'keep',
    fn: (its: EditedItem[]) => Promise<number>,
    its: EditedItem[]
  ) => {
    setBusy(kind);
    setMenuError(null);
    try {
      const n = await fn(its);
      if (n === 0) {
        setMenuError(
          kind === 'reset' ? 'Nowhere to reset.' : 'Baselines are already current.'
        );
      }
      setOpen(false);
    } catch (err: any) {
      setMenuError(err?.message || 'Action failed.');
    } finally {
      setBusy(null);
    }
  };

  // Close when clicking outside the button / panel, or pressing Escape.
  useEffect(() => {
    const handlePointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('pointerdown', handlePointer);
      document.addEventListener('keydown', handleKey);
    }
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Portal placement: anchored under the button, right-aligned to it,
  // clamped to the viewport. Recomputed on scroll/resize so it follows the
  // page even when the printable sheet's scale container scrolls.
  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const width = Math.min(vw * 0.92, 384);
      let left = rect.right - width;
      left = Math.max(8, Math.min(left, vw - width - 8));
      setPos({ top: rect.bottom + 6, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-xl text-sm font-medium transition shadow-sm">
        <ListChecks size={14} />
        Edited fields
        <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-amber-100 text-[11px] font-bold text-amber-700">
          {items.length}
        </span>
        {sysChangedCount > 0 && (
          <span
            className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-rose-100 text-[11px] font-bold text-rose-700"
            title={`${sysChangedCount} changed under the record`}>
            Δ{sysChangedCount}
          </span>
        )}
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{ top: pos.top, left: pos.left, width: 'min(92vw, 384px)' }}
          className="fixed z-[100] bg-white border border-gray-200 rounded-xl shadow-lg no-print max-h-[calc(100dvh-6rem)] flex flex-col overflow-hidden">
          {/* rule 13 — concurrent edits */}
          {api.hasConflict && (
            <div className="m-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-[12px] text-rose-800">
              <p className="font-bold">Changed by someone else</p>
              <p className="mt-0.5">
                {api.conflicts.length} field
                {api.conflicts.length === 1 ? '' : 's'} were saved by another user
                after this form was opened ({api.conflicts
                  .map(c => c.field_key.replace(/:/g, ' · '))
                  .join(', ')}
                ).
              </p>
              <div className="flex gap-2 mt-1.5">
                <button
                  className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 font-semibold text-[11px] disabled:opacity-50"
                  disabled={api.saving}
                  onClick={() => api.resolveConflict('overwrite')}>
                  Keep mine, overwrite
                </button>
                <button
                  className="rounded-lg bg-white border border-rose-300 text-rose-700 px-2.5 py-1 font-semibold text-[11px] disabled:opacity-50"
                  disabled={api.saving || api.loading}
                  onClick={() => api.resolveConflict('reload')}>
                  Load theirs, drop mine
                </button>
              </div>
            </div>
          )}

          <div className="overflow-y-auto p-2 space-y-1">
            {items.length === 0 && (
              <p className="text-[12px] text-gray-500 px-1 py-2">No edits stored.</p>
            )}
            {items.map(item => (
              <div
                key={`${item.sid ?? 0}|${item.fieldKey}`}
                className="rounded-lg border border-gray-100 hover:bg-gray-50 px-2 py-1.5 text-[12px]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-700 truncate">{item.label}</p>
                    <p className="text-gray-500 truncate">
                      “{item.value === '' ? '(cleared)' : item.value}”
                      <span className="text-gray-400"> · {item.unsaved ? 'unsaved' : 'saved'}</span>
                      {item.sysChanged && (
                        <span className="ml-1 rounded bg-rose-100 px-1 text-[10px] font-bold text-rose-700">
                          system value changed
                        </span>
                      )}
                    </p>
                    {item.sysChanged && (
                      <p className="text-[11px] text-gray-400 truncate">
                        was on “{item.currentSystem === '' ? '(blank)' : item.currentSystem}”
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {item.sysChanged && !item.unsaved && (
                      <button
                        className="rounded-md border border-gray-200 bg-white text-[11px] px-1.5 py-0.5 hover:bg-gray-50 disabled:opacity-40"
                        title="Accept the new system value as this edit's baseline (rule 12)"
                        disabled={busy !== null}
                        onClick={() => run('keep', api.refreshBaseline, [item])}>
                        {busy === 'keep' ? <Loader2 size={11} className="animate-spin" /> : 'Keep'}
                      </button>
                    )}
                    <button
                      className="rounded-md border border-gray-200 bg-white text-[11px] px-1.5 py-0.5 hover:bg-gray-50 text-rose-600 disabled:opacity-40"
                      title="Reset to system value (rule 11)"
                      disabled={busy !== null}
                      onClick={() => run('reset', api.resetEdits, [item])}>
                      {busy === 'reset' ? <Loader2 size={11} className="animate-spin" /> : 'Reset'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {items.length > 0 && (
            <div className="p-2 pt-0">
              <button
                className="w-full rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-[12px] font-semibold px-2 py-1.5 hover:bg-rose-100 disabled:opacity-40"
                disabled={busy !== null}
                onClick={() => run('reset', api.resetEdits, items)}>
                <RotateCcw size={12} className="inline mr-1" />
                Reset all {items.length} listed field{items.length === 1 ? '' : 's'}
                {api.dirtyCount > 0 && ' (also discards unsaved)'}
              </button>
            </div>
          )}

          {menuError && (
            <p className="px-2 pb-2 text-[11px] text-rose-600">{menuError}</p>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
