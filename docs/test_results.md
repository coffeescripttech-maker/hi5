# Results (T11-T59)

Run started 2026-11-01. Logged in as Administrator (user signed in manually; passwords never typed by the agent).
Progress: setup done (backup taken). No test item completed yet.

## T20 — Master List Complete; No Maritime — PARTIAL
Role: Administrator
Steps: Subject Management > Elective Offerings > Manage; read all clusters; searched page text for "maritime".
Observed: Grouped by track: Academic (5 clusters: Arts/Social Sciences/Humanities; Business and Entrepreneurship; STEM; Social Sciences (Theory and Practice); Sports, Health, and Wellness) and TechPro (9 clusters incl. Hospitality and Tourism; ICT Support and Computer Programming Technologies). No "Maritime" text anywhere on the page. Counter "167 of 168 electives offered" (G11+G12 combined, so each elective is counted once per grade). Academic electives work out to roughly 38 unique (75-76 entries across both grades), vs PDF "approximately 48".
Why PARTIAL: grouping and no-Maritime pass; I cannot confirm the "approximately 48" figure against the reference list (do not have it) and the on-screen count looks lower (~38).
Also noted: one elective was already OFF before testing (Arts 1 ... Visual Art ... G11 or G12 row) - pre-existing state, to be restored/noted.
Evidence: screenshots/T20_elective_offerings.jpg

## T24 — SHS Subject Types — PASS
Role: Administrator. Steps: Subject Management > Add Subject. Observed: Subject Type buttons are exactly Core, Applied, Specialized, Elective, Field Experience, Work Immersion. Evidence: screenshots/T24_add_subject_types.jpg

## T25 — Core Subjects Are Grade 11 Only — PASS
Role: Administrator. Steps: Add Subject, name ZZTEST-core-G12, Grade 12, Core, Add Subject. Then ZZTEST-core-G8, Grade 8, Core.
Observed: Grade 12 core refused with red toast "Core subjects are Grade 11 only under the Strengthened SHS Curriculum — Grade 12 has no core subjects." (wording matches PDF; no ZZTEST-core-G12 row created). Grade 8 core saved: toast 'Subject "ZZTEST-core-G8" created.' and row appears under Grade 8 as Core.
Evidence: screenshots/T25_g12_core_refused.jpg, screenshots/T25_g8_core_saved.jpg
Note (contradiction (b) candidate): the Grade 12 list ALREADY contains legacy Core subjects (LS1-LS6, Introduction to the Philosophy of the Human Person, Media and Information Literacy, Physical Science, Reading and Writing Skills, Statistics and Probability). The refusal blocks new ones only; existing legacy G12 core rows remain.

## T26 — No Hours for Field Experience / Work Immersion — PASS (grade display not checked here)
Role: Administrator. Steps: Add Subject, ZZTEST-FE-nohours, Grade 12, Field Experience, cleared Hours field (hint "Leave empty for curriculum-mandated subjects"), Add Subject.
Observed: saved; row shows "Curriculum-mandated"; Grade 12 weekly total unchanged (62 hrs/week before and after). 
My own error, disclosed: my first attempt (ZZTEST-FE) failed to clear the Hours field, so it saved with the default 4 hrs/wk and raised the G12 total from 58 to 62. That is a test-process slip, not a system defect. ZZTEST-FE needs removing (see cleanup.md).
"Grades are displayed as plain numbers" is part of T27/T43 and is checked there.
Also noted: pre-existing "new Work Immersion" (G11) shows "1 hr/day · 4 days/wk (4 hrs/wk)", i.e. a Work Immersion row WITH hours - contradiction (c) candidate (legacy/test data, not created by me).

## T33 — Passing and Monitoring Thresholds — PASS
Role: Administrator. Steps: School Settings > Academic Thresholds. Read values: passing 75, monitoring 80. Changed passing to 76, Save Academic Thresholds, reloaded page: 76 persisted. Changed back to 75, saved, reloaded: 75 / 80.
Observed: both fields editable and persist. No success toast was visible in my screenshot (it may have faded before capture) - verified by reload instead.
Evidence: screenshots/T33_thresholds_edit.jpg. Thresholds are restored to 75 / 80.

---
PROGRESS CHECKPOINT: done so far = backup, T20, T24, T25, T26, T33. Next = role-based items; need user to sign in as Committee / Registrar / Teachers. Remaining items not yet run: T11-T19, T21-T23, T27-T32, T34-T59 (except as above).

## T11 — Track Replaces the Strand Picker — FAIL
Role: Enrollment Committee (committee01). Steps: Enrollment > New Student; filled personal details with dummy data; Next; chose Grade 11 + Mainstream/Regular.
Observed: no "Strand" text anywhere on the step (PASS). A "SENIOR HIGH SCHOOL TRACK *" grid with exactly two cards, "Academic" and "Technical-Professional (TechPro)" (PASS). BUT with neither card selected I pressed "Next Step" and the wizard advanced to the Requirements step (step 3). Expected: "Pressing Next without choosing a track is blocked." Seen: not blocked, no error shown. Going Back showed both cards still unselected, so no default was applied. The Next button is also not disabled (disabled=false).
Repeat with Grade 12 and Open High School: NOT YET RUN.
Evidence: screenshots/T11_track_cards.jpg, screenshots/T11_FAIL_next_not_blocked.jpg
What I think is wrong: the Track "required" check is not enforced when pressing Next (could be that it is only enforced at final confirm - not tested separately).

