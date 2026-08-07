/**
 * Captures the exact serialized HTML the Download PDF button sends to the
 * server, saves it to disk, and renders the resulting PDF so we can inspect
 * what's drawing the reported gray boxes.
 * Run: cd server && node diagnose-boxes.cjs
 */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");
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

  let serialized = null;
  page.on("request", (req) => {
    if (req.url().includes("/api/pdf/render") && req.method() === "POST" && req.postData()) {
      try { serialized = JSON.parse(req.postData()).html; } catch {}
    }
  });
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
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find(x => x.textContent.includes("Download PDF"));
    if (b) b.click();
  });
  for (let i = 0; i < 80 && !(await page.evaluate(() => !!window.__pdfB64)); i++) await new Promise(r => setTimeout(r, 250));

  if (serialized) fs.writeFileSync(path.join(__dirname, "serialized.html"), serialized, "utf8");
  const b64 = await page.evaluate(() => window.__pdfB64);
  if (b64) {
    fs.writeFileSync(path.join(__dirname, "diagnosed.pdf"), Buffer.from(b64, "base64"));
    console.log("saved serialized.html + diagnosed.pdf");
  } else {
    console.log("saved serialized.html; no PDF captured");
  }
  await browser.close();
})().catch(e => { console.error("FAILED:", e); process.exit(1); });
