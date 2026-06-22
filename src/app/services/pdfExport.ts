/**
 * PDF Export utility using html2canvas + jsPDF
 *
 * Handles modern CSS color formats (oklch, oklab, Display P3) by resolving
 * them to standard rgb() values using pure mathematical conversion, then
 * applying them as !important inline styles so they override Tailwind
 * class definitions.
 */

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export interface PdfExportOptions {
  /** ID of the element to capture */
  elementId: string;
  /** Output filename (without extension) */
  filename?: string;
  /** Page orientation */
  orientation?: "portrait" | "landscape";
  /** Page format */
  format?: "a4" | "letter" | "legal";
  /** Scale factor for rendering (higher = better quality, slower) */
  scale?: number;
}

/* ── Pure-math color conversion (oklch → sRGB) ── */

/**
 * Convert a single CSS color function string to sRGB using pure math.
 * Handles: oklch(), oklab(), rgb(), rgba() — anything else is returned as-is.
 *
 * This avoids the Canvas API entirely since some browsers/versions silently
 * fail on oklch() fillStyle values and default to black.
 */

/** CCT — clamp, convert channel to [0,1] hex byte */
const c = (v: number): string =>
  Math.round(Math.max(0, Math.min(255, v)) * 1)
    .toString(16)
    .padStart(2, "0");

/**
 * Convert linear sRGB (no gamma) to sRGB (with gamma).
 * Assumes input values are in [0,1].
 */
function linearToSrgb(c: number): number {
  const abs = Math.abs(c);
  if (abs > 0.0031308) {
    return Math.sign(c) * (1.055 * Math.pow(abs, 1 / 2.4) - 0.055);
  }
  return 12.92 * c;
}

/**
 * Convert oklch(L, C, H) to sRGB.
 * L in [0,1], C in [0, ~0.4], H in [0, 360) — standard oklch ranges.
 * Returns [r, g, b] in [0, 255].
 */