## T12 — Clicking a Track Reveals Its Electives — PASS
Role: Committee. Steps: same flow; clicked Academic.
Observed: with no track selected, no elective cluster list is shown (only the track cards). After choosing Academic (clusters take ~2-3 s to load): ARTS, SOCIAL SCIENCES, AND HUMANITIES; BUSINESS AND ENTREPRENEURSHIP; SCIENCE, TECHNOLOGY, ENGINEERING, AND MATHEMATICS (STEM); SOCIAL SCIENCES (THEORY AND PRACTICE); SPORTS, HEALTH, AND WELLNESS, each with chips. 
Not checked in this run: clicking TechPro alone (only seen via cross-track view in T13, where ICT SUPPORT AND COMPUTER PROGRAMMING TECHNOLOGIES and HOSPITALITY AND TOURISM are present).
Note: immediately after clicking Academic the panel briefly said "No elective offerings configured for this track and school year yet" before the list loaded.
Note: "Arts 1 (...)" chip is absent from the Arts cluster; that matches the pre-existing OFF switch noticed in Admin.

## T13 — Electives from the Other Track — PASS (save of both checked later)
Role: Committee. Steps: selected Academic; ticked "Show electives from the other track (DepEd lets learners choose across tracks)".
Observed: nine TechPro clusters appear, each headed "· Technical-Professional (TechPro)" (PDF says "· TechPro" - label is the long form, treating as the same). Picked Biology 1 (Academic) and Animation, NC II (TechPro): a "PICKED (2)" bar appeared at the top of the picker; each cluster shows "1 picked". Completed Requirements > Student ID (2027-11-1531) > Preview > Confirm Enrollment: "Enrollment Successful!" for ZZTEST-Alpha ZZTEST-Learner, Grade 11, Pending Section.
Observation: the Preview screen does not display Track or electives or subjects at all (shows only personal, contact, requirements, section status).
Whether BOTH electives were stored is not yet verified; will check in Section Assignment (T14/T35).
Evidence: screenshots/T13_cross_track_checkbox.jpg, T13_techpro_picked.jpg, T13_enrolled_ZZTEST_Alpha.jpg

## T13 UPDATE — PASS (stored value verified)
Section Assignment preview row for ZZTEST-Alpha showed "Electives: Animation, NC II, Biology 1" (one Academic + one TechPro), so both tracks' electives were saved at enrollment. Evidence: screenshots/T14_preview_rows.jpg

## T14 — Electives May Be Empty at Signup; Committee Fills Them Before Confirming — FAIL
Role: Committee. Steps: (1) enrolled ZZTEST-Bravo, Grade 11, Academic track, no electives: "Enrollment Successful!" (PASS). (2) Section Assignment > Random (Gender-Balanced) tab, filter Grade 11, Generate Preview. (3) Preview row for Bravo reads "No electives chosen yet" with an "Assign" button (PASS, exact wording). (4) Selected ONLY Bravo and pressed Confirm.
Observed: "Assignments complete. 1/1 assigned successfully." Bravo was placed in 11-Matatag with no electives. Expected: refused with a message naming the learner. => FAIL.
I then used the page's "Undo last assignment" (returned Bravo to pending), re-generated the preview, assigned Chemistry 1 to Bravo via Assign and confirmed Bravo alone: success (second half PASS).
ANOMALY: when I selected BOTH Alpha and Bravo and pressed Confirm, the page showed "Complete the elective selections before confirming section placement for: ZZTEST-Alpha ZZTEST-Learner" - a refusal naming Alpha, who displayed three electives (Animation NC II, Biology 1, Physics 1) in the row. Nothing was assigned. Confirming Alpha alone moments later succeeded ("ZZTEST-Alpha ZZTEST-Learner: Assigned to 11-Matatag"). I cannot explain this; it looks like the refusal check used stale/other data, or only fires in some conditions. This message is the closest thing to the PDF's refusal but it named the wrong learner and was inconsistent.
Other observation: the Random (Gender-Balanced) tab (described "JHS Regular") is where SHS Regular Grade 11 learners appear; the "Eligible / proposed for special programs" figure shows "NaN" in the preview summary.
Evidence: screenshots/T14_Bravo_enrolled_no_electives.jpg, T14_preview_rows.jpg, T14_FAIL_confirmed_without_electives.jpg, T14_refusal_names_Alpha.jpg, T14_Bravo_confirm_ok.jpg

## T35 — Committee Can Edit Each Learner's Electives; Mixed Sections Allowed — PASS
Role: Committee. Steps: Preview > Alpha row > "Edit"; searched Physics; picked Physics 1; Save Electives.
Observed: window titled "Electives — ZZTEST-Alpha ZZTEST-Learner" opened, showing offered electives by cluster with track label (· Academic / · Technical-Professional (TechPro)); save updated the row instantly to "Electives: Animation, NC II, Biology 1, Physics 1". Alpha (3 electives) and Bravo (Chemistry 1) both ended in the same section 11-Matatag, and confirmation succeeded ("1/1 assigned successfully") for each. 
Caveat: the activity-log entry for these edits is checked under T18/T53 (not yet).
Evidence: screenshots/T35_electives_window.jpg, T35_row_updated.jpg

