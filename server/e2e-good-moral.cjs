/**
 * End-to-end smoke test for the Good Moral "Download PDF" button.
 *
 * Drives a real headless Chrome through the exact UI flow a registrar would:
 *   1. Log in via the API to get a JWT.
 *   2. Open the Good Moral certificate page with that token.
 *   3. Type in the student search, pick the first suggestion.
 *   4. Wait for the certificate to fill in.
 *   5. Click "Download PDF" → watch the /api/pdf/render POST land.
 *   6. Save the returned PDF, then re-open it in Chrome (file://) and
 *      screenshot it so the layout can be compared against the page.
 *
 * Run:  cd server && node e2e-good-moral.cjs
 */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const API = process.env.API_URL || "http://localhost:3001/api";
const FRONT = process.env.FRONT_URL || "http://localhost:5173";
const CHROME = process.env.PDF_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = path.join(__dirname, "smoke-test-e2e.pdf");
const PAGE_PNG = path.join(__dirname, "cert-on-page.png");
const PDF_PNG = path.join(__dirname, "cert-from-pdf.png");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 960 });

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") console.log("[console]", msg.type(), msg.text().slice(0, 200));
  });
  page.on("requestfailed", (req) => console.log("[reqfailed]", req.url().slice(0, 120), req.failure()?.errorText));
  page.on("request", (req) => {
    if (req.url().includes("/api/pdf/render") && req.method() === "POST") {
      const html = req.postData() || "";
      const checks = [
        ["certificate title", /Certificate of Good Moral Character/],
        ["student name", /Nathan Banaria Miranda/],
        ["LRN", /123456789111/],
        ["Tinos font-face", /@font-face/],
        ["@page rule", /@page\s*\{[^}]*size:\s*letter/i],
        ["logo data URL", /data:image/],
        ["principal signatory", /VILLANUEVA/i],
      ];
      for (const [label, re] of checks) {
        console.log(`  html contains ${label}: ${re.test(html) ? "YES" : "NO"}`);
      }
      console.log(`  html bytes: ${Buffer.byteLength(html)}`);
    }
  });

  const pdfHits = [];
  page.on("response", async (res) => {
    if (res.url().includes("/api/pdf/render") && res.request().method() === "POST") {
      const hit = { status: res.status(), type: res.headers()["content-type"] };
      pdfHits.push(hit);
      console.log(`→ POST /api/pdf/render: ${hit.status} ${hit.type}`);
      if (res.status() !== 200) {
        console.log("  body:", (await res.text()).slice(0, 300));
      }
    }
  });

  // Allow downloads so we can capture the actual file the button produces.
  const cdp = await page.createCDPSession();
  await cdp.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: path.join(__dirname, "downloads"),
  });

  // Seed the JWT then load the page fresh (so the router picks up the role).
  await page.goto(`${FRONT}/login`, { waitUntil: "networkidle0" });
  const uInput = await page.waitForSelector('input[placeholder="Enter your username"]', { timeout: 20000 });
  await uInput.type("registrar01");
  const pInput = await page.waitForSelector('input[placeholder="Enter your password"]');
  await pInput.type("password123");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    pInput.press("Enter"),
  ]);
  console.log("logged-in url:", page.url());

  // Navigate like a real user: click the sidebar button for Good Moral.
  await page.waitForSelector('[data-nav-item]', { timeout: 15000 });
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("[data-nav-item]"));
    const hit = btns.find((b) => b.textContent.includes("Good Moral Certificate"));
    if (hit) hit.click();
  });
  await page.waitForFunction(() => location.pathname.includes("certificates/good-moral"), { timeout: 15000 });

  console.log("url after nav:", page.url());
  const debugText = await page.evaluate(() => document.body.innerText.slice(0, 400));
  console.log("page text:", JSON.stringify(debugText));

  const input = await page.waitForSelector('input[placeholder*="Search student"]', { timeout: 20000 });
  await input.click();
  await input.type("Miranda");
  await new Promise((r) => setTimeout(r, 1500)); // let the debounce + fetch settle
  const searchState = await page.evaluate(() => ({
    value: document.querySelector('input[placeholder*="Search student"]')?.value,
    dropdownBtns: document.querySelectorAll('div[class*="animate-scale-in"] button').length,
    bodyText: document.body.innerText.slice(-600),
  }));
  console.log("search state:", JSON.stringify(searchState, null, 1));
  await page.waitForSelector('div[class*="animate-scale-in"] button', { timeout: 15000 });

  // Pick the first suggestion.
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[class*="animate-scale-in"] button'));
    if (btns[0]) btns[0].click();
  });

  // Wait until the certificate actually fills in (name rendered, no spinner).
  await page.waitForFunction(() => {
    const el = document.getElementById("cert-goodmoral-content");
    return el && /Nathan/i.test(el.textContent) && !el.textContent.includes("Loading");
  }, { timeout: 20000 });
  console.log("✓ student picked, certificate filled");

  await new Promise((r) => setTimeout(r, 600)); // let images (logo) load
  const cert = await page.$("#cert-goodmoral-content");
  if (cert) await cert.screenshot({ path: PAGE_PNG });
  console.log("✓ screenshot of on-page certificate → cert-on-page.png");

  // Intercept URL.createObjectURL so we capture the exact blob bytes the
  // client hands to the <a download> — the file the user actually saves.
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

  // Click "Download PDF".
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find((x) => x.textContent.includes("Download PDF"));
    if (b) b.click();
  });

  // Wait for the blob to be captured (up to ~30s).
  for (let i = 0; i < 60 && !(await page.evaluate(() => !!window.__pdfB64)); i++) {
    await new Promise((r) => setTimeout(r, 500));
  }
  const b64 = await page.evaluate(() => window.__pdfB64);
  if (b64) {
    const buf = Buffer.from(b64, "base64");
    fs.writeFileSync(OUT, buf);
    console.log(`  captured ${buf.length} bytes — magic "${buf.slice(0, 5).toString()}" eof "${buf.slice(-5).toString()}"`);
  } else {
    console.log("  no blob captured — download likely not triggered");
  }

  // Wait for the server render round-trip (up to ~20s) if not seen yet.
  for (let i = 0; i < 40 && pdfHits.length === 0; i++) await new Promise((r) => setTimeout(r, 500));

  // Open the produced PDF in Chrome and screenshot it for a visual check.
  if (fs.existsSync(OUT) && fs.statSync(OUT).size > 0) {
    const pdfPage = await browser.newPage();
    pdfPage.setViewport({ width: 816, height: 1056 });
    await pdfPage.goto(`file://${OUT.replace(/\\/g, "/")}`, { waitUntil: "load" });
    await new Promise((r) => setTimeout(r, 1500)); // let Chrome's PDF viewer paint
    await pdfPage.screenshot({ path: PDF_PNG, type: "png" });
    console.log("✓ screenshot of rendered PDF → cert-from-pdf.png");
    await pdfPage.close();
  }

  console.log("pdfHits:", JSON.stringify(pdfHits));
  await browser.close();
})().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exit(1);
});
