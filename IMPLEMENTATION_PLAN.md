# Implementation Plan: Teacher & Admin System Revisions

## Context

User requested a coordinated set of teacher-role fixes, admin/system-wide enhancements, security/account controls, and UI/documentation improvements for HI5PORTALF. An upcoming demo means we should prioritize visible, low-risk UI changes first and defer deep data/archival work until the demo-critical pieces are stable. All work will happen on the current branch with local commits and progress tracked via markdown checkboxes.

## Decisions & constraints gathered

- **Rollout order:** Teacher features first, then admin/security/UI, then archival/data changes.
- **"All Sections" view:** Hide from teachers only; keep for admin/registrar/principal.
- **Username rules:** Alphanumeric + `.` `_` `-`; consistent frontend/backend validation.
- **PDF guide:** Generate from existing `SystemGuide` page and include the school logo/seal.
- **Verification:** `tsc`/`npm run build` on both frontend and backend, plus a manual smoke-test checklist.
- **Graduated students:** Soft-archive with read-only login; block re-enrollment but preserve historical data.
- **Grade change common mistakes:** Dropdown of preset reasons + an "Other" free-text fallback.
- **Progress tracking:** Markdown checkboxes.
- **Branching:** Single branch, incremental local commits.

## Global progress tracker

- [x] 1. Teacher: Academic Year dynamic sync [M]
- [x] 2. Teacher: My Sections view (hide All Sections from teachers) [M]
- [x] 3. Teacher: Document filtering by subject [S]
- [x] 4. Teacher: Grade change common-mistakes field [S]
- [x] 5. Teacher: Upload grades template formatting fix [M]
- [x] 6. Teacher: SF generation restricted to assigned students [M]
- [x] 7. Teacher: Recently enrolled list (6 + expand) [S]
- [x] 8. Teacher/Student: Graduated soft-archive & re-enrollment block [L]
- [x] 9. Admin: Activity logs pagination (6 + expand) [S]
- [x] 10. Admin: Standardized account labels [S]
- [x] 11. SF9: Gender dropdown + full names [S]
- [x] 12. Security: Current-password mandatory + no autofill [S]
- [x] 13. Security: Username validation (frontend + backend) [M]
- [x] 14. UI: Sidebar toggle in navbar + logo flip [S]
- [x] 15. Docs: PDF user guide from SystemGuide [M]

## Recommended implementation order

1. **Quick demo wins (low risk)**
   - 10. Standardized account labels
   - 14. Sidebar toggle + logo flip
   - 11. SF9 gender dropdown + full names
   - 9. Activity logs pagination
2. **Teacher features (demo-critical)**
   - 1. Academic Year sync
   - 2. My Sections view
   - 3. Document filtering by subject
   - 4. Grade change common-mistakes field
   - 5. Upload grades template fix
   - 6. SF generation restriction
   - 7. Recently enrolled list (6 + expand)
3. **Security/account hardening**
   - 12. Current-password mandatory + no autofill
   - 13. Username validation
4. **Data/archive changes (highest risk; do after demo if possible)**
   - 8. Graduated soft-archive & re-enrollment block
5. **Documentation**
   - 15. PDF user guide

---

## Group 1 — Teacher Role Features & Fixes

### 1. Academic Year dynamic sync
**Goal:** All teacher views use the currently active school year automatically instead of a hardcoded default.

**Files:**
- `src/app/context/AppContext.tsx` — `refreshSchoolInfo` already hydrates `schoolYearLabel` and `enrollmentOpen` from the current SY.
- `src/app/services/schoolYears.ts` — `schoolYearsApi.current()` returns the `is_current = 1` row.
- `server/src/controllers/schoolYears.controller.ts` — `getCurrentSchoolYear` returns `WHERE is_current = 1 LIMIT 1`; `setCurrentSchoolYear` updates `school_settings.current_sy_id`.
- `src/app/pages/teacher/EnrollmentModule.tsx` — line ~568 initializes `selectedSYId` to `1`; replace with current-SY lookup.
- `src/app/pages/teacher/UploadGrades.tsx` — confirm year default uses current SY.
- `src/app/pages/teacher/GradeManagement.tsx` — confirm year default uses current SY.

**Approach:**
- On teacher page mount, call `schoolYearsApi.current()` and set the active `school_year_id`.
- Replace any remaining hardcoded `school_year_id: 1` or `selectedSYId(1)` with the fetched current year.
- If no current year is set, show a clear warning and block data-dependent actions.

