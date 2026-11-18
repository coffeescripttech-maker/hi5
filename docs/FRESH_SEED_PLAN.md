# Fresh-Seed Cleanup Plan — Production DB (`hi5_db`)

**Status: PLAN ONLY — nothing executed.** All recon below is from read-only
queries against the shared production DB (2026-11-07). Execution will only
happen after the keep/remove lists are confirmed.

---

## A. What recon found (ground truth)

**Users (23):**
- Demo candidates (to KEEP): `admin`(1), `registrar01`(4), `principal01`(5), `committee01`(25)
- Explicitly test (REMOVE): `tst_teacher_a/b/c/d` (166–169), `zzprobe_sf10` (170), `teacher01`(2), `teacher02`(3, inactive)
- Ambiguous — need confirmation (REMOVE or KEEP): `teahcer12`(10), `arlan12`(11), `jerecho01`(12), `Mica03`(13), `biab`(14), `teacher.xed`(16), `teacherrobin`(19), `teacher_maria`(24), `comite2`(34, 2nd committee), `taecherste`(139), `teacherb`(149), `Teacher_Vin`(161)

**Students (135):**
- Flagged test (99) — includes all `TST/QA/TEST/ZZPROBE/9xx-pattern` learners (ids 13–35, 39, 44–73, 141–192, 194–202)
- The remaining 36 "real" names but most are tester-typed entries (Arlan/… variants, `RaceTest 960…991`, `sdsds dsds sdsd`, `Jaja Jaja`, `Jeje Jeje`, etc.)
- ⚠️ Needs decision: delete ALL learner rows, or keep a small demo roster?

**Everything tied to learners that must go with them:**
enrollments **228**, grades **1853**, grade_correction_requests **34**,
sf_form_edits **24**, student_electives **9**, student_classifications **70**,
reading_assessments **5**, promotions **69**, promotion_students **139**,
sectioning_history **109**, at_risk_predictions, enrollment_requirements,
transfer_requests, notifications **186** + notification_reads, and the 13
uploaded_documents (grade-template workbooks from testing).

**Sections (30):** `9-9-Alpha`(63) and `9-Beta`(64) are the test sections; the
rest look real — but their `current_count`/rosters all reference test learners.
If we delete all learners, every section's enrollment ties break → we will
RESET `current_count = 0` and clear any remaining test STA grants instead of
deleting real sections (ask: delete test sections only, or reset-counts-for-all?).

**Rooms (3):** all look test (used by the test schedule rows) → REMOVE.
**Schedules (5):** all test, including the `Robin / Foreign Language (Biology 1?)`
slot (id 18, teacher_id 19, G8 English, SY2025) → REMOVE ALL 5 + schedule_changes.

**Subjects (327):** the real catalog is intact (G7–G12 cores incl. the five
G11 cores, electives + on/off switches, TLE specializations, MAPEH, STE/SPFL
extras, ALS strands, Work Immersion + Field Experience). The previously
reported `TEST-CORE-G8-ACCEPT / TEST-FE-ACCEPT / ZZTEST-* / "new Work
Immersion"` test subjects are ALREADY GONE from the table. → Nothing to
delete here unless a tighter trim is wanted.

**Section teacher grants:** 18 `section_teacher_assignments` rows all point at
the test teachers (tst_teacher_*) → REMOVE ALL (they get re-assigned at
school setup). `teacher_subject_assignments` (40 rows): includes demo rows we
should KEEP only if the user confirms they belong to kept accounts.

**School settings / thresholds / years / role access (KEEP all):**
`school_settings` (school identity, passing grade 75, grade deadline),
`section_type_config` (STE/SPFL min-average bands — Auto-Sectioning
thresholds), `section_types`, `school_years` (all 10, 2027-2028 current),
`role_permissions`. No changes.

**Backups (61 rows):** keep **#136 and #137** (client asked), plus a FRESH
backup taken immediately before the cleanup. Everything else (mostly 2×/day
auto-backups ~2 MB SQL files) → REMOVE rows via the app's backup-delete API;
local `server/backups/auto-backup-*.sql` files can also be deleted from disk.
The auto-backup cron will keep making new ones after cleanup — that's by
design.

**Activity logs (3,085, Aug 19 – Nov 6):** client wants "entries from testing"
removed. Since essentially everything so far was development/testing,
proposal: wipe ALL activity_logs (fresh seed) — or keep the pre-October ones?
(ask, default: wipe all).

---

## B. Execution plan (after confirmation)

1. **Confirm lists** (Section C below) — no run until answered.
2. **Fresh backup** — take via the app's Database Backup (before touching
   anything) → this becomes the "fresh backup" the client asked to retain.
3. **Stop-the-clock** — client confirms nobody is online; disable nothing but
   avoid concurrent edits during the run (~10 min).
4. **Delete in dependency order** (children → parents, all scoped ONLY to
   confirmed IDs):
   - per-learner data: at_risk_predictions → grade_correction_requests →
     grades → sf_form_edits → reading_assessments →
     student_classifications → student_electives → enrollment_requirements →
     transfer_requests → promotion_students → promotions →
     sectioning_history → schedule_changes →
     notifications + notification_reads →
     teacher_subject_assignments / section_teacher_assignments rows of
     removed users → enrollments → students
   - uploads: uploaded_documents rows + their files in `server/uploads/`
   - sections: the confirmed test sections (63/64 + any) — real sections get
     counts reset to 0 instead
   - rooms + schedules + schedule_changes (confirmed test)
   - teacher grants of removed accounts (tsa/sta)
   - users: confirmed test accounts (+ zzprobe_sf10 at the very end)
   - backups: delete rows ≠ {fresh, 136, 137}; delete their disk files
   - youtube: activity logs (per decision in C-5)
5. **Reset normalizers** — `sections.current_count` recomputed; elective
   toggles (elective_year_exclusions) untouched.
6. **Verify** (acceptance):
   - logins work for the 5 demo accounts + the elective-assigned teacher
   - counts: learners 0 (or per agreed), enrollments 0, grades 0, edits 0,
     logs (per decision), notifications 0
   - catalog intact: subjects count unchanged, section types unchanged
   - school settings/thresholds/years/role access unchanged (snapshot diff)
   - backups list = fresh + #136 + #137
7. **Report** — before/after row counts per table to this doc as evidence.

Rollback: restore from the fresh backup taken in step 2.

---

## C. Decisions needed BEFORE execution

1. **Demo accounts to keep** — confirm exact list: `admin`, `registrar01`,
   `principal01`, `committee01` + WHICH teacher account is kept (and holds
   the elective grant). Are `teahcer12 / arlan12 / jerecho01 / Mica03 / biab /
   teacher.xed / teacherrobin / teacher_maria / comite2 / taecherste /
   teacherb / Teacher_Vin` test accounts to remove?
2. **Learners** — remove ALL (fresh roster), or keep some real-named ones?
   If keeping specific demo learners for the defense demo, name them.
3. **Sections** — delete only `9-9-Alpha`(63) + `9-Beta`(64), or also reset
   all real sections' counts (rosters all vanish with the learners)?
4. **Activity logs** — wipe all 3,085 (fresh seed) or keep a cutoff?
5. **Auto-backups other than #136/#137 + fresh** — delete rows only, or also
   delete the SQL files on disk (`server/backups/`, Railway `/data/backups`)?
6. **Transfer requests / requirements** (from the transfers work) — remove
   all as "tied to test learners" (they reference removed learners anyway).
7. **Secretary note** — `zzprobe_sf10` (id 170, admin) is a helper account
   from tonight's stress probe; it will be removed at the very END of the run.
