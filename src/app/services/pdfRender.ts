/**
 * Server-side PDF rendering for certificates.
 *
 * The client-side pdfmake conversion re-implements layout and never quite
 * matches the browser's Print Preview. Instead, we serialize the
 * *already-rendered* certificate into a self-contained HTML document — every
 * computed style inlined, images + fonts embedded as data URLs, @page rules
 * attached — and POST it to /api/pdf/render. There, puppeteer-core drives the
 * system Chrome to print it to PDF, so the file is rendered by the same engine
 * as the Print Preview and matches it exactly.
 */

import { api } from "./api";
import {
  fetchAsBase64,
  inlineRemoteImages,
  replaceFormControls,
} from "./pdfExport";
import tinosRegular from "../../assets/fonts/Tinos-Regular.ttf";
import tinosBold from "../../assets/fonts/Tinos-Bold.ttf";

export interface PdfRenderOptions {
  /** ID of the element to capture */
  elementId: string;
  /** Output filename (without extension) */
  filename?: string;
  /** Page orientation */
  orientation?: "portrait" | "landscape";
  /** Page format */
  format?: "a4" | "letter" | "legal";
}

/* ── Computed-style inlining for the standalone page ── */

/**
 * Properties that would break or misrender a print page if copied inline.
 * Layout-critical properties (display, flex, padding, margins, borders,
 * typography, colors, box-sizing…) are intentionally kept.
 */
const DENY_EXACT = new Set([
  "position",
  "inset",
  "top",
  "right",
  "bottom",
  "left",
  "z-index",
  "opacity",
  "filter",
  "backdrop-filter",
  "box-shadow",
  "text-shadow",
  "overflow",
  "overflow-x",
  "overflow-y",
  "text-overflow",
  "white-space",
  "cursor",
  "user-select",
  "pointer-events",
  "caret-color",
  "resize",
  "visibility",
  "will-change",
  "contain",
  "content-visibility",
  "float",
  "clear",
  "widows",
  "orphans",
  "appearance",
  "touch-action",
  "text-size-adjust",
  "mix-blend-mode",
  "isolation",
]);

const DENY_PREFIXES = [
  "transition",
  "animation",
  "transform",
  "translate",
  "rotate",
  "scale",
  "outline",
  "scroll-",
  "overscroll-",
  "clip",
  "mask",
  "offset-",
  "-webkit-",
];

function isDenied(prop: string): boolean {
  if (DENY_EXACT.has(prop)) return true;
  for (const prefix of DENY_PREFIXES) {
    if (prop.startsWith(prefix)) return true;
  }
  return false;
}

/** Width/height utilities that should stay fixed (e.g. w-64, sm:w-20). */
const SIZE_UTILITY_RE = /(?:^|\s)(?:[a-z]+:)?[wh]-[a-z0-9/]+/;
/** Fluid width/height utilities that must reflow, not stay fixed. */
const FLUID_SIZE_RE = /(?:^|\s)(?:[a-z]+:)?[wh]-(?:full|screen|fit|max|min)/;
/** min-w-* / max-w-* / min-h-* / max-h-* utilities. */
const MINMAX_RE = /(?:^|\s)(?:[a-z]+:)?(?:min|max)-[wh]-/;

/**
 * Whether an element's laid-out width/height should be preserved verbatim.
 * Images and tables need their measured size; blocks that rely on reflow to
 * the page width must NOT get their on-screen pixel width pinned, otherwise
 * the print page would keep the ~896px on-screen layout instead of reflowing
 * to the 816px letter page the way the Print Preview does.
 */
function shouldPinSize(el: HTMLElement, cls: string): boolean {
  const tag = el.tagName;
  if (tag === "IMG" || tag === "TABLE") return true;
  if (el.style.width || el.style.height) return true; // explicit inline size
  return SIZE_UTILITY_RE.test(cls) && !FLUID_SIZE_RE.test(cls);
}

/** True when `value` can be inlined safely on a reflowing block. */
function isFluidSize(value: string): boolean {
  if (value.endsWith("%")) return true;
  return (
    value === "auto" ||
    value === "fit-content" ||
    value === "max-content" ||
    value === "min-content" ||
    value === "none" ||
    value === "0px"
  );
}

/**
 * Deep-walk `root` and copy every computed style property onto each element as
 * inline styles, so the serialized HTML renders identically in a bare page
 * that has no Tailwind stylesheet. The generic `serif` family is remapped to
 * the embedded Tinos font so the @font-face in the document actually applies.
 */
