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
import { saveOrShareResponse } from "./nativeExport";
import {
  fetchAsBase64,
  inlineRemoteImages,
  replaceFormControls,
  syncFormControlValues,
  withLightTheme,
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

/**
 * Width/height utilities that should stay fixed (e.g. `w-64`, `sm:w-20`),
 * including absolute-value arbitrary utilities (`w-[30rem]`, `h-[3px]`).
 * Percentage/calc arbitrary values (`w-[38%]`, `w-[calc(100%-2rem)]`) are
 * deliberately excluded so they keep reflowing to the print page width.
 */
const SIZE_UTILITY_RE = /(?:^|\s)(?:[a-z]+:)?[wh]-(?:\[[^\]%]+\]|[a-z0-9/]+)/;
/** Fluid width/height utilities that must reflow, not stay fixed. */
const FLUID_SIZE_RE = /(?:^|\s)(?:[a-z]+:)?[wh]-(?:full|screen|fit|max|min)/;
/** min-w-* / max-w-* / min-h-* / max-h-* utilities. */
const MINMAX_RE = /(?:^|\s)(?:[a-z]+:)?(?:min|max)-[wh]-/;
/**
 * Logical size longhands Chrome enumerates separately from width/height.
 * In horizontal-tb writing mode block-size == height and inline-size ==
 * width, so without this guard the measured SCREEN height of every block
 * would be pinned into the print page (block-size: 1153px on .sf1-page,
 * min-block-size: 1200px → a 1200px min-height!). Any print-time reflow —
 * zoom, page-width page breaks — then overflows those pinned boxes and
 * paints text on top of following blocks: the garbled second page on
 * SF5/SF9 exports.
 */
const LOGICAL_SIZE_RE = /^(min-|max-)?(block|inline)-size$/;

/**
 * Chrome reports `grid-template-columns` as the *used* pixel sizes
 * (e.g. "236px 236px 236px 236px"), never the authored
 * `repeat(n, minmax(0, 1fr))`. Inlining those pixels pins the columns to the
 * width measured on screen; when the standalone print page lays the grid out
 * at a different width the fixed tracks no longer line up and later cells
 * (e.g. SF9's marking table) paint on top of the blocks that follow it (the
 * AO/SO/RO/NO legend). Rewrite an all-pixel track list to proportional `fr`
 * so it reflows to the page width. Lists that contain non-pixel tracks
 * (auto / minmax / fit-content) are JS layout hints and are left untouched.
 */
function relativizeGridTracks(value: string): string {
  const tokens = value.trim().split(/\s+/);
  if (!tokens.length || !tokens.every((t) => /^\d+(?:\.\d+)?px$/.test(t))) {
    return value;
  }
  return tokens.map((t) => t.replace(/px$/, "fr")).join(" ");
}

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

