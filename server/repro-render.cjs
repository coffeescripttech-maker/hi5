/** Reproduces the exact server render path for a captured serialized html. */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const file = process.argv[2] || "sf1-serialized.html";

(async () => {
  const html = fs.readFileSync(path.join(__dirname, file), "utf8");
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"] });
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    await Promise.race([page.evaluate(() => document.fonts.ready), new Promise((r) => setTimeout(r, 8000))]);
    console.log("setContent + fonts OK, html bytes:", Buffer.byteLength(html));
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    console.log("page.pdf OK, bytes:", Buffer.byteLength(pdf));
    fs.writeFileSync(path.join(__dirname, "repro-" + file), pdf);
  } catch (e) {
    console.log("ERROR:", e.message);
    console.log(e.stack ? e.stack.split("\n").slice(0, 5).join("\n") : "");
  }
  await browser.close();
})().catch((e) => { console.log("FATAL:", e.message); process.exit(1); });
