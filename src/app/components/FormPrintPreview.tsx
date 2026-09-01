/**
 * FormPrintPreview — confirmation preview shown before printing a school form.
 *
 * Renders the EXACT document that will print/export by reusing the same
 * serializer the PDF pipeline uses (serializeElementForPdf: computed styles
 * inlined, images/fonts embedded, @page rules attached) inside a sandboxed
 * iframe. The user reviews it, then chooses:
 *   • Edit      → closes the preview and returns to the fillable form
 *   • Print     → prints the previewed document (iframe print, with a
 *                 window.print() fallback)
 *   • Export PDF→ runs the form's existing server-rendered PDF handler
 *
 * Used by SF1 / SF5 / SF9 / SF10 so no form goes straight to print.
 */
import { useEffect, useRef, useState } from "react";
import { Eye, Loader2, PencilLine, Printer, X, FileDown, AlertTriangle } from "lucide-react";
import { serializeElementForPdf } from "../services/pdfRender";

interface FormPrintPreviewProps {
  open: boolean;
  title: string;
  /** ID of the on-screen element the print/PDF pipeline captures. */
  elementId: string;
  /** Closes the preview — "Edit" (back to the form). */
  onClose: () => void;
  /** Confirmed PDF export — the form's existing handleExportPdf. */
  onExportPdf?: () => void;
  exporting?: boolean;
  orientation?: "portrait" | "landscape";
  format?: "a4" | "letter" | "legal";
}

export function FormPrintPreview({
  open,
  title,
  elementId,
  onClose,
  onExportPdf,
  exporting = false,
  orientation = "landscape",
  format = "letter",
}: FormPrintPreviewProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Serialize the live form element into the standalone print document each
  // time the preview opens. Identical output to downloadRenderedPdf's input,
  // so what you see here is exactly what prints/exports.
  useEffect(() => {
    if (!open) {
      setHtml(null);
      setFailed(false);
      return;
    }
    let cancelled = false;
    serializeElementForPdf(elementId, { orientation, format })
      .then(doc => {
        if (!cancelled) setHtml(doc);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, elementId, orientation, format]);

  if (!open) return null;

  const handlePrint = () => {
    try {
      const win = iframeRef.current?.contentWindow;
      if (win) {
        win.focus();
        win.print();
        return;
      }
    } catch {
      /* iframe print blocked — fall back to the page's print stylesheet */
    }
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:hidden" role="dialog" aria-modal="true" aria-label={`${title} print preview`}>
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <Eye size={16} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">{title} — Print Preview</h3>
              <p className="text-[11px] text-gray-400">Review the document before printing or exporting.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Preview body */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          {failed ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <AlertTriangle size={28} className="text-amber-400" />
              <p className="text-sm font-medium text-gray-600">Preview could not be rendered.</p>
              <p className="max-w-md text-xs text-gray-400">
                You can still print directly or go back and try the PDF export.
              </p>
            </div>
          ) : html === null ? (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <Loader2 size={24} className="animate-spin text-gray-400" />
              <p className="text-xs text-gray-400">Preparing preview…</p>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              title={`${title} preview`}
              srcDoc={html}
              className="h-full min-h-[420px] w-full rounded-lg border border-gray-200 bg-white shadow-sm"
            />
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <PencilLine size={14} className="text-amber-500" />
            Edit
          </button>
          {onExportPdf && (
            <button
              onClick={onExportPdf}
              disabled={exporting || failed}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} className="text-red-500" />}
              Export PDF
            </button>
          )}
          <button
            onClick={handlePrint}
            disabled={failed}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:bg-gray-300"
          >
            <Printer size={14} />
            Print
          </button>
        </div>
      </div>
    </div>
  );
}