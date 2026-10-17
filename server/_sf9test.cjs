const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const cssPath = path.join(__dirname, "..", "dist", "assets", "index-CzMkNXOU.css");
const css = fs.readFileSync(cssPath, "utf8");
let tpl = fs.readFileSync(path.join(__dirname, "sf9repro.html"), "utf8");
tpl = tpl.replace("/*CSS_INJECT*/", "<style>" + css + "</style>");
// give page 1 enough height to fill a full page
tpl = tpl.replace('<h2 style="text-align:center">PAGE ONE PLACEHOLDER</h2>',
  '<div style="height:7.4in"></div><h2 style="text-align:center">PAGE ONE PLACEHOLDER</h2>');

function inflateStreams(pdf) {
  const latin = pdf.toString("latin1");
  const out = [];
  let idx = 0;
  while (true) {
    const s = latin.indexOf("stream", idx);
    if (s === -1) break;
    let d = s + 6;
    if (latin[d] === "\r") d++;
    if (latin[d] === "\n") d++;
    const e = latin.indexOf("endstream", d);
    if (e === -1) break;
    const raw = Buffer.from(latin.slice(d, e), "latin1");
    let txt = null;
    try { txt = zlib.inflateSync(raw).toString("latin1"); } catch {}
    if (!txt) { try { txt = zlib.inflateRawSync(raw).toString("latin1"); } catch {} }
    if (txt) out.push(txt);
    idx = e + 9;
  }
  return out;
}

function countPages(pdf) {
  const latin = pdf.toString("latin1");
  const m = latin.match(/\/Type\s*\/Page[^s]/g);
  return m ? m.length : 0;
}

// Rough text extraction: walk content stream, track Tm/Td, emit text with x,y.
function extractText(stream) {
  const items = [];
  const re = /([-\d.]+)\s+([-\d.]+)\s+(Td|TD)|([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+Tm|\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
  let curX = 0, curY = 0, lastX = 0, lastY = 0;
  let m;
  while ((m = re.exec(stream))) {
    if (m[3]) {
      curX = lastX + parseFloat(m[1]);
      curY = lastY + parseFloat(m[2]);
      lastX = curX; lastY = curY;
    } else if (m[9] !== undefined) {
      curX = parseFloat(m[7]); curY = parseFloat(m[8]);
      lastX = curX; lastY = curY;
    } else if (m[10] !== undefined) {
      items.push({ text: m[10], x: Math.round(curX), y: Math.round(curY) });
    }
  }
  return items;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  for (const pos of ["absolute", "static"]) {
    const html = tpl.replace("__POS__", pos);
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(path.join(__dirname, `sf9_${pos}.pdf`), pdf);
    console.log(`\n===== position: ${pos} =====`);
    console.log("pages:", countPages(pdf), "bytes:", pdf.length);
    const streams = inflateStreams(pdf);
    for (let i = 0; i < streams.length; i++) {
      const items = extractText(streams[i]);
      if (!items.length) continue;
      const legend = items.filter(t => /Always Observed|Sometimes Observed|Rarely Observed|Not Observed/.test(t.text));
      const behavior = items.filter(t => /Maka-Diyos|Makatao|Maka-Kalikasan|Maka-Bansa|spiritual beliefs|ethical principles|cultural differences|solidarity|environment|Filipino citizen|behavior in carrying out/.test(t.text));
      if (legend.length || behavior.length) {
        console.log(` stream ${i}: legendItems=${legend.length} behaviorItems=${behavior.length}`);
        for (const t of legend) console.log(`   LEGEND  y=${t.y} x=${t.x}  ${t.text.slice(0,40)}`);
        for (const t of behavior.slice(0, 8)) console.log(`   BEHAV   y=${t.y} x=${t.x}  ${t.text.slice(0,40)}`);
      }
    }
    await page.close();
  }
  await browser.close();
})().catch(e => { console.log("FATAL", e.message); process.exit(1); });
