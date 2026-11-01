# Hi5 Portal — Client Acceptance & Testing Guide (Plain-Word Version)

This is the **easy-to-read companion** to
`docs/CLIENT_ACCEPTANCE_CHECKLIST.md` (the technical version our developers
use). Every requirement from **`MAJOR_CHANGES.txt`** is still covered — nothing
is dropped, only translated. If any test below fails, please report it using
its **test number** (e.g. "T14 failed") and what you saw instead.

**Words used in this guide**

| Word | Meaning |
|---|---|
| Term | The grading period. The school now uses **3 terms (T1, T2, T3)** instead of quarters — the menus and forms say **Term**. |
| Track | The Senior High choice **Academic** or **TechPro** that replaces the old "strand" picker. |
| Elective | A specialized subject (e.g. Animation NC II, Business 1) chosen by each individual learner. |
| Cluster | A group heading for electives (e.g. "Hospitality and Tourism"). |
| Field Experience / Work Immersion | On-the-job subjects. They get **plain number grades** and the system never stores weekly hours for them. |
| System value | The value the portal computes itself from enrollment/grades. |
| Saved edit | A value a staff member typed and pressed **Save** on a school form — it then beats the system value. |

**How to read each test:** 📍 *Where* → 🔧 *What to do* → ✅ *What you should see*.

---

## Part 0 — One-time setup before testing

1. In the project folder, create a file named `.env.local` containing one line:
   `VITE_API_URL=http://localhost:3001/api`
2. Open two terminals:
   - Terminal 1: `cd server` then `npm run dev` (this is the backend)
   - Terminal 2: project root, `npm run dev` (this is the website)
3. Visit `http://localhost:5173/login` and sign in:

| Role | Account | Notes |
|---|---|---|
| Administrator | `admin` / `password123` | |
| Registrar | `registrar01` / `password123` | |
| Enrollment Committee | `committee01` / `password123` | |
| Teacher | your teacher demo account | create via Admin → User Management if missing |

   ⚠️ Always tick **"I agree to the Terms and Conditions"** — Sign In stays
   disabled until you do.

⚠️ **The testing you do here writes to the school's real (live) database.**
Use clearly-fake learners, e.g. named **"TEST- Acceptance"**, and afterwards
remove them through the normal drop/withdraw flow. Don't leave test grades on
real learners.

💡 If something looks stale after a fix was made, do a **hard refresh**
(Ctrl+Shift+R). No retesting of old areas is needed unless a fix targeted them.

---

## Part 1 — Enrollment form

**T11 — Track replaces the strand picker.** 📍 Enrollment (Committee) → New
Student → choose Grade 11, program Regular → Next. ✅ There is no "strand"
field anymore. Instead there is a required **Senior High School Track** card
grid with exactly two cards: **Academic** and **Technical-Professional
(TechPro)**. Pressing Next without choosing a track is blocked. Repeat with
Grade 12 and with Open High School — same behavior.

**T12 — Clicking a track reveals its electives.** 📍 Same flow. ✅ Clicking
**Academic** shows its cluster headings (Arts/Social Sciences/Humanities,
Business and Entrepreneurship, Sports/Health/Wellness, STEM) each with that
track's elective chips. Clicking **TechPro** shows TechPro clusters instead
(e.g. ICT Support and Computer Programming, Hospitality and Tourism). With no
track selected, no clusters appear.

**T13 — Electives from the other track.** 📍 Enrollment form, Academic picked.
✅ Ticking **"Show electives from the other track (DepEd lets learners choose
across tracks)"** also shows TechPro clusters, each labeled · TechPro. Choosing
one from each track and submitting saves both.

**T14 — Electives may be empty at signup; Committee fills before confirming.**
📍 Enroll a Grade 11 test learner with a track but no electives → it submits
fine. Then Committee → Section Assignment → build an assignment preview
containing that learner. ✅ The row shows **"No electives chosen yet"** with an
**Assign** button. Pressing **Confirm** with this learner inside is **refused**
with a message naming the learner. After assigning electives via that button,
Confirm passes.

**T15 — Core subjects are automatic.** 📍 Enroll a Grade 11 learner. ✅ The
five DepEd cores (Effective Communication / Mabisang Komunikasyon, Pag-aaral ng
Kasaysayan at Lipunang Pilipino, Life and Career Skills, General Mathematics,
General Science) appear already assigned and cannot be un/ex-selected. For a
Grade 12 learner: no cores, but **Work Immersion** is auto-assigned. The
learner's record afterwards shows these subjects.

