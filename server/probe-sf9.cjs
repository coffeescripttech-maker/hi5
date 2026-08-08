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
  page.on("response", async (res) => {
    const u = res.url();
    if (/\/api\/(sections|enrollments|school-years|students)(\?|$)/.test(u) && res.request().method() === "GET") {
      let body = "";
      try { body = (await res.text()).slice(0, 200); } catch {}
      console.log(`[api] ${res.status()} ${u.replace("http://localhost:5173", "")} → ${body.slice(0, 120)}`);
    }
  });

  // Capture what the app's own api client receives for /sections, then apply the exact filter the page uses.
  await page.evaluateOnNewDocument(() => {
    const orig = window.fetch;
    window.__sf9Debug = { sectionsRaw: null, sectionsParsed: null, filterResult: null };
    window.fetch = async (...args) => {
      const url = String(args[0]);
      const res = await orig.apply(window, args);
      if (url.includes("/api/sections") && !url.includes("my-sections")) {
        const clone = res.clone();
        try {
          const j = await clone.json();
          window.__sf9Debug.sectionsRaw = j;
          window.__sf9Debug.sectionsParsed = j;
          const active = (j || []).filter((s) => s.is_active === 1);
          window.__sf9Debug.filterResult = active.map((s) => ({
            id: s.id, name: s.name, grade_level: s.grade_level, is_active: s.is_active,
          }));
        } catch (e) {
          window.__sf9Debug.filterResult = "PARSE_ERR " + e.message;
        }
      }
      return res;
    };
  });

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
  // Wait until the app's api client has received the sections array, then give
  // React a beat to flush state, then dump the section select at 3 timepoints.
  await page.waitForFunction(() => {
    const d = window.__sf9Debug;
    return d && Array.isArray(d.filterResult) && d.filterResult.length > 0;
  }, { timeout: 15000 });

  const dumpNow = async () => {
    return page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll("select")).map((s) => ({
        label: s.closest("div")?.querySelector("label")?.textContent || "?",
        value: s.value,
        options: Array.from(s.options).map((o) => `${o.value}:${o.textContent.trim().slice(0, 40)}`),
      }));
      return { selects };
    });
  };

  for (const wait of [300, 1500, 3000]) {
    await new Promise((r) => setTimeout(r, wait));
    const d = await dumpNow();
    console.log(`\n── after +${wait}ms ──`);
    console.log(JSON.stringify(d.selects, null, 1));
  }

  const dump = await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll("select")).map((s) => ({
      label: s.closest("div")?.querySelector("label")?.textContent || "?",
      value: s.value,
      options: Array.from(s.options).map((o) => `${o.value}:${o.textContent.trim().slice(0, 40)}`),
    }));
    return {
      pathname: location.pathname,
      selects,
      hasPrintArea: !!document.getElementById("sf9-print-area"),
      loadingText: document.body.innerText.match(/Loading[^\n]*/)?.[0] || null,
      errText: document.body.innerText.match(/Failed to load[^\n]*/)?.[0] || null,
      pageText: document.body.innerText.slice(0, 400),
      sf9Debug: window.__sf9Debug,
    };
  });
  console.log(JSON.stringify(dump, null, 1));
  await browser.close();
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
