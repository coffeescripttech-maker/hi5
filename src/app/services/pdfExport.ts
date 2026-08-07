/**
 * PDF Export utility using html-to-pdfmake + pdfmake.
 *
 * html-to-pdfmake parses an HTML *string* and only reads inline `style`
 * attributes — it does not understand stylesheet/Tailwind classes, modern
 * oklch()/oklab()/color-mix() colors, or <input>/<select>/<textarea>
 * elements. So before converting we produce a clean copy of the print area
 * where:
 *   - every element's computed style is inlined as plain hex/rgb values,
 *   - `.no-print` elements are hidden,
 *   - form controls are replaced with <span>s carrying their current value,
 *   - remote <img> URLs are converted to base64 data URLs (best effort).
 */

import htmlToPdfmake from "html-to-pdfmake";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import tinosRegular from "../../assets/fonts/Tinos-Regular.ttf";
import tinosBold from "../../assets/fonts/Tinos-Bold.ttf";

// Register the Roboto virtual file system bundled with pdfmake.
pdfMake.addVirtualFileSystem(pdfFonts);

export interface PdfExportOptions {
  /** ID of the element to capture */
  elementId: string;
  /** Output filename (without extension) */
  filename?: string;
  /** Page orientation */
  orientation?: "portrait" | "landscape";
  /** Page format */
  format?: "a4" | "letter" | "legal";
  /** Accepted for API compatibility — pdfmake is vector so scale is a no-op. */
  scale?: number;
}

/* ── Pure-math color conversion (oklch/oklab → sRGB) ── */

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
 * Parse an oklch() string and return rgb()/rgba().
 * Accepts formats:
 *   oklch(l c h)
 *   oklch(l c h / a)
 *   oklch(l% c h)
 *   oklch(l c h / a%)
 */
function parseOklch(val: string): string | null {
  const match = val.match(
    /oklch\s*\(\s*([\d.]+%?)\s+([-\d.e]+)\s+([-\d.e]+)\s*(?:\/\s*([\d.]+%?))?\s*\)/i
  );
  if (!match) return null;

  const lRaw = match[1];
  const c = parseFloat(match[2]);
  const h = parseFloat(match[3]);
  const aRaw = match[4];

  let l: number;
  if (lRaw.endsWith("%")) {
    l = parseFloat(lRaw) / 100;
  } else {
    l = parseFloat(lRaw);
  }

  const [r, g, b] = oklchToSrgb(l, c, h);
  if (aRaw !== undefined) {
    const alpha = aRaw.endsWith("%") ? parseFloat(aRaw) / 100 : parseFloat(aRaw);
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
  }
  return `rgb(${r},${g},${b})`;
}

/**
 * Parse an oklab() string and return rgb()/rgba().
 * oklab(l a b) or oklab(l a b / alpha)
 */
