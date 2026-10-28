# Strengthened SHS Curriculum — Implementation Report

Hi5 Portal update implementing the client's **Strengthened SHS Curriculum Update Guide**
(`docs/MAJOR_CHANGES.txt`). Work performed on branch `strengthened-shs-curriculum`,
October 2026.

---

## A. Overview & Scope

The old SHS strand picker (11 legacy strands) is replaced by **two tracks** —
**Academic** and **Technical-Professional (TechPro)** — for Grade 11–12 learners in
the *regular* and *open_high* programs. Five Grade-11 core subjects and Grade-12
Work Immersion are auto-assigned; **electives are chosen per learner** (not per
section), validated at enrollment, enforced at section confirmation, and honored
in gradebooks, Excel rosters, and the SF1/SF5/SF9/SF10 forms. JHS (7–10) and ALS
flows are untouched.

The system goes live once both SHS grades follow the new curriculum (per client):
no dual-curriculum mode is built. Legacy rows are **deactivated, never deleted**,
so historical SF9/SF10 records and old grades keep resolving.

## B. Requirements → Implementation Mapping

| Client requirement | Where implemented |
|---|---|
| Two SHS tracks replace strand picker (G11–12) | `strand_tracks` rows `shs_academic` (13), `shs_techpro` (14) with `track_type='shs_track'`; `src/app/pages/teacher/EnrollmentModule.tsx` track cards |
| 5 G11 core subjects, auto-assigned, non-selectable | `subjects` ids 208–211 + General Mathematics (48), `subject_type='core'`; shown as locked chips in EnrollmentModule |
| Electives chosen per learner | New `student_electives` table + `/api/electives` API; EnrollmentModule elective cluster chips |
| Elective clusters (Academic & TechPro) | `subjects.elective_cluster` column; catalog grouped by cluster |
| Per-SY elective on/off switches | `elective_year_exclusions` table; committee/Admin toggle via `/api/electives/offerings/off|on` |
| Grade-12 Work Immersion auto-assigned | `subject_type='work_immersion'` subject; enrollment carry-over logic auto-includes it |
| Teachers cannot place students | Section confirmation is committee-only; `sectioning.controller` 422 gate blocks SHS learners without electives |
| SF1/SF5 show track + electives | `forms.controller` track joins; `sf1-register.tsx` / `sf5-report.tsx` remarks & name suffixes |
| SF9/SF10 show "Track/Strand" | `sf9-report.tsx`, `sf10-report.tsx` header field from `strand_track_name` |
| Elective-only teachers can grade | `students.controller` roster includes elective pickers across sections; `grades.controller` elective scope rules; `documents.controller` section-less elective rosters |
| Legacy strands history-only (print as text) | `strand_tracks` deactivated; forms print `strand_track_name` plain text, no picker |

## C. Database Migration (044)

File: `server/migrations/044_strengthened_shs_curriculum.sql` — **applied to the
production Railway DB (2026-10-28) and verified.**

- `strand_tracks.track_type` ENUM extended to `('tle','shs_strand','shs_track')`;
  Academic (id 13) and TechPro (id 14) added with `grade_level = 0` — *track
  fetches for G11/G12 must not filter by grade_level*.
- Legacy `shs_strand` rows (ids 6–12) deactivated.
- `subjects`: `subject_type` ENUM extended with `elective`, `field_experience`,
  `work_immersion`; `hours_per_week` made nullable (curriculum-mandated hours);
  `elective_cluster` VARCHAR(100) added.
- Legacy shared SHS cores deactivated except General Mathematics G11 (id 48);
  new G11 cores seeded (ids 208–211); Work Immersion G12 seeded; **84 electives**
  (G11 + G12 rows) seeded and linked via `subject_strand_tracks`.
- New tables: `student_electives` (unique per student+subject+SY),
  `elective_year_exclusions` (per subject+SY off switch).
- Pre-migration backup: `server/backups/pre-044-2026-10-28T07-40-09.875Z.sql`.

## D. Backend Changes

