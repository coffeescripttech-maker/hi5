# Pre-Deployment Test Guide — Enrollment Committee, Transfers & Reading Assessments

> **Release:** 2026-10-01 · **Scope:** Migrations 036/037, Enrollment Committee role, Registrar↔Committee transfer workflow, committee document verification, teacher reading assessments, Q1–Q3 grade enforcement, SNED + subject grouping.
>
> **Why this document exists:** this release adds a new role, two new tables, and new cross-role workflows. Server-side behavior is already covered by automated tests (`npm test` → 13/13, `npm run test:api` → 19/19). **The UI has never been clicked through.** This guide is the manual pass. Do not deploy until every check below reads PASS.

---

## 0. Status at time of writing

| Layer | Command / method | Result |
|---|---|---|
| DB schema (live Railway `hi5_db`) | `npm run migrate` | Migrations 036/037 applied 2026-09-30 / 2026-10-01 |
| Enum + column verification | read-only `information_schema` query | committee role, `sned`, verification columns, TLE grouping all present |
| Unit tests | `cd server && npm test` | **13/13 pass** |
| API authorization tests | `cd server && npm run test:api` | **19/19 pass** |
| Frontend (browser) | **manual, this document** | ⬜ **NOT YET DONE** |
| Deploy | — | ⬜ blocked on the manual pass |

**Known accepted state:**
- 377 legacy `quarter = 4` grade rows exist in live data. Decision on record: **leave them, block new ones.** They are inert — SF9/SF10, LIS, at-risk and promotion all read Q1–Q3 only. New Q4 writes are now refused by the API.
- 6 students carry a legacy `non_reader` tag with **no** supporting reading assessment. Pre-existing data, not created by this release. See step **3.6**.

---

## 1. Environment & test accounts

### 1.1 Start the stack

```bash
# terminal 1 — API
cd server
npm run dev            # expect: "API running at http://localhost:3001"

# terminal 2 — frontend
npm run dev            # expect: http://localhost:5173
```

### 1.2 Verify the API is up

```bash
curl http://localhost:3001/api/health
# expect: {"status":"ok", ...}
```

### 1.3 Create a committee test account

There is **no** seeded committee user. Create one (idempotent — safe to re-run):

```bash
cd server
npx tsx scripts/createCommitteeUser.ts
```

Optional args: `createCommitteeUser.ts <username> <password> <full name> <email>`

### 1.4 Accounts to test with

| Role | Username | Password | Source |
|---|---|---|---|
| Admin | `admin` | `password123` | seeded |
| Teacher | `teacher01` | `password123` | seeded |
| Teacher | `teacher02` | `password123` | seeded |
| Registrar | `registrar01` | `password123` | seeded |
| Principal | `principal01` | `password123` | seeded |
| **Committee** | `committee01` | `password123` | created in 1.3 |

> Use a **private/incognito window per role**, or log out fully between role switches. Session and cached role are a common source of false failures here.

### 1.5 Live fixture numbers (for reconciliation)

| Fact | Value |
|---|---|
| Current school year | `2026-2027` (id 2) |
| Enrolled learners | 51 |
| Enrolled with **no section** (pending queue) | 31 |
| Submitted document requirements | 100 |
| Verified requirements | 0 |
| Transfer requests | 0 |
| Reading assessments | 0 |

---

## 2. Committee role & navigation

### 2.1 Login redirect
1. Log in as `committee01`
2. **Verify:** you land on `/committee` (not `/admin`, not `/registrar`)
3. **Verify:** the brand/logo link returns you to `/committee`

### 2.2 Sidebar
1. **Verify** sidebar groups appear in this order:
   - **Overview** → Committee Dashboard
   - **Committee Duties** → Transfer Approvals, Enrollment, Section Assignment, Document Verification
   - **Account** → Profile, System Guide
2. **Verify** there is **no** User Management, Subject Management, School Settings, Database Backup, or LIS Export in the committee sidebar
   - Committee is Admin-equivalent *on the server*; the sidebar is intentionally narrowed to the committee's own duties. If admin menus leak in, **FAIL** — report it.