/** Per-side border longhands force-inlined after the generic pass (see below). */
const BORDER_SIDES = ["top", "right", "bottom", "left"] as const;
const BORDER_KINDS = ["width", "style", "color"] as const;

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

      // SVG subtrees are self-contained: their internal <style> block and
      // presentation attributes already hold the diagram's layout, so the
      // computed-style pass must skip them. Inlining style.transform over an
      // SVG `transform` attribute moves the transform-origin to the view-box
      // center and scrambles mermaid node positions.
      if (el.namespaceURI === "http://www.w3.org/2000/svg") {
        continue;
      }

      const baseline = getUaBaseline(hEl.tagName);
      const cls = hEl.className || "";
      const pinSize = shouldPinSize(hEl, cls);

      // getComputedStyle resolves `auto` margins to USED pixel value (the
      // off-screen clone's layout), which would freeze e.g. `margin: 0 auto`
      // centering at whatever px happened to be computed on the screen card.
      // In the wider preview iframe / page-sized PDF the sheet would then sit
      // hard-left. The width/height guard below is what the loop actually
      // overwrites with, so the auto-vs-pinned decision is enforced THERE —
      // see the margin skip inside the loop.

      for (let i = 0; i < cs.length; i++) {
        const prop = cs[i];
        if (isDenied(prop)) continue;

        const value = cs.getPropertyValue(prop);

        // Grid tracks are the one layout metric Chrome resolves to absolute
        // pixels that the width/height guard below never sees. Reflow column
        // tracks to `fr` and drop row/auto tracks (content-sized), otherwise
        // grids stay pinned to their on-screen width and overlap following
        // blocks (e.g. SF9's marking legend painted over the values table).
        if (!pinSize) {
          if (prop === "grid-template-columns") {
            const tracks = relativizeGridTracks(value);
            if (tracks !== value) {
              hEl.style.setProperty(prop, tracks);
              continue;
            }
          } else if (
            prop === "grid-template-rows" ||
            prop === "grid-auto-columns" ||
            prop === "grid-auto-rows"
          ) {
            continue;
          }
        }

        // Pixel widths/heights on reflowing blocks are skipped so content
        // re-wraps to the letter page width, like the Print Preview. The
        // logical longhands (block-size/inline-size) map onto the same axes
        // and must follow the exact same rule — see LOGICAL_SIZE_RE.
        if (
          prop === "width" ||
          prop === "height" ||
          prop === "block-size" ||
          prop === "inline-size"
        ) {
          if (!pinSize && !isFluidSize(value)) continue;
          // A height that was never authored by the designer (neither an
          // inline height nor an h-* utility) is the used pixel result of
          // the SCREEN layout and must not pin: the print page can reflow
          // taller and a pinned height would let following blocks overlap
          // the tail of this one (probe: the SF10 sheet serialized with
          // height: 1681.75px). Widths stay pinned — the sheet's fixed
          // 996px is what makes every device agree.
          if (
            (prop === "height" || prop === "block-size") &&
            !(hEl.style.height || /(?:^|\s)(?:[a-z]+:)?h-/.test(cls))
          ) {
            continue;
          }
        }
        // getComputedStyle resolves authored `auto` margins to the USED pixel
        // values of the off-screen clone's layout. Writing them freezes
        // `margin: 0 auto` centering at whatever px the on-screen card
        // computed — in the wider preview iframe / page-sized PDF the sheet
        // would then sit hard-left (probe: sheet at x=69 instead of 222 in a
        // 1440px viewport). Chrome enumerates the logical longhands
        // (margin-inline[-start/end]) SEPARATELY from margin-left/right, so
        // every margin* property must be guarded, not just the physical ones.
        if (
          prop.startsWith("margin") &&
          /auto/.test(hEl.style.margin)
        ) {
          continue;
        }
        // min/max sizes are only preserved when they were explicitly set.
        // (camelCase lookup covers both physical and logical property names.)
        if (
          (prop.startsWith("min-") || prop.startsWith("max-")) &&
          (/-[wh]$/.test(prop) || LOGICAL_SIZE_RE.test(prop)) &&
          !pinSize &&
          !MINMAX_RE.test(cls)
        ) {
          const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
          if (!(hEl.style[camel as "minWidth"] || hEl.style[camel as "maxWidth"])) {
            continue;
          }
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

      // Force-inline the per-side border longhands AFTER the generic pass.
      // Chrome's computed-style enumeration exposes the `border` shorthand but
      // NOT the 12 per-side longhands, and a shorthand whose four sides differ
      // (border-b, border-t, divide-y — used throughout SF9/SF10) serializes to
      // "" and is dropped, so partial borders would vanish in the standalone
      // page, which has no Tailwind stylesheet. Values already at the bare-UA
      // baseline are skipped to keep the output lean. Writing width+style
      // together also avoids the UA `medium` fallback on style-less baselines.
      for (const side of BORDER_SIDES) {
        for (const kind of BORDER_KINDS) {
          const prop = `border-${side}-${kind}`;
          const value = cs.getPropertyValue(prop);
          if (value && value !== baseline.getPropertyValue(prop)) {
            hEl.style.setProperty(prop, value);
          }
        }
      }
      // Table border model: keep collapse/separate exactly as rendered.
      if (hEl.tagName === "TABLE") {
        const collapse = cs.getPropertyValue("border-collapse");
        if (collapse && collapse !== baseline.getPropertyValue("border-collapse")) {
          hEl.style.setProperty("border-collapse", collapse);
        }
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
  // Unpin the measured screen height: serializeElementForPdf pins the clone's
  // width before style inlining, which also flags the root as size-pinned and
  // captures its screen height — at print time the content must be free to
  // reflow across pages, or overflow paints over the next page's content.
  root.style.height = "auto";
  root.style.setProperty("block-size", "auto");
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
 * Collect every print-related stylesheet block currently in the document,
 * in true document order.
 *
 * The SF forms (SF1/SF5/SF9/SF10) rely on @media print rules — page size and
 * margins (@page), .no-print hiding, page breaks, and the zoom that scales the
 * wide register down to the page width — none of which computed-style inlining
 * captures (they only apply while printing). Puppeteer prints with the print
 * media type active, so embedding the same rules in the standalone page makes
 * the PDF match the browser's Print Preview exactly.
 *
 * `document.styleSheets` is ordered by document position, so a single pass
 * over it preserves the live page's cascade exactly: each form's own
 * in-body <style> block comes after the sf1.css <link>, and its
 * `@page { size: letter landscape; margin: 0.3in }` wins just like on the
 * live page. The old two-pass version (all <style> blocks, then all <link>
 * rules) inverted that order — sf1.css's `@page { size: legal landscape;
 * margin: 0.2in }` overrode SF9/SF10's letter page in the standalone print,
 * producing big blank side margins around the smaller sheet.
 * Certificates have no persistent print styles, so they pass printCss
 * explicitly.
 */
function collectPrintCss(): string {
  const blocks: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    const owner = sheet.ownerNode as HTMLElement | null;
    if (owner && owner.tagName === "STYLE") {
      // Forms' component <style> blocks: embed whole — their @media print
      // rules are self-contained and were captured as full text before.
      const css = (owner as HTMLStyleElement).textContent || "";
      if (css.includes("@media print") || css.includes("@page")) {
        blocks.push(css);
      }
      continue;
    }
    // <link> sheets (sf1.css in production): @media print and @page rules can
    // only be reachable via CSSOM. Cross-origin sheets throw on cssRules
    // access and are skipped; same-origin Vite assets are readable.
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin stylesheet — not readable
    }
    const parts: string[] = [];
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule && /print/i.test(rule.conditionText)) {
        parts.push(rule.cssText);
      } else if (rule instanceof CSSPageRule) {
        parts.push(rule.cssText);
      }
    }
    if (parts.length) blocks.push(parts.join("\n"));
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
    // Capture colours in light mode: a dark-themed clone would serialize its
    // dark backgrounds straight into the PDF *and* into the screen-media
    // FormPrintPreview iframe (where the @media print reset never applies).
    await withLightTheme(async () => {
      syncFormControlValues(element, clone);
      await inlineComputedStylesForChromium(clone);
      replaceFormControls(clone);
    });
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

  await saveOrShareResponse(response, `${filename}.pdf`);
}
