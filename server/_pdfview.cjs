const puppeteer = require("puppeteer-core");
const path = require("path");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 850 });
  const pdfUrl = "file:///" + path.join(__dirname, "sf9_absolute.pdf").replace(/\\/g, "/");
  try {
    await page.goto(pdfUrl, { waitUntil: "networkidle2", timeout: 20000 });
  } catch (e) { console.log("goto err", e.message); }
  await new Promise(r => setTimeout(r, 3000));
  const html = await page.content();
  console.log("content length", html.length, "has embed", html.includes("embed"), "has plugin", html.toLowerCase().includes("plugin"));
  const png = await page.screenshot({ type: "png" });
  require("fs").writeFileSync(path.join(__dirname, "_pdfview.png"), png);
  console.log("screenshot bytes", png.length);
  await browser.close();
})().catch(e => { console.log("FATAL", e.message); process.exit(1); });