**Verification:**
- Change the active year in Admin → Academic Year Mgmt.
- Teacher dashboards/sections/grades/enrollment reflect the new year without manual refresh.

---

### 2. My Sections view (hide All Sections from teachers)
**Goal:** Teachers see only sections they are actively teaching; the global "All Sections" view remains available to admin/registrar/principal.

**Files:**
- `src/app/pages/teacher/SectionManagement.tsx` — already has a `scope` toggle (`"mine" | "all"`) shown only when `role === "teacher"`; default is `"mine"`.
- `src/app/services/sections.ts` — `listMySections()` calls `/sections/my-sections`.
- `server/src/controllers/sections.controller.ts` — `getTeacherSections` already filters `WHERE s.adviser_id = ? AND s.is_active = 1`.
- `src/app/navigation.ts` — teacher nav item is "Section Management".

**Approach:**
- Remove the `scope` toggle entirely for teachers; keep the page scoped to `listMySections()`.
- Keep the global `list()` endpoint and admin/registrar UI untouched.
- Optionally rename the teacher nav label to "My Sections" to match intent.

**Verification:**
- Log in as teacher: only assigned sections appear.
- Log in as admin/registrar: global section list still accessible.

---

### 3. Document filtering by subject
**Goal:** Document Management shows only files relevant to the teacher’s designated subjects.

**Files:**
- `src/app/pages/teacher/DocumentManagement.tsx` — currently calls `documentsApi.list()` and filters client-side by `subject_id`.
- `src/app/services/documents.ts` — `list()` accepts `subject_id` but only one value at a time.
- `server/src/controllers/documents.controller.ts` — `listDocuments` filters by single `subject_id`; needs teacher-scoped multi-subject filter.

**Approach:**
- Backend: add `GET /api/documents/my-documents` that joins `uploaded_documents` with `teacher_subject_assignments` for `req.user!.userId` and the active school year.
- Frontend (teacher): call the new endpoint; hide or auto-select the subject filter so it only shows assigned subjects.
- Frontend (admin/registrar): keep using `/documents` with full filter controls.

**Verification:**
- Teacher uploads/views documents; only their assigned subjects are listed.
- Admin sees all documents and all subjects in the filter.

---

### 4. Grade Change Requests — Common Mistakes field
**Goal:** Add an optional dropdown for common mistakes plus an "Other" free-text fallback.

**Files:**
- `src/app/pages/teacher/GradeManagement.tsx` — correction modal currently has Subject, Quarter, and Justification fields.
- `src/app/services/grades.ts` — `CorrectionRequestPayload` defines the request shape.
- `server/src/controllers/corrections.controller.ts` — `createCorrection` persists `student_id`, `subject_id`, `school_year_id`, `quarter`, `justification`.
- Database migration: add `common_mistake` and `other_mistake` columns to `grade_correction_requests`.

**Approach:**
- Migration: `ALTER TABLE grade_correction_requests ADD common_mistake VARCHAR(80) NULL, ADD other_mistake TEXT NULL;`
- Backend: update `createCorrection` to accept and persist `common_mistake` and `other_mistake`; include them in list/detail SELECTs.
- Frontend: add a `<select>` with presets (`Wrong item count`, `Transposed score`, `Missing student`, `Computation error`, `Encoding lag`, `Other`). When `Other` is selected, reveal a text area bound to `other_mistake`. Both fields are optional.
- Update TypeScript interfaces (`CorrectionRequestPayload`, correction row type).

**Verification:**
- Submit a correction with a preset reason.
- Submit a correction with `Other` and custom text.
- Submit a correction with no mistake reason (still allowed).
- Registrar/admin review page displays the common-mistake reason.

---

### 5. Upload Grades Template formatting fix
**Goal:** Fix formatting issues in the downloadable/uploadable grade entry template.

**Files:**
- `server/src/controllers/documents.controller.ts` — `getTemplate` generates the XLSX template.
- `src/app/pages/teacher/UploadGrades.tsx` — download/upload flow.
- `src/app/services/documents.ts` — `template()`, `preview()`, `importGrades()`.