### 2.3 Direct URL access
Type each path directly in the address bar:
- `/committee` ✅ loads
- `/committee/transfers` ✅ loads
- `/committee/enrollment` ✅ loads
- `/committee/section-assignment` ✅ loads
- `/committee/documents` ✅ loads

### 2.4 Role label everywhere
1. Open **Profile**
2. **Verify** role reads **"Enrollment Committee"** — not blank, not "teacher", not a raw enum value
3. **Verify** the header/avatar shows the committee label
4. **Verify** notifications badge and dropdown render without error

### 2.5 Admin can see and manage committee
1. Log in as `admin` → **User Management**
2. **Verify** "Enrollment Committee" appears in the role dropdown
3. **Verify** creating or editing a user with that role succeeds
4. **Verify** the permissions summary column shows the committee scope

### 2.6 RBAC page
1. As `admin` → **Role Access Control**
2. **Verify** an `enrollment_committee` row exists
3. **Verify** inherited keys (admin + registrar scope) are shown **locked** and cannot be toggled off
4. **Verify** committee-only keys (dashboard, enrollment, section assignment, document verification, transfers) **can** be toggled
5. **Verify:** toggling one off removes the corresponding sidebar item, and toggling back restores it

---

## 3. Reading assessments & the Non-Reader rule

> **The rule under test:** Non-Reader is a *manual, assessment-backed* tag. It must never be inferred from grades, general average, or a section threshold.

### 3.1 Teacher page loads
1. Log in as `teacher01`
2. Open **Reading Assessments** (`/teacher/reading-assessments`)
3. **Verify:** page loads, shows a Non-Reader counter and a Reader counter
4. **Verify:** the banner states Non-Reader is never assigned from grades
5. **Verify:** the learner dropdown lists **only that teacher's own roster**
   - Cross-check with `/teacher` class list. A learner from another teacher's class here is a **FAIL**.

### 3.2 Record a Non-Reader assessment
1. Select a learner, set **Result = Non-Reader**, enter an **Instrument** (e.g. "BATANES"), set the date
2. Submit
3. **Verify:** success toast, and the row appears in the table
4. **Verify:** the Non-Reader counter increments
5. **Verify:** reloading the page still shows the row (it persisted)

### 3.3 Record a Reader assessment
1. Same learner, set **Result = Reader**
2. **Verify:** row updates/appears as Reader; Non-Reader counter does not increment

### 3.4 Non-Reader tag now permitted
1. Open the learner's profile → classifications
2. **Verify:** **Non-Reader** is now selectable/taggable
3. Tag it → **Verify:** it saves and persists

### 3.5 Removing the assessment clears the tag
1. On **Reading Assessments**, delete the assessment for that learner
2. Confirm the warning dialog
3. **Verify:** toast confirms the Non-Reader tag was cleared
4. **Verify:** the learner's profile no longer shows Non-Reader
5. **Verify:** trying to re-tag Non-Reader now fails with a message telling you to record the assessment first

### 3.6 Non-Reader is never grade-derived
1. On **Section Assignment** as committee, look at the placement options
2. **Verify:** there is **no** automatic "Non-Reader Section by grade threshold" rule
3. **Verify:** Non-Reader placement appears **only** for learners who already carry the tag
4. **Check the legacy data:** 6 students have a `non_reader` tag from before this release with no assessment on record. Ask the committee whether each is legitimate. If any is not, remove the tag (Classification untagging, step 6.4).

---

## 4. Document verification (committee duty)

> **The rule under test:** verification records *sighting a receipt*. It does not upload files, and an unsubmitted document can never be verified.

### 4.1 Committee-only visibility
1. As **committee** → open `/committee/documents`
2. **Verify:** you can click a submitted document to verify
3. As **teacher01** → open the same path
4. **Verify:** the verify control is **absent** (read-only or a "handled by the Enrollment Committee" notice). Teacher must not be able to verify.

