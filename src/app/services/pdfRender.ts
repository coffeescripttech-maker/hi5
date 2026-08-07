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
  /**
   * Extra stylesheet rules to embed in the standalone page — e.g. an
   * `@media print { … }` block carrying `@page`, page breaks, or the zoom that
   * scales the SF registers down to the page width. When omitted, any
   * print-related `<style>` blocks already in the document are captured
   * automatically (SF1/SF5/SF9/SF10 all have one; certificates have none).
   */
  printCss?: string;
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
  "-", // any vendor / internal / custom property (-webkit-*, --tw-*, --color-*)
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

/** Elements processed per chunk before yielding to the event loop. */
const INLINE_CHUNK = 16;

let uaBaselineFrame: HTMLIFrameElement | null = null;
const uaBaselines = new Map<string, CSSStyleDeclaration>();

/**
 * Computed style of a bare element of `tag` inside a pristine (stylesheet-less)
 * iframe — exactly what the standalone print page would give that element
 * before we inline anything. Any property already at this value can be skipped:
 * the print page renders it identically without an inline style, and every
 * skipped write avoids a style-invalidation pass. (Copying ~750 properties onto
 * every element made serialization take seconds; the diff is ~10x smaller.)
 */
function getUaBaseline(tag: string): CSSStyleDeclaration {
  let base = uaBaselines.get(tag);
  if (base) return base;
  if (!uaBaselineFrame) {
    uaBaselineFrame = document.createElement("iframe");
    uaBaselineFrame.style.display = "none";
    document.body.appendChild(uaBaselineFrame);
  }
  const idoc = uaBaselineFrame.contentDocument!;
  const el = idoc.createElement(tag.toLowerCase());
  idoc.body.appendChild(el);
  base = idoc.defaultView!.getComputedStyle(el);
  uaBaselines.set(tag, base);
  return base;
}

/**
 * Deep-walk `root` and copy every computed style property onto each element as
 * inline styles, so the serialized HTML renders identically in a bare page
 * that has no Tailwind stylesheet. The generic `serif` family is remapped to
 * the embedded Tinos font so the @font-face in the document actually applies.
 *
 * The walk is breadth-first and yields between chunks, so the main thread
 * stays responsive (the "exporting" spinner can paint and clicks register)
 * while serialization is in flight.
 */
async function inlineComputedStylesForChromium(root: HTMLElement) {
  const queue: Element[] = [root];
  while (queue.length) {
    const batch = queue.splice(0, INLINE_CHUNK);
    for (const el of batch) {
      const hEl = el as HTMLElement;
      const cs = getComputedStyle(hEl);

      // Drop anything marked not-print (and its subtree).
      if (hEl.classList.contains("no-print")) {
        hEl.style.display = "none";
        continue;
      }

      const baseline = getUaBaseline(hEl.tagName);
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

        // Skip properties already at the bare-UA default — the standalone page
        // renders them identically without an inline style. Border properties
        // are always inlined: their used value depends on border-style, so the
        // "0px" width measured on a style-less baseline is NOT the 0px you get
        // once border-style: solid is applied — the UA falls back to the 3px
        // `medium` default and draws a box around every element.
        if (
          !prop.startsWith("border") &&
          value === baseline.getPropertyValue(prop)
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

      for (let i = 0; i < el.children.length; i++) queue.push(el.children[i]);
    }
    if (queue.length) {
      // Give the browser a frame to paint the spinner / handle input.
      await new Promise((r) => setTimeout(r, 0));
    }
  }
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

/** Base64 of the embedded Tinos fonts — fetched once, reused across exports. */
let tinosFontsCache: { regular: string; bold: string } | null = null;
async function getTinosFonts(): Promise<{ regular: string; bold: string }> {
  if (!tinosFontsCache) {
    const [regular, bold] = await Promise.all([
      fetchAsBase64(tinosRegular),
      fetchAsBase64(tinosBold),
    ]);
    tinosFontsCache = { regular, bold };
  }
  return tinosFontsCache;
}

async function buildPdfDocumentHtml(
  innerHtml: string,
  opts: { orientation: "portrait" | "landscape"; format: "a4" | "letter" | "legal" },
  printCss = ""
): Promise<string> {
  const { regular, bold } = await getTinosFonts();
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
${printCss ? `\n<style>\n${printCss}\n</style>` : ""}
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
 * Collect every print-related stylesheet block currently in the document.
 *
 * The SF forms (SF1/SF5/SF9/SF10) rely on @media print rules — page size and
 * margins (@page), .no-print hiding, page breaks, and the zoom that scales the
 * wide register down to the page width — none of which computed-style inlining
 * captures (they only apply while printing). Puppeteer prints with the print
 * media type active, so embedding the same rules in the standalone page makes
 * the PDF match the browser's Print Preview exactly. Document order is
 * preserved so @page overrides resolve like the live page's cascade.
 * Certificates have no persistent print styles, so this returns "" for them.
 */
function collectPrintCss(): string {
  const blocks: string[] = [];
  for (const style of document.querySelectorAll("style")) {
    const css = style.textContent || "";
    if (css.includes("@media print") || css.includes("@page")) {
      blocks.push(css);
    }
  }
  return blocks.join("\n");
}

/**
 * Serialize a rendered element into a self-contained HTML document ready for
 * /api/pdf/render: full computed styles inline, images/fonts embedded,
 * @page rules attached.
 */
export async function serializeElementForPdf(
  elementId: string,
  opts: { orientation: "portrait" | "landscape"; format: "a4" | "letter" | "legal"; printCss?: string }
): Promise<string> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element #${elementId} not found`);

  // Yield once before any heavy work: the caller (handleExport) just set its
  // "exporting" state, and this frame is the only chance the loading spinner
  // has to paint before style inlining takes over the main thread.
  await new Promise((r) => setTimeout(r, 0));

  // Clone into the live DOM, off-screen, so inherited styles resolve and
  // images load — the same trick pdfExport uses for html-to-pdfmake.
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.position = "absolute";
  clone.style.left = "-9999px";
  clone.style.top = "0";
  clone.style.width = element.offsetWidth + "px";
  (element.parentNode ?? document.body).insertBefore(clone, element);

  // Print-only styles (page size, zoom, page breaks) come from the page's own
  // <style> blocks — computed-style inlining can't capture what only applies
  // while printing. Explicit opt.printCss wins, otherwise auto-capture.
  const printCss = opts.printCss ?? collectPrintCss();

  try {
    await inlineComputedStylesForChromium(clone);
    replaceFormControls(clone);
    await inlineRemoteImages(clone);
    fixRootForPrint(clone);
    return await buildPdfDocumentHtml(clone.outerHTML, opts, printCss);
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
    printCss,
  } = opts;

  const html = await serializeElementForPdf(elementId, { orientation, format, printCss });

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
