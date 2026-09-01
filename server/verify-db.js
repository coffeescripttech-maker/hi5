const mysql = require("mysql2/promise");
(async () => {
  const c = await mysql.createConnection({ host: "127.0.0.1", user: "root", database: "hi5_portal" });
  const [r] = await c.query("SHOW TABLES LIKE ?", ["rooms"]);
  console.log("rooms:", r.length ? "EXISTS" : "MISSING");
  const [rc] = await c.query("SELECT COUNT(*) AS cnt FROM rooms");
  console.log("rooms_count:", rc[0].cnt);
  const [col] = await c.query("SHOW COLUMNS FROM schedules LIKE ?", ["room_id"]);
  console.log("room_id_col:", col);
  const [sc] = await c.query("SELECT COUNT(*) AS cnt FROM schedule_changes");
  console.log("schedule_changes:", sc[0].cnt);
  const [tc] = await c.query("SELECT COUNT(*) AS cnt FROM teacher_subject_assignments");
  console.log("teacher_subject_assignments:", tc[0].cnt);
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });