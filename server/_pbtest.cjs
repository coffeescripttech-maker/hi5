const puppeteer = require("puppeteer-core");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

function htmlFor(pos) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @media print {
    #root { position: ${pos}; left:0; top:0; width:100%; padding: 0.15in; }
    #root .pg { page-break-after: always; }
    #root .pg:last-child { page-break-after: avoid; }
    @page { size: letter landscape; margin: 0.3in; }
  }
  .pg { height: 100px; border: 2px solid #000; margin: 4px; }
  </style></head><body>
  <div id="root">
    <div class="pg">PAGE ONE</div>
    <div class="pg">PAGE TWO</div>
    <div class="pg">PAGE THREE</div>
  </div>
  </body></html>`;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  for (const pos of ["absolute", "static"]) {
    const page = await browser.newPage();
    await page.setContent(htmlFor(pos), { waitUntil: "load" });
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    require("fs").writeFileSync(`_pb_${pos}.pdf`, pdf);
    const latin = pdf.toString("latin1");
    const count = (latin.match(/\/Type\s*\/Page[^s]/g) || []).length;
    const counts = (latin.match(/\/Count\s+\d+/g) || []);
    const kids = (latin.match(/Kids\s*\[[^\]]*\]/g) || []);
    console.log(`position=${pos}  PageObjs=${count}  counts=[${counts.join(",")}]  kids=${kids.length}  bytes=${pdf.length}`);
    await page.close();
  }
  await browser.close();
})().catch(e => { console.log("FATAL", e.message); process.exit(1); });