function oklchToSrgb(l: number, c: number, h: number): [number, number, number] {
  // Step 1: oklch → oklab
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  // Step 2: oklab → linear sRGB (via LMS matrix)
  // The matrix is: [lms] = M1 * [lab], then [rgb_linear] = M2 * [lms^3]
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  return [
    linearToSrgb(+4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
    linearToSrgb(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
    linearToSrgb(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3),
  ].map((v) => Math.round(Math.max(0, Math.min(255, v * 255)))) as unknown as [
    number,
    number,
    number,
  ];
}

/**
 * Parse an oklch() string and return rgb(r,g,b).
 * Accepts formats:
 *   oklch(l c h)
 *   oklch(l c h / a)
 *   oklch(l% c h)
 */
function parseOklch(val: string): string | null {
  const match = val.match(/oklch\s*\(\s*([\d.]+%?)\s+([-\d.e]+)\s+([-\d.e]+)(?:\s*\/\s*[\d.]+%?)?\s*\)/i);
  if (!match) return null;

  const lRaw = match[1];
  const c = parseFloat(match[2]);
  const h = parseFloat(match[3]);

  let l: number;
  if (lRaw.endsWith("%")) {
    l = parseFloat(lRaw) / 100;
  } else {
    l = parseFloat(lRaw);
  }

  // Normalize: CSS oklch L is typically in [0, 1] but can also be expressed as percentage
  // A value like 0.623 → 62.3% lightness. Values > 1 are treated as-is (some CSS uses this).

  const [r, g, b] = oklchToSrgb(l, c, h);
  return `rgb(${r},${g},${b})`;
}

/**
 * Parse an oklab() string and return rgb(r,g,b).
 * oklab(l a b) or oklab(l a b / alpha)
 */
function parseOklab(val: string): string | null {
  const match = val.match(/oklab\s*\(\s*([\d.]+%?)\s+([-\d.e]+)\s+([-\d.e]+)(?:\s*\/\s*[\d.]+%?)?\s*\)/i);
  if (!match) return null;

  const lRaw = match[1];
  const a = parseFloat(match[2]);
  const b = parseFloat(match[3]);

  let l: number;
  if (lRaw.endsWith("%")) {
    l = parseFloat(lRaw) / 100;
  } else {
    l = parseFloat(lRaw);
  }

  // oklab → linear sRGB via LMS
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  const r = Math.round(Math.max(0, Math.min(255, linearToSrgb(+4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3) * 255)));
  const g = Math.round(Math.max(0, Math.min(255, linearToSrgb(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3) * 255)));
  const bl = Math.round(Math.max(0, Math.min(255, linearToSrgb(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3) * 255)));

  return `rgb(${r},${g},${bl})`;
}

/**
 * Resolve any recognized modern CSS color to rgb() via pure math.
 * Falls back to the Canvas API if the math parser doesn't recognize the format.
 */
function resolveToRgb(cssColorValue: string): string {
  const trimmed = cssColorValue.trim();

  // Already rgb/rgba → return as-is (normalise whitespace)
  if (/^rgb[a]?\s*\(/i.test(trimmed)) {
    return trimmed.replace(/rgba?\(/i, "rgb(").replace(/\s+/g, " ");
  }

  // Try oklch parser
  const oklchResult = parseOklch(trimmed);
  if (oklchResult) return oklchResult;

  // Try oklab parser
  const oklabResult = parseOklab(trimmed);
  if (oklabResult) return oklabResult;

  // For other formats (color(), hwb(), lab(), lch(), display-p3), fall back to Canvas API
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Store previous fillStyle
      const prev = ctx.fillStyle;
      ctx.fillStyle = trimmed;

      // Read back — if it changed to a non-oklch format, the canvas accepted it
      const readback = ctx.fillStyle.toString();
      if (readback !== trimmed) {
        // The canvas resolved it, now get actual pixel values
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

        // Sanity check: if the input was clearly not black but output is black,
        // the resolution might have failed silently — return the original value.
        if (r !== 0 || g !== 0 || b !== 0) {
          return `rgb(${r},${g},${b})`;
        }
      }
      ctx.fillStyle = prev;
    }
  } catch {
    // Canvas fallback failed — return original
  }

  return cssColorValue;
}

/* ── Color properties html2canvas struggles with ── */

const COLOR_PROPERTIES = [
  "color",
  "background-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "column-rule-color",
  "caret-color",
  "accent-color",
  "border-color",
];

const GRADIENT_PROPERTIES = ["background-image", "border-image"];

/**
 * Deep-clone `source` and for every element whose computed style contains a
 * color format html2canvas cannot parse, set an !important inline override
 * with the resolved rgb() value.
 */
function cloneWithResolvedColors(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;

  const walk = (origEl: Element, clonedEl: Element) => {
    if (origEl.nodeType !== Node.ELEMENT_NODE) return;

    const oEl = origEl as HTMLElement;
    const cEl = clonedEl as HTMLElement;
    const cs = getComputedStyle(oEl);

    for (const prop of COLOR_PROPERTIES) {
      const val = cs.getPropertyValue(prop);
      if (!val || val === "transparent" || val === "inherit" || val === "initial") continue;
      try {
        const rgb = resolveToRgb(val);
        if (rgb !== val) {
          cEl.style.setProperty(prop, rgb, "important");
        }
      } catch {
        // skip
      }
    }

    for (const prop of GRADIENT_PROPERTIES) {
      const val = cs.getPropertyValue(prop);
      if (!val || val === "none") continue;
      try {
        const resolved = val.replace(
          /(oklch|oklab|color|hwb|lab|lch|display-p3)\s*\([^)]+\)/gi,
          (match) => resolveToRgb(match)
        );
        if (resolved !== val) {
          cEl.style.setProperty(prop, resolved, "important");
        }
      } catch {
        // skip
      }
    }

    for (let i = 0; i < origEl.children.length; i++) {
      walk(origEl.children[i], clonedEl.children[i]);
    }
  };

  walk(source, clone);
  return clone;
}

/* ── Main export ── */

/**
 * Export an HTML element to PDF by rendering it as a canvas.
 * Handles multi-page content by splitting across pages.
 */
export async function exportToPdf({
  elementId,
  filename = "document",
  orientation = "landscape",
  format = "letter",
  scale = 2,
}: PdfExportOptions): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element #${elementId} not found`);
    return;
  }

  // Clone and resolve unsupported colour formats
  const resolvedEl = cloneWithResolvedColors(element);

  // Hide no-print elements on the clone
  resolvedEl.querySelectorAll(".no-print").forEach((el) => {
    (el as HTMLElement).style.display = "none";
  });

  // Temporarily place the clone in the DOM so stylesheets apply to it
  resolvedEl.style.position = "absolute";
  resolvedEl.style.left = "-9999px";
  resolvedEl.style.top = "0";
  resolvedEl.style.width = element.offsetWidth + "px";
  document.body.appendChild(resolvedEl);

  try {
    const canvas = await html2canvas(resolvedEl, {
      scale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // jsPDF uses mm internally
    const marginX = 7; // 7mm left/right margin
    const marginY = 5; // 5mm top/bottom margin
    const formatSizes: Record<string, [number, number]> = {
      letter: [215.9, 279.4],
      a4: [210, 297],
      legal: [215.9, 355.6],
    };

    const [pageWidth, pageHeight] = formatSizes[format] || formatSizes.letter;
    const outputWidth = orientation === "landscape" ? pageHeight : pageWidth;
    const outputHeight = orientation === "landscape" ? pageWidth : pageHeight;

    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format,
    });

    // Available area after margins
    const availW = outputWidth - 2 * marginX;
    const availH = outputHeight - 2 * marginY;

    // Scale image to fit within available area, preserving aspect ratio
    const scaleX = availW / imgWidth;
    const scaleY = availH / imgHeight;
    const fitScale = Math.min(scaleX, scaleY);

    const renderW = imgWidth * fitScale;
    const renderH = imgHeight * fitScale;

    // Center on page
    const offsetX = (outputWidth - renderW) / 2;
    const offsetY = (outputHeight - renderH) / 2;

    if (renderH <= availH) {
      // Single page — fits within margins
      pdf.addImage(imgData, "PNG", offsetX, offsetY, renderW, renderH, undefined, "FAST");
    } else {
      // Multi-page: slice the canvas into page-sized chunks
      const pxPerMm = imgWidth / renderW;
      const sliceHmm = availH;
      const sliceHpx = Math.floor(sliceHmm * pxPerMm);
      const totalPages = Math.ceil(imgHeight / sliceHpx);

      for (let i = 0; i < totalPages; i++) {
        if (i > 0) pdf.addPage();
        const srcY = i * sliceHpx;
        const curSliceHpx = Math.min(sliceHpx, imgHeight - srcY);
        const curSliceHmm = curSliceHpx / pxPerMm;

        const canvasSlice = document.createElement("canvas");
        canvasSlice.width = imgWidth;
        canvasSlice.height = curSliceHpx;
        const ctx = canvasSlice.getContext("2d");
        if (ctx) {
          ctx.drawImage(canvas, 0, srcY, imgWidth, curSliceHpx, 0, 0, imgWidth, curSliceHpx);
          const sliceData = canvasSlice.toDataURL("image/png");
          pdf.addImage(sliceData, "PNG", offsetX, offsetY, renderW, curSliceHmm, undefined, "FAST");
        }
      }
    }

    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error("PDF export failed:", error);
    throw error;
  } finally {
    if (resolvedEl.parentNode) {
      resolvedEl.parentNode.removeChild(resolvedEl);
    }
  }
}
