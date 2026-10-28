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

### 4.4 Schedule/room for cross-section electives ⚠️ review
Elective teachers have no fixed section; check Schedule/Room handling with
the team (flagged in report §H) — not a blocker for the curriculum itself.

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
