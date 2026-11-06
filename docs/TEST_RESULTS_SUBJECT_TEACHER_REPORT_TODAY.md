# Subject-Teacher Client Test — Results (live site, partial run)

## A. Run details

- **Date:** 2026-11-06
- **Site:** https://hi5-six.vercel.app (API: hi5-production.up.railway.app)
- **School year:** 2027-2028 (current)
- **Accounts available:** Administrator, Registrar, Enrollment Committee, TST-Teacher-C (logged in and used). TST-Teacher (A), TST-Teacher-B and TST-Teacher-D were created by the user but **never logged in as**.
- **No passwords are recorded in this file.** Accounts were created by the user; Claude does not create accounts, enter passwords or permanently delete data on a production site.
- **Setup done:** sections `9-9-Alpha` (adviser TST-Teacher, id 63) and `9-Beta` (adviser TST-Teacher-B, id 64); six learners TST A1–A3, B1–B3 enrolled (Grade 9, Regular) but left in **Pending Section**.
- **Main blocker:** no tool places a single learner. Section Assignment (Committee and Registrar) only offers whole-queue tools over 57 pending learners, mostly real. Applying would have moved real students, so it was not done. Both fixtures stay at 0 learners. Every case needing learners in a section is NOT RUN.
- **Second blocker:** only one teacher login (TST-Teacher-C) was used, so Teacher-A/B/D cases were not run.
- **Not run for safety:** TC-ST-10 (copy previous year), and TC-ST-29 deletions (permanent deletes are not allowed for Claude).

## B. Sign-off table

| Part | Cases | Result |
|---|---|---|
| 1 Setup & advisory | 01–02 | PARTIAL (01 steps 1–2 PASS, step 3 blocked; 02 NOT RUN) |
| 2 Assignments | 03–11 | PASS: 03, 07, 11. FAIL: 09. NOT VERIFIED: 06. NOT RUN: 04, 05, 08, 10 |
| 3 Encoding & corrections | 12–15 | NOT RUN |
| 4 Electives | 16–17 | NOT RUN |
| 5 Forms & saved edits | 18–21 | FAIL: 20 (step 1 only). NOT RUN: 18, 19, 21 |
| 6 Non-Reader | 22 | NOT RUN |
| 7 Mid-year changes | 23–25 | NOT RUN |
| 8 Promotion | 26–28 | PARTIAL: 27 (teacher side PASS, staff side NOT RUN). NOT RUN: 26, 28 |
| 9 Cleanup | 29 | PARTIAL (nothing deleted; leftovers listed in section E) |

## C. Every case

Screenshots are in `./test-evidence/` (names differ from the requested pattern; see list at the end).

