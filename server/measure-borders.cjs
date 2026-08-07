/** Compares live border computed values vs the pristine-iframe UA baseline. */
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

  const r = await page.evaluate(() => {
    const live = document.querySelector("#cert-goodmoral-content p");
    const liveCs = getComputedStyle(live);
    // pristine iframe baseline
    const frame = document.createElement("iframe");
    frame.style.display = "none";
    document.body.appendChild(frame);
    const idoc = frame.contentDocument;
    idoc.body.innerHTML = "<p></p>";
    const baseCs = getComputedStyle(idoc.querySelector("p"));
    const props = ["border-top-width", "border-top-style", "border-top-color", "border-width", "border-style", "border-color"];
    const out = { live: {}, baseline: {} };
    for (const prop of props) {
      out.live[prop] = liveCs.getPropertyValue(prop);
      out.baseline[prop] = baseCs.getPropertyValue(prop);
    }
    // Also check the live page's own rendered border (is it visible in live too?)
    const liveRect = live.getBoundingClientRect();
    out.liveRect = { w: liveRect.width, h: liveRect.height };
    frame.remove();
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch(e => { console.error("FAILED:", e); process.exit(1); });
