# Strengthened SHS Curriculum — Client Acceptance Checklist

Every requirement in `docs/MAJOR_CHANGES.txt` → **Status · Exact navigation ·
Step-by-step test · Expected result**.

---

## 0. One-time setup (before testing)

**Step 1 — point the web app at the LOCAL API.** The repo `.env` currently
points at the production API. For local acceptance testing create
`.env.local` in the project root with:

```
VITE_API_URL=http://localhost:3001/api
```

**Step 2 — start both servers** (two terminals):

```
# Terminal 1 — API
cd server
npm run dev              # API on http://localhost:3001

# Terminal 2 — Web app (project root)
npm run dev              # UI on http://localhost:5173
```

**Step 3 — log in.** Go to `http://localhost:5173/login`.

| Role | Account | Notes |
|---|---|---|
| Administrator | `admin` / `password123` | base seed |
| Registrar | `registrar01` / `password123` | |
| Enrollment Committee | `committee01` / `password123` | reset/create with: `cd server; npx tsx scripts/createCommitteeUser.ts committee01 password123` |
| Teacher | your teacher demo account | if none exists, create users in Admin → User Management |

⚠️ **Always tick "I agree to the Terms and Conditions"** — Sign In stays
disabled until the checkbox is ticked.

> The API talks to the **live Railway database** — anything you create here is
> real data. Use test learners (e.g. "TEST- Acceptance") and clean up with the
> drop/withdraw flow, or restore the pre-044 backup if something breaks.

---

## 1. Enrollment form behavior

### 1.1 Track replaces the SHS Strand picker ✅
1. Log in as **Enrollment Committee** (`committee01`).
2. Sidebar → **Enrollment** (under Committee) → **New Student** card.
3. Choose **Grade 11**, program **Regular** → Next.
4. Look at the section that used to say "SHS Strand \*".

**Expected:** a required **"Senior High School Track \*"** card grid with
exactly two cards — *Academic* and *Technical-Professional (TechPro)* — and no
strand list anywhere. Try Next/Submit without picking a track → blocked.
Repeat once with **Grade 12** and once with **Open High School** — same
behavior.

### 1.2 Track click reveals its clusters + electives ✅
1. Same flow as 1.1, click the **Academic** card.
2. Watch below the track cards.

**Expected:** cluster headings appear (e.g. *Arts, Social Sciences, and
Humanities*, *Business and Entrepreneurship*, *Sports, Health, and Wellness*),
each with that track's elective chips. Click **TechPro** instead → the
TechPro clusters appear (e.g. *ICT Support and Computer Programming
Technologies*, *Hospitality and Tourism*). No track selected → no clusters.

### 1.3 "Show electives from the other track" toggle ✅
1. Select **Academic** as the track.
2. Tick **"Show electives from the other track (DepEd lets learners choose
   across tracks)"** above the cluster list.

**Expected:** TechPro clusters appear as well, each labeled `· Technical-
Professional (TechPro)`. Untick → Academic clusters only. Tick it again, pick
one Academic + one TechPro elective, and submit — both are saved (verify in
test 7.1 SF1 remarks or the section review in test 6.1).

### 1.4 Electives may be empty at enrollment; Committee must fill before confirming ✅
1. As **Committee**: enroll a test G11 learner with a track but **no
   electives** → submit succeeds (a missing choice never blocks enrollment).
2. Sidebar → **Section Assignment** → run a workflow (e.g. **Manual
   Assignment**) to build a preview containing that learner.
3. In the preview row, the electives chip shows **"No electives chosen yet"**
   with an **Assign** button.
4. Click **Confirm** including this learner → the backend refuses it
   (HTTP 422, `missing_electives` names the learner).

**Expected:** confirmation blocked until the learner has electives. Use the
row's **Assign** button (test 6.1's editor) to fill them, then confirm again —
it passes.

### 1.5 Auto-assigned subjects ✅
1. Enroll a **Grade 11** learner (any track): after picking the track, the
   five cores (Effective Communication / Mabisang Komunikasyon, Pag-aaral ng
   Kasaysayan at Lipunang Pilipino, Life and Career Skills, General
   Mathematics, General Science) appear **auto-assigned** — chips not
   selectable.
