import { query } from "../src/config/database";
import { RowDataPacket } from "mysql2";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const out = process.argv[2] || "_state.json";

  const years = await query<RowDataPacket[]>(
    "SELECT id, sy_label, is_current, enrollment_open FROM school_years ORDER BY id"
  );
  const current = years.find((y: any) => y.is_current === 1) || null;
  const next = current
    ? years.filter((y: any) => y.id > current.id).sort((a: any, b: any) => a.id - b.id)[0] || null
    : null;

  const snap: any = { captured_at: new Date().toISOString(), current_sy: current, next_sy: next, years };

  if (current) {
    snap.current_sections = await query<RowDataPacket[]>(
      `SELECT s.id, s.name, s.grade_level, s.section_type, s.current_count,
              COUNT(e.id) AS enrolled_now
       FROM sections s
       LEFT JOIN enrollments e ON e.section_id = s.id AND e.school_year_id = ? AND e.status='enrolled'
       WHERE s.is_active = 1
       GROUP BY s.id
       ORDER BY s.grade_level, s.name`,
      [current.id]
    );

    snap.current_by_section = await query<RowDataPacket[]>(
      `SELECT e.section_id, COUNT(*) c
       FROM enrollments e WHERE e.school_year_id = ? AND e.status='enrolled'
       GROUP BY e.section_id`,
      [current.id]
    );

    snap.current_null_section = await query<RowDataPacket[]>(
      `SELECT COUNT(*) c FROM enrollments
       WHERE school_year_id = ? AND status='enrolled' AND section_id IS NULL`,
      [current.id]
    );
  }

  if (next) {
    snap.next_null_section = await query<RowDataPacket[]>(
      `SELECT COUNT(*) c FROM enrollments
       WHERE school_year_id = ? AND status='enrolled' AND section_id IS NULL`,
      [next.id]
    );
    snap.next_enrolled_total = await query<RowDataPacket[]>(
      `SELECT COUNT(*) c FROM enrollments WHERE school_year_id = ? AND status='enrolled'`,
      [next.id]
    );
    snap.next_by_grade = await query<RowDataPacket[]>(
      `SELECT st.grade_level, COUNT(*) c
       FROM enrollments e JOIN students st ON st.id = e.student_id
       WHERE e.school_year_id = ? AND e.status='enrolled'
       GROUP BY st.grade_level ORDER BY st.grade_level`,
      [next.id]
    );
  }

  snap.students_by_grade = await query<RowDataPacket[]>(
    "SELECT grade_level, COUNT(*) c FROM students GROUP BY grade_level ORDER BY grade_level"
  );

  snap.recent_promotions = await query<RowDataPacket[]>(
    `SELECT p.id, p.section_id, s.name AS section_name, p.to_grade_level,
            p.school_year_id, p.status, p.created_at,
            (SELECT COUNT(*) FROM promotion_students ps WHERE ps.promotion_id = p.id) AS student_count,
            (SELECT COUNT(*) FROM promotion_students ps WHERE ps.promotion_id = p.id AND ps.is_retained = 1) AS retained,
            (SELECT COUNT(*) FROM promotion_students ps WHERE ps.promotion_id = p.id AND ps.to_section_id IS NULL) AS pending_section
     FROM promotions p LEFT JOIN sections s ON s.id = p.section_id
     ORDER BY p.id DESC LIMIT 10`
  );

  const file = path.isAbsolute(out) ? out : path.resolve(__dirname, out);
  fs.writeFileSync(file, JSON.stringify(snap, null, 2));

  console.log("=== SNAPSHOT ===");
  console.log("current SY:", current ? `${current.id} ${current.sy_label}` : "NONE");
  console.log("next SY   :", next ? `${next.id} ${next.sy_label}` : "NONE");
  if (snap.current_null_section) console.log("current SY pending (NULL section):", snap.current_null_section[0].c);
  if (snap.next_null_section) console.log("next SY pending (NULL section):", snap.next_null_section[0].c);
  if (snap.next_by_grade) console.log("next SY enrolled by grade:", JSON.stringify(snap.next_by_grade));
  console.log("students by grade:", JSON.stringify(snap.students_by_grade));
  console.log("recent promotions:", JSON.stringify(snap.recent_promotions, null, 0));
  console.log("written ->", file);
  process.exit(0);
}

main().catch((e) => {
  console.error("SNAPSHOT FAILED:", e);
  process.exit(1);
});
