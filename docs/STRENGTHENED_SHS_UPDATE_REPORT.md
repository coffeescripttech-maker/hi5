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
- **Migration 045 (applied 2026-10-30)** — `schedules.section_id` made nullable
  for **elective timeslots**: a schedule row without a section is rostered
  from the learners who picked the elective (per-learner picks cut across
  sections). `uk_section_time` still allows multiple NULL-section rows, so
  several electives/teachers can share the same timeslot.

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
- **Saved School Form Edits (docs/MAJOR_CHANGES_IN_FORMS.txt) — Phase 1**:
  - **Migration 046** — `sf_form_edits` table keyed
    `(form, school_year_id, student_id NULL=form-level, field_key)` with
    unique `uk_sf_edit`; value TEXT (≤5000 chars), actor + timestamps, FKs to
    students/school_years/users.
  - **`controllers/formEdits.controller.ts` (new)** — `GET/PUT /api/forms/edits`
    in `routes/forms.routes.ts`: role gating (rule 10 strict — teachers write
    only SF9 `attendance:*` keys for own-advisory learners, one learner per
    batch), closed-SY lock (rule 16: only Registrar/Admin), field-key regex
    + 400-edit/5000-char limits, empty-string = cleared field (rule 7),
    SELECT-then-upsert (NULL-safe), per-field Activity Log old → new
    (rule 14). Teacher GET mirrors the existing form read guards.
  - **`controllers/forms.controller.ts`** — `saveSF9FormData` (observed
    values) tightened the same way: teacher saves only for own-advisory
    learners; closed SY is Registrar/Admin only; Principal/Committee → 403.
  - **Phase 2 — rules 8 + 15** (`utils/formSharedKeys.ts` + migration 047):
    shared fields (school-identity header on all four forms; learner identity
    `sex/lrn/birthDate` SF1↔SF10) are stored ONCE under `form='SHARED'` and
    translated into each requesting form's namespace on read (per-form rows
    shadow the shared copy). `GET /forms/edits` additionally returns
    `carried` rows — the previous school year's learner-level namespaces
    (SF1 `s:*` minus per-SY `remarks`, SF10 `learner:*`/`elig:*`) as a
    read-only prefill; quarterly fields start blank and current-SY saves
    always shadow carried values.
- **Saved School Form Edits — Phase 3 (rules 11–13)** (migration 048):
  - **Migration 048** — `sf_form_edits.system_value` TEXT NULL: each edit
    stores the system value it was taken over from (rule 11/12 baseline).
  - `PUT /api/forms/edits` accepts optional per-edit `system_value` (UPDATE
    uses `COALESCE`, so an omitted baseline never clobbers a stored one) and
    optional `opened_at` + `force`: rows changed after `opened_at` refuse the
    save with **409 + `conflicts[]`** unless the client confirmed the
    overwrite (rule 13); identical-value writes never conflict. The clock is
    the **database's own time** — GET/PUT exchange `opened_at` as a DB-side
    `NOW()` timestamp and the `updated_at > opened_at` comparison runs inside
    SQL, so client clock skew and the DB↔API timezone difference on Railway
    cannot skew it.
  - **`DELETE /api/forms/edits`** (`resetFormEdits`) — rule 11 reset to
    system value: same role/closed-SY gating as the save (rule 10/16),
    shared-key normalization included, deletes each stored row and logs
    `"..." -> system value` (rule 14).
- **PDF renderer** — renders are now **serialized** on the shared headless
  Chrome with a 180 s per-step timeout and crash-recovery relaunch (fixes a
  wedged-browser deadlock when renders queued up).
- **Teacher roster** — `students/my-students` includes elective pickers for
  elective-only teachers (no advisory section needed).
- **At-risk roster scoping** — a shared `teacherScopeCondition` mirrors the
  my-students rule (advised/assigned sections OR elective pickers) across
  trends, prediction lists (were school-wide for teachers), and predictions
  (teachers may target only their own roster; no-target school-wide runs are
  refused for teachers).
