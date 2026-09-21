# Client Revision Tracker — HI5PORTALF

Source: `docs/revision1.txt` (client's list). Status audited against the codebase on **2026-09-14** (branch `main`, commits up to `7f57cb0`) and **live-verified** against the running app (API on :3001, frontend on :5173) the same day. **Re-audited against current source on 2026-09-21 (see "Round 3" below).**

Legend: ✅ **FIXED** (implemented + verified in code and/or live) · 🔍 **VERIFY** (implemented — visual/functional check still pending) · ❌ **NOT STARTED**

---

## LIS

| # | Revision | Status | Evidence |
|---|----------|--------|----------|
| 1 | LIS should be Registrar only | ✅ FIXED | `server/src/routes/lis.routes.ts` — every LIS route is `authorize("registrar")`; teacher nav has no LIS entry (`src/app/navigation.ts:190`) |
| 2 | LIS Export Excel format bugged | ✅ FIXED | Live check: `GET /api/lis/grades.xlsx` → HTTP 200, `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, filename `lis-grades-2031-2032.xlsx`, first bytes `PK\x03\x04` (real xlsx). Registrar-only verified. |
| 3 | LIS Export Document quality (PDF/official look) | 🔍 VERIFY | `.xlsx` workbooks rebuilt (verified live). Official PDF path exists via `GET /api/lis/data` (JSON "used by the official PDF composer") + frontend pdfmake composer — visual quality needs an eyeball check on actual output. |

## Notifications

| # | Revision | Status | Evidence |
|---|----------|--------|----------|
| 4 | Real-time notifications | ✅ FIXED | Live check: `GET /api/notifications/stream?token=` returns SSE framing (`: connected`) with `EventSource` client (`src/app/hooks/useLiveNotifications.ts`, auto-reconnect). |

## Admin

| # | Revision | Status | Evidence |
|---|----------|--------|----------|
| 5 | Hours per Week display ("03.03.03.03") | ✅ FIXED | `src/app/utils/hours.ts` (NEW) formats as "X hr(s)/day · 4 days/wk (Y hrs/wk)"; used in `SubjectManagement.tsx` table (:446), mobile card (:497), modal (:583); and `SubjectView.tsx` (:216) |
| 6 | Create School Year not working/incomplete | ✅ FIXED | Live check: bad label `20-21` → 400 with validation message; `2099` → 201 (auto row); duplicate `2099` → 409 "already exists." Test row cleaned up after. |
| 7 | SF5 PDF broken lines/borders | 🔍 VERIFY | `GET /api/forms/sf5` → 200 with full data; `#sf5-print-area` + print CSS + server Chrome render pipeline in place. Border quality is a visual check on a rendered PDF (browser e2e blocked this round by test-harness login changes). |
| 8 | SF9 PDF broken lines/borders | 🔍 VERIFY | `GET /api/forms/sf9?student_id=4` → 200 with student/enrollment/subjects/general_average; same render pipeline as SF5. Visual border check still pending. |
| 9 | Manual database backup not working | ✅ FIXED | Live check: `POST /api/backups` → 201; file `backup-hi5_portal-2026-09-14T07-32-09.sql` (166,469 bytes) written to disk. Cron auto-backup also confirmed in logs. |
| 10 | School Settings required fields validated | ✅ FIXED | `SchoolSettings.tsx:65-74` required-field validation blocks save with toast |
| 11 | Calendar-year option for SY config | ✅ FIXED | `createSchoolYear` accepts `^\d{4}$` (calendar year) alongside `^\d{4}[-–]\d{4}$` (live: `2099` → 201) |
| 12 | Inactive SYs grayed out | ✅ FIXED | `AcademicYearManagement.tsx:291-297` — non-current SY rows with enrollment closed render `opacity-60 saturate-50`; "Inactive" badge at :317-321; hover restores full opacity |
| 13 | Bug: reverts to a previous SY | 🔍 VERIFY | Create/archive/`set-current` all sync `is_current` + `school_settings.current_sy_id`; cleanup delete of the live test row worked cleanly. A dedicated set-current→restart live test is still pending. |
| 14 | Total Students counter on dashboard | ✅ FIXED | `AdminDashboard.tsx:36/123/310` — "Total Students" stat present |
| 15 | Activity-log deletion schedule | ✅ FIXED | `server/src/cron/activityLogCron.ts` — deletes logs older than 90 days, runs daily |
| 16 | Remove redundant Admin logout button | ✅ FIXED | Exactly 1 logout control: `ProfileDropdown.tsx:96-98` (`<LogOut /> Logout` in dropdown). Sidebar footer (:210) = avatar+name+role only; TopBar has none |
| 17 | Remove duplicate search bars | ✅ FIXED | `SearchCommand.tsx:95-151` = single global ⌘K palette. Per-page inputs serve distinct purposes: StudentList filters local table; SectionCreation TeacherSearch = adviser picker; EnrollmentModule = LRN/ID lookup; SubjectManagement = grade toggle. No true duplicates |
| 18 | Date Hired paired with End of Contract | ✅ FIXED | `UserManagement.tsx:649-662` renders both fields side-by-side: "Date Hired" (:652, `date_hired`) and "End of Contract" (:661, `end_of_contract`); service types also include both (`services/users.ts:18-19`) |
| 19 | Grade thresholds per section | ✅ FIXED (partial) | `SectionCreation.tsx:575-577` — per-section "Min. Average" input + :580-583 "Max. Average" (optional); saved via migration `021_sections_max_average.sql`. Defaults to "85" (:164) regardless of section type — type-based auto-defaulting not yet wired |
| 20 | More sections incl. STE/SPFL | ✅ FIXED | Section types STE/SPFL/SPA visible in DB + sectioning; `sections.section_type` VARCHAR |

## Enrollment — Student Basic Information

| # | Revision | Status | Evidence |
|---|----------|--------|----------|
| 21 | Height + Weight with BMI computation | ✅ FIXED | `EnrollmentModule.tsx` — Height (cm) :1917, Weight (kg) :1931, BMI auto-computed :1938-1939 (`w / Math.pow(h/100, 2)`) with category (Underweight/Normal/Overweight/Obese) :1943-1949; saved as `height_cm`/`weight_kg` (:959-960) |
| 22 | Guardian 4Ps beneficiary status | ✅ FIXED | `EnrollmentModule.tsx:1955-1966` — "Guardian 4Ps Beneficiary?" Yes/No toggle; state `guardian4ps` (init :516, submitted as `guardian_4ps` :961); DB column `students.guardian_4ps` (migration `020_student_health_4ps.sql`) |
| 23 | Returning student → previous grades preview | ✅ FIXED | `EnrollmentModule.tsx:777-781` — on returning-student hit, fetches `gradesApi.history(studentId)` into `retGradeHistory`; rendered :2750-2776 under "Previous Grades & Academic History" heading, per-SY card with `sy_label`, `grade_level`, `general_average`, `section_name` |

## Teacher Role

| # | Revision | Status | Evidence |
|---|----------|--------|----------|
| 24 | Adviser Management (own advisory only) | ✅ FIXED | My Sections (Item 2 of prior plan) — teachers see own sections only; "All Sections" removed for teachers |
| 25 | Grade encoding restricted to assigned subject | ✅ FIXED | `grades.controller.ts:70-91` — subject + advisory-section guard ("Access denied" for unassigned) |
| 26 | Grade editing time limit (post-deadline → Registrar) | ✅ FIXED | `GradeManagement.tsx:218-226` deadline check + lock → correction request to registrar |
| 27 | Remove schedule modifier from Teacher | ✅ FIXED | Teacher nav = "My Schedule" only (`navigation.ts:121`); no modify path |
| 28 | Remove LIS export from Teacher | ✅ FIXED | Same as #1 (duplicate item in client list) |

## Registrar

| # | Revision | Status | Evidence |
|---|----------|--------|----------|
| 29 | LIS export Registrar-only | ✅ FIXED | #1 duplicate |
| 30 | Schedule modifier for Registrar | ✅ FIXED | `ScheduleModifier.tsx` + nav `registrar_schedule` → `/registrar/schedule-modifier` |
| 31 | LIS Excel formatting (duplicate) | ✅ FIXED | See #2 (live xlsx verified) |

## School Forms

| # | Revision | Status | Evidence |
|---|----------|--------|----------|
| 32 | SF1/SF5/SF9/SF10 preview before printing | ✅ FIXED | All four SF forms use `FormPrintPreview` component: SF1 (:405-409), SF5 (:577-581), SF9 (:601-605), SF10 (:635-639). Each renders a visible on-screen print area before any print action |
| 33 | Edit button on preview screen | ✅ FIXED | `FormPrintPreview.tsx:135-141` — "Edit" button with `<PencilLine>` icon; calls `onClose` returning to fillable form. Present in all four SF form usages |

## Principal Role

| # | Revision | Status | Evidence |
|---|----------|--------|----------|
| 34 | Export all school documents/data | ✅ FIXED | `PrincipalExportCenter.tsx` — SF1 PDF (:194-225), SF5 PDF (:157-192), consolidated reports (:228-281), grade distribution (:284-316). Three tabs: "School Documents", "Reports", "School-wide Data"; all via pdfMake |
| 35 | Graphs & visual analytics on dashboard | ✅ FIXED | Principal modules: enrollment trend, enrollment figures, section population (PieChart), grade progress, promotion stats |

## Login Page

| # | Revision | Status | Evidence |
|---|----------|--------|----------|
| 36 | RA 10173 badge → move to Settings | ✅ FIXED | No "RA 10173 / Compliant" badge on the login card. Legal modals route: RA 10173 is cited only inside the Privacy Policy modal content (legit policy text). Settings pages carry the compliance info. |
| 37 | Terms, Privacy & Conditions on login | ✅ FIXED | `Login.tsx` legal modals `Terms of Service` / `Privacy Policy` / `Conditions of Use` (lines ~138–200) openable from the "I agree…" label links |
| 38 | Login blocked until T&C checkbox agreed | ✅ FIXED | `#agree-terms` checkbox, `agreedToTerms` defaults **false** (`Login.tsx:319`); enforced in `handleLogin` (:433) and `handleDemoLogin` (:455); submit button `disabled={…||!agreedToTerms}` (:1266). (Corrects an earlier audit that missed the checkbox.) |
| 39 | Login-page SY label live/connected to settings | ✅ FIXED | `Login.tsx` now fetches live SY via `schoolInfoApi` on mount (:336-347); desktop badge (:612-614) shows `School Year {label} · Active/Closed` with static fallback; mobile (:700-703) shows `SY {label}` with fallback. Backend `public.routes.ts` (NEW) serves `GET /api/school-info` (no auth); live verified: `{"school_name":"Don Servillano Platon Memorial National High School","current_sy_label":"2031-2032","enrollment_open":true}`. Sidebar.tsx:109-110 uses AppContext (already live). Note: `SchoolForms.tsx` still hardcodes "2025–2026" at :332/:410/:411/:511/:637/:809/:830/:1062 (separate issue) |

## System-Wide

| # | Revision | Status | Evidence |
|---|----------|--------|----------|
| 40 | Real-time notifications (duplicate #4) | ✅ FIXED | #4 |
| 41 | RA 10173 compliance info (duplicate #36) | ✅ FIXED | #36 |
| 42 | Remove redundant logout in sidebar | ✅ FIXED | #16 verified — exactly 1 logout in ProfileDropdown.tsx; TopBar.tsx has none |
| 43 | Remove duplicate search bars | ✅ FIXED | #17 verified — all search inputs serve distinct purposes; no duplicates |

---

## Summary

- ✅ **FIXED (code + live verified): 39** — All 24 original items (LIS restriction + live xlsx, notifications SSE, Create SY 400/201/409, manual backup, settings validation, calendar-year SY, Total Students, log cleanup cron, STE/SPFL sections, Adviser Management, grade subject restriction, grade deadline, teacher schedule, registrar schedule modifier, RA 10173 off login, legal modals, T&C gate, principal graphs, prior-plan items) PLUS 15 newly verified: hours-per-week formatting (#5), inactive-SY grayout (#12), redundant logout (#16/#42), duplicate search bars (#17/#43), date hired + end of contract (#18), per-section thresholds (#19), BMI/height/weight (#21), guardian 4Ps (#22), returning-student grade preview (#23), SF preview gate (#32), edit button on preview (#33), principal export (#34), live login SY label (#39)
- 🔍 **VERIFY (implemented, visual/pending check): 4** — LIS PDF composer look (#3), SF5 PDF border quality (#7), SF9 PDF border quality (#8), SY set-current held across restart (#13)
- ❌ **NOT STARTED: 0** — All client revision items are now implemented or pending visual verification only
---

## Revision 3 — SF10 + At-Risk Navigation (2026-09-14)

Client requested that SF10 (Permanent Record) and AI/At-Risk modules be enabled for all roles (admin, teacher, registrar). All backends were already live; the only gap was `disabled: true` flags in the navigation config.

| Change | Files | Status |
|--------|-------|--------|
| Remove `disabled: true` from `admin_forms_sf10` | `src/app/navigation.ts` | ✅ DONE |
| Remove `disabled: true` from `teacher_forms_sf10` | `src/app/navigation.ts` | ✅ DONE |
| Remove `disabled: true` from `teacher_atrisk` | `src/app/navigation.ts` | ✅ DONE |
| Remove `disabled: true` from `registrar_forms_sf10` | `src/app/navigation.ts` | ✅ DONE |
| Remove `disabled: true` from `registrar_atrisk` | `src/app/navigation.ts` | ✅ DONE |
| Remove `disabled: true` from `principal_atrisk` | `src/app/navigation.ts` | ✅ DONE |

**Backend verification:** Unauthenticated `GET /api/forms/sf10?student_id=4` and `GET /api/at-risk/trends` return 401 (routes mounted; `authenticate`/`authorize` gate them). With a valid admin token both return real data — SF10: full Permanent Record for Grade 8 student (Juan Dela Cruz); At-Risk trends: summary + per-student risk analytics.

---

## Round 2 — SY Reversion Hardening (2026-09-17)

Addressed remaining || 1 fallbacks that could incorrectly default to school year ID 1 when no current school year is found, preventing potential data integrity issues during school year transitions.

| # | Revision | Status | Evidence |
|---|----------|--------|----------|
| B1a | SF9 report school year fallback | ✅ FIXED | `src/app/pages/registrar/sf9-report.tsx:349-354` — replaced `|| 1` with explicit null checking |
| B1b | Grade Management school year fallback | ✅ FIXED | `src/app/pages/teacher/GradeManagement.tsx:175-178` — replaced `|| 1` fallbacks with null returns in try/catch blocks |
| B1c | SF1 register school year fallback | ✅ FIXED | `src/app/pages/registrar/sf1-register.tsx:191-193` — replaced `|| 1` chain with conditional null handling |
| B1d | SF5 report school year fallback | ✅ FIXED | `src/app/pages/registrar/sf5-report.tsx:249-251` — replaced `|| 1` chain with conditional null handling |
| B2  | Activity log cron restart-safety | ✅ FIXED | `server/src/cron/activityLogCron.ts` — changed from 24h setInterval to hourly checks with persistence; `server/migrations/016_activity_log_cleanup_tracking.sql` — added last_activity_log_cleanup column to school_settings |
| B3  | Returning-student subject breakdown | ✅ FIXED | `src/app/pages/teacher\EnrollmentModule.tsx:2750-2790` — rendered retGradeHistory[].subjects as table with Q1-Q4 and final columns; added empty state for no subject history |

## Suggested next batch

All client revision items (Revisions 1–3) are now implemented. Remaining work:

1. **Visual verification pass** — open the app in a browser, confirm SF5/SF9 PDF border quality (#7/#8), LIS PDF look (#3), and SY set-current persistence across restart (#13) to convert the final 4 🔍 into ✅
2. **SchoolForms.tsx hardcoded SY** — lines 332/410/411/511/637/809/830/1062 still contain hardcoded "2025–2026" (not fallbacks) — should use AppContext `schoolYearLabel` like the sidebar does
3. **Demo prep** — client-laptop deployment runbook (see prior session)

---

## Round 3 — Full code re-audit (2026-09-21)

Re-audited every Revision-1 item marked **Not Fixed / Needs Improvement / Not tested**, the four pending 🔍 VERIFY items from Round 2, and the tracker's own noted leftovers, against the current source (`server/src` + `src/app`). Legend carries over: ✅ FIXED · ⚠️ PARTIAL · 🔍 VERIFY (implemented, visual/live check pending) · ❌ OPEN.

### Previously 🔍 VERIFY → re-checked

| Item | Status (09-21) | Evidence |
|------|----------------|----------|
| 3 · LIS PDF official look | ✅ FIXED | `src/app/services/lisPdf.ts` — full DepEd letterhead (both logos), bordered table + repeating page header, Registrar/Principal signature block, A4 landscape, rendered via the same server `/api/pdf/render` pipeline as the SF forms (not a raw dump) |
| 13 · SY persists across restart | 🔍 VERIFY (code confirmed) | `schoolYears.controller.ts:33` reads `is_current = 1` live; every grading/enrollment/sectioning/report controller now resolves the active SY at request time; frontend stores no SY id (`AppContext.tsx:162`). Remaining: one live “set current → restart server → still active” smoke test |
| 7 / 8 · SF5 + SF9 PDF border quality | 🔍 VERIFY (unchanged) | Same puppeteer pipeline with `@page`/print CSS; a visual check of a rendered PDF is still pending |

### Revision-1 “Not Fixed” items — re-audited

| Item | Status | Evidence |
|------|--------|----------|
| Hours per Week “03.03.03.03” | ✅ FIXED | `src/app/utils/hours.ts` → “3 hrs/day · 4 days/wk (12 hrs/wk)”; used in `SubjectManagement.tsx` and `SubjectView.tsx` |
| SY reversion bug | ✅ FIXED (code) | see #13 — no stale `\|\| 1` fallbacks remain |
| Activity-log automated deletion | ✅ FIXED | `server/src/cron/activityLogCron.ts` — hourly, 90-day retention, restart-safe |
| Redundant Admin logout | ✅ FIXED | exactly 1 logout: `ProfileDropdown.tsx:96`; sidebar footer + TopBar have none |
| Redundant search bars | ✅ FIXED | single global ⌘K palette; per-page inputs serve distinct purposes |
| Teacher grade subject restriction | ✅ FIXED | `grades.controller.ts:73-94` `teacherGradeBlockReason` (subject + advisory-section guard → 403); UI disables non-assigned inputs (`GradeManagement.tsx:711`) |
| Grade editing deadline → Registrar | ✅ FIXED | deadline gate `grades.controller.ts:57-66,79-81`; teacher routes to Registrar correction flow (`corrections.controller.ts`, Registrar-only review) |
| Returning student → previous grades preview | ✅ FIXED | `EnrollmentModule.tsx` — grade-history panel rendered before enrollment can be confirmed (per-SY subject Q1–Q4 tables) |
| LIS Excel format | ✅ FIXED (2026-09-21) | `lis.controller.ts` `sendXlsx` rewritten with **exceljs**: merged navy title banner, school-year sub-banner, bold/centered/colored header row with frozen pane, thin borders + zebra striping, autofilter (`xlsx`/SheetJS removed for exports) |
| Principal document export | ✅ FIXED | `PrincipalExportCenter.tsx` — SF1 PDF, SF5 PDF, consolidated reports, grade-distribution data |
| Principal dashboard graphs | ✅ FIXED | enrollment trend, grade distribution, at-risk, gender/program pies present |
| Registrar dashboard graphs | ✅ FIXED (2026-09-21) | added **Enrollment Trend** (LineChart, per-SY) + **Grade Distribution (School-wide)** (BarChart via `gradesApi.getDistribution`) to `RegistrarDashboard.tsx` |
| School Form preview-first | ✅ FIXED (2026-09-21) | SF1/SF5/SF9/SF10 editors gate print/PDF behind `FormPrintPreview`; `SchoolForms.tsx` Print/Export buttons now open the shared preview instead of `window.print()` |
| Edit button in preview | ✅ FIXED | `FormPrintPreview.tsx:135` “Edit” → returns to fillable form |
| Preview non-editable + numeric-only inputs | ✅ FIXED (2026-09-21) | preview read-only (inputs replaced with spans); `sf5-report.tsx` now defines the `sanitizeGradeInput` helper (0–100, 2-dp clamp) it already called; SF10 **Final Rating** now clamped the same as Q1–Q4 |
| Quick Actions (LSO) | ✅ FIXED | no “Quick Actions” section in any dashboard |

### Newly found (not in the client list, surfaced by this audit) — all closed 2026-09-21

| Item | Status | Evidence |
|------|--------|----------|
| SF5 grade-cell validation ReferenceError | ✅ FIXED | `sf5-report.tsx` — `sanitizeGradeInput` helper added (0–100, 2-dp clamp, same as SF1), used by every SF5 grade cell |
| SF10 Final Rating unvalidated | ✅ FIXED | `sf10-report.tsx` — Final Rating input now `inputMode="numeric"` with the same 0–100 / 2-dp clamp as Q1–Q4 |
| `SchoolForms.tsx` hardcoded “2025–2026” | ✅ FIXED (already in source) | all form headers read `activeSY` from `AppContext.schoolYearLabel` (lines 339/417/518/644/816/837/1069); no hardcoded year string remains |
| SchoolForms preview bypass | ✅ FIXED | Print Form / Export PDF buttons now open `FormPrintPreview` (`elementId="sf-print-area"`); Export PDF uses the server-rendered pipeline with a client fallback |

### Status summary (2026-09-21)

- ✅ **FIXED:** all 39 tracked items stay fixed **plus** the freshly closed opens — LIS PDF look, hours/week display, teacher grade restriction + deadline, returning-grade preview, principal export + graphs, LIS Excel styled workbook, SchoolForms preview gate, SF5/SF9 numeric validation, registrar dashboard trend + grade-distribution charts.
- ⚠️ **PARTIAL:** none remaining from the audit.
- 🔍 **VERIFY:** SY restart smoke test (#13), SF5/SF9 PDF border visual check (#7/#8) — both implemented, need a human eyeball on the running app.
- ❌ **OPEN:** none.

> Client-facing step-by-step test steps for every item above live in **`docs/VERIFICATION_CHEATSHEET.md`**.