## T23 (Committee parts only) — PARTIAL (Admin screen and counter not fully checked)
Observed in the Committee window and enrollment form: "Search electives…" box filters the chips only; PICKED (n) bar stays pinned at top with an x remove control on each chip even when search hides the chip (Physics search still showed Biology 1 and Animation in the bar); clusters have a chevron and a "1 picked" count. I did NOT see an "n of m" counter in the enrollment form or Committee window (Admin Offerings screen does show "167 of 168 electives offered" and G11/G12/All tabs).
Evidence: screenshots/T23_search_picked_pinned.jpg

## T36 — Carry-Over from Grade 11 to Grade 12 — PARTIAL
Role: Committee. Steps: Section Assignment > tab "Carry-Over (Prior Section)" (the tab is NOT labelled "Carry Over (G11 to G12)" - a "Carry-over target:" dropdown inside it defaults to G10 -> G11; I chose "G11 -> G12"); Generate Preview.
Observed: preview proposes 2 pre-existing learners (TEST_E SHS TVL Learner, TEST_D SHS Regular Learner) to "12-Masipag (proposed)". Both rows read "No electives chosen yet" with an Assign button, so I could NOT see "prior electives copied" - these learners had no electives on record to copy. Pressing Confirm for both: refused, message "Complete the elective selections before confirming section placement for: TEST_E SHS TVL Learner" (names only the first learner). Opened Assign on a row: window "Electives - TEST_E SHS TVL Learner", "Grade 12 · tick the electives ...", search + clusters, Save Electives / Cancel (editable: PASS).
I did NOT finish the confirm (no electives assigned, carry-over not committed) so no pre-existing learner was moved.
My ZZTEST Grade 11 learners could not be used for carry-over: they were just enrolled this year and are not in a closed prior year.
Status reasons: "same prior section" and "electives copied" not verifiable with available data -> PARTIAL.
Also: "Eligible / proposed for special programs" summary shows "NaN".
Evidence: screenshots/T36_carryover_refusal.jpg, T36_carryover_electives_window.jpg

---
CHECKPOINT 2 (Committee login): done T11-T14, T23(partial), T35, T36. Not yet run as Committee: T11 repeat for Grade 12 / Open High School, T15-T19, T21 (needs Admin OFF toggle then Committee check), T37.

## T11 UPDATE (repeat steps) — FAIL
Grade 12 + Regular: track cards shown, no "Strand" text; pressing Next with no track selected advanced to Requirements (not blocked). 
Grade 12 + Open High School: same - cards shown, Next advanced with no track. 
Conclusion: required-track blocking is not enforced at the Next button for Grade 11 or 12, Regular or Open HS. (Not tested: whether it is enforced at final Confirm - I did not submit a track-less enrollment.)

## T15 — Core Subjects Are Automatic — PARTIAL (not visible in this form)
Role: Committee. Observed: the Enrollment Form never lists any subjects: neither the five Grade 11 core subjects nor Work Immersion for Grade 12 appear on the Grade & Program step or on the Preview & Confirm step (preview shows only personal/contact/requirements/section status). So I could not verify "already appear as assigned and cannot be unselected" on the form. The Admin subject list does contain the five core names for Grade 11 exactly: "Effective Communication / Mabisang Komunikasyon", "Pag-aaral ng Kasaysayan at Lipunang Pilipino", "Life and Career Skills", "General Mathematics", "General Science", and Grade 12 has "Work Immersion". Whether they are attached to a learner's record is to be checked on SF9 (T43). 
Not run: no Grade 12 learner enrolled.

## T16 — ALS Unchanged — FAIL
Role: Committee. Steps: Enrollment wizard, Grade 11 (also Grade 12), Program "ALS SHS".
Observed: no elective clusters appear (PASS), BUT the "SENIOR HIGH SCHOOL TRACK *" card grid (Academic / Technical-Professional (TechPro)) IS shown for ALS SHS at both Grade 11 and Grade 12. Expected: no track cards. There is also no "strand" field or text anywhere, so I could not see "its existing strand flow" either.
Evidence: screenshots/T16_FAIL_als_g11.jpg, T16_FAIL_als_g12_track_cards.jpg

## T17 — PWD Learners — PASS
Role: Committee. Steps: enrolled ZZTEST-Charlie, ticked classification PWD, Grade 11 Regular, chose TechPro track, completed enrollment.
Observed: preview showed "Classification: PWD" and PWD-specific requirement tags; enrollment succeeded; in the Pending Section Queue the row carries tags "PWD" and "sned". Track selection accepted.
Evidence: screenshots/T17_pwd_enrolled.jpg, T17_pwd_sned_tag.jpg