- **Schedules** — elective timeslots: `section_id` optional; create/update
  validate the XOR rule (elective/FE/WI subjects → no section; section‑wide
  subjects → section required), conflict detection still enforces teacher and
  room overlaps (section overlap checked only when a section applies).

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
- **`components/electives/ElectiveCatalogGrid.tsx` (new)** — shared elective
  grid with **search**, automatic **grade tabs** (G11/G12/All), **collapsible
  clusters** with picked/on badges, and a pinned **"Picked (n)"** bar so a
  selection hidden by the search stays removable. Wired into
  EnrollmentModule (learner picks), the committee elective editor
  (SectionAssignment), and the admin Elective Offerings panel.
- **`registrar/ScheduleModifier.tsx`** — **Class Type** toggle:
  *Section class* vs *⚡ Elective timeslot* (section picker hidden; elective
  subjects badged with their picker count from the batch API). List rows show
  an **⚡ Elective** chip for section-less slots.
- **`registrar/MasterSchedule.tsx` / `teacher/TeacherSchedule.tsx`** —
  elective slots render an elective marker instead of a section name.
- **`registrar/sf9-report.tsx`** — teacher **My Elective** dropdown switches
  the student list to an elective roster; summary line shows the elective;
  deep-linked roster learners are kept as the selected student.
- **Saved School Form Edits (docs/MAJOR_CHANGES_IN_FORMS.txt) — Phase 1**:
  - **`services/forms.ts`** — `formEdits`/`saveFormEdits` + `FormEditRow`.
  - **`hooks/useFormEdits.ts` (new)** — loaded/local value maps, dirty
    tracking, `get`/`setValue`/`save`/`reset`, merged `valuesRef` for build
    effects, before-leave warning while dirty.
  - **`registrar/sf9-report.tsx`** — attendance cells, parent signatures,
    Certificate-of-Transfer fields and signer names persist (observed values
    keep their auto-save; Save flushes them immediately).
  - **`registrar/sf1-register.tsx`** — per-learner cells, header identity,
    signers, BoSY/EoSY dates and REGISTERED summary cells persist; row
    overlays re-apply saved + unsaved values on rebuilds.
  - **`registrar/sf5-report.tsx`** — per-learner cells (incl. General
    Average/action overrides), summary/progress count tables and the
    Reviewed signer persist.
  - **`registrar/sf10-report.tsx`** — learner block (incl. checkbox
    eligibility), certification block, header identity, and per-school-year
    record cells + learning areas + remedial rows persist; saved values are
    re-applied once both the SF10 and the edits fetch settle.
  - Explicit **Save** button + **● n unsaved edits** badge on every form
    (visible to admin/registrar; teacher sees it on SF9 only, principal and
    committee never).
  - **Phase 2** — `hooks/useFormEdits.ts` layers `carried` (previous-SY
    prefill, rule 15) UNDER the current school year's saved values, and
    shared fields arrive pre-translated (rule 8) so no per-form change was
    needed beyond the hook.
  - **Phase 3 (rules 11–13)** — `hooks/useFormEdits.ts` gains `setBase`
    (records the freshly derived system value from the forms' build
    effects), `isEdited` (marker compare), `listEdits`/`resetEdits`
    (per-item **Reset**), `refreshBaseline` (**Keep**), and
    `conflicts`/`resolveConflict` (409 banner Overwrite/Reload); sends the
    DB-clock `opened_at` with every save.
  - **`components/FormEditsMenu.tsx` (new)** — the **Edited fields** menu in
    every form header bar (admin/registrar; teacher on SF9): lists
    saved/unsaved/carried edits, amber Δ badge when baselines drifted,
    per-item **Reset** + **Reset all**, `system value changed` tags with
    **Keep**, and the concurrent-edit banner. Wired into
    `sf1-register.tsx`, `sf5-report.tsx`, `sf9-report.tsx`,
    `sf10-report.tsx`.
  - **`registrar/sf1.css`** — `.sf-edited-cell` amber marker on cells that
    differ from the system-derived value (hidden in print/PDF); markers
    render on the SF1/SF5 leaf-cell grids.

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

Live saved-form-edit probes (temp API on :3005, throwaway teacher account):