| TC | User | Expected | Actual | Result | Screenshot |
|---|---|---|---|---|---|
| 01 | Administrator | Both sections saved; second advisory for same teacher refused; 9-Beta adviser = Teacher-B; 3 learners enrolled per section | Sections saved. Refusal: "TST-Teacher is already assigned to "9-9-Alpha" in Grade 9". 9-Beta saved with TST-Teacher-B. Six learners enrolled via Committee but left in Pending Section (no safe placement tool). | PARTIAL | TC-ST-01-adviser-refusal.jpg, TC-ST-01-learner-A1-enrolled.jpg |
| 02 | — | Adviser sees gradebook read-only | Needs Teacher-A login and learners | NOT RUN | — |
| 03 | Admin, Registrar | Rows save; chips per subject | Alpha: English→B, Math→C, Science→B + co-teacher D. Beta: English→A, Math→C. Registrar then added D to Beta Science and saved (no-teacher count 16→15). Log confirms. | PASS (Admin and Registrar parts) | — |
| 04 | — | Per-subject edit rights | Needs Teacher-B login and learners | NOT RUN | — |
| 05 | — | Co-teacher rights | Needs Teacher-D login and learners | NOT RUN | — |
| 06 | Admin/Registrar | Cross-program or elective subject refused with message | Editor header says "Co-teachers allowed · electives excluded" and lists no elective. No forged request tried, so server refusal not seen. | NOT VERIFIED | — |
| 07 | Registrar | Save succeeds with load warning | Saved with: "Saved, with 1 schedule note: TST-Teacher-C's total teaching load is now 34 hours/week — above the 30 hour maximum. Saved, but flagged for review." Extra assignments removed afterwards (9-Beta back to 15 no-teacher). | PASS | TC-ST-07-load-warning-34h.jpg |
| 08 | — | Overlap warning | Master Schedule overlap not set up | NOT RUN | — |
| 09 | Committee (edit form) | Teacher already advising another section is refused; replacing adviser refused | TST-Teacher-B → 9-9-Alpha refused: "TST-Teacher-B is already assigned to "9-Beta" in Grade 9". But TST-Teacher-C replaced TST-Teacher as adviser of 9-9-Alpha with **no refusal**. Restored afterwards. | FAIL (against script wording; may be a script issue) | TC-ST-09-adviser-of-other-section-refused.jpg, TC-ST-09-adviser-replaced-no-refusal.jpg |
| 10 | Admin, Registrar | Admin and Registrar both can copy | Not run (no scratch section). Observation only: Admin's Section Creation page has a "Copy Teachers" button; Registrar's Section Management page and the Committee's page do not. Claude opened the dialog by mis-click once and cancelled. | NOT RUN | — |
| 11 | Administrator | Every add/remove logged with names | Search "TST-Teacher" returned 29 entries; removals show teacher, subject and section ("Unassigned teacher "TST-Teacher-C" from "ITCS" in "9-Beta""), attributed to Registrar. Adds present. | PASS | — |
| 12–19 | — | Encoding, locks, corrections, electives, form saves | Need learners in sections and teacher logins | NOT RUN | — |
| 20 | TST-Teacher-C | Teacher with no advisory sees no sections on SF1/SF5 | SF1 Grade 7: "No sections". SF1 Grade 9: lists both 9-9-Alpha and 9-Beta for a subject-only teacher. SF5 not opened; Teacher-A/B steps not run. | FAIL (step 1 only) | TC-ST-20-teacherC-SF1-lists-sections.jpg |
| 21–26 | — | | Need Committee save test, Teacher-A/B, learners | NOT RUN | — |
| 27 | TST-Teacher-C | Teacher blocked from individual promotion and rollback | Server: individual 403, rollback 403 (see D). Teacher sidebar has no Promotion entry. Staff-side promotion not run (no learner safe to promote). | PARTIAL (teacher side PASS) | — |
| 28 | — | Adviser status dashboard | Needs Teacher-A | NOT RUN | — |
| 29 | Administrator | Delete TST learners, sections, accounts; logs remain | Nothing deleted. Delete Section dialog ("This cannot be undone") was opened and cancelled; Claude may not permanently delete data. | PARTIAL | — |

## D. Extra checks (as TST-Teacher-C, a subject teacher in both fixtures, not a teacher with no assignments)

| Check | Result |
|---|---|
| X1 grades template, unassigned teacher | NOT RUN (no unassigned teacher; route not confirmed) |
| X2 `GET /sections/:id` for unassigned teacher | NOT RUN. As subject teacher: `GET /sections/63` → **200**, `/64` → **200** |
| X3 subject teacher `GET /sections/:id` | **200** (done with Teacher-C, not Teacher-B) |
| X4 promotion routes | `POST /promotions/individual` **403**; `POST /promotions/0/rollback` **403** (fake id); `GET /promotions/roster` **403** (all "requiredRoles admin, registrar"); `GET /promotions/preview` for section 63 **403** "You can only preview your advisory section."; `POST /promotions/bulk-promote` **400** "No advisory section with enrolled students was found" |
| X5 document download by non-owner | NOT RUN |
| X6 `POST /grades/unlock` school year only | NOT RUN |
| X7 `GET /forms/edits` for section 63 | Without `form` and `school_year_id`: 400 "form (SF1/SF5/SF9/SF10) and school_year_id are required." With them: SF1, SF5, SF9, SF10 all **200**. No 500. (Teacher-C, not Teacher-B.) |
| X8 "advisorship" text | Partial: one string in the main bundle, "N students under your advisorship". Other lazy chunks not scanned; screen not identified. |

## E. Failures and surprises (most serious first)

