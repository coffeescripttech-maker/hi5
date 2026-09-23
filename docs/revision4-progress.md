# Revision 4 — Progress & Testing Guide

Status as of: 2026-09-23
Both builds pass: `npx tsc --noEmit` (server) and `npm run build` (root).

---

## 1. Progress track

### Done — code complete & builds verified

| # | Fix | Key file(s) |
|---|-----|-------------|
| 1 | LIS Excel export — fixed `getExcelLetter` helper (crash on export) | `server/src/controllers/lis.controller.ts` |
| 2 | Subject delete — FK protection, clear 409 message, deletes assignments first | `server/src/controllers/subjects.controller.ts` |
| 3 | Backup download — new `GET /backups/:id/download`, wired buttons, `utf8mb4` on backup + restore | `backups.controller.ts`, `backups.routes.ts`, `src/app/services/backups.ts`, `DatabaseBackup.tsx` |
| 4 | Room ↔ Schedule sync — rooms turn `Occupied`/`Available` automatically; `Maintenance`/`Inactive` preserved. **Fixed live**: schedule create/update/delete were 500-ing everywhere because migration `029` had never been applied (its SQL also dropped the wrong CHECK) — new **`031_room_status_occupiable.sql`** normalizes the `rooms.status` CHECK to allow `Occupied` (idempotent either way); `findConflicts` now detects overlaps on room **OR** teacher **OR** section (was AND — cross-room teacher double-bookings slipped through); `syncRoomStatus` no longer clobbers a manual `Maintenance`/`Inactive`. Frontend Schedule Modifier now picks a room from the rooms list and saves `room_id` (was free text → no link, no Occupied) | `server/migrations/031_room_status_occupiable.sql`, `schedules.controller.ts`, `ScheduleModifier.tsx` |
| 5 | School years list ordered numerically by year (desc) | `server/src/controllers/schoolYears.controller.ts` |
| 6 | User edit now saves `status` (was silently dropped) — role/status edits persist | `server/src/controllers/users.controller.ts` |
| 7 | Profile editability — Employee ID / Designation / Date Hired editable on all 4 profile pages | `auth.controller.ts`, `services/api.ts`, `ProfileSections.tsx`, 4× profile pages |
| 8 | SchoolSettings — Principal/Registrar required (with `*`), Active SY read‑only, enrollment dates normalized | `src/app/pages/admin/SchoolSettings.tsx` |
| 9 | TopBar — "Home" breadcrumb clickable → your role dashboard | `src/app/components/layout/TopBar.tsx` |
| 10 | AdminDashboard — stat card wording + green dot on Total Sections | `src/app/pages/admin/AdminDashboard.tsx` |
| 11 | PrincipalDashboard — pie shows `Name: value` + tooltip `X students` | `src/app/pages/principal/PrincipalDashboard.tsx` |
| 12 | AdminRooms — `Occupied` status displayed & filterable (not selectable in form) | `src/app/pages/admin/AdminRooms.tsx` |
| 13 | Backup resilience — `mysqldump` CLI can't auth to Railway MySQL (`caching_sha2_password`); falls back to a logical dump via the app's mysql2 connection; restore does the same. Manual AND scheduled backups now work | `server/src/utils/dbBackup.ts`, `backups.controller.ts`, `backupCron.ts` |
| 14 | Forgot Password → one-time reset **link** (was a 6-digit code) — tokenized `/reset-password` page, emailed link, token cleared on use/expiry. Live-tested end‑to‑end and reverted | `auth.controller.ts`, `mailer.ts`, `Login.tsx`, `ResetPassword.tsx`, `routes.tsx`, `services/api.ts` |
| 15 | Complete Terms of Service / Privacy Policy / Conditions of Use — full texts seeded into `school_settings` (editor shows them, login modals render them); covers collected / stored / used / security / retention / rights (RA 10173). Applied live + **migration `030_seed_legal_documents.sql`** for other environments | `server/migrations/030_seed_legal_documents.sql`, `Login.tsx` |
| 16 | SF1/SF5 edit bug — text columns (names, remarks, LRN, action…) were routed through the numeric sanitizer and reset to `0`; only the grade/numeric keys are sanitized now, and the sanitizer returns `''` instead of `0` on bad input | `sf1-register.tsx`, `sf5-report.tsx` |
| 17 | SF1/SF5 signatures auto-populate — "Prepared by"/Adviser = the signed-in account's name (`authApi.me()`), "Certified Correct"/School Head = `settings.principal_name`; all still editable | `sf1-register.tsx`, `sf5-report.tsx` |
| 18 | Database restore fixed — dump adds `DROP TABLE IF EXISTS` before every `CREATE TABLE` and relaxes/restores `sql_mode` (`SET @OLD_SQL_MODE…, SQL_MODE=''`), so empty ENUM rows no longer truncate and restore works on a populated DB. Verified live: fresh DB pass, existing-data pass, and a full `/backups/:id/restore` on the real DB | `server/src/utils/dbBackup.ts` |
| 19 | Backup dir stabilized — `server/backups` (resolved from `process.cwd()`, shared by controller + cron, `__dirname`-independent) | `server/src/utils/dbBackup.ts`, `backups.controller.ts`, `backupCron.ts` |
| 20 | Backup download — blob fetch with the `Authorization` header (replaces `window.open`+token query, so it can't be popup-blocked); simulated-progress interval is cleared on success AND failure | `src/app/services/backups.ts`, `DatabaseBackup.tsx` |
| 21 | Subject Management — "Assigned Teacher" column/header now clickable and expands inline to the assigned teacher(s), separate "Assign Teacher" action kept; subject's assignments purged from React state after delete | `src/app/pages/admin/SubjectManagement.tsx` |
| 22 | Activity Logs — desktop table scrolls inside its card (`max-h-[70vh]`, smooth + contained overscroll) | `ActivityLogs.tsx`, `src/styles/index.css` |
| 23 | Grade Summary (LIS) PDF — no more one-page squeeze. Rebuilt as several A4-landscape pages: fixed learner columns (LRN 70px, **Learner Name 200px**, Grade, Section) + Gen. Average/Promotion repeat on **every** page, at most 3 subjects per page, two-line header (subject name spanning Q1–Q4) with readable horizontal labels (no rotation), a practical 9px font (subject heads 8.5px), header repeated on every page (`thead` + chunk page-breaks), letterhead logos on each page. Rendered live via `/pdf/render` and layout-verified with headless Chrome (26 pages in dev data, each table 972px — fits A4 landscape) | `src/app/services/lisPdf.ts` |
| 24 | Grade Summary data scope — the pivot listed **every grade level's** subjects (78 in dev data: 13 subjects × 6 levels via the `(name, grade_level)` unique key), so pages 2+ repeated the same learners with empty columns. Now restricted to the grade level(s) of the filtered roster and, when grades exist, to the subjects that actually received them (fallback keeps graded subjects outside the level list). Dev data fell from **26 pages → 1**. Removed the "· Page X of Y" noise from the title | `server/src/controllers/lis.controller.ts`, `src/app/services/lisPdf.ts` |
| 25 | Grade Upload template download — went through `window.open(…?token=…)`, which the popup blocker kills. Switched `documentsApi.template`/`download` to a blob fetch with the `Authorization` header + anchor download (same as backups); the Upload Grades button shows a spinner and surfaces failures via toast | `src/app/services/documents.ts`, `UploadGrades.tsx` |

### Pending — live testing

- [ ] SF forms (SF1/SF5) — visual check in the browser: text cells no longer reset to `0`, signatures show the account + principal names
- [ ] Activity Logs — desktop list scrolls within its card; row click still opens the viewer
- [ ] Backup **download** — new blob-based download needs a click in the browser (button works, endpoint verified); restore is verified end‑to‑end live
- [ ] Grade Upload **template** download — now a blob fetch; needs a click in the browser (endpoint verified server‑side)
- [ ] Basic reset link only exercised server‑side (SMTP configured) — take a look at the `/reset-password` page UI in the browser
- [ ] Subject delete for admins — delete a subject with grades/pending corrections → guidance message; an unused one → succeeds (backend verified live)

---

## 2. How to test the fixes

Prerequisites:
1. Restart the server once so the new migrations run (`029_room_occupied.sql`, `030_seed_legal_documents.sql`, `031_room_status_occupiable.sql`).
2. Logins: `admin`, `teacher01`, `registrar01` / `password123`.

| Fix | Where to test | Steps |
|-----|---------------|-------|
| LIS Excel | LIS panel (top bar, any role) | Open a learner profile that has sections → **Export LIS** → file downloads & opens (previously crashed) |
| Subject delete | Sections/Subjects (admin) | Delete a subject that has records → clear 409 message; delete an unused subject → succeeds |
| Backup download | Admin → Database Management | Create a backup → **Download** works (table row + mobile list); **Restore** → success and you stay logged in (verified live) |
| Room sync | Registrar → Scheduling + Admin → Rooms | Create a schedule with a room (Room dropdown) → room becomes **Occupied**; delete schedule → back to **Available**; same teacher booked in two rooms at overlapping times → **blocked 409**; set a room to **Maintenance**, schedule in it → stays **Maintenance** |
| User edit | Admin → User Management | Open a user → change **status** or role → Save → persists after reload |
| Profile edit | Any profile page → **Edit** | Edit Employee ID / Designation / Date Hired → Save → header + Employment card update |
| School settings | Admin → Settings | Clear Principal or Registrar → blocked; Active School Year is greyed out |
| Dashboard text | Admin dashboard + Principal dashboard | Stats read "Across all grades…", "Teachers with active accounts"; pie labels `Program: value` |
| Reset link | Login → Forgot Password? | Enter email → "Check your email" screen → open emailed link (or the amber dev link) → set new password → sign in with it |
| Legal docs | Login modals + Admin → Settings → Data Privacy | Full Terms/Privacy/Conditions show seeded on login; editor under "Legal Documents at Login" loads them; edit & save → login modals reflect the change |
| SF1/SF5 edit | Registrar → School Forms → SF1 / SF5 | Edit a name/LRN/remark cell → it keeps what you type (previously became `0`); signatures show the account name (Prepared by) and principal (Certified) |
| Subject management | Sections/Subjects (admin) | Click "Assigned Teacher" on a row → teacher(s) expand inline; the "Assign Teacher" action still opens the modal |
| Restore | Admin → Database Management | Create a backup → **Restore** → "Database restored successfully" and you stay logged in (verified live end‑to‑end) |
| Grade Summary PDF | Registrar → LIS Export → Grade Summary → **Official PDF** | Several landscape pages; Learner Name 200px on every page; each page shows ≤3 subjects with Q1–Q4 read from left to right (no vertical headers); Gen. Average / Promotion Status repeated per page; header row repeats on page breaks. Only subjects with grades in that school year appear (no more 20+ empty pages) |
| Grade Upload template | Teacher → Grade Management → Upload Grades | Select section + subject + school year, click **Download Excel Template** → `.xlsx` downloads from the server (no blank popup tab); matches LRN | Student Name | Grade |