**T16 — ALS unchanged.** 📍 Enroll, program ALS-SHS, Grade 11. ✅ No track
cards, no elective clusters — ALS keeps its own strand flow.

**T17 — PWD learners.** 📍 Enroll with the PWD classification, pick any track.
✅ The SNED tagging still applies, and any track is accepted.

**T18 — Every track/elective change is logged.** 📍 Edit an enrolled learner's
track or electives as Committee; then login as admin → Activity Logs. ✅ An
entry shows who did it, which learner, and the old → new values.

**T19 — SPJ (open decision).** The manuscript doesn't name SPJ as a program,
so SPJ currently behaves as before. A client decision is still needed (see
§H questions in the detailed checklist).

---

## Part 2 — The electives list and its switches

**T20 — Master list complete; no Maritime.** 📍 Admin → Subject Management →
**Elective Offerings** card → **Manage ▼**. ✅ Clusters grouped by track,
covering the reference lists (Academic ≈48 electives; TechPro specializations
with NC II/NC III). **No Maritime Transport cluster anywhere.**

**T21 — Turning an elective OFF hides it at enrollment.** 📍 Same screen. ✅
Every elective is a ● ON / ○ OFF switch. Click one ON elective → it turns OFF
with a success message. Log in as Committee → new Grade 11 enrollment → the
switched-off elective no longer appears. Switch back ON → it returns.

**T22 — No cluster-editing screen (by design).** ✅ Browsing the admin sidebar
you will find no screen to rename/delete clusters — clusters are fixed titles.
Deliberate; goes in the report's limitations.

