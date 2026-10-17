const fs = require("fs");
const zlib = require("zlib");
const pdf = fs.readFileSync(process.argv[2] || "sf9_absolute.pdf");
const latin = pdf.toString("latin1");
const ms = latin.match(/\/Count\s+(\d+)/g);
console.log("Count entries:", ms);
console.log("has /Page:", (latin.match(/\/Page/g) || []).length);
console.log("has ObjStm:", latin.includes("/ObjStm"));

function inflateAll(pdf) {
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
    out.push({ text: txt, len: raw.length });
    idx = e + 9;
  }
  return out;
}
const streams = inflateAll(pdf);
console.log("streams:", streams.length);
streams.forEach((s, i) => {
  console.log(`--- stream ${i} rawLen=${s.len} inflated=${s.text ? s.text.length : "FAIL"}`);
});
const firstContent = streams.map(s => s.text).filter(t => t && (t.includes("Tj") || t.includes(" TJ") || t.includes("Td")));
if (firstContent[0]) {
  console.log("=== sample content (first 1500) ===");
  console.log(firstContent[0].slice(0, 1500));
}
