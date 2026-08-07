/**
 * End-to-end smoke test for the SF-form "PDF" buttons (SF1, SF5, SF9, SF10).
 *
 * Drives a real headless Chrome through the exact UI flow a registrar would and
 * captures the /api/pdf/render POST so we can prove the serializer embeds each
 * form's own @media print CSS (page size, margins, page breaks, and the zoom
 * that fits the wide register) — without which the server PDF would overflow
 * the page. Also captures the returned PDF blob (the server-rendered file).
 *
 * Run:  cd server && node e2e-sf-forms.cjs
 */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const FRONT = process.env.FRONT_URL || "http://localhost:5173";
const CHROME = process.env.PDF_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT_DIR = __dirname;

function pageCount(buf) {
  const s = buf.toString("latin1");
  return (s.match(/\/Type\s*\/Page[^s]/g) || []).length;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[console.error]", msg.text().slice(0, 200));
  });
  page.on("requestfailed", (req) => console.log("[reqfailed]", req.url().slice(0, 120), req.failure()?.errorText));

  // ── capture per-form POST bodies + server responses ──
  const captures = {}; // key -> { html, pdfBuf }
  page.on("request", (req) => {
    if (req.url().includes("/api/pdf/render") && req.method() === "POST" && req.postData()) {
      try {
        const body = JSON.parse(req.postData());
        const key = body.filename.split("_")[0].toLowerCase();
        captures[key] = { html: body.html, pdfBuf: null };
        fs.writeFileSync(path.join(OUT_DIR, `${key}-serialized.html`), body.html);
      } catch {}
    }
  });
  page.on("response", async (res) => {
    if (res.url().includes("/api/pdf/render") && res.request().method() === "POST") {
      console.log(`→ POST /api/pdf/render: ${res.status()} ${res.headers()["content-type"]}`);
      if (res.status() !== 200) console.log("  body:", (await res.text()).slice(0, 300));
    }
  });

  const cdp = await page.createCDPSession();
  await cdp.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: path.join(OUT_DIR, "downloads"),
  });

  // ── login ──
  await page.goto(`${FRONT}/login`, { waitUntil: "networkidle0" });
  const uInput = await page.waitForSelector('input[placeholder="Enter your username"]', { timeout: 20000 });
  await uInput.type("registrar01");
  const pInput = await page.waitForSelector('input[placeholder="Enter your password"]');
  await pInput.type("password123");
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), pInput.press("Enter")]);
  console.log("logged-in url:", page.url());
  await page.waitForSelector("[data-nav-item]", { timeout: 15000 });

  const goNav = async (label) => {
    await page.evaluate((lbl) => {
      const btns = Array.from(document.querySelectorAll("[data-nav-item]"));
      const hit = btns.find((b) => b.textContent.includes(lbl));
      if (hit) hit.click();
    }, label);
  };

  const injectBlobCapture = async () => {
    await page.evaluate(() => {
      const orig = URL.createObjectURL.bind(URL);
      window.__pdfB64 = null;
      URL.createObjectURL = (obj) => {
        if (obj instanceof Blob) {
          obj.arrayBuffer().then((ab) => {
            const bytes = new Uint8Array(ab);
            let bin = "";
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            window.__pdfB64 = btoa(bin);
          }).catch(() => {});
        }
        return orig(obj);
      };
    });
  };

  const clickPdfAndCapture = async (key) => {
    await page.evaluate(() => { window.__pdfB64 = null; });
    const before = Object.keys(captures).length;
    const t0 = Date.now();
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find((x) => x.textContent.includes("PDF"));
      if (b) b.click();
    });
    // wait for the POST request to fire
    for (let i = 0; i < 40 && Object.keys(captures).length === before; i++) await new Promise((r) => setTimeout(r, 500));
    // wait for the server-rendered blob (up to 90s — first render launches Chrome)
    for (let i = 0; i < 180 && !(await page.evaluate(() => !!window.__pdfB64)); i++) await new Promise((r) => setTimeout(r, 500));
    const b64 = await page.evaluate(() => window.__pdfB64);
    const elapsed = Date.now() - t0;
    if (b64) {
      const buf = Buffer.from(b64, "base64");
      const keys = Object.keys(captures);
      const target = keys.length ? keys[keys.length - 1] : key;
      captures[target] = { html: captures[target]?.html, pdfBuf: buf };
      console.log(`  ✓ ${key} server PDF: ${buf.length} bytes, pages≈${pageCount(buf)} (${elapsed}ms)`);
    } else {
      console.log(`  ✗ no PDF blob captured for ${key} (${elapsed}ms)`);
    }
  };

  const checkSerialized = (key, req) => {
    console.log(`\n──── ${key.toUpperCase()} serialized html checks ────`);
    if (!req || !req.html) {
      console.log("  ✗ no POST captured");
      return;
    }
    const html = req.html;
    const isSf1Family = key === "sf1" || key === "sf5";
    const checks = [
      ["@media print captured", /@media print/],
      ["print-area element", new RegExp(`${key}-print-area`)],
      ["page-break-after", /page-break-after:\s*always/],
      ["no-print hiding", /\.no-print\s*\{[^}]*display:\s*none/i],
    ];
    if (isSf1Family) {
      checks.push(["@page A4 landscape (sf1.css)", /@page[^}]*size:\s*A4 landscape/i]);
      checks.push(["zoom: 0.78 (sf1.css)", /zoom:\s*0\.78/]);
    } else {
      checks.push(["@page letter landscape (form)", /@page[^}]*size:\s*letter landscape/i]);
    }
    for (const [label, re] of checks) console.log(`  ${label}: ${re.test(html) ? "YES" : "NO"}`);
    const baseIdx = html.indexOf("@page { size: letter landscape; margin: 0; }");
    const a4Idx = html.indexOf("A4 landscape");
    console.log(`  base @page before form @page: ${baseIdx !== -1 && a4Idx > baseIdx ? "YES" : "NO"}`);
    console.log(`  html bytes: ${Buffer.byteLength(html)}`);
  };

  const testForm = async ({ navLabel, urlPart, key, prepare, areaSel }) => {
    await goNav(navLabel);
    await page.waitForFunction((p) => location.pathname.includes(p), {}, urlPart);
    if (prepare) await prepare();
    await page.waitForSelector(areaSel, { timeout: 25000 });
    console.log(`✓ ${key} page loaded, ${areaSel} present`);
    await injectBlobCapture();
    await clickPdfAndCapture(key);
    checkSerialized(key, captures[key]);
  };

  // ══ SF1 — wide register (zoom 0.78, A4 landscape) ══
  await testForm({
    navLabel: "SF1 — School Register",
    urlPart: "/forms/sf1",
    key: "sf1",
    areaSel: "#sf1-print-area",
  });

  // ══ SF5 — promotion report (same sf1.css layout) ══
  await testForm({
    navLabel: "SF5 — Promotion Report",
    urlPart: "/forms/sf5",
    key: "sf5",
    areaSel: "#sf5-print-area",
  });

  // ══ SF9 — report card (student dropdown → letter landscape) ══
  await testForm({
    navLabel: "SF9 — Report Card",
    urlPart: "/forms/sf9",
    key: "sf9",
    areaSel: "#sf9-print-area",
    prepare: async () => {
      await page.waitForFunction(() => {
        const sels = Array.from(document.querySelectorAll("select"));
        return sels.some((s) => [...s.options].some((o) => /Miranda/i.test(o.textContent)));
      }, { timeout: 20000 });
      await page.evaluate(() => {
        const sels = Array.from(document.querySelectorAll("select"));
        const student = sels.find((s) => [...s.options].some((o) => /Miranda/i.test(o.textContent)));
        if (student) {
          const opt = [...student.options].find((o) => /Miranda/i.test(o.textContent));
          student.value = opt.value;
          student.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      await page.waitForFunction(() => {
        const el = document.getElementById("sf9-print-area");
        return el && /Miranda/i.test(el.textContent) && !el.textContent.includes("Loading");
      }, { timeout: 20000 });
    },
  });

  // ══ SF10 — permanent record (learner search → letter landscape) ══
  await testForm({
    navLabel: "SF10 — Permanent Record",
    urlPart: "/forms/sf10",
    key: "sf10",
    areaSel: "#sf10-print-area",
    prepare: async () => {
      const search = await page.waitForSelector('input[placeholder*="Search by name"]', { timeout: 20000 });
      await search.click();
      await search.type("Miranda");
      await new Promise((r) => setTimeout(r, 1200));
      await page.waitForFunction(() => {
        const sels = Array.from(document.querySelectorAll("div.absolute button"));
        return sels.some((b) => /Miranda/i.test(b.textContent));
      }, { timeout: 15000 });
      // The suggestion uses onMouseDown (not onClick) — dispatch a real mousedown.
      await page.evaluate(() => {
        const sels = Array.from(document.querySelectorAll("div.absolute button"));
        const hit = sels.find((b) => /Miranda/i.test(b.textContent));
        if (hit) hit.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      });
      await page.waitForFunction(() => {
        const el = document.getElementById("sf10-print-area");
        return el && /Miranda/i.test(el.textContent) && !el.textContent.includes("Loading");
      }, { timeout: 20000 });
    },
  });

  // ── persist server-rendered PDFs for manual inspection ──
  for (const [key, cap] of Object.entries(captures)) {
    if (cap && cap.pdfBuf) {
      const f = path.join(OUT_DIR, `sf-${key}-smoke.pdf`);
      fs.writeFileSync(f, cap.pdfBuf);
      console.log(`saved ${f} (${cap.pdfBuf.length} bytes, pages≈${pageCount(cap.pdfBuf)})`);
    }
  }

  await browser.close();
})().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exit(1);
});
