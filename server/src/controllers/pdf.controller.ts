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

/** Lazily launch (and reuse) the headless browser. Resets on failure so the next request retries. */
function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        executablePath: findChromeExecutable(),
        // v22+ treats `true` as the "new" headless mode, which prints PDFs faithfully.
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"],
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
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

  if (typeof html !== "string" || html.trim() === "") {
    res.status(400).json({ error: "Missing required field: html" });
    return;
  }
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    res.status(413).json({ error: "HTML payload too large" });
    return;
  }

  let page: Page | null = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    // The HTML is fully self-contained (data URLs), so "load" settles fast.
    await page.setContent(html, { waitUntil: "load" });

    // Wait for the embedded @font-face fonts to finish loading before printing.
    await Promise.race([
      page.evaluate(() => document.fonts.ready),
      new Promise((r) => setTimeout(r, 8000)),
    ]);

    // preferCSSPageSize makes page.pdf honor the @page { size: …; margin: 0 }
    // rules that came in with the client's HTML. Recent puppeteer versions
    // return a Uint8Array; Express res.send() would JSON-stringify that, so
    // wrap it in a real Buffer first.
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}.pdf"`
    );
    res.send(Buffer.from(pdf));
  } catch (err) {
    console.error("PDF render failed:", err);
    res.status(500).json({
      error:
        "PDF rendering failed. Make sure Chrome is installed (or set PDF_CHROME_PATH).",
    });
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {
        // ignore — tab already gone
      }
    }
  }
}