## T18 — Every Track/Elective Change Is Logged — PASS (viewed as Committee, not Administrator)
Steps: as Committee, changed ZZTEST-Alpha's electives in Section Assignment (added Physics 1). Opened Activity Logs (/admin/logs - the Committee account could open this page by URL; I did not log in as Administrator for this check) and searched ZZTEST-Alpha.
Observed entries (category student_electives): 'Updated electives for ZZTEST-Alpha ZZTEST-Learner: [Animation, NC II, Biology 1] → [Animation, NC II, Biology 1, Physics 1]' by "Enrollment Committee" at 11/1/2026 4:26:32 PM; 'Enrollment track set: ZZTEST-Alpha ZZTEST-Learner → Academic with 2 electives' at 4:24:02 PM. Who, learner, old and new values all present. Track-set for Charlie: 'Enrollment track set: ZZTEST-Charlie ZZTEST-Learner → Technical-Professional (TechPro)'.
Note: a change of TRACK after enrollment was not tested (only electives were edited), so the "old track -> new track" form is unverified.
Observation for contradictions/permissions: Committee login can open the full System Activity Logs and also has Admin Dashboard / User Management / Subject Management / Section Creation / Academic Year Mgmt entries in its sidebar.
Evidence: screenshots/T18_activity_log_electives.jpg

---
CHECKPOINT 3: Done = backup, T11-T18 (T15 partial), T20, T23(partial), T24-T26, T33, T35, T36. Remaining need other logins: Admin (T21 OFF toggle, T22, T53, T54, T52), Committee (T21 verify, T37), Teachers (T27-T29, T34, T37, T40, T49, T51), Registrar (T30, T41-T46, T50, T55-T59), Principal (T51). T19, T38, T31/T32/T39/T42 need grades.

## T22 — No Cluster-Editing Screen (By Design) — LIMITATION
Role: Administrator. Observed: Admin sidebar items are Dashboard, User Management, Subject Management, Section Creation, Academic Year Mgmt., Room Management, Promotion & Graduation, SF1, SF5, SF9, SF10, School Settings, Database Backup, Activity Logs, Role Access Control, My Profile, System Guide. No screen to rename or delete elective clusters; cluster titles are fixed. Known limitation confirmed.

## T21 — Turning an Elective OFF Hides It at Enrollment — IN PROGRESS (Admin half done)
Admin: Subject Management > Elective Offerings > Manage > G11: chip "ON Biology 2" clicked; toast "Elective switched OFF." and chip then reads "OFF Biology 2" (PASS for switch + success message; each elective shows an ON/OFF chip). 
STILL TO DO: log in as Committee, start Grade 11 enrollment, confirm Biology 2 is absent; then switch back ON (Biology 2 is currently OFF - must be restored).
Evidence: screenshots/T21_biology2_off_toast.jpg

## Accounts found (User Management, 16 users)
Teachers include biab (Bianca - role is Teacher), teacher01, teacher02, teacher_maria, teacherrobin, taecherste, arlan12, Mica03, teacher.xed. School Head: principal01. Registrars: registrar01, jerecho01, teahcer12. Committee: committee01, comite2. No ZZTEST accounts created (and none needed to be created for Principal: principal01 exists, but I do not have its password).

## T21 UPDATE (Committee half) — hidden at enrollment confirmed; restore step pending
Role: Committee. Steps: New Student wizard, Grade 11, Regular, Academic track; read the STEM cluster chips and searched "Bio".
Observed: chips present Biology 1, Chemistry 1, Physics 1; "Biology 2" absent (search "Bio" returns only Biology 1). So the OFF elective is hidden at enrollment (PASS for step 3).
Remaining: switch Biology 2 back ON (Admin) and confirm it returns to the enrollment list (needs a second visit - will try with the Admin login on /committee/enrollment).
Also (T23): the elective search in the enrollment form shows no "n of m" counter (confirms earlier note).
I did NOT submit this enrollment (ZZTEST-Delta details typed but abandoned) - no record created.
Evidence: screenshots/T21_biology2_hidden_at_enrollment.jpg

## T21 — Turning an Elective OFF Hides It at Enrollment — PASS (final)
Steps: Admin: Biology 2 (G11) OFF -> toast "Elective switched OFF." Committee: new G11 enrollment, Academic: Biology 2 absent, Biology 1/Chemistry 1/Physics 1 present. Admin: Biology 2 ON -> toast "Elective switched ON."; then Admin opened /committee/enrollment (allowed for Admin), G11 Academic: "Biology 2" present again.
Also switched the pre-existing OFF "Arts 1 (Creative Industries 1 ...)" (G11) ON per the end-of-run rule "electives back ON"; it now appears in the enrollment list. All electives are ON now.
Evidence: screenshots/T21_biology2_off_toast.jpg, T21_biology2_hidden_at_enrollment.jpg

## T41 — SF1 School Register — PARTIAL
Role: Administrator (the Registrar login was not used; Admin has the same SF1 page: Save, "Edited fields", PDF, Print). Steps: SF1, School Year 2027-2028, Grade 11, Section 11-Matatag; read the Remarks cells; opened PDF (Print Preview).
Observed: SHS rows show track and electives in the Remarks column, e.g. "Track: Academic <sep> Electives: Animation, NC II, Biology 1, Physics 1" for ZZTEST-Alpha, "Track: Academic <sep> Electives: Chemistry 1" for ZZTEST-Bravo, "Track: Technical-Professional (TechPro) <sep> Electives: Arts 1..., Arts 2..." for a legacy learner (Miranda, Xedxed Benusa). Content matches "Track: Academic · Electives: A, B" EXCEPT the separator: the cell value contains a corrupted character (read back as "�" from the input; drawn as a "◆" in the Print Preview). Expected a middle dot "·". 
Also: one learner (Torres, Ivan) shows "Electives: Animation, NC II" with no Track at all; legacy strand values were not visible on this section so "legacy strands print as plain text" is not verified.
Print Preview: took ~15-17 s to render ("Preparing preview..." first). In the preview the long Remarks text for the SHS rows runs past the right edge of the table/sheet (text outside the Remarks column) - evidence screenshots/T41_sf1_preview_zoom_overflow.png. Relevant to T45 (layout).
Manuscript TC-23: "PDF preview loads; SHS rows show Track and electives" -> preview loads (slow), rows show track+electives but with the separator glitch and overflow.
Evidence: screenshots/T41_sf1_admin_header.jpg, T41_sf1_print_preview.jpg, T41_sf1_preview_zoom_overflow.png

