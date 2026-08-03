# HI5 Portal — Feature Progress Checklist

> **Last Updated:** 2026-07-02
> **Legend:** ✅ Done | ⚠️ Partial | ❌ Missing

---

## 1. Administrator (ICT Coordinator)

| # | Feature | Status | Module / File |
|---|---------|--------|---------------|
| 1.1 | Create, update, manage user accounts | ✅ Done | [UserManagement.tsx](../src/app/pages/admin/UserManagement.tsx) |
| 1.2 | Assign roles (Admin, Registrar, Teacher, Principal) | ✅ Done | `users.role` ENUM, roleGuard middleware |
| 1.3 | Configure school years | ✅ Done | [AcademicYearManagement.tsx](../src/app/pages/admin/AcademicYearManagement.tsx) |
| 1.4 | Configure grade levels | ✅ Done | Built into sections/subjects (7–12) |
| 1.5 | Configure sections | ✅ Done | [SectionCreation.tsx](../src/app/pages/admin/SectionCreation.tsx) |
| 1.6 | Configure subject offerings | ✅ Done | [SubjectManagement.tsx](../src/app/pages/admin/SubjectManagement.tsx) |
| 1.7 | Open / close enrollment period | ✅ Done | Backend 403 guard + EnrollmentModule closed banner + AppContext |
| 1.8 | Manage MATATAG core JHS subjects | ✅ Done | Subject system supports any subjects |
| 1.9 | STE Research / SPFL language subjects | ✅ Done | Program field on enrollments |
| 1.10 | MAPEH as 4 separate subjects | ✅ Done | Subjects split; computeAverages groups MAPEH; promotions SQL uses subquery CASE GROUP BY |
| 1.11 | G9/10 TLE as student-specific tracks | ✅ Done | `strand_tracks` table + `subject_strand_tracks` junction per-enrollment |
| 1.12 | SHS strands (STEM/ABM/HUMSS/GAS/TVL/ADT) | ✅ Done | Same `strand_tracks` table covers G11-12 SHS strands |
| 1.13 | Section capacity limits per grade/type | ✅ Done | Enforced in enrollment + sectioning controllers |
| 1.14 | Manual database backups | ✅ Done | [DatabaseBackup.tsx](../src/app/pages/admin/DatabaseBackup.tsx) |
| 1.15 | Schedule automatic backups | ✅ Done | `backupCron.ts` (hourly check, daily/12h/weekly) + settings UI |
| 1.16 | Restore the database | ✅ Done | `POST /api/backups/:id/restore` + confirmation dialog |
| 1.17 | View activity logs | ✅ Done | `/admin/logs` route |
| 1.18 | Monitor login activity (Idle 30d / Inactive 60d) | ✅ Done | `userStatusCron.ts` auto-flags idle/inactive/active |
| 1.19 | Dynamic section type management (CRUD via UI) | ✅ Done | `section_types` table + Manage Types modal in SectionCreation |

---

## 2. Registrar