2. Enroll a **Grade 12** learner: no core chips appear; **Work Immersion** is
   auto-assigned.
3. Verify persistence: Committee → **Dashboard** or Registrar → **Enrollment
   Report** → open the learner → the auto subjects are recorded.

### 1.6 ALS SHS unchanged ✅
1. Enroll a learner, program **ALS-SHS**, Grade 11.

**Expected:** no Track field, no elective clusters — ALS keeps its own
strand/specialization flow exactly as before.

### 1.7 PWD auto-tagged SNED, may take any track ✅
1. Enroll a learner with the **PWD** classification, pick **TechPro**.

**Expected:** SNED tagging still applied (learner list/classification), and
the track is accepted — no restriction.

### 1.8 Track/elective changes are logged ✅
1. As **Committee**: edit an enrolled SHS learner's track (Enrollment →
   Returning Student, or the enrollment record) and change an elective.
2. Log in as **admin** → sidebar → **Activity Logs**.

**Expected:** entries with the actor, the learner, and the **old → new**
values for both the track and the electives.

### 1.9 SPJ decision ⏳ open
The manuscript doesn't name SPJ as a program. Currently SPJ behaves as
before. Client decision required (report §H) — not testable until decided.

---

## 2. Electives list & on/off switches

### 2.1 Reference lists seeded, Maritime removed ✅
1. As **admin** → sidebar → **Subject Management**.
2. Open the **Elective Offerings** card (below the grade filter) → **Manage ▼**.

**Expected:** clusters grouped by track covering the reference lists (Academic
~48 electives, TechPro specializations with NC II/NC III suffixes). **No
Maritime Transport cluster.**

### 2.2 Per-year ON/OFF switch ✅
1. Same card as 2.1 — every elective chip is a switch showing **● ON** or
   **○ OFF**.
2. Click an ON elective (e.g. *Introduction to Philosophy*) → it becomes
   **○ OFF** with a success toast.
3. Log in as **Committee** → **Enrollment** → new G11 enrollment → pick the
   Academic track.

**Expected:** the switched-off elective is **not offered** on the enrollment
form. Switch it back ON in Subject Management → it reappears.

### 2.3 No cluster-management screen ✅ (by design)
1. Browse the admin sidebar.

**Expected:** no cluster CRUD screen — clusters exist only as fixed headings
(seed data `elective_cluster` values).

### 2.4 Elective picker UX — search, tabs, collapse ✅
The catalog spans ~84 electives × 2 grades × 14 clusters, so all three
elective lists (enrollment form, committee editor, admin offerings) share a
searchable, collapsible grid:
1. Admin → **Subject Management → Elective Offerings → Manage ▼**.
2. Type in the **Search electives…** box (e.g. "animation").

