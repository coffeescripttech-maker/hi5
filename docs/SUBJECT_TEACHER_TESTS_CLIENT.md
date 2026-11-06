# Subject-Teacher Revision — Client Test Script

**Version:** 2026-11-06 · **Scope:** the revision "a section has one adviser and many
subject teachers; grades belong to one teacher + one subject + one section."
**Where to run:** the live site (Vercel frontend + Railway backend), on any
current school year that is opened for enrollment.
**Test data rule:** create your own "TST-" accounts/learners where instructed and
delete them at the end (Part 9). Real school data is never modified by this
script, except where a step says to restore a value.

Accounts the script needs (ask the Administrator to create or reuse):

| Shortcut in this script | Role |
|---|---|
| **Admin** | Administrator |
| **Registrar** | Registrar |
| **Teacher-A** | Teacher — will be an **adviser** in the fixture sections |
| **Teacher-B** | Teacher — a **subject teacher** in the same sections but adviser of *its own* different section |
| **Teacher-C** | Teacher — **no assignments at all** after Part 1 |
| Committee | Enrollment Committee (for the elective part) |

School-year shortcut: **SY** = the current school year shown at the top bar.

---

## Decided rules used in this script (client team, 2026-11)

| Rule | Decision |
|---|---|
| Who assigns teachers | **Administrator + Registrar** both can |
| Co-teachers | **Allowed** (several teachers on one subject; each can encode) |
| Teaching-load maximum | **30 hours/week** — a warning, never a block; saves continue |
| Copy previous year | **Administrator's button**, opt-in |
| A teacher who is already adviser elsewhere | **Hard error** (one advisory section max) |
| Non-owned subject in your own advisory section | **Read-only**, not hidden |
| Non-Reader tag | **Class adviser only** (admin also may, as system steward) |
| Replacement teacher edits old grades | **Yes** — edit rights follow the *current* assignment; grade history is kept |
| Correction approval opens | **Only the named subject + quarter** of that learner |

---

## Part 1 — School sets up sections first (Administrator)

**TC-ST-01 · Create the fixture sections**
1. Admin → **Section Creation**.
2. Create two Grade 9 sections: **9-Alpha** (adviser **Teacher-A**) and **9-Beta**
   (adviser **Teacher-A**).
   *Expected:* both sections are saved. When you try to name **Teacher-A**
   adviser of the second section, the system **refuses with an error** (one
   advisory section per teacher — decided rule). Change the plan:
   **9-Beta** adviser = **Teacher-B**, and give **Teacher-A** only **9-Alpha**.
3. Enroll at least **3 learners** in each via Enrollment (any names, e.g.
   "TST-A1", "TST-A2", "TST-A3"; "TST-B1", "TST-B2", "TST-B3") and let the
   Committee confirm their section placement. To place them safely (Committee
   or Registrar → **Section Assignment → Single Placement**): pick one learner
   from the pending queue, pick the target section, press **Place** — repeat
   for each of the six learners. Only the chosen learner moves each time, the
   rest of the queue (including real students) stays pending.

**TC-ST-02 · Adviser alone does NOT get grading rights**
1. Before assigning any subject teachers, Teacher-A logs in → **My Students →
   Grades** (or Gradebook) for 9-Alpha and opens its gradebook.
   *Expected:* the teacher can **look** at the section (adviser read scope) but
   every grade cell is **read-only**; the page states these fields belong to the
   subject teachers. No Save is possible.

## Part 2 — Give every subject in each section a teacher

**TC-ST-03 · Assign subject teachers (Section-Teachers editor)**
1. Admin (and repeat one save as **Registrar** to prove both roles may do this —
   decided: both can) → Section Creation → **9-Alpha** → the **Subject
   Teachers** part.
2. Assign: English → **Teacher-B**; Math → **Teacher-C**; Science → **Teacher-B
   + one co-teacher** (decided: co-teachers allowed).
3. Repeat for **9-Beta**: English → **Teacher-A**, Math → **Teacher-C**.
   *Expected:* rows save; the primary teacher chip + optional co-teacher chips
   appear per subject row.
4. Also create a spare account **Teacher-E** in this part (Users module) that
   receives NO assignment — TC-ST-20 needs a teacher with zero assignments.

