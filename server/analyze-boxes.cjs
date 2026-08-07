/**
 * Loads the captured serialized.html into a blank page and lists every element
 * that has a visible inline border / outline / non-white background — i.e.
 * anything that could draw the reported "gray box" around text or images.
 * Run: cd server && node analyze-boxes.cjs
 */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "serialized.html"), "utf8");
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 816, height: 1056 });
  await page.setContent(html, { waitUntil: "load" });
  await new Promise(r => setTimeout(r, 800));

  const { issues, imgs } = await page.evaluate(() => {
    const out = [];
    const all = document.querySelectorAll("#cert-goodmoral-content *");
    for (const el of all) {
      const tag = el.tagName.toLowerCase();
      const cls = (el.className || "").toString();
      const style = el.getAttribute("style") || "";
      // Only care about elements with some inline style that could draw a box.
      const cs = getComputedStyle(el);
      const bw = ["border-top-width","border-right-width","border-bottom-width","border-left-width"]
        .map(p => parseFloat(cs[p])).reduce((a,b)=>a+b,0);
      const outline = cs.outlineStyle !== "none";
      const bg = cs.backgroundColor;
      const nonWhiteBg = bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "rgb(255, 255, 255)";
      if (bw > 0 || outline || nonWhiteBg) {
        out.push({
          tag, cls: cls.slice(0, 60),
          borderW: bw, outline: cs.outlineStyle, bg,
          // short text preview
          text: (el.textContent || "").trim().slice(0, 50),
          hasImg: el.querySelector("img") !== null,
        });
      }
    }
    // Also check the images themselves
    const imgs = [];
    for (const img of document.querySelectorAll("#cert-goodmoral-content img")) {
      const cs = getComputedStyle(img);
      const bw = ["border-top-width","border-right-width","border-bottom-width","border-left-width"].map(p => parseFloat(cs[p])).reduce((a,b)=>a+b,0);
      const rect = img.getBoundingClientRect();
      imgs.push({ src: (img.getAttribute("src")||"").slice(0, 40), w: Math.round(rect.width), h: Math.round(rect.height), borderW: bw, loaded: img.complete && img.naturalWidth > 0, natW: img.naturalWidth });
    }
    return { issues: out, imgs };
  });

  console.log("── elements with visible border/outline/bg ──");
  for (const i of issues) console.log(`  <${i.tag} class="${i.cls}"> border=${i.borderW} outline=${i.outline} bg=${i.bg} text="${i.text}"`);
  console.log(`  (${issues.length} total)`);
  console.log("── images ──");
  for (const i of imgs || []) console.log(" ", JSON.stringify(i));
  await browser.close();
})().catch(e => { console.error("FAILED:", e); process.exit(1); });