## T50 — Saving on All Four Forms — FAIL (SF1 as Administrator; SF5/SF9/SF10 not yet run)
Role: Administrator. Steps (SF1): School Year 2027-2028, Grade 11, 11-Matatag. Typed "ZZTEST-Brgy" into the Barangay cell of ZZTEST-Alpha; appended " ZZTEST" to the Region header; pressed Save in the header bar; pressed Save a second time (retry).
Observed:
- Header badge: "? 1 unsaved edit" after the first change, "? 2 unsaved edits" after the second; "Edited fields" counter went 1 -> 2 (badge works; the "?" is probably a corrupted warning glyph - same encoding problem as T41).
- Save: red toast "Teachers can only save SF9 attendance entries." Network: PUT https://hi5-production.up.railway.app/api/forms/edits -> HTTP 403, reproduced twice. No success toast; edits NOT stored.
- Leaving the page with unsaved edits triggered the browser "Leave site?" dialog (warning on leave = PASS).
Expected: Administrator may save on all four forms. Seen: Admin treated as Teacher and refused (403). Whether this is a role-resolution bug on the server or the Admin permission being switched off in Role Access Control is unknown (the Role Access Control page was not inspected - my guessed URL /admin/roles returned 404). I did not change any role permission.
Not run / not verifiable here: change a T-date; SF5, SF9, SF10 saves; persistence; "Nothing new to save"; PDF containing saved value.
Because nothing was saved, the unsaved edits (Barangay and Region) were discarded when I left the page; no data changed.
Evidence: screenshots/T50_sf1_unsaved_badge.jpg, T50_FAIL_admin_save_refused.jpg

## T51 — Who May Save and Where — FAIL (Administrator row)
Administrator save on SF1 refused with 403 "Teachers can only save SF9 attendance entries." The Registrar login has not been tested; teacher/principal/committee rows not yet tested. See T50.

Contradiction (a): "Registrar and Administrator save on all four School Forms" - Administrator cannot save on SF1.

## ===== REGISTRAR LOGIN (registrar01) =====

## T50 — Saving on All Four Forms — PARTIAL (SF1 as Registrar works; SF5/SF9/SF10 saves not run; T-date not run)
(Replaces the earlier Administrator FAIL for the Registrar part; the Administrator FAIL stands in T51.)
Role: Registrar. Steps (SF1): 2027-2028, Grade 11, 11-Matatag; typed "ZZTEST-Brgy" in Barangay of ZZTEST-Alpha; appended " ZZTEST" to Region header; Save.
Observed: badge "? 1 unsaved edit" then "? 2 unsaved edits"; Save -> PUT /api/forms/edits HTTP 200, button greys, "Edited fields" shows 2 (success toast faded before I could read it - I saw only its trailing "...2 SF1 ... " fragment, so the exact success wording is NOT confirmed). Pressing Save again with no change: toast "Nothing new to save � SF1 is up to date." (text starts with the required wording; the dash after it is a corrupted character). Left the page (Registrar dashboard) and came back: Barangay = "ZZTEST-Brgy", Region = "Region V ZZTEST" still there (persisted). Leave-page warning seen earlier (Admin session).
Not run: change a T-date; saving on SF5, SF9, SF10; value in the exported PDF; viewing as another user.
Evidence: screenshots/T50_registrar_sf1_saved.jpg, T50_nothing_new_to_save.jpg

## T55 — One Correction, All Forms (Shared Fields) — PARTIAL
Role: Registrar. After saving Region = "Region V ZZTEST" on SF1: SF5 header Region = "Region V ZZTEST" (PASS); SF10 header Region = "Region V ZZTEST" but three other Region inputs on SF10 still read "Region V" (probably per-record blocks; unverified); SF9: no learner selected so header not visible (not verified). Past school year and the SF10 Sex/LRN/Birth Date -> SF1 steps NOT run.

## T57 — See What Was Changed; Undo to System Value — PARTIAL (menu checked; Reset not yet pressed)
Edited fields menu (button next to Save): lists each saved edit with value, timestamp and a Reset button, plus "Reset all 2 listed fields". Entries read: 'form-level — header · region  "Region V ZZTEST" · saved  Nov 1, 2026, 4:45 PM' and 'student 183 — s · addr_barangay  "ZZTEST-Brgy" · saved'. Issue: the learner is shown as "student 183" (an internal id) and the field as a raw key "addr_barangay", not the learner's name (PDF: "Every entry shows the learner, field, and saved value"). Reset/Reset all, amber dots, logging of resets: still to test.
Evidence: screenshots/T57_edited_fields_menu.jpg