**TC-ST-04 · Every assigned teacher gets encoding rights — and only for its pair**
1. Log in as **Teacher-B** → Grades → 9-Alpha → **English**.
   *Expected:* quarters Q1–Q3 cells are editable; you can type grades and Save
   (subject-level lock button also appears for English only).
2. Same login, same section, click **Math** (assigned to Teacher-C).
   *Expected:* read-only — "This subject is not yours" (or every cell locked).
3. Same login → **9-Beta** grades (you are 9-Beta's adviser but hold no grant
   there). *Expected:* section visible for reading; all cells read-only because
   the adviser title alone does not grant grading rights.
4. Log in as **Teacher-C** → 9-Alpha Math: editable; 9-Alpha English: read-only.

**TC-ST-05 · Co-teacher rights**
1. Open 9-Alpha Science as the **co-teacher** assigned in TC-ST-03.
   *Expected:* Science cells editable; English/Math still read-only for this
   teacher.

**TC-ST-06 · Section Creation enforces the program match**
1. In the Subject-Teachers editor of a regular section, try to attach a subject
   from another program/strand (or an elective, if one appears in the list).
   *Expected:* refused with an explanatory message (electives are never assigned
   per section — they are granted per subject in Part 4).

**TC-ST-07 · Teaching load warning (30 h/week) — warning, not a block**
1. Assign the same teacher to enough subjects in enough sections so its total
   weekly hours exceed 30 (check subjects' `hours/week` in Subject Management).
   *Expected:* the save **still succeeds**, and a warning is shown/returned:
   "… teaching load is now X hours/week — above the 30 hour maximum. Saved, but
   flagged for review." Remove the extra assignments afterwards.

**TC-ST-08 · Master-Schedule overlap warning (already existing behavior)**
1. If the Master Schedule has rows, assign a teacher to two sections whose
   schedule slots overlap.
   *Expected:* warning again — allowed, but flagged. Administrator can still
   save (decided: warn only).

Name tip: the system automatically prefixes the grade (e.g. typing **Alpha**
in Grade 9 makes **9-Alpha**). Typing the prefix yourself doubles it — the
system now strips it, but plain names are safest.

**TC-ST-09 · One advisory section rule**
1. Try to set Teacher-C as adviser of **9-Alpha** while Teacher-A is adviser.
   As **Committee** this is refused outright (adviser work belongs to
   Administrator/Registrar). As **Admin**, in the Edit Section view, changing
   the adviser now **opens a confirmation naming both teachers** — cancelling
   leaves the adviser unchanged; continuing (only if deliberate) completes the
   replacement and logs it in Activity Logs. Restore the original adviser by
   the same path.
2. Try to name a teacher who already advises any section (any grade level, not
   just Grade 9) as the adviser of a new section.
   *Expected:* refused: "… is already the adviser of …" both in the picker
   (marked **Taken**) and on save.

**TC-ST-10 · Copy previous year (Administrator/Registrar, opt-in)**
1. Next school year in a throwaway test (or on another draft section), use
   **Copy Teachers** as Admin — the button is also available to the Registrar
   (decided: both roles assign teachers).
   *Expected:* the previous year's subject-teacher rows are preloaded. Delete
   the draft section afterwards if used on a scratch section.

**TC-ST-11 · Activity Log audit (R10)**
1. Admin → **Activity Logs**, filter Section-Teachers.
   *Expected:* every add/remove this Part made is listed with teacher names,
   subject, section — including the co-teacher and every removal in TC-ST-07.

---

## Part 3 — Teachers encode grades (the new order)

**TC-ST-12 · Encode + lock by the granted teacher**
1. Teacher-B → 9-Alpha English: fill some Q1 grades and press the lock/submit
   for English. *Expected:* English sheet locks for Q1; Math (Teacher-C) is
   unaffected.
2. Teacher-C opens 9-Alpha Math: still editable while English Q1 is locked.
   *Expected:* Math cells editable — locking one subject never freezes another
   teacher's empty sheet.

**TC-ST-13 · Grades only for learners actually offered the subject**
1. Assign one 9-Alpha learner a program/track that does not include a specific
   subject, then have the granted teacher try to encode that subject for that
   learner (via Upload Grades import or the API-backed gradebook edit).
   *Expected:* refused — "this subject is not offered to the learner."

**TC-ST-14 · Grade-correction workflow (decided: only the named subject + quarter)**
1. After Teacher-B's English sheet locks (TC-ST-12), Teacher-B requests a
   correction: Grade Management → correction form. **Subject = English,
   Term = 1** (both are now required).
   *Expected:* the form will not submit until both are chosen; the request is
   filed to the Registrar.
2. Registrar → **Grade Corrections** → approve the request.
   *Expected:* approval unlocks **only English Q1 for that learner**. Math and
   Science cells, other quarters, and other learners' grades stay locked.
3. Teacher-B edits the English Q1 grade; the sheet locks again afterwards (per
   the lock workflow).

**TC-ST-15 · Registrar's manual unlock is exact-scope only**
1. Registrar/Admin → Grades → attempt unlock leaving out subject or quarter.
   *Expected:* refused: "Unlocking requires the exact scope: student_id,
   subject_id and quarter (1-3) are all required." A whole-section or
   whole-year unlock is no longer possible.

## Part 4 — Electives stay subject-level

**TC-ST-16 · Elective grant + roster**
1. Admin/Registrar → Subject Management → pick an elective subject → assign
   **Teacher-B** to it (the elective grant). Note the elective must be offered.
2. Have two learners (one from 9-Alpha, one from 9-Beta) choose that elective.
   *Expected:* Teacher-B's **My Elective** list shows this elective; the roster
   shows the two pickers from their own sections.
3. Teacher-B encodes grades for the two learners via the My Elective page.
   *Expected:* saving works even though neither learner is in Teacher-B's
   advisory section; a third learner who did NOT pick the elective is refused.

**TC-ST-17 · SF9 for the elective teacher**
1. Teacher-B → SF9 page → choose a picker's grade level → **My Elective:
   [that elective]**.
   *Expected:* list switches to the elective's pickers; a card renders with the
   learner's **own section name** and its subject list (including the elective).

---

## Part 5 — Saved school-form edits, by role (the Save buttons)

**TC-ST-18 · Registrar/Admin can save everything**
1. Registrar → SF1 of any fixture section → change the Barangay of one learner,
   fix the Region header, change a T-date → **Save**.
   *Expected:* success toast; an "n unsaved edits" badge counts; leaving with
   unsaved edits warns. Navigate away and come back — the saved values
   re-appear.
2. Repeat one save on SF5, SF9, SF10 as Admin. *Expected:* all save.

**TC-ST-19 · Teacher saves only SF9 attendance, own advisory only**
1. Teacher-A (adviser of 9-Alpha) → SF9 → change an attendance cell → Save.
   *Expected:* saved.
2. Same teacher, SF9 → change a grade or a principal cell → Save.
   *Expected:* refused ("attendance only" message).
3. Teacher-A opens Teacher-B's section (9-Beta) SF9 for a 9-Beta learner → Save
   an attendance cell. *Expected:* refused — not your advisory learner.
4. Teacher-A tries to save anything on **SF1**. *Expected:* refused ("Teachers
   can only save SF9 attendance entries").

**TC-ST-20 · Who may open which form (decided: SF1/SF5 adviser-only)**
1. **Teacher-E** — created in TC-ST-03 with **no assignments** — opens SF1/SF5.
   *Expected:* no sections/learners appear (adviser-only lists). Subject-only
   Teacher-C and Teacher-B must ALSO see no Grade 9 fixture sections here
   (fixed after the 2026-11-06 client run where Teacher-C saw both sections).
   Teacher-A opens SF1/SF5. *Expected:* lists its own advisory (9-Alpha) only.
2. **Teacher-B (subject teacher, no advisory learners in 9-Alpha)** opens SF9 and
   SF10 for a 9-Alpha learner it teaches. *Expected:* the forms open
   **read-only** (subject teachers open SF9/SF10 for their granted learners, but
   only the adviser saves — the Save button shows the TC-ST-19 restriction).
3. Teacher-B also sees the **saved edits** (e.g. the Registrar's SF1 barangay
   edit re-applies) on forms it can open — read access, not save access.

**TC-ST-21 · Committee/Principal cannot save form edits**
1. Login as Committee (and Principal if available) → try to save any SF edit.
   *Expected:* refused ("You are not allowed to save school form edits").

---

## Part 6 — Non-Reader tag: class adviser only (decided)

**TC-ST-22 · Adviser tags; subject teacher cannot**
1. Teacher-A (adviser) → Reading Assessments → record **Non-Reader** for a
   9-Alpha learner. *Expected:* saved; the learner shows the Non-Reader tag.
2. Teacher-B — teaching that same learner English — tries to record a reading
   assessment. *Expected:* refused ("Only the learner's class adviser can
   record a reading assessment…").
3. Teacher-B CAN view the reading history; verify the tag stays adviser-created.
4. Administrator removes a wrong assessment as needed (system steward);
   Registrar is refused.

---

## Part 7 — Mid-year changes (adviser/section moves)

**TC-ST-23 · Replace a subject teacher (R26)**
1. Admin → 9-Alpha English rows — remove **Teacher-B**, add **Teacher-D**.
2. Teacher-D → 9-Alpha English. *Expected:* can edit grades immediately; the
   grades Teacher-B encoded stay in place and readable (decided: history kept).
3. Teacher-B → 9-Alpha English. *Expected:* read-only/errors on save right
   after removal.
4. Activity Logs show the replacement with names (removed + added).

**TC-ST-24 · Learner transfer keeps grants working (R27)**
1. Move one 9-Alpha learner to another Grade 9 section (Enrollment transfer) or
   re-place it via Section Assignment.
2. Teacher-A's advisory list updates after the move; the receiving section's
   teachers gain access; the old section's English teacher loses write access
   to that learner the moment it moves. *Expected:* all of the above, and the
   learner's existing grades move with the enrollment (audit in Activity Logs).

**TC-ST-25 · Regenerate forms after moves (R28)**
1. Open SF1 of the receiving section; regenerate/print.
   *Expected:* the moved learner's row shows with correct saved edits; audit
   trail shows the transfer recorded.

---

## Part 8 — Promotion stays an adviser duty

**TC-ST-26 · Advisory-only promotion with Q1–Q3 completeness**
1. Teacher-B (subject teacher gradebook for 9-Alpha) — My Section → Missing
   Grades panel. *Expected:* rows indicate learners whose granted subjects lack
   Q1–Q3.
2. Teacher-A (adviser) → Bulk Promotion for 9-Alpha while a subject still has a
   missing Q grade. *Expected:* 409-style refusal: promotion is advisory-only
   and needs every subject Q1–Q3 complete.
3. Fill/complete, then complete promotion. *Expected:* succeeds only for the
   adviser.

**TC-ST-27 · Individual promotion & rollback are staff-only (client review)**
1. Log in as any Teacher → the promotion page: the **Individual** tab and the
   **Rollback** buttons are not shown.
2. Registrar/Admin → Individual tab → promote a learner.
   *Expected:* works for staff. Teacher attempting the same action (e.g. via a
   stale link) is refused: "Individual promotion is handled by the
   Administrator or Registrar."

**TC-ST-28 · Section-status is adviser/subject-aware**
1. Teacher-who-is-adviser opens the section status dashboard.
   *Expected:* marked as adviser view, missing-grade figures computed per
   learner's offered subjects (program/track/elective aware).

---

## Part 9 — Cleanup

**TC-ST-29 · Remove everything created for this script**
1. Delete the TST- learners, the fixture sections 9-Alpha/9-Beta, and the
   Teacher-D scratch account if one was created (Admin → Users).
2. Confirm Activity Log entries remain (the audit trail is kept by design).

---

## Pass/Fail sign-off

| Part | Cases | Result | Tester initials / date |
|---|---|---|---|
| 1 Setup & advisory | TC-ST-01…02 | ☐ Pass ☐ Fail | |
| 2 Assignments | TC-ST-03…11 | ☐ Pass ☐ Fail | |
| 3 Encoding & corrections | TC-ST-12…15 | ☐ Pass ☐ Fail | |
| 4 Electives | TC-ST-16…17 | ☐ Pass ☐ Fail | |
| 5 Forms & saved edits | TC-ST-18…21 | ☐ Pass ☐ Fail | |
| 6 Non-Reader | TC-ST-22 | ☐ Pass ☐ Fail | |
| 7 Mid-year changes | TC-ST-23…25 | ☐ Pass ☐ Fail | |
| 8 Promotion | TC-ST-26…28 | ☐ Pass ☐ Fail | |
| 9 Cleanup | TC-ST-29 | ☐ Pass ☐ Fail | |

When reporting a failure, give the **TC number**, the **user you were logged in
as**, and a screenshot of the screen at the moment it failed.
