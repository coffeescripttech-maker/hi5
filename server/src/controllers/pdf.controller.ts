/**
 * Server-side PDF rendering using puppeteer-core + the system Chrome.
 *
 * The client serializes an already-rendered certificate into a self-contained
 * HTML document (every computed style inline, images + fonts embedded as data
 * URLs, @page rules attached) and POSTs it here. Because the same Chromium
 * engine that renders the browser's Print Preview prints the PDF, the file
 * matches the preview exactly — unlike the client-side pdfmake conversion.
 *
 * A single headless Chrome instance is reused across requests (launched
 * lazily); only the tab is opened/closed per request.
 */
import { Request, Response } from "express";
import puppeteer, { Browser, Page } from "puppeteer-core";
import fs from "fs";

/** Candidate browser executables, tried in order. Override via PDF_CHROME_PATH. */
const CHROME_CANDIDATES = [
  process.env.PDF_CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].filter(Boolean) as string[];

/** Minimal DOM surface reached inside the headless Chromium page (tsc for Node has no DOM lib). */
type PageDom = { document: { fonts: { ready: Promise<unknown> } } };

function findChromeExecutable(): string {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore permission errors etc., keep scanning
    }
  }
  throw new Error(
    "No Chrome/Edge executable found. Install Chrome or set PDF_CHROME_PATH in server/.env to its path."
  );
}

let browserPromise: Promise<Browser> | null = null;

/**
 * Lazily launch (and reuse) the headless browser. If the browser process ever
 * dies — a renderer can crash/OOM while printing the very large SF registers
 * (tens of thousands of inlined styles) — the singleton is dropped so the next
 * request launches a fresh Chrome instead of failing forever on a dead browser.
 */
function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        executablePath: findChromeExecutable(),
        // v22+ treats `true` as the "new" headless mode, which prints PDFs faithfully.
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"],
      })
      .then((browser) => {
        browser.on("disconnected", () => {
          browserPromise = null;
        });
        return browser;
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

/**
 * Renders are serialized: the shared headless Chrome wedges when several giant
 * pages (the SF registers carry megabytes of inlined styles) print
 * concurrently — so each render waits for the previous one to finish.
 */
let renderQueue: Promise<unknown> = Promise.resolve();

/** Overall ceiling for one render attempt (load + fonts + print). */
const RENDER_TIMEOUT_MS = 180_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function doRenderPdfBuffer(html: string): Promise<Buffer> {
  let page: Page | null = null;
  let browser: Browser | null = null;
  try {
    browser = await getBrowser();
    page = await browser.newPage();

    // The HTML is fully self-contained (data URLs), so "load" settles fast.
    await withTimeout(
      page.setContent(html, { waitUntil: "load" }),
      RENDER_TIMEOUT_MS,
      "Page load"
    );

    // Wait for the embedded @font-face fonts to finish loading before printing.
    await Promise.race([
      page.evaluate(() => (globalThis as unknown as PageDom).document.fonts.ready),
      new Promise((r) => setTimeout(r, 8000)),
    ]);

    // preferCSSPageSize makes page.pdf honor the @page { size: …; margin: … }
    // rules that came in with the client's HTML.
    const pdf = await withTimeout(
      page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
      }),
      RENDER_TIMEOUT_MS,
      "PDF print"
    );
    return Buffer.from(pdf);
  } catch (err) {
    // Drop the (possibly wedged) shared browser so the next request — or the
    // crash-recovery retry below — launches a fresh Chrome.
    browserPromise = null;
    try {
      await browser?.close();
    } catch {
      // already gone
    }
    throw err;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {
        // tab already gone
      }
    }
  }
}

async function renderPdfBuffer(html: string): Promise<Buffer> {
  const run = renderQueue.then(async () => {
    // One crash-recovery retry: doRenderPdfBuffer drops the shared browser on
    // failure, so the retry launches a fresh Chrome.
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await doRenderPdfBuffer(html);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  });
  // The queue must not reject — a failed render just passes the baton on.
  renderQueue = run.catch(() => undefined);
  return run;
}

const MAX_HTML_BYTES = 5 * 1024 * 1024;

/** Strip characters that are unsafe or invalid in a filename. */
function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, "_")
    .replace(/\.pdf$/i, "");
  return cleaned || "document";
}

export async function renderPdf(req: Request, res: Response): Promise<void> {
  const html = req.body?.html;
  const filename = sanitizeFilename(req.body?.filename || "document");
  const t0 = Date.now();
  console.log(`[pdf] render request: ${filename} (${html ? Buffer.byteLength(html, "utf8") : 0} bytes)`);

  if (typeof html !== "string" || html.trim() === "") {
    res.status(400).json({ error: "Missing required field: html" });
    return;
  }
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    res.status(413).json({ error: "HTML payload too large" });
    return;
  }

  try {
    // renderPdfBuffer owns page/browser lifecycle and retries once on crash.
    const pdf = await renderPdfBuffer(html);
    console.log(`[pdf] rendered ${filename} in ${((Date.now() - t0) / 1000).toFixed(1)}s (${pdf.length} bytes)`);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}.pdf"`
    );
    res.send(pdf);
  } catch (err) {
    console.error("PDF render failed:", err);
    console.log(`[pdf] FAILED ${filename} after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    res.status(500).json({
      error:
        "PDF rendering failed. Make sure Chrome is installed (or set PDF_CHROME_PATH).",
    });
  }
}