## T57 UPDATE — Reset tested — PARTIAL
Role: Registrar. Pressed Reset on the Region entry: Region field immediately showed "Region V" again without reopening the page, counter dropped 2 -> 1. Then "Reset all 1 listed field": Barangay cell became empty and the "Edited fields" badge disappeared. All my SF1 test edits are therefore undone (cleanup.md updated). Not verified: amber dots on SF1 grid cells (the screen showed no amber dots in the cells I looked at after typing - the cells had no visible amber marker in my screenshots, only the page header counter), the Reset entries in the Activity Log (needs Admin view), Reset permissions for other roles. Menu entry shows "student 183" instead of the learner's name (see earlier).
Evidence: screenshots/T57_reset_region_instant.jpg, T57_reset_all_cleared.jpg

## T43 — SF9 — Report Card — FAIL
Role: Registrar. Steps: SF9, 2027-2028, Grade 11, 11-Matatag, learner 999900000011 ZZTEST-Alpha (Academic; electives Animation NC II, Biology 1, Physics 1 per SF1/Section Assignment).
Observed: header "Track/ Strand: Academic" (PASS). Learning Areas lists the five core subjects with exact names: "Effective Communication / Mabisang Komunikasyon", "General Mathematics", "General Science", "Life and Career Skills", "Pag-aaral ng Kasaysayan at Lipunang Pilipino" (PASS). The learner's ELECTIVES are NOT listed at all (rows are only those five plus an extra row named "new" and "General Average") - FAIL against "Grade 11 lists the five core subjects and the learner's electives". Term columns are headed "Term" with 1, 2, 3 (T47 label check - see T47). Grades display as "—" (no grades yet), so "plain numbers" not verifiable. Grade 12 SF9 (electives, Field Experience, Work Immersion) not checked. Customizable extra rows not exercised (the row "new" may be one).
Evidence: screenshots/T43_sf9_alpha_header.jpg, T43_FAIL_sf9_no_electives.jpg

## T44 — SF10 — Permanent Record — FAIL
Role: Registrar. Steps: SF10, 2027-2028, Grade 11, 11-Matatag, learner ZZTEST-Alpha (Academic; electives Animation NC II / Biology 1 / Physics 1).
Observed: scholastic record block "SCHOLASTIC RECORD � SY 2027-2028" (dash character corrupted) with header fields Classified as Grade 11, Section 11-Matatag, School Year 2027-2028, "Track/ Strand:" EMPTY, adviser "Rob..." . Learning Areas list the five core names exactly as DepEd writes them (PASS: "Effective Communication / Mabisang Komunikasyon", "General Mathematics", "General Science", "Life and Career Skills", "Pag-aaral ng Kasaysayan at Lipunang Pilipino"), plus a row "new". The learner's electives do NOT appear anywhere on the form and Track is blank => "Track and electives are recorded for each school year" FAIL. Columns are headed "QUARTERS 1 2 3" (not Term - relevant to T47/contradiction (d)). Page intro text says "open their SF10-JHS (Formerly Form 137)" even for an SHS learner. Field Experience / Work Immersion grades not checkable (no Grade 12 learner with data). Legacy strands not checked.
Evidence: screenshots/T44_FAIL_sf10_no_track_electives.jpg

## T47 — Periods Are Labeled "Term" — PARTIAL (SF9 only)
SF9 Learning Areas table: column group "Term" with sub-columns 1, 2, 3, and parent signature lines "1st Term / 2nd Term / 3rd Term" (PASS - but the headings read "Term 1/2/3", not "T1/T2/T3"). SF10 headings read "QUARTERS 1 2 3" - labels not "Term". Teacher Grade Management not yet checked (needs teacher login).

## T42 — SF5 — Promotion Report — PARTIAL
Role: Registrar. Steps: SF5, 2027-2028, Grade 11, 11-Matatag.
Observed: learner names carry the track: "ZZTEST-Learner, ZZTEST-Alpha (Academic)", "ZZTEST-Learner, ZZTEST-Bravo (Academic)", "Miranda, Xedxed Benusa (Technical-Professional (TechPro))" (PASS; the TechPro label is the long form). Legacy learner "Torres, Ivan" shows no track. Torres has General Average 87 and "PROMOTED". The ZZTEST learners have no grades so "final ratings include electives" and "promotion check counts electives" could not be verified here (see T31/T38 - need elective grades from a teacher).
The SF5 header Region now reads "Region V" (my SF1 edit was reset).
Evidence: screenshots/T42_sf5_names_track.jpg

## T46 — No Editing Dots on Printed Output — PASS (Print Preview); exported PDF file not inspected
Role: Registrar. Steps: SF1, 2027-2028, Grade 7, 7-Hero (a section that already has saved edits). On screen, small amber dots show beside the edited cells: Mother Tongue "yes", IP "none", House "purok 6", Municipality "naga", Province "cam sur" (also confirms the on-screen amber-dot helper from T57). Opened PDF > Print Preview for the same sheet.
Observed: the same values appear in the preview with NO amber dots; sheet is clean. Print Preview took ~25-35 s to render ("Preparing preview..." for a long time) on this sheet.
Not verified: the exported PDF file itself (export produced no file - see T45).
Evidence: screenshots/T46_sf1_screen_amber_dots.jpg, T46_sf1_preview_no_dots.png