**Approach:**
- In `getTemplate`, standardize the workbook:
  - Freeze the header row.
  - Bold header text with a light background fill.
  - Set explicit column widths (`LRN` narrow, `Student Name` wide, grade columns medium).
  - Format grade cells as number with one decimal place and range data-validation (0–100).
  - Mark `LRN` and `Student Name` columns as protected/read-only so graders do not overwrite identifiers.
- Ensure the upload parser (`preview`/`importGrades`) expects the exact header text and ignores the protected flag.
- Add a small note/comment row or header subtitle indicating the subject and quarter.

**Verification:**
- Download template, fill it, re-upload; grades import correctly.
- Empty/template-only uploads fail gracefully with a clear message.
- Headers render consistently in Excel/LibreOffice/Google Sheets.

---

### 6. School Form (SF) Generation — Restrict to assigned students
**Goal:** Teachers can generate SF reports only for students assigned to them.

**Files:**
- `src/app/services/forms.ts` — SF9/SF5/SF1/SF10 API service.
- `server/src/controllers/forms.controller.ts` — `getSF9` returns student, enrollment, subjects, general_average, school.
- Teacher SF pages (e.g., `src/app/pages/teacher/sf9-report.tsx` or equivalent).

**Approach:**
- Backend: add a teacher-scope check in SF endpoints. For SF9, verify the student is in a section where the teacher is the adviser OR the teacher has a subject assignment for that student in the active school year. Reuse `teacher_section_assignments` / `teacher_subject_assignments`.
- Backend: update `getSF9` query to join `sections.adviser_id` → `users.name` and include `school_settings.principal_name` so signatories are full names, not usernames.
- Frontend: filter the student selector in teacher SF pages to only students in the teacher’s assigned sections/subjects.
- Return 403 if a teacher manually requests an unassigned student’s SF.

**Verification:**
- Teacher SF form only lists their assigned students.
- Attempting to access another teacher’s student via URL is rejected.
- Signatory fields show full names.

---

### 7. Recently Enrolled List — 6 + expand
**Goal:** Show 6 recent enrollments by default, with an Expand button for the full list.

**Files:**
- `src/app/pages/teacher/EnrollmentModule.tsx` — lines ~1113-1119 already compute `recentEnrollments` with `.slice(0, 6)`.

**Approach:**
- Extract `recentEnrollments` into a `useMemo` if not already memoized.
- Add local state `showAllRecent` (boolean) defaulting to `false`.
- Display `showAllRecent ? recentEnrollments : recentEnrollments.slice(0, 6)`.
- Add an **Expand / Show all** toggle button in the card header (next to the enrolled count).

**Verification:**
- List shows max 6 entries initially.
- Expand reveals remaining entries; collapse returns to 6.

---

### 8. Graduated Students — Soft-archive & re-enrollment block
**Goal:** Graduated students cannot be re-enrolled; their accounts are soft-archived with read-only login; historical section/academic data is preserved.

**Files:**
- `src/app/pages/teacher/EnrollmentModule.tsx` — returning-student flow (`handleConfirmReturning`) and new-student flow.
- `server/src/controllers/enrollments.controller.ts` — `createEnrollment` currently rejects duplicate SY enrollment but does not block graduated re-enrollment.
- `src/app/pages/teacher/StudentList.tsx` — already has a `graduated` status filter.
- `server/src/controllers/schoolYears.controller.ts` — archive flow marks students `graduated` via enrollment `status = 'completed'`.

**Approach:**
- Frontend: in `handleConfirmReturning`, check `foundStudent.status === 'graduated'` and block with a toast/error.
- Backend: in `createEnrollment`, reject with 403 if the student row `status = 'graduated'`.
- Soft-archive (demo-safe minimum): add `is_archived`/`archived_at` columns to `students` (migration); set `is_archived = 1` when status becomes `graduated`. Display an "Archived / Graduate" badge in the student list.
- Read-only login (post-demo if time is tight): add middleware that rejects write methods for archived users while allowing `GET` views and profile reads. Preserve all historical `enrollments`, `grades`, and `sections` records (no cascade deletes).

**Verification:**
- Mark a student graduated; re-enroll button is disabled and API rejects re-enrollment.
- The graduated student can log in and view records but cannot edit grades/enroll (once read-only guard is added).
- Historical section and grades remain intact.


## Group 2 — Admin & System-Wide Enhancements

### 9. Admin Activity Logs — Pagination (6 + expand)
**Goal:** Show 6 recent activity-log entries by default, with an Expand option for full history.

