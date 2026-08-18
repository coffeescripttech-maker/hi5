import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * DocumentViewer — paper-form preview for official DepEd sheets (SF1/SF5/SF9/SF10).
 *
 * Official forms keep their real paper dimensions (A4/Letter) at every
 * breakpoint — they are NOT reflowed into narrow cards. On phones (< md) the
 * paper renders inside a dedicated pan/zoom viewport:
 *   - drag/pan horizontally and vertically (native scroll)
 *   - pinch-to-zoom (two-finger gesture, confined to the document)
 *   - zoom +/−, percentage reset, and Fit controls
 * On md+ and in print the viewer is invisible: the paper renders at its
 * natural size exactly as before, and the existing @media print rules +
 * pdfRender capture (which clones only the #*-print-area subtree) are
 * untouched. The zoom is applied with the screen-only `zoom` property, so it
 * never affects printing or PDF export.
 */
interface DocumentViewerProps {
  children: React.ReactNode;
  /** Height of the mobile pan viewport. Default `h-[72vh]`. */
  heightClass?: string;
  /** Extra classes on the outer wrapper. */
  className?: string;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
const DEFAULT_ZOOM = 0.6;
const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export function DocumentViewer({
  children,
  heightClass = 'h-[72vh]',
  className = '',
}: DocumentViewerProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const applyZoom = useCallback((next: number) => {
    const clamped = clamp(next);
    zoomRef.current = clamped;
    setZoom(clamped);
  }, []);

  /** Scale so the paper's full width fits the viewport (never above 100%). */
  const fit = useCallback(() => {
    const surface = surfaceRef.current;
    const scaleEl = scaleRef.current;
    if (!surface || !scaleEl) return;
    // offsetWidth already reflects the current zoom; divide to get natural px.
    const natural = scaleEl.offsetWidth / zoomRef.current;
    const available = surface.clientWidth - 24; // surface p-3 = 12px each side
    applyZoom(Math.min(1, available / Math.max(natural, 1)));
  }, [applyZoom]);

  // Confined two-finger pinch. The surface is `touch-action: pan-x pan-y`, so
  // single-finger drags pan natively; when a second finger lands we take over
  // with a non-passive listener so the browser doesn't also scroll.
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    let active = false;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        active = true;
        pinchRef.current = {
          dist: Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          ),
          zoom: zoomRef.current,
        };
      } else {
        active = false;
        pinchRef.current = null;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (!active || e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      applyZoom(pinchRef.current.zoom * (d / pinchRef.current.dist));
    };
    const onEnd = () => {
      active = false;
      pinchRef.current = null;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [applyZoom]);

  return (
    <div className={className}>
      {/* Zoom toolbar — mobile only, hidden on print */}
      <div className="doc-viewer-toolbar no-print mb-2 flex items-center gap-1.5 md:hidden">
        <span className="mr-auto text-[11px] font-medium text-gray-500">
          Pinch to zoom · drag to pan
        </span>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => applyZoom(zoom - ZOOM_STEP)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-base font-bold text-gray-600 active:bg-gray-50"
        >
          −
        </button>
        <button
          type="button"
          aria-label="Reset zoom to 100%"
          onClick={() => applyZoom(1)}
          className="h-9 min-w-10 rounded-lg border border-gray-200 bg-white px-2 text-center text-xs font-semibold text-gray-600 active:bg-gray-50"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => applyZoom(zoom + ZOOM_STEP)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-base font-bold text-gray-600 active:bg-gray-50"
        >
          +
        </button>
        <button
          type="button"
          onClick={fit}
          className="h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-600 active:bg-gray-50"
        >
          Fit
        </button>
      </div>

      {/* Pan / zoom surface — bounded on phones, plain wrapper on md+ */}
      <div
        ref={surfaceRef}
        className={`doc-viewer-surface ${heightClass} overflow-auto rounded-xl border border-gray-200 bg-gray-100/60 p-3`}
        style={{ touchAction: 'pan-x pan-y' }}
      >
        <div
          ref={scaleRef}
          className="doc-viewer-scale w-full"
          style={{ ['--doc-zoom' as string]: zoom } as React.CSSProperties}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