function parseOklab(val: string): string | null {
  const match = val.match(
    /oklab\s*\(\s*([\d.]+%?)\s+([-\d.e]+)\s+([-\d.e]+)\s*(?:\/\s*([\d.]+%?))?\s*\)/i
  );
  if (!match) return null;

  const lRaw = match[1];
  const a = parseFloat(match[2]);
  const b = parseFloat(match[3]);
  const aRaw = match[4];

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

  if (aRaw !== undefined) {
    const alpha = aRaw.endsWith("%") ? parseFloat(aRaw) / 100 : parseFloat(aRaw);
    return `rgba(${r},${g},${bl},${Math.max(0, Math.min(1, alpha))})`;
  }
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
      const prev = ctx.fillStyle;
      ctx.fillStyle = trimmed;

      // Read back — if it changed to a non-oklch format, the canvas accepted it
      const readback = ctx.fillStyle.toString();
      if (readback !== trimmed) {
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
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

const MODERN_COLOR_FN_NAMES = [
  "oklch",
  "oklab",
  "lab",
  "lch",
  "hwb",
  "color",
  "display-p3",
  "color-mix",
];

/**
 * Replace every modern color function token inside a (possibly compound)
 * value string — e.g. a box-shadow list, border-color shorthand, a gradient,
 * or scrollbar-color pair — with its rgb() equivalent.
 *
 * Scans for balanced parentheses so nested functions like
 * `color-mix(in oklab, rgb(...) 30%, blue)` are captured whole.
 * Unknown functions and already-rgb values pass through untouched.
 */
function resolveColorsInValue(value: string): string {
  if (!value) return value;
  if (
    value === "transparent" ||
    value === "inherit" ||
    value === "initial" ||
    value === "none"
  ) {
    return value;
  }
  const lower = value.toLowerCase();
  let out = "";
  let i = 0;
  while (i < value.length) {
    let match: { start: number; open: number } | null = null;
    for (const fn of MODERN_COLOR_FN_NAMES) {
      if (lower.startsWith(fn, i)) {
        let j = i + fn.length;
        while (j < value.length && value[j] === " ") j++;
        if (value[j] === "(") {
          match = { start: i, open: j };
          break;
        }
      }
    }
    if (!match) {
      out += value[i];
      i++;
      continue;
    }
    // find the matching close paren
    let depth = 0;
    let k = match.open;
    for (; k < value.length; k++) {
      if (value[k] === "(") depth++;
      else if (value[k] === ")") {
        depth--;
        if (depth === 0) {
          k++;
          break;
        }
      }
    }
    const token = value.slice(match.start, k);
    out += resolveToRgb(token);
    i = k;
  }
  return out;
}

/* ── Computed-style inlining for html-to-pdfmake ── */

const mmToPt = 72 / 25.4;

/** Convert a single rgb()/rgba() color string to a #rrggbb hex string. */
function rgbToHex(color: string): string {
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return color;
  return (
    "#" +
    [m[1], m[2], m[3]]
      .map((v) =>
        Math.max(0, Math.min(255, Number(v))).toString(16).padStart(2, "0")
      )
      .join("")
      .toUpperCase()
  );
}

/**
 * Resolve any modern color functions inside `value` (oklch, oklab, color-mix,
 * …) to plain rgb(), then coerce every rgb()/rgba() token to hex so pdfmake
 * never sees a color format it cannot parse.
 */
function toPdfColor(value: string): string {
  return resolveColorsInValue(value).replace(
    /rgba?\(([^)]+)\)/g,
    (_whole, inner: string) => rgbToHex(`rgb(${inner})`)
  );
}

/**
 * Inline a cell/element's four borders as `border-<side>` shorthands.
 * All four sides are always written so html-to-pdfmake's border fill-gap logic
 * does not add a default visible border on the missing sides.
 */
function inlineBorders(el: HTMLElement, cs: CSSStyleDeclaration) {
  const sides = ["left", "top", "right", "bottom"] as const;
  const visible: Partial<Record<(typeof sides)[number], string>> = {};
  let anyVisible = false;

  for (const side of sides) {
    const width = cs.getPropertyValue(`border-${side}-width`);
    const style = cs.getPropertyValue(`border-${side}-style`);
    const color = cs.getPropertyValue(`border-${side}-color`);
    const w = parseFloat(width);
    if (w > 0 && style && style !== "none" && style !== "hidden") {
      anyVisible = true;
      visible[side] = `${width} ${style} ${toPdfColor(color)}`;
    }
  }

  if (!anyVisible) return;

  for (const side of sides) {
    el.style.setProperty(
      `border-${side}`,
      visible[side] || "0px none #000000"
    );
  }
}

/**
 * Deep-walk `root`, copying the computed style properties html-to-pdfmake
 * understands onto each element as inline styles. Colors are resolved to hex
 * so modern oklch()/oklab() values never reach the converter.
 */
function inlineComputedStyles(root: HTMLElement) {
  const walk = (el: Element) => {
    if (el.nodeType !== Node.ELEMENT_NODE) return;
    const hEl = el as HTMLElement;
    const cs = getComputedStyle(hEl);
    const nodeName = el.nodeName;

    // Hide anything marked not-print.
    if (hEl.classList.contains("no-print")) {
      hEl.style.display = "none";
    }

    // Font & text properties.
    if (cs.fontSize) hEl.style.setProperty("font-size", cs.fontSize);
    if (cs.fontWeight) hEl.style.setProperty("font-weight", cs.fontWeight);
    if (cs.fontStyle === "italic") hEl.style.setProperty("font-style", "italic");

    const align = cs.textAlign;
    if (align && align !== "start") {
      hEl.style.setProperty("text-align", align === "end" ? "right" : align);
    }

    const deco = cs.textDecorationLine;
    if (deco && deco !== "none" && deco !== "auto") {
      hEl.style.setProperty("text-decoration", deco);
    }

    // Colors — resolved to hex.
    const bg = cs.backgroundColor;
    if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") {
      hEl.style.setProperty("background-color", toPdfColor(bg));
    }
    const color = cs.color;
    if (color && color !== "transparent") {
      hEl.style.setProperty("color", toPdfColor(color));
    }

    inlineBorders(hEl, cs);

    // Full-width tables keep spanning the whole page.
    if (nodeName === "TABLE" && hEl.classList.contains("w-full")) {
      hEl.style.setProperty("width", "100%");
    }

    // Images keep their laid-out size.
    if (nodeName === "IMG") {
      const w = cs.width;
      const h = cs.height;
      if (w && w !== "auto") hEl.style.setProperty("width", w);
      if (h && h !== "auto") hEl.style.setProperty("height", h);
    }

    for (let i = 0; i < el.children.length; i++) {
      walk(el.children[i]);
    }
  };
  walk(root);
}

/**
 * html-to-pdfmake cannot render form controls, so replace every
 * input/select/textarea with a <span> that carries the control's current
 * value (its inline styles were already inlined in a previous pass).
 * Exported so the server-side render path (pdfRender.ts) can reuse it.
 */
