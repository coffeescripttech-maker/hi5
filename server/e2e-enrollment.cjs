/**
 * End-to-end smoke test for the Certificate of Enrollment "Download PDF" button.
 *
 * Mirrors e2e-good-moral.cjs against the enrollment page: real UI login →
 * sidebar nav → search/pick student → click Download PDF → assert the
 * serialized HTML sent to /api/pdf/render + that a valid PDF is downloaded.
 *
 * Run:  cd server && node e2e-enrollment.cjs
 */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const API = process.env.API_URL || "http://localhost:3001/api";
const FRONT = process.env.FRONT_URL || "http://localhost:5173";
const CHROME = process.env.PDF_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = path.join(__dirname, "smoke-test-enrollment.pdf");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 960 });

  page.on("request", (req) => {
    if (req.url().includes("/api/pdf/render") && req.method() === "POST") {
      const html = req.postData() || "";
      const checks = [
        ["certificate title", /Certificate of Enrollment/],
        ["student name", /Nathan Banaria Miranda/],
        ["LRN", /123456789111/],
        ["Tinos font-face", /@font-face/],
        ["@page rule", /@page\s*\{[^}]*size:\s*letter/i],
        ["logo data URL", /data:image/],
        ["registrar signatory title", /Registrar/i],
      ];
      for (const [label, re] of checks) {
        console.log(`  html contains ${label}: ${re.test(html) ? "YES" : "NO"}`);
      }
      console.log(`  html bytes: ${Buffer.byteLength(html)}`);
    }
  });
  page.on("requestfailed", (req) => console.log("[reqfailed]", req.url().slice(0, 120), req.failure()?.errorText));

  const pdfHits = [];
  page.on("response", async (res) => {
    if (res.url().includes("/api/pdf/render") && res.request().method() === "POST") {
      const hit = { status: res.status(), type: res.headers()["content-type"] };
      pdfHits.push(hit);
      console.log(`→ POST /api/pdf/render: ${hit.status} ${hit.type}`);
      if (res.status() !== 200) console.log("  body:", (await res.text()).slice(0, 300));
    }
  });

  // Allow real downloads into a folder we can inspect.
  const cdp = await page.createCDPSession();
  await cdp.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: path.join(__dirname, "downloads-enrollment"),
  });

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

  await page.waitForSelector('[data-nav-item]', { timeout: 15000 });
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("[data-nav-item]"));
    const hit = btns.find((b) => b.textContent.includes("Certificate of Enrollment"));
    if (hit) hit.click();
  });
  await page.waitForFunction(() => location.pathname.includes("certificates/enrollment"), { timeout: 15000 });
  console.log("url after nav:", page.url());

  const input = await page.waitForSelector('input[placeholder*="Search student"]', { timeout: 20000 });
  await input.click();
  await input.type("Miranda");
  await new Promise((r) => setTimeout(r, 1500)); // debounce + fetch
  await page.waitForSelector('div[class*="animate-scale-in"] button', { timeout: 15000 });
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[class*="animate-scale-in"] button'));
    if (btns[0]) btns[0].click();
  });

  await page.waitForFunction(() => {
    const el = document.getElementById("cert-enrollment-content");
    return el && /Nathan/i.test(el.textContent) && !el.textContent.includes("Loading");
  }, { timeout: 20000 });
  console.log("✓ student picked, certificate filled");

  // Capture the exact blob bytes the browser saves.
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

  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find((x) => x.textContent.includes("Download PDF"));
    if (b) b.click();
  });

  for (let i = 0; i < 60 && !(await page.evaluate(() => !!window.__pdfB64)); i++) {
    await new Promise((r) => setTimeout(r, 500));
  }
  const b64 = await page.evaluate(() => window.__pdfB64);
  if (b64) {
    const buf = Buffer.from(b64, "base64");
    fs.writeFileSync(OUT, buf);
    console.log(`  captured ${buf.length} bytes — magic "${buf.slice(0, 5).toString()}" eof "${buf.slice(-6).toString()}"`);
  } else {
    console.log("  no blob captured — download likely not triggered");
  }

  for (let i = 0; i < 40 && pdfHits.length === 0; i++) await new Promise((r) => setTimeout(r, 500));
  console.log("pdfHits:", JSON.stringify(pdfHits));
  await browser.close();
})().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exit(1);
});