- **`server/src/utils/shsCurriculum.ts` (new)** — shared rules: track
  validation, `validateElectivePick`, `saveStudentElectives`,
  `carryOverElectives` (G12 reuse of prior SY picks + Work Immersion),
  `validateEnrollmentTrack`; electives apply only to G11/12 programs
  `regular`/`open_high` (never ALS).
- **`server/src/utils/subjectScope.ts`** — scope engine accepts
  `electiveStudentId`: learners' elective picks join the visible subject set
  (SF9/SF10 callers inherit this automatically).
- **Electives API (new)** — `electives.controller.ts` + `routes/electives.routes.ts`,
  mounted at `/api/electives`: catalog (cluster-grouped, per track + SY),
  per-student assignments, **batch assignments** (`/assignments/batch`), save
  assignments (`{student_id, school_year_id, subject_ids}`), offering
  on/off switches, roster for an elective.
- **Enrollments** — create accepts `elective_ids` (validated, persisted, G12
  carry-over); update supports track change with elective replacement; activity
  logs record changes.
- **Sectioning** — confirmation 422 gate: SHS learners with no elective picks
  are refused (`missing_electives`); carry-over on the no-enrollment branch.
- **Promotions** — promoted enrollments carry `strand_track_id`; G11→G12
  elective carry-over strengthened.
- **Grades** — section gradebook scoped per learner (elective subjects appear
  only for learners holding the pick); `teacherGradeBlockReason` rewritten:
  elective → teacher needs the subject assignment + student pick (any section);
  non-elective → advisory-section rule; batch upsert exempts elective rows from
  the section check but requires pick + assignment.
- **Documents (Excel)** — elective templates roster the learners who picked the
  elective (**section_id no longer required for electives**); import resolves
  enrollment via the elective pick by LRN; teacher imports restricted to
  assigned subjects (403).
- **Forms (SF1/SF5/SF9/SF10)** — enrollment queries join `strand_tracks`
  (`strand_track_name`, `track_type`); subject lists preserve legacy rows that
  still have grades (`is_active=0` but graded) so old SF10s keep printing.
- **PDF renderer** — renders are now **serialized** on the shared headless
  Chrome with a 180 s per-step timeout and crash-recovery relaunch (fixes a
  wedged-browser deadlock when renders queued up).
- **Teacher roster** — `students/my-students` includes elective pickers for
  elective-only teachers (no advisory section needed).

## E. Frontend Changes

- **`services/electives.ts` (new)** — typed client for the electives API.
- **`services/strandTracks.ts`** — `'shs_track'` added to all track-type unions.
- **`services/enrollments.ts`** — create/update payloads gained `elective_ids`
  (+ `strand_track_id` on update).
- **`services/subjects.ts` / `utils/hours.ts`** — 6-type union, nullable hours
  ("Curriculum-mandated"), `elective_cluster`.
- **`teacher/EnrollmentModule.tsx`** — track cards + elective cluster chips for
  G11/G12 (JHS keeps the TLE grid); stale-pick pruning; `elective_ids` sent on
  submission; both hardcoded strand pickers removed.
- **`registrar/SectionAssignment.tsx`** — committee review rows show each SHS
  learner's elective picks (amber warning when none chosen) with an
  **Assign/Edit** action: a modal editor the Committee uses to fill or amend
  picks on the spot before confirming a section.
- **`registrar/sf9-report.tsx`, `sf10-report.tsx`** — "Track/ Strand:" field.
- **`registrar/sf1-register.tsx`, `sf5-report.tsx`** — track + electives in
  remarks / name suffix.
- **`registrar/SubjectView.tsx`, `admin/SubjectManagement.tsx`** — 6 subject
  types with colors/labels, Strengthened SHS presets, optional hours, elective
  cluster input; core subjects are blocked at Grade 12 (SHS cores are G11
  only; JHS cores unaffected); **Elective Offerings** panel gives the
  Administrator the per-school-year ON/OFF switch for every elective.
