/**
 * Layout-fidelity check: compares font/layout metrics of the LIVE certificate
 * against a re-render of the exact serialized HTML that goes to the server.
 * If the serialization regressed (missing styles), the standalone render's
 * font metrics would diverge from the page's.
 *
 * Run:  cd server && node verify-layout.cjs
 */
const puppeteer = require("puppeteer-core");
const FRONT = "http://localhost:5173";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 960 });
  await page.goto(`${FRONT}/login`, { waitUntil: "networkidle0" });
  await (await page.waitForSelector('input[placeholder="Enter your username"]')).type("registrar01");
  const p = await page.waitForSelector('input[placeholder="Enter your password"]');
  await p.type("password123");
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), p.press("Enter")]);
  await page.waitForSelector("[data-nav-item]");
  await page.evaluate(() => {
    Array.from(document.querySelectorAll("[data-nav-item]")).find(b => b.textContent.includes("Good Moral Certificate"))?.click();
  });
  await page.waitForFunction(() => location.pathname.includes("certificates/good-moral"));
  const input = await page.waitForSelector('input[placeholder*="Search student"]');
  await input.click(); await input.type("Miranda");
  await new Promise(r => setTimeout(r, 1500));
  await page.waitForSelector('div[class*="animate-scale-in"] button');
  await page.evaluate(() => document.querySelectorAll('div[class*="animate-scale-in"] button')[0].click());
  await page.waitForFunction(() => {
    const el = document.getElementById("cert-goodmoral-content");
    return el && /Nathan/i.test(el.textContent);
  }, { timeout: 20000 });

  // Capture the serialized HTML the button sends to /api/pdf/render.
  let serialized = null;
  page.on("request", (req) => {
    if (req.url().includes("/api/pdf/render") && req.method() === "POST" && req.postData()) {
      try { serialized = JSON.parse(req.postData()).html; } catch {}
    }
  });
  // Patch blob capture so the flow completes (button stays disabled until done).
  await page.evaluate(() => {
    const orig = URL.createObjectURL.bind(URL);
    window.__pdfB64 = null;
    URL.createObjectURL = (obj) => {
      if (obj instanceof Blob) {
        obj.arrayBuffer().then(ab => {
          const bytes = new Uint8Array(ab); let bin = "";
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          window.__pdfB64 = btoa(bin);
        }).catch(() => {});
      }
      return orig(obj);
    };
  });

  // Measure the LIVE page's key certificate nodes.
  const live = await page.evaluate(() => {
    const q = (sel) => document.querySelector(sel);
    const css = (el) => {
      const s = getComputedStyle(el);
      return { font: s.fontFamily, size: s.fontSize, lh: s.lineHeight, align: s.textAlign, wt: s.fontWeight, spacing: s.letterSpacing, transform: s.textTransform };
    };
    return {
      title: css(q("#cert-goodmoral-content h1")),
      para: css(q("#cert-goodmoral-content p")),
      signatory: css(q("#cert-goodmoral-content .text-center p") || q("#cert-goodmoral-content")),
      hasLogo: !!q("#cert-goodmoral-content img"),
      text: q("#cert-goodmoral-content").innerText.length,
    };
  });

  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find(x => x.textContent.includes("Download PDF"));
    if (b) b.click();
  });
  for (let i = 0; i < 80 && !(await page.evaluate(() => !!window.__pdfB64)); i++) await new Promise(r => setTimeout(r, 250));

  if (!serialized) { console.log("FAIL: serialized HTML not captured"); process.exit(1); }
  console.log("serialized html bytes:", Buffer.byteLength(serialized));

  // Render the exact serialized HTML in a fresh blank page (no app stylesheet).
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 816, height: 1056 });
  await page2.setContent(serialized, { waitUntil: "load" });
  await new Promise(r => setTimeout(r, 800)); // let fonts/images settle
  const standalone = await page2.evaluate(() => {
    const q = (sel) => document.querySelector(sel);
    const css = (el) => {
      const s = getComputedStyle(el);
      return { font: s.fontFamily, size: s.fontSize, lh: s.lineHeight, align: s.textAlign, wt: s.fontWeight, spacing: s.letterSpacing, transform: s.textTransform };
    };
    return {
      title: css(q("#cert-goodmoral-content h1")),
      para: css(q("#cert-goodmoral-content p")),
      signatory: css(q("#cert-goodmoral-content .text-center p") || q("#cert-goodmoral-content")),
      hasLogo: !!q("#cert-goodmoral-content img"),
      text: q("#cert-goodmoral-content").innerText.length,
      rootWidth: q("#cert-goodmoral-content").getBoundingClientRect().width,
    };
  });

  const fmt = (m) => JSON.stringify(m, null, 1);
  console.log("──── LIVE PAGE ────"); console.log(fmt(live));
  console.log("──── STANDALONE (serialized HTML) ────"); console.log(fmt(standalone));

  // Compare
  const fields = ["font", "size", "lh", "align", "wt", "spacing", "transform"];
  const diffs = [];
  for (const node of ["title", "para", "signatory"]) {
    for (const f of fields) {
      const a = live[node][f], b = standalone[node][f];
      // Intended: the serializer remaps the generic `serif` family to the
      // embedded Tinos font so the PDF actually uses it. Not a regression.
      const equivalentFont = f === "font" && a === "serif" && b === "Tinos, serif";
      if (!equivalentFont && a !== b) diffs.push(`${node}.${f}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
    }
  }
  if (live.hasLogo !== standalone.hasLogo) diffs.push(`hasLogo: ${live.hasLogo} vs ${standalone.hasLogo}`);
  if (Math.abs(live.text - standalone.text) > 3) diffs.push(`text length: ${live.text} vs ${standalone.text}`);

  console.log("──── RESULT ────");
  if (diffs.length === 0) {
    console.log("✓ LAYOUT FAITHFUL — all font/layout metrics match between page and serialized render");
  } else {
    console.log("✗ LAYOUT DIVERGED:");
    diffs.forEach(d => console.log("  - " + d));
  }
  await browser.close();
})().catch(e => { console.error("FAILED:", e); process.exit(1); });