## T45 — Same Appearance on Every Device — BLOCKED (file export) / MANUAL (second device)
Role: Registrar. Steps: SF5 (Grade 11, 11-Matatag): resized the Chrome window to 1920x1080, 1366x768, 768x1024 via the resize tool (each reported "Successfully resized"), opened PDF > Print Preview, pressed "Export PDF" twice (waited 8-10 s each).
Observed: (1) NO PDF file appeared in C:\Users\Arlan\Downloads after either attempt (the folder contains only an older, unrelated .pptx), so I could not open or compare PDFs. Cause unknown (the browser or automation may block downloads; I did not change any Chrome setting). (2) The resize tool does not actually change the page: after every "resize", window.innerWidth stayed 1526 and outerWidth 1532 (devicePixelRatio 1.25), and screenshots were identical, so the layout at wide/laptop/tablet/phone widths could not be tested.
Print Preview (single size) shows a centered sheet with logos, header fields, aligned table and summary tables; SF1 preview (T41) had Remarks text running past the sheet edge for SHS rows.
=> Compare of exported PDFs across widths: BLOCKED. A real second device: MANUAL.
Evidence: screenshots/T45_sf5_print_preview.jpg

## T48 — Mobile/Tablet Header — BLOCKED
Could not shrink the browser to phone/tablet width (see T45: viewport stays 1526 px wide). No test of the search icon or hamburger overlay was possible. Needs a real phone/tablet or a manual DevTools device mode.

## T30 — Elective Timetabling Without a Section — LIMITATION (labelled per instruction; behaviour mostly as expected)
Role: Registrar. Steps: Schedule Modifier > New Schedule > Class Type "Elective timeslot".
Observed:
- Section picker removed; replaced by the note "No section needed — the roster is all learners who picked the elective, from any section." (PASS)
- Subject list contains only electives (each prefixed with a lightning icon), Field Experience (TEST-FE-ACCEPT, ZZTEST-FE, ZZTEST-FE-nohours) and Work Immersion; no section subjects (non-elective entries: none). Badge "— n pickers" shown only on electives with learners: "Animation, NC II — 2 pickers", "Biology 1 — 1 picker", etc. (PASS; singular "1 picker").
- Created Bianca / Animation, NC II / Mon 07:00-08:00: toast "Schedule entry created."; list row shows an "Elective" chip in the Section column instead of a section name (PASS).
- Same teacher, same time, Biology 1: panel "Conflicts detected - Teacher is busy: Animation, NC II · Elective" and "Schedule conflict detected — review the warnings below before saving." (PASS). 
- "A section subject cannot be scheduled through this class type; refused with a message": could NOT be exercised - the UI offers no section subject in this mode, so there is nothing to attempt (prevented by the list, not by a refusal message).
- Known limitation: created Robin / Biology 1 / Mon 07:00-08:00 (ZZTEST-Alpha picked both Animation NC II and Biology 1). Saved with NO warning (toast "Schedule entry created.") => the system does not warn when two electives of the same learner clash. Limitation confirmed.
- I did not test "cloned" schedules separately (the overlap test above covers the conflict warning).
Evidence: screenshots/T30_elective_timeslot_no_section.jpg, T30_elective_chip.jpg, T30_conflict_warning.jpg, T30_limitation_no_learner_clash_warning.jpg

## ===== TEACHER LOGIN (biab / "Bianca", role badge: Teacher; 3 sections Gr 7-9; also assigned the elective Animation, NC II (G11)) =====

## T51 — Who May Save and Where — PARTIAL (Administrator row FAIL above; Teacher rows below)
Role: Teacher (Bianca). 
- SF1: header bar shows only PDF and Print - there is NO Save button for a Teacher (save blocked in the UI). Expected-by-PDF permission message not seen because no Save control exists.
- SF9 own advisory section (7-Pogi): typed "5" in an attendance cell (School Days, Jun) and "4" in the next cell; badge "unsaved edit" -> Save -> spinner -> badge cleared, "Edited fields" shows 1. Saved OK (TC-21 first half: PASS). The network tool shows only an OPTIONS 204 to /api/forms/edits (it does not list the PUT or bodies).
- SF9 other section: the Section dropdown for this Teacher lists ONLY her own section (7-Pogi), so another section cannot be chosen in the UI. The API-replay check (save for a learner outside her section) could not be done: the network tool shows no request bodies, and I will not guess a payload => that part is MANUAL. No "permission message" seen (TC-21 second half: not demonstrated).
- Principal / Committee view-only: not tested (no Principal login; Committee saw no form save test).
Evidence: screenshots/T51_teacher_sf9_own_section_saving.jpg, T51_teacher_sf9_saved.jpg