**Files:**
- `src/app/pages/admin/ActivityLogs.tsx`
- `src/app/services/logs.ts`
- `server/src/controllers/logs.controller.ts`
- `src/app/components/ui/pagination.tsx`

**Approach:**
- Backend already supports pagination (`page`, `limit`, `total`, `totalPages`).
- Frontend currently fetches `limit: 100` and discards pagination metadata.
- Update frontend to track `page` and `limit` (default `limit = 6`).
- Add an **Expand** button that switches `limit` to a higher value (e.g., 50) or fetches all up to the backend max.
- Reuse the existing `Pagination` component for page controls when expanded.

**Verification:**
- Activity logs load quickly and show up to 6 entries.
- Expand shows more entries and pagination controls.
- Page navigation works.

---

### 10. Standardized Account Labels
**Goal:** Replace placeholder labels (e.g., hardcoded "System Administrator") with consistent default role names.

**Files:**
- `src/app/navigation.ts` (existing `ROLE_LABELS`)
- `src/app/components/ProfileSections.tsx`
- `src/app/pages/admin/UserManagement.tsx`
- `src/app/pages/admin/AdminProfile.tsx`

**Approach:**
- Define a single source of truth for role labels, e.g.:
  - `admin` → "Administrator"
  - `principal` → "School Head"
  - `teacher` → "Teacher"
  - `registrar` → "Registrar"
- Replace local `ROLE_LABEL` maps in `UserManagement.tsx` with the shared constant.
- In `AdminProfile.tsx`, remove hardcoded `name`/`email` placeholders and bind to the logged-in user’s actual profile.

**Verification:**
- Labels are consistent across sidebar, profile, and user management.
- Admin profile shows the real logged-in admin name/email.

---

### 11. SF9 — Gender Dropdown + Full Names
**Goal:** SF9 uses a standardized dropdown for sex and displays full names instead of system usernames.

**Files:**
- `src/app/pages/registrar/sf9-report.tsx`
- `src/app/pages/registrar/sf9-card.tsx`
- `server/src/controllers/forms.controller.ts`
- `src/app/services/settings.ts`
- `src/app/services/sections.ts`

**Approach:**
- `sf9-card.tsx`: replace the free-text Sex input with a dropdown (`Male` / `Female`), storing the DB enum value `male`/`female`.
- `sf9-report.tsx`: normalize and display sex value.
- Backend `getSF9`: ensure the query returns `users.name` for the adviser and `school_settings.principal_name`.
- `sf9-report.tsx`: prefill signatory fields with `principal_name` and `adviser_name`; remove any username-based signatory fallback.

**Verification:**
- Fillable SF9 shows a dropdown for sex.
- Report view shows `Male`/`Female` and full signatory names.

---

## Group 3 — Security & Account Controls

### 12. Profile Security — Current Password Mandatory + No Autofill
**Goal:** The Current Password field must be manually entered and not autofilled by the browser.

**Files:**
- `src/app/components/ProfileSections.tsx` (`ChangePasswordModal`)
- `src/app/services/api.ts` (`authApi.changePassword`)
- Backend change-password handler (`server/src/controllers/auth.controller.ts` or equivalent)

**Approach:**
- On the current-password input, set `autoComplete="off"` (or `new-password`) and add `data-lpignore="true"`.
- Ensure client-side validation rejects an empty current password.
- Confirm the backend already verifies current password and returns a clear 401/403 if wrong.

**Verification:**
- Browser does not autofill the current-password field.
- Submitting without current password shows a validation error.
- Wrong current password is rejected.

---

### 13. Username Validation (Frontend + Backend)
**Goal:** Enforce consistent username syntax/constraints for creation and changes.

**Files:**
- Frontend: `src/app/pages/Login.tsx`, `src/app/pages/admin/UserManagement.tsx`
- Backend: `server/src/controllers/users.controller.ts`
- Model: `server/migrations/001_core_tables.sql`

**Approach:**
- Create a shared validation rule: `^[a-zA-Z0-9_.-]+$`, length 3–50.
- Frontend: update Zod schemas in `Login.tsx` and `UserManagement.tsx` to use the same regex and length limits.
- Backend: add validation in `createUser` and `updateUser`.
- If username changes are desired, add `username` to the allowed update fields and check case-insensitive uniqueness.
- Return clear validation messages (e.g., "Username can only contain letters, numbers, dots, underscores, and hyphens").