### 4.2 Verify a submitted document
1. As committee, find a learner with a submitted requirement
2. **Verify:** the **Verified** progress meter reads `0/…` initially (live data starts at 0 verified)
3. Click the submitted document's verify control
4. **Verify:** it turns to the verified state immediately (optimistic update)
5. **Verify:** the progress meter increments to `1/…`
6. **Verify:** the percentage updates
7. **Verify:** the tooltip explains it is a sighted receipt, no file upload
8. **Reload** → **Verify:** verification persisted

### 4.3 Un-verify
1. Click the same control again
2. **Verify:** it returns to submitted, and the meter decrements

### 4.4 Cannot verify an unsubmitted document
1. Find a learner whose requirement is **not** submitted
2. **Verify:** there is **no** clickable verify control on it
3. If you can force a request (devtools), the API must return an error. Expect a 4xx with a message that the requirement is not submitted.

### 4.5 Un-submitting clears verification
1. Verify a submitted requirement (step 4.2)
2. Then un-submit that same requirement
3. **Verify:** it reverts to unsubmitted **and** the verification is cleared
4. **Verify:** the meter decremented

### 4.6 Duplicate flags
1. **Verify:** the committee dashboard "Document Verification" tile shows a duplicate-flags count
2. **Verify:** duplicate enrollments surface and can be resolved

---

## 5. Transfers (Registrar files → Committee decides)

> **The rules under test:** registrar files, committee decides. Nobody approves their own filing. A learner cannot have two open requests for the same school year. A Transfer-Out returns the seat to the section headcount.

### 5.1 Registrar files a Transfer-In
1. Log in as `registrar01` → open `/registrar/transfers`
2. **Verify:** sidebar has a Transfers entry
3. Fill a new-learner Transfer-In: LRN, name, sex, birthdate, grade level, school year
4. Submit → **Verify:** success toast, request appears as **Pending**
5. **Verify:** a **Withdraw** action is available while pending

### 5.2 Duplicate guard
1. With the same learner LRN **pending**, try to file another request for the **same school year**
2. **Verify:** it is **refused** with a clear "already pending" message
3. **Verify:** filing for a **different** school year is allowed

### 5.3 Teacher cannot file
1. As `teacher01`, open `/registrar/transfers`
2. **Verify:** the file form is not available / access is refused

### 5.4 Committee sees the queue
1. Log in as `committee01` → `/committee`
2. **Verify:** "Transfer Approvals" tile shows **1 awaiting decision**
3. **Verify:** the committee sidebar has Transfer Approvals
4. Open `/committee/transfers`
5. **Verify:** the registrar's pending request is listed with learner name, type, school year, and filer

### 5.5 Committee approves a Transfer-In
1. Click **Approve**
2. **Verify:** the request leaves the pending list and its status becomes approved
3. **Verify:** the learner is now **enrolled**
4. **Verify:** a notification is generated for the relevant party
5. **Verify:** the committee dashboard tile count drops to 0
6. **Verify:** an activity log entry exists

### 5.6 Self-approval is blocked
1. As `registrar01`, note that the registrar cannot decide. Open the request and attempt a decision (or via devtools).
2. **Verify:** refused with 403 — a registrar must not approve their own filing
3. Same for a committee member who somehow filed one (committee is admin-equivalent, so this is a guard worth confirming)

### 5.7 Committee rejects
1. File a second Transfer-In as registrar
2. As committee, click **Reject** with a reason
3. **Verify:** status becomes rejected, reason is recorded, learner is **not** enrolled

### 5.8 Transfer-Out returns the seat
This is the highest-risk fix in the release — test carefully.
1. Note a section's current headcount (Sections page, or the section's roster count)
2. File a **Transfer-Out** as registrar for a learner currently enrolled in that section
3. As committee, **Approve** it
4. **Verify:** only that learner's **active** enrollment is marked transferred
5. **Verify:** the section's current headcount **decreases by exactly 1**
6. **Verify:** the seat is now available for a new placement

### 5.9 Registrar withdrawal
1. File a Transfer-In, then **Withdraw** it as registrar
2. **Verify:** status becomes withdrawn/withdrawn, it is no longer actionable by the committee
3. **Verify:** committee tile count reflects the change