| Probe | Result |
|---|---|
| Admin PUT SF1 form-level + learner cells (current SY) | 200 |
| Admin PUT SF9 on closed SY | 200 (allowed for Admin) |
| Teacher GET: foreign learner / own advisory learner | 403 / 200 |
| Teacher PUT SF1 / foreign-learner attendance / non-attendance key | 403 / 403 / 403 |
| Teacher PUT SF9 attendance, own advisory learner | 200 |
| Teacher PUT on closed SY | 403 |
| Principal / Committee GET + PUT | 403 / 403 |
| `sf9-data` observed values: teacher own 200, foreign 403, principal 403 | ✅ |
| Activity Log rows (actor, learner, form, field, old → new) | ✅ verified |
| Duplicate key / bad field key / unknown learner / unknown form | 400 / 400 / 404 / 400 |

Phase-2 probes (temp API on :3005, admin account):

| Probe | Result |
|---|---|
| Admin PUT SF10 `learner:sex` → stored once as `SHARED` `shared:learner:sex` | ✅ |
| GET SF1 same learner → appears translated as `s:sex` | ✅ |
| Admin PUT SF1 `header:schoolId` → GET SF9 (even closed SY 1 view) shows it | ✅ |
| Rule 15: SF10 `elig:*` + `learner:middleName` saved in prev SY → appear in `carried` of SY3 | ✅ |
| SF1 `s:remarks` excluded from carry; SF9/SF5 carry nothing (quarterly blank) | ✅ |
| Current-SY save shadows the carried value | ✅ |
| Shared header scoped to a learner → 400; shared learner field without a learner → 400 | ✅ |

Phase-3 probes (temp API on :3005, admin + throwaway teacher):

| Probe | Result |
|---|---|
| PUT with `system_value` → GET returns the stored baseline | ✅ |
| DELETE reset of a saved row (idempotent; row gone after) | ✅ |
| GET returns DB-clock `opened_at` | ✅ |
| Stale `opened_at` + different value → **409 + conflicts[]** | ✅ |
| Same request with `force:true` → 200 | ✅ |
| "Keep" (same value + new `system_value`) → 200, baseline refreshed | ✅ |
| Identical-value save with stale `opened_at` | 200 (no conflict) |
| Admin PUT/DELETE reset on a closed SY | 200 |
| Teacher DELETE reset SF9 attendance, own learner | 200 |
| Teacher DELETE on SF1 / foreign learner / closed SY | 403 |
| Teacher DELETE batch with two learners | 400 |
| Teacher PUT non-attendance SF9 key | 403 |
| Activity Log `Reset ... -> system value` rows | ✅ verified |

All test rows, the throwaway account, and probe activity-log rows were removed
afterwards; the borrowed test section's real adviser was restored.

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
- Elective timeslot conflict detection is teacher/room/section-based only — a
  learner whose two picked electives land on the same timeslot gets no
  automatic warning (the Committee resolves collisions when picking/confirming).
- At-risk `AVG(grade)` is subject-agnostic by design — elective and core
  grade rows both feed the quarterly General-Average trend.
- **Saved School Form Edits, Phase 1+2** (mirrors checklist §9.6/§9.7):
  - Shared fields cover the school-identity header + learner identity
    (`sex/lrn/birthDate` SF1↔SF10). Other learner details printed on several
    forms (names, addresses, guardian) are system-derived from the students
    record, so the forms already agree on them; splitting SF10's name parts
    ↔ SF1's full name is intentionally not shared (lossy mapping).
  - Edited markers render only on the SF1/SF5 leaf-cell grids plus the
    SF1 count/date cells; other edit targets (signers, SF10 cells, SF9
    certificate fields) appear correctly in the Edited-fields menu but
    without an on-cell dot. SF9 observed values keep their separate
    endpoint and are out of this menu's scope.

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

- **Applied:** migrations 044 (elective timeslots), **046 (`sf_form_edits`)**
  **and 047 (SHARED form value)** are already live on the production Railway DB.
  **048 (`sf_form_edits.system_value`) is applied as well** (column add,
  data-preserving).
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
