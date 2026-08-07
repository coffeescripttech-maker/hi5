/** Debug: navigate to SF9 and dump the select options + page state. */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");
const FRONT = process.env.FRONT_URL || "http://localhost:5173";
const CHROME = process.env.PDF_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 200)); });
  page.on("requestfailed", (r) => console.log("[reqfailed]", r.url().slice(0, 140), r.failure()?.errorText));

  await page.goto(`${FRONT}/login`, { waitUntil: "networkidle0" });
  const u = await page.waitForSelector('input[placeholder="Enter your username"]', { timeout: 20000 });
  await u.type("registrar01");
  const p = await page.waitForSelector('input[placeholder="Enter your password"]');
  await p.type("password123");
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), p.press("Enter")]);
  await page.waitForSelector("[data-nav-item]", { timeout: 15000 });
  await page.evaluate(() => {
    Array.from(document.querySelectorAll("[data-nav-item]")).find((b) => b.textContent.includes("SF9 — Report Card"))?.click();
  });
  await page.waitForFunction(() => location.pathname.includes("/forms/sf9"), { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 4000)); // let data load

  const dump = await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll("select")).map((s) => ({
      label: s.closest("div")?.querySelector("label")?.textContent || "?",
      options: Array.from(s.options).map((o) => `${o.value}:${o.textContent.trim().slice(0, 40)}`),
    }));
    return {
      pathname: location.pathname,
      selects,
      hasPrintArea: !!document.getElementById("sf9-print-area"),
      loadingText: document.body.innerText.match(/Loading[^\n]*/)?.[0] || null,
      errText: document.body.innerText.match(/Failed to load[^\n]*/)?.[0] || null,
    };
  });
  console.log(JSON.stringify(dump, null, 1));
  await browser.close();
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