| # | Feature | Status | Module / File |
|---|---------|--------|---------------|
| 2.1 | View & manage student records | ✅ Done | [StudentSearch.tsx](../src/app/pages/registrar/StudentSearch.tsx) |
| 2.2 | Process transfer / withdrawal | ✅ Done | Enrollment update with dropped/transferred status |
| 2.3 | Monitor real-time enrollment stats | ✅ Done | [RegistrarDashboard.tsx](../src/app/pages/registrar/RegistrarDashboard.tsx) |
| 2.4 | View document completion per student | ✅ Done | [DocumentCompletion.tsx](../src/app/pages/registrar/DocumentCompletion.tsx) — section selector + requirement checklist table |
| 2.5 | View teacher-uploaded grade files | ✅ Done | [SubjectView.tsx](../src/app/pages/registrar/SubjectView.tsx) |
| 2.6 | View computed general averages | ✅ Done | `GET /api/grades/compute/averages` |
| 2.7 | JHS regular: random distribution + confirm | ✅ Done | SectionAssignment — Random workflow |
| 2.8 | STE/SPFL: flag exam passers + place + confirm | ✅ Done | SectionAssignment — Placement workflow |
| 2.9 | SHS: carry-over G11→G12 + confirm | ✅ Done | SectionAssignment — Carryover workflow |
| 2.10 | ALS-SHS / Open High School: manual assignment | ✅ Done | SectionAssignment — Manual workflow |
| 2.11 | SF10 PDF export (transfer document) | ✅ Done | Forms controller |
| 2.12 | Certificate of Enrollment PDF | ✅ Done | [CertificateOfEnrollment.tsx](../src/app/pages/registrar/CertificateOfEnrollment.tsx) |
| 2.13 | Certificate of Good Moral Character | ✅ Done | [GoodMoralCertificate.tsx](../src/app/pages/registrar/GoodMoralCertificate.tsx) |
| 2.14 | Enrollment per grade/program report (Excel/PDF) | ✅ Done | [EnrollmentReport.tsx](../src/app/pages/registrar/EnrollmentReport.tsx) — live table + CSV/Excel/PDF export + charts + live classification data |
| 2.15 | Gender breakdowns | ✅ Done | Live `GET /api/enrollments/stats` + gender card + bar chart by grade |
| 2.16 | 4Ps/PWD summaries | ✅ Done | Live `student_classifications` query via dashboard stats endpoint |
| 2.17 | Section population report | ✅ Done | Dashboard + EnrollmentReport |
| 2.18 | Promotion & retention stats | ✅ Done | [PromotionRecords.tsx](../src/app/pages/registrar/PromotionRecords.tsx) |
| 2.19 | Grade distribution report | ✅ Done | [GradeDistribution.tsx](../src/app/pages/registrar/GradeDistribution.tsx) — stacked bar charts per subject with pass rates |
| 2.20 | View At-Risk Students (read-only) | ✅ Done | [RegistrarAtRisk.tsx](../src/app/pages/registrar/RegistrarAtRisk.tsx) |

---

## 3. Teacher

| # | Feature | Status | Module / File |
|---|---------|--------|---------------|
| 3.1 | Enroll new students (all 5 programs) | ✅ Done | [EnrollmentModule.tsx](../src/app/pages/teacher/EnrollmentModule.tsx) — New flow |
| 3.2 | Enroll returning students (by LRN/ID) | ✅ Done | Returning flow with LRN auto-populate |
| 3.3 | Enroll Balik-aral students | ✅ Done | Part of returning flow via LRN lookup |
| 3.4 | Enrollment requirements checklist | ✅ Done | Requirements list + DB storage |
| 3.5 | Flag incomplete requirements | ✅ Done | Backend validation |
| 3.6 | View assigned subjects | ✅ Done | GradeManagement per-student subject grid |
| 3.7 | View class list by section | ✅ Done | [StudentList.tsx](../src/app/pages/teacher/StudentList.tsx) |
| 3.8 | View schedules (web) | ✅ Done | [TeacherSchedule.tsx](../src/app/pages/teacher/TeacherSchedule.tsx) — weekly timetable grid |
| 3.9 | Encode quarterly grades per subject | ✅ Done | [GradeManagement.tsx](../src/app/pages/teacher/GradeManagement.tsx) |
| 3.10 | MAPEH as 4 separate entries | ✅ Done | Seed has 24 entries (4 subjects × 6 grades); grades grid renders them individually |
| 3.11 | Bulk-import grades via template | ✅ Done | [UploadGrades.tsx](../src/app/pages/teacher/UploadGrades.tsx) |
| 3.12 | Submit & lock grades | ✅ Done | Lock/unlock endpoints + modal |
| 3.13 | Grade correction requests | ✅ Done | Correction modal + API |
| 3.14 | Track grade submission status | ✅ Done | [DocumentManagement.tsx](../src/app/pages/teacher/DocumentManagement.tsx) |
| 3.15 | Generate SF1 PDF | ✅ Done | SchoolForms page |
| 3.16 | Generate SF5 PDF | ✅ Done | SchoolForms page |
| 3.17 | Generate SF9 PDF (Report Card) | ✅ Done | SchoolForms page + card view |
| 3.18 | Generate SF10 PDF | ✅ Done | SchoolForms page |
| 3.19 | Submit forms to LIS Officer | ✅ Done | Server-side CSV generation + download page at `/admin/lis-export` |
| 3.20 | Import DepEd SF files (Excel/PDF) | ✅ Done | UploadGrades with validation preview |
| 3.21 | Bulk promotion for advisory section | ✅ Done | [BulkPromotion.tsx](../src/app/pages/teacher/BulkPromotion.tsx) |
| 3.22 | GA < 75 → Retained flag | ✅ Done | Promotions controller threshold check |
| 3.23 | Grade 12 → Completers | ✅ Done | `completeSection` endpoint + `BulkPromotion.tsx` completers flow + `enrollments.status='completed'` |
| 3.24 | AI at-risk prediction | ✅ Done | [AtRiskDetection.tsx](../src/app/pages/teacher/AtRiskDetection.tsx) |
| 3.25 | Color-coded badges (On Track / Needs Monitoring / At-Risk) | ✅ Done | RISK_CONFIG styling |