**Verification:**
- Invalid characters are rejected on both frontend and backend.
- Duplicate username (different case) is rejected.
- Valid username passes.

---

## Group 4 — UI, Navigation & Documentation

### 14. Sidebar Toggle in Navbar + Logo Flip
**Goal:** The sidebar collapse/expand toggle lives in the navbar, and expanding the sidebar flips the brand logo.

**Files:**
- `src/app/components/Layout.tsx`
- `src/app/components/layout/TopBar.tsx`
- `src/app/components/layout/Sidebar.tsx`

**Approach:**
- `TopBar.tsx` already appears to contain the toggle; confirm it is the only toggle and remove any duplicate from the sidebar/page body.
- `Sidebar.tsx`: add a CSS transform (e.g., `rotate-y-180`) to the logo image when the sidebar is in expanded/full mode.
- Use the `desktopSidebar` state from `Layout.tsx` to drive the flip animation.

**Verification:**
- Toggle works in navbar.
- Sidebar expands/collapses smoothly.
- Logo flips/animates on expand.

---

### 15. PDF User Guide from SystemGuide
**Goal:** Add a Download PDF button to the existing SystemGuide page; PDF includes flowcharts and the school logo/seal.

**Files:**
- `src/app/pages/SystemGuide.tsx`
- `src/app/services/pdfExport.ts`
- `src/app/services/pdfRender.ts`
- `server/src/controllers/pdf.controller.ts`
- Public assets: `public/deped-seal.svg`, `public/right-logo.svg`, etc.

**Approach:**
- Add a **Download PDF** button to `SystemGuide.tsx`.
- Reuse existing PDF utilities.
- Preferred path: extend `pdfExport.ts` (pdfmake + html-to-pdfmake) to render the guide container.
- Because the guide contains Mermaid SVG diagrams, test whether pdfmake renders them. If not, capture the rendered guide container as an image (e.g., `html2canvas`) and embed that image into the PDF.
- Inline the school seal/logo SVG in the generated document.
- Alternative: add a backend endpoint in `pdf.controller.ts` that receives the rendered HTML and uses `puppeteer-core` to generate the PDF.

**Verification:**
- Click Download PDF; generated file contains the flowcharts and logo.
- PDF is readable in light/dark themes.

---

## Verification plan

### Automated checks
- [ ] Frontend type check: `npm run build` (runs `tsc -b && vite build`)
- [ ] Backend type check: `npm run build` (runs `tsc` in `server/`)
- [ ] Run existing backend tests: `npm test` (inside `server/`)
- [ ] Run existing e2e smoke test if relevant: `npm run test:e2e`

### Manual smoke tests
- [ ] **Teacher flow:** log in as teacher → verify My Sections only → documents filtered by subject → grade change with common mistake → upload grades template.
- [ ] **SF9 flow:** log in as registrar/principal → open SF9 → sex is dropdown → signatories show full names.
- [ ] **Admin flow:** activity logs show 6 entries → expand shows more → pagination works.
- [ ] **Profile flow:** change password requires current password, no autofill.
- [ ] **User management:** create/update user with invalid username fails; valid username succeeds.
- [ ] **Sidebar:** toggle in navbar, logo flips.
- [ ] **PDF guide:** download from SystemGuide includes logo and flowcharts.
- [ ] **Graduated archive:** mark student graduated → re-enrollment blocked → read-only login preserved.

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Changing labels in many places causes inconsistent display | Use a single `ROLE_LABELS` source of truth; audit all occurrences with grep. |
| Username validation breaks existing seeded/legacy accounts | Validate only on create/update, not login; allow existing usernames unchanged. |
| SF9 signatory names missing from backend response | Update `getSF9` query to join adviser and school settings. |
| Mermaid SVG does not render in PDF | Test early; fallback to `html2canvas` image capture or server-side `puppeteer-core`. |
| Graduated archive changes login behavior | Implement as soft archive; test both login and re-enrollment paths separately. |
| Teacher-only section filtering breaks admin/registrar view | Gate the filter by role in the backend/frontend; keep existing all-sections route. |
| Demo deadline pressure | Prioritize visible UI items first; leave archival logic for after demo if needed. |

---

## Next step

Wait for the focused teacher-role exploration to complete, then fill in the file paths and concrete implementation steps for Group 1 (items 1–8), refine ordering if needed, and present the plan for approval.