- **Cross-track electives** — enrollment form has a "Show electives from the
  other track" toggle (DepEd allows choosing across tracks); other-track
  clusters are labeled with their track name.
- **`teacher/UploadGrades.tsx` + `services/documents.ts`** — elective subjects
  need no section; roster comes from elective picks; "(Elective)" labels and
  hints; template/upload omit `section_id` for electives.

## F. Test & Verification Results

| Suite | Command | Result |
|---|---|---|
| Unit (sectioning rules, regression) | `server: npm run test` | **25/25 pass** |
| API authorization smoke | `server: npm run test:api` | **26/26 pass** |
| E2E (SF forms PDF) | `server: npm run test:e2e` | **Partially verified** (see below) |
| Server TypeScript build | `server: npm run build` | clean |
| Frontend production build | `npm run build` | clean |

E2E notes:
- Login was broken by the later-added Terms gate (script predates it) — fixed.
- The PDF button now opens the FormPrintPreview modal — script clicks
  "Export PDF" inside it.
- SF9 verified end-to-end: `POST /api/pdf/render → 200`, server PDF 137 KB / 2 pages.
- SF1/SF5 serialized HTML validates against the current `sf1.css`
  (legal landscape, zoom 0.89) — the old A4/0.78 expectations were stale.
- Full-suite completion is blocked by an **unstable network** on the dev machine
  (`ERR_NETWORK_CHANGED` on localhost requests, `ECONNRESET`/`ENOTFOUND` to the
  Railway MySQL mid-run) — environmental, not code. A manual probe of the whole
  SF1 flow (login → SF1 → preview → export → blob captured in 11 s) passed.
  Rerun `npm run test:e2e` once the connection is stable.

## G. Known Limitations

- `hours_per_week` is NULL for curriculum-mandated subjects; UI shows
  "Curriculum-mandated" / "—".
- Legacy strands are history-only: they print as plain text; they cannot be
  re-selected and are hidden from new pickers.
- Electives are enforced for G11/12 `regular`/`open_high` only; ALS is exempt.
- Section gradebook scoping preserves pre-existing JHS behavior to avoid
  regressions; only elective subjects are learner-scoped.
- The old `strand_tracks` TLE rows (JHS) still drive the JHS TLE selector
  unchanged.

## H. Open Questions for the Client

1. **SPJ retention** — whether Special Program in Journalism continues under
   the new curriculum (legacy rules still applied by default).
2. **Failed-elective promotion** — whether a learner who failed an elective
   keeps the pick into G12 or must re-pick (currently picks carry over).
3. **Missing "Page 9"** of the client's update guide — the TechPro elective
   list ends at Photovoltaic Systems; confirm nothing follows.
4. **Composite elective names** — some DepEd entries ("Driving and Automotive
   Servicing, NC I and NC II") were split into numbered subject pairs; confirm
   the split is acceptable.
5. **Field Experience** — DepEd lists it as an Academic cluster of 80–160
   hours in one term, but no official subject list was found (unverified);
   seeded as `field_experience` type for the registrar to enable per school.
6. **DepEd Memo No. 12, s. 2026** — cited in the guide but not independently
   verified.

## I. Deployment & Rollback

- **Applied:** migration 044 is already live on the production Railway DB.
- **Deploy:** deploy the updated server (`server/dist`) and frontend
  (`npm run build`) together; the API is backward-compatible with the old
  frontend except for the new elective flows, which old clients simply don't
  call.
- **Rollback (data-preserving):**
  1. Restore code to the previous release.
  2. Re-activate legacy subjects/strands: `UPDATE subjects SET is_active=1
     WHERE id IN (…step-4 ids…)`, `UPDATE strand_tracks SET is_active=1 WHERE
     track_type='shs_strand'`.
  3. Optionally drop `student_electives` / `elective_year_exclusions` and
     revert the ENUMs (see header notes in the migration file).
  4. Worst case restore `server/backups/pre-044-2026-10-28T07-40-09.875Z.sql`
     (loses all data written after the backup).
