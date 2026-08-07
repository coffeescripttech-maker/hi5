/** POSTs a tiny html to /api/pdf/render to check if the server browser is healthy. */
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

// Read JWT_SECRET from server/.env
const env = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
const secret = (env.match(/^JWT_SECRET=(.*)$/m) || [])[1];
if (!secret) { console.error("no JWT_SECRET in .env"); process.exit(1); }

const token = jwt.sign({ id: 1, username: "registrar01", role: "registrar" }, secret, { expiresIn: "5m" });

(async () => {
  const file = process.argv[2];
  const html = file
    ? fs.readFileSync(path.join(__dirname, file), "utf8")
    : `<!DOCTYPE html><html><head><style>@page { size: letter landscape; margin: 0.3in; }</style></head><body><h1>probe</h1></body></html>`;
  const t0 = Date.now();
  const res = await fetch("http://localhost:3001/api/pdf/render", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ html, filename: "probe" }),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`status: ${res.status} type: ${res.headers.get("content-type")} in ${Date.now() - t0}ms (html ${Buffer.byteLength(html)} bytes)`);
  if (res.status === 200) {
    console.log("PDF magic:", buf.slice(0, 5).toString(), "bytes:", buf.length);
    const out = path.join(__dirname, `probe-${(file || "minimal").replace(/\.html$/, "")}.pdf`);
    fs.writeFileSync(out, buf);
    console.log("saved", out);
  } else console.log("body:", buf.slice(0, 400).toString());
})();
