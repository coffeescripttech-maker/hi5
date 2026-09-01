/**
 * Probe: verify GET /api/subjects/me/assigned returns subject 8 for teacher01 (userId 2)
 */
const jwt = require("jsonwebtoken");
require("dotenv").config();

const secret = process.env.JWT_SECRET;
if (!secret) { console.error("no JWT_SECRET in .env"); process.exit(1); }

const token = jwt.sign({ userId: 2, username: "teacher01", role: "teacher" }, secret, { expiresIn: "5m" });
const base = `http://localhost:${process.env.PORT || 3001}`;

(async () => {
  const res = await fetch(`${base}/api/subjects/me/assigned`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("STATUS:", res.status);
  const body = await res.json();
  console.log("BODY:", JSON.stringify(body, null, 1));
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