1. **Section placement blocker (TC-ST-01 step 3).** Committee and Registrar Section Assignment only run on the whole queue (57 pending, mostly real). A preview put 3 learners into each fixture but also assigned 49 others. Not applied. User: Committee and Registrar.
2. **TC-ST-20 FAIL:** subject-only TST-Teacher-C sees 9-9-Alpha and 9-Beta in SF1's Section list. Rule says SF1/SF5 adviser-only. Steps: log in as Teacher-C → SF1 → Grade 9. Screenshot TC-ST-20-teacherC-SF1-lists-sections.jpg.
3. **TC-ST-09:** adviser replacement allowed with no refusal (only a teacher advising another section is blocked). Done as Committee. Screenshot TC-ST-09-adviser-replaced-no-refusal.jpg.
4. **Committee account has an "Administration" menu** (User Management, Section Creation, Subject Management, Activity Logs, Database Backup, Role Access Control, School Settings) and can change a section's adviser. Committee's edit dialog has no Subject Teachers block.
5. **Script inconsistency:** TC-ST-03 gives Teacher-C Math in both sections, but TC-ST-20 calls Teacher-C "no assignments". TC-ST-10 says Registrar can copy; rules table says Admin button only.
6. **Section name shows "9-9-Alpha":** the system prefixes the grade, so typing "9-Alpha" doubled it. Edit form has no name field.
7. **Teacher picker marks a teacher "Taken" but still lets Admin select them;** only the save is refused.
8. **Silent failures after session expiry:** Committee session expired mid-enrollment; Confirm Enrollment did nothing and showed no message (three clicks). No duplicate learner was created (verified in the queue).
9. **Pre-existing test learners** (`TST-8-01`, `TST-8-02`, `TST-9-03`, `TST-8-03`) already sit in the pending queue. Not created by this run; not touched.
10. **Mis-click:** a layout shift opened Copy Subject Teachers once; cancelled, nothing copied.

## F. Manuscript answers (only what was observed)

1. **Non-Reader tag:** not tested. The enrollment form says "Non-Reader is not selectable here — it is assigned manually from a recorded reading assessment". Teacher menu has "Reading Assessments".
2. **Registrar can assign teachers:** **Yes.** Saved a Science assignment on 9-Beta; logged.
3. **After an approved correction, what unlocks:** not tested.
4. **Subject-only teacher on SF1/SF5/SF9/SF10:** SF1 opens and lists both Grade 9 fixtures for Teacher-C. SF5, SF9, SF10 screens not opened. Server `GET /forms/edits` returns 200 for all four forms.
5. **SF9 attendance versus observed values:** not tested.
6. **Copy previous year:** Admin has the button; Registrar and Committee pages show none. The copy itself was not run.
7. **Teacher blocked from individual promotion and rollback:** **Server: yes** (403 for individual, rollback and roster; preview limited to own advisory). **Screen:** teacher sidebar has no Promotion entry; the Individual tab and Rollback buttons were not viewed directly.

## G. Verdict

- **PASS: 3** (TC-ST-03, 07, 11). **FAIL: 2** (TC-ST-09, 20). **PARTIAL: 3** (01, 27, 29). **NOT VERIFIED: 1** (06). **NOT RUN: 20** (02, 04, 05, 08, 10, 12–19, 21–26, 28 — note 18–19 and 21–26 listed together).
- **Is the subject teacher revision ready? Not shown to be.** About 70 percent of the script could not run. The server rules checked (promotion roles, advisory-only preview, subject teachers able to read sections and form edits) held. The SF1 adviser-only rule did not hold for a subject-only teacher, and the adviser rule has one gap against the script.
- **To finish:** a safe single-learner placement route (or an approved placement), then logins as TST-Teacher, TST-Teacher-B and TST-Teacher-D, then user-performed cleanup.

## Leftovers for the user to delete (TC-ST-29)

- Sections: `9-9-Alpha` (id 63) and `9-Beta` (id 64).
- Learners: TST A1 (2027-09-6054), A2 (2027-09-9783), A3 (2027-09-6010), B1 (2027-09-5768), B2 (2027-09-6850), B3 (2027-09-4776).
- Accounts: TST-Teacher, TST-Teacher-B, TST-Teacher-C, TST-Teacher-D.
- Activity Log entries stay by design. No real record was changed by this run.

## Evidence files (`./test-evidence/`)

TC-ST-01-adviser-refusal.jpg, TC-ST-01-taken-badge.jpg, TC-ST-01-learner-A1-enrolled.jpg, TC-ST-07-load-warning-34h.jpg, TC-ST-09-adviser-of-other-section-refused.jpg, TC-ST-09-adviser-replaced-no-refusal.jpg (shows the form before saving; the result was confirmed in the table), TC-ST-20-teacherC-SF1-open.jpg, TC-ST-20-teacherC-SF1-lists-sections.jpg