### 5.10 Audit trail
1. As `admin` → **Activity Logs**
2. **Verify** entries exist for: transfer filed, approved, rejected, withdrawn

---

## 6. Section assignment

### 6.1 Queue loads
1. As committee → `/committee/section-assignment`
2. **Verify:** 31 enrolled learners awaiting a section are listed

### 6.2 Teacher view
1. As `teacher01` → open section assignment
2. **Verify:** a notice says assignment is handled by the **Enrollment Committee** (not "Registrar")
3. **Verify:** no assignment controls are available

### 6.3 Place a learner
1. As committee, use preview/assign for a learner
2. **Verify:** the rules engine produces assignments consistent with section thresholds
3. Confirm → **Verify:** learner leaves the pending queue, section headcount increments

### 6.4 Classification untagging (fix under test)
1. Open a learner's classifications
2. Remove a tag (e.g. 4PS)
3. **Verify:** it saves — previously an empty selection was rejected outright
4. To fully clear a mis-tagged learner, deselect everything and save
5. **Verify:** all tags clear and the change persists
6. **Verify:** a partially-failed save does not leave the learner with **zero** tags (this was a transaction bug)

### 6.5 Undo
1. Use **Undo last assignment batch**
2. **Verify:** the batch reverts and learners return to the queue

---

## 7. Enrollment

### 7.1 Committee enrolls
1. As committee → `/committee/enrollment`
2. Enroll a learner
3. **Verify:** success message names the **Enrollment Committee** as the party who assigns the section (not "Registrar")
4. **Verify:** learner lands in the pending queue, not silently in a section

### 7.2 Non-Reader is not selectable at enrollment
1. Enroll a learner and look for a Non-Reader option
2. **Verify:** **Non-Reader is not offered** at enrollment time
3. **Why:** the tag requires a recorded reading assessment, which is a teacher duty performed after enrollment

---

## 8. Grades are Q1–Q3 only (fix under test)

### 8.1 Grade entry
1. As teacher → Grade Management / Upload Grades
2. **Verify:** quarter selector offers **only** Q1, Q2, Q3 — no Q4

### 8.2 Upload rejects Q4
1. Attempt to upload a workbook tagged for Q4
2. **Verify:** rejected with a message that quarters are 1–3

### 8.3 Import rejects an out-of-range quarter
1. Try to import a document tagged outside Q1–Q3
2. **Verify:** rejected before any rows are written

### 8.4 Correction requests reject Q4
1. As teacher/registrar → Grade Corrections, request a correction for **Q4**
2. **Verify:** rejected with "Quarter must be 1, 2, or 3"
3. **Verify:** leaving the quarter blank (all quarters) is still allowed
4. **Verify:** no Q4 correction request can be left permanently pending

### 8.5 Reports are unaffected
1. As registrar → SF9, SF10
2. **Verify:** only three quarterly columns render, no empty Q4 column
3. **Verify:** LIS exports show Q1–Q3 only
4. **Verify:** at-risk analytics use Q1–Q3
5. **Verify:** the 377 legacy Q4 rows do **not** appear in any report

### 8.6 Regression unit tests
```bash
cd server
npm test
# expect: 13/13 pass
```
The four tests that previously failed asserted **4-quarter** projections; they were corrected to the 3-quarter calendar.

---

## 9. SNED & subject grouping

### 9.1 PWD implies SNED
1. Tag a learner **PWD**
2. **Verify:** **SNED** is added automatically
3. Remove PWD → **Verify:** the auto-added SNED is removed
4. Tag SNED **alone** → **Verify:** it is kept (SNED also covers non-PWD special needs)
5. **Verify** the API response includes `sned_auto_tagged`

### 9.2 TLE grouping
1. Open a grade or form for a TLE/EPP specialization
2. **Verify:** specializations (e.g. `TLE/EPP` tracks in G7–G10) report under the **single TLE/EPP heading**
3. **Verify:** the general average counts the TLE group **once**, not once per specialization
4. **Verify:** a learner only sees their own specialization
5. Repeat for **SF9** and **SF10** — same collapse
6. **Verify:** MAPEH components still collapse as before (no regression)

