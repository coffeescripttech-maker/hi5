/**
 * Creates the missing SHS TVL specialization subjects (GL11/GL12) and links
 * them to the TVL strand track — mirroring the school's existing JHS TLE
 * "specialized" subject conventions (name/subject_type/subject_group/hours).
 * Idempotent: matches on (name, grade_level); links only inserted when absent.
 *
 * Usage (from server/):  node scripts/seedTvlSpecializations.cjs
 *                        node scripts/seedTvlSpecializations.cjs --apply
 */
const path = require("path");
const fs = require("fs");
const mysql = require(path.join(__dirname, "../node_modules/mysql2/promise"));

const env = {};
for (const line of fs.readFileSync(path.join(__dirname, "../.env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const APPLY = process.argv.includes("--apply");

const TVL_TRACK_ID = 10; // strand_tracks.code = 'tvl'
const SPECIALIZATIONS = [
  "TLE — Home Economics",
  "TLE — Information & Communications Technology",
  "TLE — Industrial Arts",
  "TLE — Agriculture & Fishery Arts",
  "TLE — Entrepreneurship & Innovation Arts",
];
const GRADE_LEVELS = [11, 12];

(async () => {
  const conn = await mysql.createConnection({
    host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USER,
    password: env.DB_PASSWORD, database: env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });
  const [track] = await conn.query("SELECT id, code, name FROM strand_tracks WHERE id = ? AND is_active = 1", [TVL_TRACK_ID]);
  if (track.length === 0) { console.error("TVL track missing — aborting"); await conn.end(); process.exit(1); }
  console.log("TVL track:", track[0].name, "| mode:", APPLY ? "APPLY" : "DRY-RUN");

  let created = 0, linked = 0, skipped = 0;
  for (const gl of GRADE_LEVELS) {
    for (const name of SPECIALIZATIONS) {
      const [exists] = await conn.query(
        "SELECT id FROM subjects WHERE name = ? AND grade_level = ? LIMIT 1", [name, gl]
      );
      let subjectId;
      if (exists.length > 0) {
        subjectId = exists[0].id;
        skipped++;
      } else if (APPLY) {
        await conn.beginTransaction();
        try {
          const [ins] = await conn.query(
            `INSERT INTO subjects (name, grade_level, hours_per_week, subject_type, subject_group, program, is_active)
             VALUES (?, ?, 3.0, 'specialized', 'tle', NULL, 1)`,
            [name, gl]
          );
          subjectId = ins.insertId;
          await conn.commit();
          created++;
        } catch (e) {
          await conn.rollback();
          console.error("INSERT FAIL:", name, gl, e.message);
          continue;
        }
      } else {
        console.log("(dry) would create:", name, gl);
        continue;
      }

      const [link] = await conn.query(
        "SELECT id FROM subject_strand_tracks WHERE subject_id = ? AND strand_track_id = ?",
        [subjectId, TVL_TRACK_ID]
      );
      if (link.length === 0 && APPLY) {
        await conn.query("INSERT INTO subject_strand_tracks (subject_id, strand_track_id) VALUES (?, ?)", [subjectId, TVL_TRACK_ID]);
        linked++;
      }
      console.log(`GL${gl} ${name} -> subject ${subjectId}${link.length === 0 ? " (linked to TVL)" : " (already linked)"}`);
    }
  }
  console.log(`SUMMARY: created=${created} linked=${linked} already-exist=${skipped} (mode: ${APPLY ? "APPLY" : "DRY-RUN"})`);
  await conn.end();
})().catch(e => { console.error("FATAL", e); process.exit(1); });
