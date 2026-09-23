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
| 4 | Room ↔ Schedule sync — rooms turn `Occupied`/`Available` automatically; `Maintenance`/`Inactive` preserved | `server/src/controllers/schedules.controller.ts`, `server/migrations/029_room_occupied.sql` |
| 5 | School years list ordered numerically by year (desc) | `server/src/controllers/schoolYears.controller.ts` |
| 6 | User edit now saves `status` (was silently dropped) — role/status edits persist | `server/src/controllers/users.controller.ts` |
| 7 | Profile editability — Employee ID / Designation / Date Hired editable on all 4 profile pages | `auth.controller.ts`, `services/api.ts`, `ProfileSections.tsx`, 4× profile pages |
| 8 | SchoolSettings — Principal/Registrar required (with `*`), Active SY read‑only, enrollment dates normalized | `src/app/pages/admin/SchoolSettings.tsx` |
| 9 | TopBar — "Home" breadcrumb clickable → your role dashboard | `src/app/components/layout/TopBar.tsx` |
| 10 | AdminDashboard — stat card wording + green dot on Total Sections | `src/app/pages/admin/AdminDashboard.tsx` |
| 11 | PrincipalDashboard — pie shows `Name: value` + tooltip `X students` | `src/app/pages/principal/PrincipalDashboard.tsx` |
| 12 | AdminRooms — `Occupied` status displayed & filterable (not selectable in form) | `src/app/pages/admin/AdminRooms.tsx` |
| 13 | Backup resilience — `mysqldump` CLI can't auth to Railway MySQL (`caching_sha2_password`); falls back to a logical dump via the app's mysql2 connection; restore does the same. Manual AND scheduled backups now work | `server/src/utils/dbBackup.ts`, `backups.controller.ts`, `backupCron.ts` |

### Pending — live testing

- [ ] LIS export, backup download, subject delete, schedule→room sync
- [ ] Profile edit, user edit (status/role), school settings save
- [ ] Known unknowns needing a live repro: SF‑form edit resetting values, Activity Logs scroll, grade‑upload template download, calendar SY reversion
- [ ] Commit the changes (currently 19 modified files + 1 new migration, uncommitted)

---

## 2. How to test the fixes

Prerequisites:
1. Restart the server once so the new migration `029_room_occupied.sql` runs (adds `Occupied` to `rooms.status`).
2. Logins: `admin`, `teacher01`, `registrar01` / `password123`.

| Fix | Where to test | Steps |
|-----|---------------|-------|
| LIS Excel | LIS panel (top bar, any role) | Open a learner profile that has sections → **Export LIS** → file downloads & opens (previously crashed) |
| Subject delete | Sections/Subjects (admin) | Delete a subject that has records → clear 409 message; delete an unused subject → succeeds |
| Backup download | Admin → Database Management | Create a backup → **Download** works (table row + mobile list) |
| Room sync | Registrar → Scheduling + Admin → Rooms | Create a schedule with a room → room becomes **Occupied**; delete schedule → back to **Available**; set a room to **Maintenance**, schedule in it → stays **Maintenance** |
| User edit | Admin → User Management | Open a user → change **status** or role → Save → persists after reload |
| Profile edit | Any profile page → **Edit** | Edit Employee ID / Designation / Date Hired → Save → header + Employment card update |
| School settings | Admin → Settings | Clear Principal or Registrar → blocked; Active School Year is greyed out |
| Dashboard text | Admin dashboard + Principal dashboard | Stats read "Across all grades…", "Teachers with active accounts"; pie labels `Program: value` |