function inlineComputedStylesForChromium(root: HTMLElement) {
  const walk = (el: Element) => {
    if (el.nodeType !== Node.ELEMENT_NODE) return;
    const hEl = el as HTMLElement;
    const cs = getComputedStyle(hEl);

    // Drop anything marked not-print (and its subtree).
    if (hEl.classList.contains("no-print")) {
      hEl.style.display = "none";
      return;
    }

    const cls = hEl.className || "";
    const pinSize = shouldPinSize(hEl, cls);

    for (let i = 0; i < cs.length; i++) {
      const prop = cs[i];
      if (isDenied(prop)) continue;

      const value = cs.getPropertyValue(prop);

      // Pixel widths/heights on reflowing blocks are skipped so content
      // re-wraps to the letter page width, like the Print Preview.
      if (prop === "width" || prop === "height") {
        if (!pinSize && !isFluidSize(value)) continue;
      }
      // min/max sizes are only preserved when they were explicitly set.
      if (
        (prop.startsWith("min-") || prop.startsWith("max-")) &&
        /-[wh]$/.test(prop) &&
        !pinSize &&
        !MINMAX_RE.test(cls) &&
        !(hEl.style[prop as "minWidth"] || hEl.style[prop as "maxWidth"])
      ) {
        continue;
      }

      hEl.style.setProperty(prop, value);
    }

    // Make the embedded Tinos font apply wherever the page used `serif`.
    const family = cs.fontFamily;
    if (family === "serif" || family === '"serif"') {
      hEl.style.setProperty("font-family", "'Tinos', serif");
    }

    for (let i = 0; i < el.children.length; i++) walk(el.children[i]);
  };
  walk(root);
}

/**
 * Reset the captured root so it behaves like the Print Preview's rendition of
 * the certificate: full page width, no card chrome (border/radius/shadow),
 * no clipping, static position.
 */
function fixRootForPrint(root: HTMLElement) {
  root.style.position = "static";
  root.style.left = "auto";
  root.style.right = "auto";
  root.style.top = "auto";
  root.style.bottom = "auto";
  root.style.width = "100%";
  root.style.maxWidth = "none";
  root.style.minWidth = "0";
  root.style.margin = "0";
  root.style.border = "none";
  root.style.borderRadius = "0";
  root.style.boxShadow = "none";
  root.style.overflow = "visible";
  root.style.display = "block";
}

/* ── Standalone document assembly ── */

const PAGE_SIZE = { letter: "letter", a4: "a4", legal: "legal" } as const;

async function buildPdfDocumentHtml(
  innerHtml: string,
  opts: { orientation: "portrait" | "landscape"; format: "a4" | "letter" | "legal" }
): Promise<string> {
  const [regular, bold] = await Promise.all([
    fetchAsBase64(tinosRegular),
    fetchAsBase64(tinosBold),
  ]);
  const pageSize = PAGE_SIZE[opts.format] || "letter";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @page { size: ${pageSize} ${opts.orientation}; margin: 0; }
  html, body { margin: 0; padding: 0; }
  @font-face {
    font-family: 'Tinos';
    font-style: normal;
    font-weight: 400;
    src: url(data:font/ttf;base64,${regular}) format('truetype');
  }
  @font-face {
    font-family: 'Tinos';
    font-style: normal;
    font-weight: 700;
    src: url(data:font/ttf;base64,${bold}) format('truetype');
  }
</style>
<script>
  // Kick off both Tinos weights so document.fonts.ready (awaited server-side)
  // actually waits for them before printing.
  (function () {
    try {
      document.fonts.load("16px Tinos");
      document.fonts.load("bold 16px Tinos");
    } catch (e) {}
  })();
</script>
</head>
<body>
${innerHtml}
</body>
</html>`;
}

/* ── Public API ── */

/**
 * Serialize a rendered element into a self-contained HTML document ready for
 * /api/pdf/render: full computed styles inline, images/fonts embedded,
 * @page rules attached.
 */
export async function serializeElementForPdf(
  elementId: string,
  opts: { orientation: "portrait" | "landscape"; format: "a4" | "letter" | "legal" }
): Promise<string> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element #${elementId} not found`);

  // Clone into the live DOM, off-screen, so inherited styles resolve and
  // images load — the same trick pdfExport uses for html-to-pdfmake.
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.position = "absolute";
  clone.style.left = "-9999px";
  clone.style.top = "0";
  clone.style.width = element.offsetWidth + "px";
  (element.parentNode ?? document.body).insertBefore(clone, element);

  try {
    inlineComputedStylesForChromium(clone);
    replaceFormControls(clone);
    await inlineRemoteImages(clone);
    fixRootForPrint(clone);
    return await buildPdfDocumentHtml(clone.outerHTML, opts);
  } finally {
    if (clone.parentNode) {
      clone.parentNode.removeChild(clone);
    }
  }
}

/**
 * Serialize the element, render it to PDF on the server, and auto-download it.
 * Throws on failure so the caller can fall back to the client-side renderer.
 */
export async function downloadRenderedPdf(opts: PdfRenderOptions): Promise<void> {
  const {
    elementId,
    filename = "document",
    orientation = "portrait",
    format = "letter",
  } = opts;

  const html = await serializeElementForPdf(elementId, { orientation, format });

  const response = await api.postBlob("/pdf/render", { html, filename });

  if (!response.ok) {
    let message = `PDF render failed (${response.status})`;
    try {
      const body = await response.json();
      if (body && typeof body.error === "string") message = body.error;
    } catch {
      // not JSON — keep the generic message
    }
    throw new Error(message);
  }

  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/);
  const serverName = (match ? match[1] : `${filename}.pdf`).replace(/\.pdf$/i, "");
  const safeName = serverName || filename;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