**T23 — The elective picker is easy to use.** 📍 Any of the three elective
pickers (enrollment form, Committee's Assign/Edit window, admin offerings). ✅
A **Search electives…** box filters chips only, with an "n of m" counter; a
G11 / G12 / All tabs row (offerings screen only); clusters collapse via a
chevron showing a picked/ON count; the enrollment form and the Committee
window keep everything you already ticked pinned at the top in a
**"Picked (n)"** bar with ✕ to remove, even if your search hides them.

---

## Part 3 — Subject Management (Administrator)

**T24 — SHS subject types.** 📍 Admin → Subject Management → **Add Subject**.
✅ The Type selector offers Core, Applied, Specialized, **Elective**, **Field
Experience**, **Work Immersion**.

**T25 — Core subjects are Grade 11 only.** 📍 Add Subject → Type Core →
Grade 12 → Save. ✅ Refused with: *"Core subjects are Grade 11 only under the
Strengthened SHS Curriculum — Grade 12 has no core subjects."* A Grade 8 core
subject saves normally (JHS not affected).

**T26 — No hours for Field Experience / Work Immersion.** 📍 Add Subject →
Field Experience, leave Hours empty → Save. ✅ Saves fine; hours display as
"Curriculum-mandated" and the weekly-hours total ignores it. Grades are plain
numbers like any subject (see T27).

---

## Part 4 — Teachers and rosters

**T27 — An elective's roster = only the students who picked it.** 📍 Admin
assigns a teacher to an elective; log in as that teacher. ✅ **My Students /**
**Grade Management** shows only the elective's pickers, who may come from
different sections.

**T28 — Core subjects keep whole-section rosters.** ✅ A teacher assigned to a
core subject still sees the entire section.

**T29 — Elective teachers can grade and upload like everyone.** ✅ Grades can
be typed in Grade Management; **Upload Grades** lists the elective in the
Subject dropdown marked "(Elective)"; the Section dropdown can stay empty — a
green hint explains "Elective — no section needed."; the Excel template
download lists exactly the elective's students; uploaded rows for non-pickers
are refused (e.g. "LRN is not on this elective's roster").

**T30 — Elective timetabling without a section.** 📍 Registrar → Schedule
Modifier → New Schedule → Class Type **⚡ Elective timeslot**. ✅ The Section
picker disappears; teachers/subjects list only electives/FE/WI with a
"— n pickers" badge; a clone/overlap of the same teacher gets a conflict
warning; a section subject cannot be placed this way (refused with a message).
The entry shows an ⚡ Elective chip in lists instead of a section name.
*Known limitation: a clash between two of one learner's own electives is not
warned here — the Committee resolves it when the learner picks (see report
limitations).*

---

## Part 5 — Grades

**T31 — Electives count in the General Average.** ✅ Encode an elective grade;
the learner's General Average includes it (G11: cores + electives; G12:
electives only).

**T32 — TechPro electives grade like any subject.** ✅ Same term grade inputs
(T1–T3); the 75 passing rule applies (visible in the promotion check, T36).

**T33 — Passing/monitoring thresholds.** ✅ Still editable by the
Administrator in School Settings (75 passing / 80 monitoring).

**T34 — Locks & corrections include electives.** ✅ Teacher locks the
elective's grades → a locked cell cannot be edited → a correction request can
be filed on it → Admin/Registrar → Grade Corrections shows it, approving it is
logged in the Activity Log.

---

## Part 6 — Sectioning, carry-over, promotion, at-risk

**T35 — Committee can edit each learner's electives; mixed sections allowed.**
📍 Committee → Section Assignment → preview → a learner's electives chip →
Assign/Edit. ✅ A window titled "Electives — <learner>" opens with the offered
electives by cluster and track; changes save instantly on the row. Sections
may mix learners with different electives; confirming still works.

**T36 — Carry-over Grade 11 → 12.** 📍 Committee → Section Assignment →
**Carry-Over (Prior Section)** tab → Grade 12 → Generate Preview. ✅ G11
learners are proposed to their **same prior section**, with their **prior
electives copied** — the Committee can still Edit each learner's list before
confirming.

**T37 — Only the Committee/Registrar confirms placements.** ✅ A Teacher finds
no placement tools anywhere (the system refuses teachers with a
permission-denied message).

**T38 — Failing an elective means Retained.** ✅ Give a learner a final
elective average below 75 → run the promotion preview → the learner is flagged
**Retained**. (DepEd's say on failed electives: still an open question,
report §H.)

**T39 — At-risk reads electives.** ✅ A learner failing an elective appears in
At-Risk Detection, computed from the current school year's term General
Averages Trend.

**T40 — At-risk lists follow the same rosters (elective teacher).** 📍 Log in
as an elective-only teacher (no advisory section). ✅ At-Risk lists exactly
their elective students; running a prediction for one of them works; asking
another teacher's students, or a whole-school run, is refused
(permission-denied).

---

## Part 7 — School Forms (PDF) and how they look now

**T41 — SF1** — Registrar → **SF1 — School Register**. ✅ SHS rows show
**Track: Academic · Electives: A, B** instead of a strand. Legacy learners'
old strand still prints as plain text.

**T42 — SF5** — **SF5 — Promotion Report**. ✅ Learner names carry the track
—"Dela Cruz, Juan (Academic)"; final ratings include electives; the promotion
check counts them.

**T43 — SF9** — **SF9 — Report Card** → choose an SHS learner. ✅ Header shows
**Track/Strand**: Academic; Grade 11 lists the five cores + the learner's
electives; Grade 12 lists electives, Field Experience, Work Immersion;
grades are plain numbers; the customizable extra rows still work.

**T44 — SF10** — **SF10 — Permanent Record**. ✅ Track and electives are
recorded per school year; the five core names appear exactly as DepEd writes
them; FE/WI grades print; legacy strands still print as plain text.

**T45 — Same look on every device.** 📍 Export the PDF from different
computers (e.g. a wide monitor and a laptop). ✅ Every device produces the
**same sheet**: proper margins, aligned columns, page breaks always in set
places, and the sheet centered. The **Print Preview window matches the PDF** —
what you see is what you print. Manual-entry fields (Mother Tongue, Religion,
attendance, observed values) remain hand-filled before printing — not
system-filled (rule: unchanged).

**T46 — No editing dots on the printed output.** 📍 Export any form's PDF. ✅
The small amber "edited" circles you see while editing on screen are
**never** in the Print Preview window or the exported PDF — the printed copy is a clean
official form. The dots stay as an on-screen helper only.

**T47 — Periods labeled "Term".** ✅ On SF9's report card and in Teacher →
Grade Management, grading periods read **Term / T1 / T2 / T3**. Old records
aren't changed — data still keys on period numbers internally, only the labels
you see changed.

**T48 — Mobile/tablet header.** ✅ On a phone, the top bar has no search icon;
tapping the ☰ hamburger shows the sidebar menu fully, **on top of the header**
(training, no overlap).

**T49 — SF9 for elective teachers.** 📍 Log in as an elective teacher whose
students sit in sections other than theirs; SF9 page → choose the learner's
grade → in the **My Elective** dropdown pick e.g. **⚡ Animation, NC II (G11)**.
✅ The student list switches to that elective's pickers; picking one renders
the report card with their own section name and subject list; a direct link to
that card also opens. Switching My Elective → By section… restores the normal
flow.

---

## Part 8 — Saving edits on the school forms (`MAJOR_CHANGES_IN_FORMS.txt`)

What's new in one sentence: **anything a staff member hand-corrects and
presses Save on SF1/SF5/SF9/SF10 is stored and can be brought back later —
by anyone, even after closing the page or regenerating the form**.

**T50 — Saving on all four forms.** 📍 Registrar → SF1 — type one Address →
Barangay cell, fix the **Region** header, change a T-date — press **Save** in
the header bar. Navigate away, come back. ✅ A success toast appears; an
"● n unsaved edits" badge counts them; a warning tab alert appears if you leave
without saving. Your values remain — for you and for other users — on reuse,
generation and **on the PDF/print**. Repeat one field each on SF9 (attendance
cells, parent signature, signers), SF5 (General Average number, a summary
count, Reviewed by), and SF10 (learner details and even checkboxes).
Pressing Save when nothing changed says "Nothing new to save".

> System values stay system values: final grades, General Average, promotion
> result, section assignment and adviser are still **computed by the system** —
> the Save feature only covers the hand-written parts. (Rule 2)

**T51 — Who may save where.** ✅ Registrar/Administrator: all forms. Teacher:
only SF9 **attendance** and **observed values**, and only for learners in
their own advisory section — anything else shows a permission message
(try it; the system stops you politely). Principal/Committee: view only,
also blocked from saving.

**T52 — Closed school years.** 📍 Choose a past school year and try to change
a form. ✅ Registrar/Admin can save; Teacher gets *"This school year is
closed — only the Registrar or Administrator can change its school forms."*

**T53 — Full record trail.** 📍 Admin → Activity Logs after edits. ✅ Each
changed field is logged: who, which learner, which form/field, old → new, at
what time. No log rows for unchanged saves (no noise).

**T54 — Edits are inside backups.** ✅ Saved edits are just data in the
system's regular database tables, so the normal **System Backup / restore**
covers them. No extra action needed.

**T55 — One correction, all forms (shared fields).** 📍 Fix SF1's school
header (School ID, Region, Division, District, School Name) → Save → open
SF5/SF9/SF10 — even for a past year. ✅ The fixed header shows everywhere (it
is stored once). Likewise editing Sex/LRN/Birth Date on SF10 shows on SF1
for that learner. A form-specific correction still wins on that form only, and
school-wide header edits can never be pinned to one learner.

**T56 — Fresh school years start pre-filled (carry-over).** ✅ When a new
school year opens: SF1 learner cells (address, parents, guardian, contact,
IP, religion, mother tongue…) pre-fill from the previous year (Remarks do
**not** carry — they belong to the new year's picks). SF10 learner identity
and eligibility blocks carry over; scholastic records stay per-year. Term
fields (SF9 attendance, observed values, signatures, SF5 tables) start
**blank**. A carried value is read-only until someone edits it and Saves it
into the new year.

**T57 — See what was changed; undo to system.** 📍 Any form header bar →
**Edited fields** menu (next to Save). ✅ Every entry shows learner + field +
saved value, and has **Reset** — puts it back onto the system value instantly
without re-opening the page. **Reset all** is there for bulk undo. On SF1/SF5
grid cells while editing on screen you'll see a small **amber dot** on cells
you have taken over (T46: never on printouts). Resetting is logged exactly
like saving, and follows the same permission rules as T51.

**T58 — "The system value changed" notice.** ✅ If the underlying record was
updated after your edit (e.g. the source data changed), the Edited-fields menu
flags the entry in red **system value changed** with two buttons: **Keep**
(keep your saved value; absorb the new system value as its base) or **Reset**.
Fields without a direct source show as plain "edited".

**T59 — Two people editing at once.** 📍 Open the same form as two staff; A
edits + Saves; B tries to Save from a form opened before A's save. ✅ B gets a
**conflict warning** listing the clashing fields and two choices:
**"Keep mine"** (overwrite) or **"Load theirs"** (refetch and drop your own
pending edits). Saving the exact same values never triggers it. A leave-time
check (no awkward clock issues; the system uses its own internal time — works
even if a computer's clock is off).

---

## Part 9 — What the developer side already verified (plain version)

Before the client tests, the team ran three packs of computer checks:

| Check pack | What it confirms | Result |
|---|---|---|
| Sectioning rules + regression tests (25 tests) | Placing learners, carry-over and mixed-elective sections behave correctly | all passed |
| API access-control tests (26 tests) | Users can't reach actions outside their role | all passed |
| Form-PDF end-to-end test | Generating a report card PDF end-to-end works; a full repeat run is still pending | verified |

Also verified live (documented in the technical checklist, §8): the catalog
has 84 electives × 2 grades in 14 clusters with no Maritime; the OFF/ON
switch flips availability and restores it; a Registrar is blocked from
admin-only actions; Grade-12 core subjects are refused while Grade-8 cores
and no-hours FE/WI subjects save; every saved-edits rule above was executed
once against the real system (including closed years and the final
Roles/Timeline cases) and test artifacts afterwards removed.

---

## Appendix A — Where each rule lives (nothing was lost)

`MAJOR_CHANGES.txt` (also tracked as `docs/CLIENT_ACCEPTANCE_CHECKLIST.md`),
translated test-by-test:

| MAJOR_CHANGES requirement | Detailed checklist | Plain test |
|---|---|---|
| Track replaces strand (both grades, all forms) | §1.1 | T11 |
| Track click → clusters/electives | §1.2 | T12 |
| Other-track electives option | §1.3 | T13 |
| Electives optional at enroll; filled before confirming | §1.4 | T14 |
| G11 five cores auto; G12 Work Immersion auto | §1.5 | T15 |
| ALS unchanged | §1.6 | T16 |
| PWD → SNED, any track | §1.7 | T17 |
| Activity log for track/elective changes | §1.8 | T18 |
| SPJ needs a client decision | §1.9 | T19 |
| Electives list seeded; Maritime removed | §2.1 | T20 |
| Per-year ON/OFF switch affects enrollment | §2.2 | T21 |
| No cluster CRUD screen | §2.3 | T22 |
| Elective picker UX | §2.4 | T23 |
| Subject types incl. Elective / FE / Work Immersion | §3.1 | T24 |
| Cores are G11-only | §3.2 | T25 |
| No stored hours for FE/WI | §3.3 | T26 |
| Elective roster for teacher views/grades/upload | §4.1–4.3 | T27–T29 |
| Elective schedule without a section | §4.4 | T30 |
| General Average counts electives | §5.1 | T31 |
| TechPro quarterly grades + 75 rule | §5.2 | T32 |
| Thresholds stay admin settings | §5.3 | T33 |
| Locks/corrections/logging for electives | §5.4 | T34 |
| Committee elective editor; mixed-election sections confirmed | §6.1 | T35 |
| Carry-over keeps section and copies electives | §6.2 | T36 |
| Committee confirms; teachers cannot place | §6.3 | T37 |
| Failing elective → Retained | §6.4 | T38 |
| At-risk reads electives (current-SY only) | §6.5 | T39 |
| At-risk roster-scoped | §6.6 | T40 |
| Forms show track/electives instead of strand | §7.1–7.4 | T41–T44 |
| Same look on every device (PDF/print, preview matches) | §7.5 | T45 |
| Clean official copies (no editing dots in preview/PDF) | §7 + Phase 3 | T46 |
| Term labels (T1–T3) | labels change | T47 |
| Mobile header: no search; menu above header | mobile fixes | T48 |
| Teacher SF9 for elective students | §7.6 | T49 |
| Save works on all 4 forms; values persist; grades stay system | §9.1 (rules 1–6) | T50 |
| Role gating (Registrar/Admin; teacher SF9 attendance/observed; others read-only) | §9.2 (rule 10) | T51 |
| Closed school years | §9.3 (rule 16) | T52 |
| Activity log for every edit | §9.4 (rule 14) | T53 |
| Backups include saved edits | §9.5 (rule 17) | T54 |
| Shared fields across forms | §9.6a (rule 8) | T55 |
| New-year carry-over; terms start blank | §9.6b (rule 15) | T56 |
| Edited markers, per-field Reset, reset-all | §9.7 (rule 11) | T57 |
| "System value changed" notices | §9.7 (rule 12) | T58 |
| Concurrent-edit conflict handling | §9.7 (rule 13) | T59 |

**Still awaiting DepEd / client decision (report §H):** SPJ program status;
failed elective → promotion effect; a clash between two of a learner's own
electives in the timetable (none flagged; resolved at pick time).

---

## Appendix B — When you're done

Tick every test number above on your walkthrough and send anything that
didn't match as "T<nn> failed — expected X, saw Y". The technical counterpart
of this file (`docs/CLIENT_ACCEPTANCE_CHECKLIST.md`) is the version we use to
reproduce details from your report, so keeping the numbers in sync helps.