**Expected:** matching chips only, with an "n of m electives" counter; the
G11 / G12 / All tabs appear (offerings panel spans both grades; other
screens pre-filter so they don't show tabs). Clusters collapse via the
chevron, each showing a picked/on count badge. New UX safety net: on the
**enrollment form** and the **committee Assign/Edit modal**, everything
ticked stays pinned in a **"Picked (n)"** bar with ✕ to remove — even picks
hidden by the current search.

---

## 3. Subject Management (Administrator)

### 3.1 Create subjects by SHS category ✅
1. Admin → **Subject Management** → **Add Subject**.

**Expected:** the Type selector offers all six categories — Core, Applied,
Specialized, **Elective**, **Field Experience**, **Work Immersion**.

### 3.2 Core subjects are Grade 11 only ✅
1. Add Subject → Type **Core**, Grade **12**, any name → Save.

**Expected:** refused with the message *"Core subjects are Grade 11 only
under the Strengthened SHS Curriculum — Grade 12 has no core subjects."*
(Backend returns 400 too.) Grade 7–10 core subjects are unaffected — create
one at Grade 8 to confirm.

### 3.3 No stored hours for FE / Work Immersion ✅
1. Add Subject → Type **Field Experience** (or Work Immersion), leave Hours
   empty → Save.
2. Look at the subject list row.

**Expected:** saves fine; hours show as **"Curriculum-mandated"** (desktop) /
**"—"**; the list's hrs/week total ignores it. Grades remain plain numbers
(test 5.2).

---

## 4. Teacher assignment & rosters

### 4.1 Elective roster = the learners who picked it ✅
1. As **admin** → Subject Management → an elective → **Assign Teacher** →
   pick a teacher account.
2. Log in as that **Teacher**.

**Expected:** the teacher's **My Students** / **Grade Management** rosters
show **only the learners who picked that elective** — they may come from
different sections.

### 4.2 Core subjects keep the section roster ✅
1. Log in as a teacher assigned to a core subject (e.g. General Mathematics).

**Expected:** they still see the whole advisory/section roster, unchanged.

### 4.3 Elective-only teacher can grade and upload ✅
Use a teacher who has **no advisory section** (only the elective assignment):
1. **My Students** — shows the elective pickers.
2. **Grade Management** — the elective appears; encode Q1 grades; Save.
3. **Upload Grades** — pick the elective in the Subject dropdown
   (labeled **"(Elective)"**); the Section dropdown can stay **"Select
   section…"** — a green hint explains *"Elective — no section needed."*
4. **Download Excel Template** — the roster rows are the elective pickers.
5. Fill one grade, upload, review the preview (invalid LRNs say *"LRN is not
   on this elective's roster"*), then **Import**.

### 4.4 Schedule/room for cross-section electives ✅
Elective teachers have no fixed section, so their timeslots do not need one:
1. Registrar → **Schedule Modifier** → **New Schedule**.
2. In **Class Type** pick **⚡ Elective timeslot** (roster = learners who
   picked the elective, from any section) — the Section picker disappears.
3. Teacher + Subject (only electives / Field Experience / Work Immersion are
   listed, each badged **"— N pickers"**) + Day/Time/Room → **Create Entry**.
4. Try a duplicate: same teacher, overlapping time → conflict warning + 409.
5. Try the same with a section-rostered subject (e.g. General Mathematics) →
   refused with an explanation.

**Expected:** the entry saves **without a section**, shows an **⚡ Elective**
chip in the Schedule Modifier list. **My Teaching Schedule** (the teacher) and
**Master Schedule** show the slot with the elective marker instead of a
section. Teacher double-booking and room occupancy still conflict. (Learner
level: if two of a learner's electives collide in the timetable, no warning —
the Committee resolves that at pick time; see report limitations.)

---

## 5. Grades

### 5.1 General Average counts electives ✅
1. Teacher → **Grade Management** → pick an SHS learner with an elective.
2. Encode an elective Q1 grade → Save.

**Expected:** the learner's General Average recalculates including the
elective (G11: cores + electives; G12: electives only).

### 5.2 TechPro electives graded like any subject ✅
1. Encode Q1–Q3 quarterly grades for a TechPro elective.

**Expected:** same quarterly grade inputs as any subject; 75 passing rule
applies (visible in the promotion check, test 6.4).

### 5.3 Thresholds stay Administrator settings ✅ (unchanged)
Admin → **School Settings** — passing (75) / monitoring (80) still editable.

### 5.4 Locking / corrections / logging work for electives ✅
1. Teacher locks the elective's grades (lock action in Grade Management).
2. Try to edit a locked cell → blocked.
3. Teacher → elective row → file a **grade correction request**.
4. Admin/Registrar → **Grade Corrections** (registrar sidebar) → the request
   appears and can be approved → the Activity Log records it.

---

## 6. Sectioning, carry-over, promotion, at-risk

### 6.1 Committee elective editor + mixed-elective sections ✅
1. Committee → **Section Assignment** → generate a preview for Grade 11.
2. In a learner's row, the electives chip shows the picks (or "No electives
   chosen yet"); click **Assign/Edit**.

**Expected:** modal titled **"Electives — <learner name>"** with all offered
electives grouped by cluster (both tracks, labeled). Tick/untick → **Save
Electives** → the row chip updates immediately. Sections can mix learners
with different electives — confirmation succeeds.

### 6.2 Carry-Over G11→G12 ✅
1. Committee → **Section Assignment** → **Carry-Over (Prior Section)** tab →
   choose Grade 12 → **Generate Preview**.

**Expected:** G11→G12 learners propose their **prior section** and their
**prior electives copied** — each row's elective chip lists them and **Edit**
lets the Committee change the list before confirming.

### 6.3 Committee confirms; teachers cannot place ✅ (unchanged)
1. Confirm a batch in Section Assignment (checkbox → Confirm).
2. As a **Teacher**, attempt any section assignment — the UI offers none.

**Expected:** only Committee/Registrar can confirm (API returns 403 for
teachers).

### 6.4 Failed elective → Retained ✅
1. Give a learner a final elective average **below 75**.
2. Committee/Registrar → **Promotion & Graduation** / teacher → **Bulk
   Promotion** → run the promotion preview for that section.

**Expected:** the learner is flagged **Retained** — the elective counts in
the rule. (DepEd confirmation on failed electives: open question, report §H.)

### 6.5 At-risk reads elective grades ✅
1. Encode a failing elective quarter for a learner.
2. Teacher → **At-Risk Detection** (or Registrar → **At-Risk Students**) →
   compute for the current SY.

**Expected:** the learner appears with the elective's grades included in the
General-Average trend (least-squares, current-SY quarters only).

### 6.6 At-risk is roster-scoped for teachers ✅
Strengthened SHS rosters: an elective teacher's learner base cuts across
sections, so at-risk access is now roster-scoped like grade encoding:
1. Log in as a teacher who handles **only an elective** (no advisory section;
   e.g. the Animation NC II teacher) → At-Risk Detection.
2. **Expected:** the list shows exactly their elective pickers (e.g. Ivan,
   although 11-Matatag has another adviser), never other learners.
3. As that teacher, attempt a prediction (their own roster learner) → works.
   (Verified live: a non-roster learner → **403 not on your roster**;
   running school-wide without a target → **403**; prediction lists show
   only own-roster rows.)

---

## 7. School Forms (PDF)

### 7.1 SF1 ✅
1. Registrar → **SF1 — School Register** → select SY + an SHS grade/section.
2. In the register rows and in the **PDF** export (PDF → preview modal →
   **Export PDF**).

**Expected:** SHS rows show **Track: Academic · Electives: A, B** (instead of
a strand); old strand rows (legacy learners) print the strand as plain text.

### 7.2 SF5 ✅
1. Registrar → **SF5 — Promotion Report** → SHS section.

**Expected:** learner names carry the track (e.g. *Dela Cruz, Juan
(Academic)*), final ratings include electives; the promotion check counts
them; export PDF.

### 7.3 SF9 ✅
1. Registrar → **SF9 — Report Card** → pick an SHS learner (dropdown).
2. Header + subject table, then PDF → preview → **Export PDF**.

**Expected:** header shows **Track/Strand: Academic**; G11 subject list =
five cores + the learner's electives; G12 = electives, Field Experience,
Work Immersion; all numerical grades; the customizable extra rows still work.

### 7.4 SF10 ✅
1. Registrar → **SF10 — Permanent Record** → search an SHS learner.

**Expected:** the record header shows the track per school year, electives
recorded per SY, the five DepEd core names **verbatim**, FE/WI grades
printed, and a legacy learner's old strand still prints as plain text.

### 7.5 Hand-filled fields unchanged ✅ (unchanged)
Mother Tongue, Religion, attendance, observed values stay blank/manual —
verify on any printed form.

### 7.6 SF9 for elective-roster learners (teacher access) ✅
Elective teachers must open the report card for pickers who sit in other
sections' sections — the SF9/SF10 access guard accepts the roster, and the
SF9 page now has an elective-roster student picker for teachers:
1. Log in as an **elective teacher** whose roster has pickers from sections
   not advised by them (e.g. the Animation NC II teacher — roster includes
   Ivan in 11-Matatag).
2. SF9 page → grade selects the learner's grade → in the **My Elective**
   dropdown pick **⚡ Animation, NC II (G11)**.
3. The Student list switches from section rosters to the elective's pickers;
   the summary line shows **"Elective: …"**; pick the learner → SF9 renders
   (their section name + subject list, including the elective).
4. Deep-link test: open
   `/teacher/forms/sf9?student_id=<roster learner>&school_year_id=<sy>`
   directly — the card opens even though none of the teacher's own sections
   hold the learner.
5. Switch **My Elective → By section…** — the normal section flow returns, and
   the **My Students** list marks extra-roster learners with a **⚡ Elective:
   <name>** chip.

---

## 8. Automated suites (already executed)

| Suite | Command (from `server/`) | Result |
|---|---|---|
| Unit — sectioning rules & regression | `npm run test` | 25/25 pass |
| API authorization smoke | `npm run test:api` (needs API running) | 26/26 pass |
| E2E — SF-form PDF flow | `npm run test:e2e` (needs API + UI running) | SF9 verified end-to-end; full-suite rerun pending a stable network |
| TypeScript builds | `npm run build` (server) and `npm run build` (root) | clean |

Additionally verified live against the running API (2026-10-28): elective
catalog returns **84 electives × 2 grades, 14 clusters, Academic +
TechPro, no Maritime**; the Administrator OFF/ON switch flips availability
and restores it; registrar is correctly refused (403) admin-only actions;
a core subject at Grade 12 is refused with the curriculum message while
Grade 8 cores and no-hours Field Experience/Work Immersion subjects are
accepted.

Verified live (2026-10-30):

- **At-risk roster scoping** — with a throwaway elective-only teacher: trends
  lists exactly the elective pickers; predictions for own-roster learners
  pass, foreign learners → 403, whole-school run → 403; prediction lists are
  roster-only. (Test artifacts removed.)
- **Elective timeslots** (migration 045: `schedules.section_id` nullable, in
  production DB): electives/FE/WI schedule **without a section**; section
  subjects must keep a section; an elective cannot be forced onto a section
  (400 both ways); teacher overlap still conflicts (409); two elective slots
  by different teachers may share a day/time; lists/deletes/updates verified
  and test rows cleaned up.
- **Elective picker grid** (shared search/grade-tabs/collapse component) wired
  into EnrollmentModule, the committee elective editor, and the offerings
  panel — frontend TypeScript clean.
- **SF9 elective-roster flow** — teacher page picker (My Elective dropdown),
  summary line, deep-link keep-preselect; roster data confirmed via
  `/electives/assignments/batch` and `/subjects/me/assigned`.
- **Saved School Form Edits — Phase 1** (migration 046 `sf_form_edits`,
  applied to the production DB): explicit **Save** buttons on SF1/SF5/SF9/
  SF10 with unsaved-count badge + before-leave warning; every saved field
  re-applies on reopen/regenerate/print. Role gating verified live with a
  throwaway teacher: teacher saves SF9 attendance only (own advisory → 200,
  foreign learner → 403, non-attendance key → 403, SF1 → 403, closed SY →
  403); Principal/Committee → 403; closed school years stay editable only
  for Registrar/Admin; SF9 observed-value save tightened the same way
  (own advisory 200, foreign 403, principal 403). Activity-log rows confirmed
  (actor, learner, form, field, old → new). Test rows/accounts/logs removed;
  the real adviser on the borrowed test section was restored.
- **Saved School Form Edits — Phase 2** (migration 047 `SHARED` form value):
  cross-form shared fields verified live — SF1's school-identity header +
  SF10's learner identity edits surface on the other forms (even on a closed
  school year view), and a new school year starts carried over (SF1 learner
  cells, SF10 learner + eligibility blocks; quarterly fields blank; remarks
  excluded; current-SY saves shadow the carried values). Test rows/logs
  removed afterwards.

⚠️ Remember to **restart your local API** (`node dist/index.js`) to pick up
these backend changes — migrations already applied to the Railway DB.

---

## 9. Saved School Form Edits (`docs/MAJOR_CHANGES_IN_FORMS.txt`)

Every handwritten edit on SF1 / SF5 / SF9 / SF10 is now **saved permanently**
against the learner + school year and re-appears the next time anyone opens,
regenerates, or prints that form (sidebar: an explicit **Save** button in the
no-print header bar, an **● n unsaved edits** counter, and a
before-you-leave warning on the browser tab while edits are pending).

Stored in the `sf_form_edits` table (migration 046) keyed by
(form, school year, learner, field) — empty string = a deliberately
**cleared** field that also re-appears. Rule references in parentheses.

### 9.1 Saving works for all four forms ✅ (rules 1–6)
1. Registrar → SF1 → type a **Address → Barangay** cell for a learner, fix
   the **Region** header, change a BoSY/EoSY date → **Save** → success toast.
2. Navigate away, come back → your values are still there. Other users see
   them too.
3. Repeat a taste test on SF9 (attendance cells, parent signature dates,
   Certificate-of-Transfer names, Principal/Adviser signers), SF5 (a learner's
   General Average override, a summary-table count, **Reviewed by** signer),
   and SF10 (learner block, eligibility checkboxes + dates, per-year record
   cells, certification block).
4. **Expected:** the next **PDF/print** of each form uses the saved values
   (values overlay the auto-derived system data before rendering).
5. Save with no pending edits → "Nothing new to save" toast, no duplicate
   rows.

**Expected:** grades, General Average, promotion result, section, adviser
stay system-derived per rule 2 — not stored by this mechanism.

### 9.2 Role gating ✅ (rule 10 — decided STRICT)
- **Registrar/Administrator** save everything on all four forms.
- **Teacher** saves only SF9 **attendance cells** and **observed values**, and
  only for learners of a section they **advise**. Tested live: teaching SF1 →
  403; foreign learner attendance → 403; non-attendance cell → 403.
- **Principal / Enrollment Committee** are view-only → 403 on both GET (when
  scoped) and PUT.
- Teacher *read* access mirrors the existing school-form guards (own advisory
  section, assigned sections, or an elective roster via **My Elective**).

### 9.3 Closed school years ✅ (rule 16 — implemented)
1. Pick a past school year (is_current = 0) in any form → edit → **Save**.
2. **Expected:** Registrar/Admin succeed; Teacher gets
   *"This school year is closed — only the Registrar or Administrator can
   change its school forms."* (403).

### 9.4 Activity logging ✅ (rule 14)
Every changed field writes an Activity Log row (actor, learner, form, field,
old → new, time): `Saved SF9 edit for <learner>: attendance:No. of Days
Present:Jun "2" -> "3"`. Unchanged saves log nothing.

### 9.5 Backup ✅ (rule 17)
`sf_form_edits` is a plain table — included in System Backup/restore as is.

### 9.6a Cross-form shared fields ✅ (rule 8 — implemented)
Fields printed by more than one form are stored **once** under the `SHARED`
form and show everywhere (verified live):
1. On SF1 (or SF10), fix the **school-identity header** (School ID, Region,
   Division, District, School Name) → Save. Open **any** of SF5/SF9/SF10,
   even for a closed school year → the same header values are there.
2. On SF10, edit a learner's **Sex / LRN / Birth Date** → open SF1 for that
   learner → the same values appear (SF1 `s:sex/s:lrn/s:birthdate` answer
   to SF10's learner block).
3. A form-specific correction still wins on that form only (per-form rows
   shadow the shared copy), and shared header fields refuse a learner scope
   (they are school-wide).

### 9.6b New school year carry-over ✅ (rule 15 — implemented)
Every new school year starts **carried over**:
- **SF1**: learner cells (address, parents, guardian, contact, IP, religion,
  mother tongue, …) come from the immediately previous school year as a
  prefill. `Remarks` is deliberately NOT carried (it belongs to the year's
  own elective picks + legend).
- **SF10**: the **learner identity block** (names, etc.) and the
  **eligibility block** (elementary school, PEPT/ALS entries, …) carry over.
  Scholastic records / learning areas / remedials are per-year by design.
- **Quarterly fields start blank** (SF9 attendance, SF9 observed values,
  parent signatures, SF5 grade tables).
- A carried value is read-only prefill until someone edits + **Saves** it
  into the new year; a field saved in the new year always wins over the
  carried one.

### 9.7 Not yet implemented (next pass — flagged by rules 11/12/13)
- **"Edited" marker + Reset to system value** per cell.
- Notice when the underlying system value changes after an edit.
- Concurrent-edit warning (two users on the same form at once).

---