export function replaceFormControls(root: HTMLElement) {
  const controls = Array.from(root.querySelectorAll("input, select, textarea"));
  for (const el of controls) {
    const span = document.createElement("span");
    span.style.cssText = (el as HTMLElement).style.cssText;

    if (el instanceof HTMLInputElement) {
      if (el.type === "checkbox" || el.type === "radio") {
        span.textContent = el.checked ? "☑" : "☐"; // ☑ / ☐
      } else {
        span.textContent = el.value;
      }
    } else if (el instanceof HTMLSelectElement) {
      span.textContent = el.selectedOptions[0]?.text ?? "";
    } else {
      span.textContent = (el as HTMLTextAreaElement).value;
    }

    el.replaceWith(span);
  }
}

/** Load a remote image and return it as a base64 PNG data URL (or null). */
function fetchAsDataUrl(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 72;
        canvas.height = img.naturalHeight || 72;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Best-effort conversion of <img> URLs to base64 data URLs. Exported for pdfRender.ts. */
export async function inlineRemoteImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll("img"));
  const jobs = imgs.map(async (img) => {
    // `img.src` resolves relative/hashed asset paths (e.g. /assets/logo.png)
    // to an absolute, fetchable URL — getAttribute("src") would leave them
    // relative and pdfmake could not resolve them for the PDF.
    const src = img.src || img.getAttribute("src") || "";
    if (/^data:/i.test(src) || /^blob:/i.test(src)) return;
    try {
      const dataUrl = await fetchAsDataUrl(src);
      if (dataUrl) img.setAttribute("src", dataUrl);
    } catch {
      // Leave the URL — imagesByReference lets pdfmake try to fetch it.
    }
  });
  await Promise.all(jobs);
}

/** Fetch a same-origin asset and return it as a base64 string (for the font vfs). Exported for pdfRender.ts. */
export async function fetchAsBase64(src: string): Promise<string> {
  const res = await fetch(src);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * Lazily register the certificate serif font (Tinos — Times-compatible, OFL)
 * with pdfmake. The certificate templates use `font-family: serif`, but
 * pdfmake only ships Roboto, so without this the download throws
 * "Font 'Serif' in style 'normal' is not defined". The TTFs are bundled as
 * static assets and inlined into pdfmake's virtual file system the first time
 * a PDF is exported. Registered under both "serif" and "Serif" since the
 * converter's family name casing varies.
 */
let serifFontReady: Promise<void> | null = null;

function ensureSerifFont(): Promise<void> {
  if (!serifFontReady) {
    serifFontReady = (async () => {
      const [regular, bold] = await Promise.all([
        fetchAsBase64(tinosRegular),
        fetchAsBase64(tinosBold),
      ]);
      pdfMake.addVirtualFileSystem({
        "Tinos-Regular.ttf": regular,
        "Tinos-Bold.ttf": bold,
      });
      const serif = {
        normal: "Tinos-Regular.ttf",
        bold: "Tinos-Bold.ttf",
        italics: "Tinos-Regular.ttf",
        bolditalics: "Tinos-Bold.ttf",
      };
      pdfMake.fonts = {
        ...(pdfMake.fonts || {}),
        serif,
        Serif: serif,
      };
    })();
  }
  return serifFontReady;
}

/* ── Main export ── */

/**
 * Export an HTML element to PDF by converting it to a pdfmake document.
 * Tables split across pages automatically; orientation/format control the
 * page size.
 */
export async function exportToPdf({
  elementId,
  filename = "document",
  orientation = "landscape",
  format = "letter",
}: PdfExportOptions): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element #${elementId} not found`);
    return;
  }

  // Clone into the live DOM (inserted before the source so inherited styles
  // resolve identically), positioned off-screen while we compute.
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.position = "absolute";
  clone.style.left = "-9999px";
  clone.style.top = "0";
  clone.style.width = element.offsetWidth + "px";
  (element.parentNode ?? document.body).insertBefore(clone, element);

  try {
    // Inline computed styles, drop no-print content, materialise inputs, and
    // make images embeddable — then serialize to HTML for html-to-pdfmake.
    inlineComputedStyles(clone);
    replaceFormControls(clone);
    await inlineRemoteImages(clone);
    await ensureSerifFont();

    const html = clone.outerHTML;
    const converted = htmlToPdfmake(html, {
      tableAutoSize: false,
      imagesByReference: true,
    });

    const formatSizes: Record<string, string> = {
      letter: "LETTER",
      a4: "A4",
      legal: "LEGAL",
    };

    const docDefinition = {
      ...converted,
      pageSize: formatSizes[format] || "LETTER",
      orientation,
      pageMargins: [
        Math.round(7 * mmToPt),
        Math.round(5 * mmToPt),
        Math.round(7 * mmToPt),
        Math.round(5 * mmToPt),
      ],
    };

    pdfMake.createPdf(docDefinition).download(`${filename}.pdf`);
  } catch (error) {
    console.error("PDF export failed:", error);
    throw error;
  } finally {
    if (clone.parentNode) {
      clone.parentNode.removeChild(clone);
    }
  }
}