---

## 4. Principal (View-Only)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 4.1 | School-wide enrollment figures per grade/program | ✅ Done | EnrollmentFigures + EnrollmentTrend |
| 4.2 | Gender breakdowns | ✅ Done | EnrollmentFigures stats |
| 4.3 | 4Ps / PWD counts | ✅ Done | Included in enrollment figures |
| 4.4 | Section population data | ✅ Done | SectionPopulation component |
| 4.5 | Grade submission progress across sections | ✅ Done | GradeProgress component |
| 4.6 | View at-risk classifications | ✅ Done | AtRiskView component |
| 4.7 | Real-time enrollment figures | ✅ Done | Principal dashboard + trend charts |
| 4.8 | Promotion / retention statistics | ✅ Done | PromotionStats component |

---

## 5. Cross-Cutting / Infrastructure

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 5.1 | Principal role in DB | ✅ Done | `ALTER users role ENUM` migration + auth middleware |
| 5.2 | Principal sidebar / layout / navigation | ✅ Done | Purple theme, `/principal` route group + nav |
| 5.3 | Certificate of Enrollment auto-generation | ✅ Done | Registrar certificate pages with live preview + PDF export |
| 5.4 | Good Moral Certificate template | ✅ Done | Separate page, same pattern |
| 5.5 | Auto-backup scheduling | ✅ Done | Cron job + settings UI |
| 5.6 | Database restore UI | ✅ Done | Restore endpoint + confirmation dialog |
| 5.7 | Auto Idle / Inactive account flagging | ✅ Done | `userStatusCron.ts` runs every 60min |
| 5.8 | SHS track management (Academic / Tech-Voc) | ✅ Done | `strand_tracks` CRUD + per-enrollment assignment |
| 5.9 | Schedule / timetable component | ✅ Done | `schedules` table + TeacherSchedule weekly grid |
| 5.10 | Android app (real-time sync) | ❌ Missing | — |
| 5.11 | LIS Officer submission integration | ✅ Done | 3 CSV endpoints (learner profile, grades, enrolled list) + `/admin/lis-export` UI |

---

## Summary

| Role | Total | ✅ Done | ⚠️ Partial | ❌ Missing |
|------|-------|---------|------------|-----------|
| **Admin (ICT)** | 19 | 19 | 0 | 0 |
| **Registrar** | 20 | 20 | 0 | 0 |
| **Teacher** | 25 | 25 | 0 | 0 |
| **Principal** | 8 | 8 | 0 | 0 |
| **Cross-cutting** | 11 | 10 | 0 | 1 |
| **Overall** | **83** | **82** | **0** | **1** |