### 9.3 Subject management
1. As admin → Subject Management
2. **Verify:** the grouping key is visible/consistent for TLE rows
3. **Verify:** standalone subjects are unaffected

---

## 10. Regression sweep

Confirm nothing broke that existed before this release:

1. **Login** for all five roles ✅
2. **Admin:** User Management, Subject Management, School Settings, Database Backup, LIS Export ✅
3. **Registrar:** Dashboard, Students, Section Assignment, Promotions, Graduates, Subjects, SF1/SF5/SF9/SF10, Grade Distribution, Grade Corrections, Schedule, Master Schedule, LIS Export, At-Risk, Certificates ✅
4. **Teacher:** Dashboard, My Sections, Grade Management, Upload Grades, Sectioning, Attendance, Profile ✅
5. **Principal:** Dashboard, Enrollment, Sections, Grades, Promotions, Graduates, At-Risk, exports ✅
6. **Bookmarked URLs redirect instead of 404ing:**
   - `/teacher/enroll` → redirects to a relevant read-only page
   - `/teacher/sectioning` → redirects to a relevant read-only page
7. **Notifications** render for every role without error
8. **System Guide** loads for every role
9. **Profile** page loads and saves for every role

---

## 11. Sign-off

| # | Section | Tester | Date | Result | Notes |
|---|---|---|---|---|---|
| 2 | Committee role & navigation | | | ⬜ | |
| 3 | Reading assessments / Non-Reader | | | ⬜ | |
| 4 | Document verification | | | ⬜ | |
| 5 | Transfers | | | ⬜ | |
| 6 | Section assignment | | | ⬜ | |
| 7 | Enrollment | | | ⬜ | |
| 8 | Q1–Q3 enforcement | | | ⬜ | |
| 9 | SNED & subject grouping | | | ⬜ | |
| 10 | Regression sweep | | | ⬜ | |

**Deploy gate:** all rows PASS, and `npm test` + `npm run test:api` are green on the deploy commit.

**Automated re-run before deploy:**
```bash
cd server
npm test          # expect 13/13
npm run test:api  # expect 19/19 (server must be running)
npx tsc --noEmit  # expect no errors
cd ..
npx tsc -b        # expect no errors
```

**Re-apply migrations on the target environment:**
```bash
cd server
npm run migrate
```
Expect `0 new migration(s) executed` if already applied. If it reports new migrations, stop and verify the schema before continuing.

---

## Appendix A — Test data hygiene

- The committee account (`committee01`) is a test artifact. **Delete it before or immediately after deployment** unless the school has a real committee member to onboard.
- Transfer requests, reading assessments, and document verifications created during this pass are test records. Prefer using clearly-named test learners (e.g. `ZZTEST`) and clean them up, or run the pass on a staging copy of the database.
- 6 legacy `non_reader` tags lack assessment evidence (step 3.6). Resolve deliberately — do not bulk-delete.
- 377 legacy `quarter = 4` rows: **leave as-is** per the recorded decision. Do not delete.

## Appendix B — What was already automated

`server/scripts/smokeCommittee.ts` (run via `npm run test:api`) covers, without writing to shared data:

- health check
- anonymous access blocked from transfers and reading assessments
- transfer list readable by committee / admin / registrar / teacher; anonymous blocked
- teacher cannot file a transfer
- teacher cannot decide a transfer
- registrar cannot decide a transfer (separation of duties)
- committee passes authz on filing (admin-equivalent, fails on validation)
- teacher can list reading assessments
- `non_reader` tagging refused without assessment evidence
- empty classification array accepted (clears tags)
- Q4 correction request refused
- committee can read enrollment requirements

`server/src/utils/linearRegression.test.ts` (run via `npm test`) covers the at-risk regression and classification math.

**What automation does NOT cover:** rendering, routing, sidebar gating, optimistic UI, toasts, counters, and any multi-step workflow. That is exactly what this document tests.