## T49 — SF9 for Elective Teachers — FAIL (several steps)
Role: Teacher (Bianca, assigned Animation, NC II). Steps: SF9 > "My Elective" dropdown (options "By section…" and "⚡ Animation, NC II (G11)") > choose Animation, NC II (G11).
Observed: (1) Student list switched to the elective's pickers: "2 students ... Elective: Animation, NC II": Ivan Torres and ZZTEST-Alpha ZZTEST-Learner (PASS). (2) Selecting ZZTEST-Alpha rendered the report card with the learner's own section "Section: 11-Matatag", Grade 11, and the subject list (five core + row "new"). BUT the header reads "Curriculum: JHS (K to 12)" and "Track/ Strand: N/A (JHS)" for this SHS learner (the Registrar's view of the same learner shows "SHS (K to 12)" and "Academic"); the "Grade Level" dropdown stayed on Grade 7 and the info line reads "Grade 7 · Elective: Animation, NC II". The learner's electives are again not listed as subjects. (3) Direct link: the page URL does not change when a learner is chosen (always /teacher/forms/sf9), so there is no direct link to test => cannot verify. (4) Switching My Elective back to "By section…": student list became "0 students ... No students enrolled" for 7-Pogi (it had 9 before) and stayed so after 8 s - normal flow was NOT restored without re-selecting; FAIL against "restores the normal section-based flow".
Evidence: screenshots/T49_elective_report_card.jpg

## T47 — Periods Are Labeled "Term" — PARTIAL -> teacher part PASS, wording inconsistent
Role: Teacher (Bianca). Grade Management (/teacher/grades): the grade table columns are "SUBJECT  T1  T2  T3  FINAL  REMARKS" - only three period columns, labelled T1 to T3 (TC07: PASS). SF9 (Registrar view) uses "Term 1/2/3". BUT the Grade Management help text on the same page still says "Encode and manage student grades per subject and quarter" and "enter grades (0-100) for each subject and quarter" and SF10 headings say "QUARTERS". So "only the visible labels change" is not fully applied (contradiction (d) minor).
Also seen: learner shown "Locked"; non-assigned subjects are "Read-only · not assigned to you"; "14 students under your advisorship"; STE subjects flagged "Not in curriculum · STE".
Evidence: screenshots/T47_teacher_grade_management.jpg

## T28 — Core Subjects Keep Whole-Section Rosters — NOT RUN (no teacher login with a core-subject assignment + whole-section roster checked)
Bianca's Grade Management lists the whole advisory section (14 students) but her subject assignments were not examined. Needs a teacher assigned a core subject.

## ===== ADMIN LOGIN (second visit) =====

## T53 — Full Record Trail — PASS (minor notes)
Role: Administrator. Steps: Activity Logs, searched "Registrar" and "Bianca" (50 per page).
Observed (category sf_form_edits): 
- 4:45:09 PM Registrar: 'Saved SF1 edit for ZZTEST-Alpha ZZTEST-Learner: s:addr_barangay "" -> "ZZTEST-Brgy"' and 'Saved SHARED edit (typed on SF1) for form-level: header:region "" -> "Region V ZZTEST"' - each changed field has its own entry with who, learner, form, field, old and new value, and time. 
- 4:47:13/4:47:23 PM Registrar: 'Reset SHARED edit ... header:region "Region V ZZTEST" -> system value' and 'Reset SF1 edit for ZZTEST-Alpha ZZTEST-Learner: s:addr_barangay "ZZTEST-Brgy" -> system value' (T57: resets ARE logged).
- Bianca (Teacher): 'Saved SF9 edit for QaMiss5251473 Mid Docs: attendance:No. of School Days:Jun "" -> "5"' (4:58:52), Jul "" -> "4" (4:59:09); two 'Reset SF9 edit ...' entries at 5:00:51.
- Unchanged save ("Nothing new to save") produced NO log entry (PASS).
- Schedule entries are also logged (Created / Deleted schedule ...).
Notes: field names are raw keys ("s:addr_barangay", "attendance:No. of School Days:Jun"); the header Region "old" value logs as "" rather than the displayed system value "Region V"; the failed Administrator save (403) left no entry.
Evidence: screenshots/T53_activity_log_registrar.jpg

## T54 — Edits Are Included in Backups — PARTIAL (behaviour verified; storage MANUAL)
Role: Administrator. Steps: Database Backup: history had #136 (baseline, 158 records). Pressed Backup Now -> "Backup completed successfully", #137 (Manual, 1.9 MB, 161 records). Pressed Restore on #137 -> dialog "Restore Database? ... will overwrite ALL current data including student records, grades, enrollment data, and system settings. This action cannot be undone." -> Restore Database. No success toast was visible after 8 s, but Activity Logs then showed "Database restored from backup #137" (Administrator, 5:03:41 PM) and all earlier log entries remain (total 2776).
Edits after restore: the 5 pre-existing saved SF1 edits on 7-Hero (amber dots: yes / none / purok 6 / naga / cam sur) are still there ("Edited fields 5"). My own SF1/SF9 test edits had already been reset before I took #137, so they could not be re-checked.
MANUAL: "stored in the regular database tables" cannot be seen from the UI. "No additional backup action required": the single Backup/Restore covered pre-existing saved edits.
Evidence: screenshots/T54_restore_dialog.jpg

## T52 — Closed School Years — BLOCKED
Past school years exist (2026-2027, 2025-2026 and the selector also lists 2028-2029 to 2034-2035). I did not test saving on a past year: (a) as Administrator every form save is refused with 403 (see T50), so "Admin can save on a closed year" cannot be tested; (b) the teacher message "This school year is closed — only the Registrar or Administrator can change its school forms." needs a Teacher on a past year, which I did not run before leaving the Teacher login; (c) I did not check whether those years are actually marked closed. Not tested.
