# Test Cases — Digital Requirements Upload, Name Suffix, and School Form Field Population

**Source:** `docs/new/Hi5_Portal_Digital Requirements Upload, Name Suffix, and School Form Field Population.md`
**Prepared:** November 21, 2026
**Tester roles used below:** Enrollment Committee, Registrar, Administrator, Teacher, Principal

---

## How to use this file

- Test in order — later cases reuse earlier results.
- Mark **Pass ☐ / Fail ☐** on each case. If a case fails, note the step number.
- Demo learners (the 23 pre-loaded learners) are safe to use — nothing here deletes learner data.
- Login accounts: `committee01`, `registrar01`, `principal01`, plus any teacher account. (Administrator password was changed by the school — use the admin account you hold.)

**Where things are:**

| Page | Path / Menu |
|---|---|
| Enrollment (Committee) | Committee → **Enrollment** |
| Learner search (Registrar) | Registrar → **Students** |
| Learner profile (all roles) | `/student/<id>` — or click a learner from a list |
| Document Checklist | Learner profile → **Document Checklist** tab |
| School Forms | Registrar/Admin → **School Forms** → SF1 / SF5 / SF9 / SF10 |
| Activity Log | Admin → **Activity Logs** |

---

# Part A — Digital Requirements Upload

## A1. Only the right roles can see the upload controls

**Log in as:** Teacher (or Principal)
1. Open any enrolled learner's profile (Registrar → Students → click a learner — or ask the Registrar to open one for you and share the URL).
2. Click the **Document Checklist** tab.
3. Look at each checklist row.

**Expected:** You see the checklist and the Received badges, but there are **no** "Take Photo" / "Choose File" / Replace / Delete buttons anywhere. You cannot view files.

☐ Pass ☐ Fail

---

## A2. Administrator can view but not manage

**Log in as:** Administrator
1. Open the same learner's profile → **Document Checklist** tab.
2. Look at a checklist row that has a file attached (use one after A4 or A9 has been done by the Committee).

**Expected:** Admin sees the **View** button and can open the file, but there are **no** Take Photo / Choose File / Replace / Delete buttons.

☐ Pass ☐ Fail

---

## A3. Committee uploads a PDF copy (Choose File)

**Log in as:** `committee01` (or `registrar01`)
1. Open the learner's profile → **Document Checklist** tab.
2. On the row **PSA/NSO Birth Certificate**, click **Choose File**.
3. Pick a small PDF (under 5 MB).
4. Wait for the upload to finish (you will see a progress bar).

**Expected:** A green success toast appears ("Attached …"), and a file chip with the file's name and size appears **within a few seconds** — no page reload needed.

☐ Pass ☐ Fail

---

## A4. Take Photo on a mobile phone

**Log in as:** `committee01` on a **mobile browser** (same steps as A3)
1. Open the learner's profile → **Document Checklist** tab.
2. Tap **Take Photo** on any requirement row.
3. Capture a document and confirm.

**Expected:** The camera opens, the captured photo uploads, and the file appears on the laptop view a few seconds later (refresh the profile on the laptop to see it).

☐ Pass ☐ Fail

---

## A5. HEIC is rejected with a clear message

1. Same screen as A3.
2. Click **Choose File** and pick a **.heic** photo (an iPhone photo that was not converted).

**Expected:** A red error appears: *"HEIC is not supported — switch the camera to JPG or convert the photo first."* Nothing is attached.

☐ Pass ☐ Fail

---

## A6. Files over 5 MB are rejected

1. Same screen as A3.
2. Click **Choose File** and pick a JPG/PNG/PDF **larger than 5 MB**.

**Expected:** Error: *"The file exceeds the 5 MB limit."* Nothing is attached.

☐ Pass ☐ Fail

---

## A7. A file with a fake extension is rejected

1. On a laptop, rename a small `.txt` (or any non-PDF/JPG/PNG) file to end with `.png`.
2. Same screen as A3 → **Choose File** → pick the renamed file.

**Expected:** Error: *"Only PDF, JPG/JPEG, or PNG files are accepted (the file content must match)."* — the system checks the actual content, not just the name.

☐ Pass ☐ Fail

---

## A8. Maximum 3 files per requirement

1. Same screen as A3 — attach files one at a time until the requirement has **3 files**.
2. Try to attach a 4th.

**Expected:** The Take Photo / Choose File buttons become disabled, and the counter shows **3/3 files**. A 4th file cannot be added.

☐ Pass ☐ Fail

---

## A9. Replace a file

1. Same screen — on an attached file chip, click **Replace**.
2. Pick a different PDF/JPG/PNG.

**Expected:** The chip now shows the **new** file's name and size; there is still only **one** copy replaced (the count does not grow). If the new file is invalid, the **original stays untouched**.

☐ Pass ☐ Fail

---

## A10. Delete a file

1. Same screen — click **Delete** on an attached file chip.

**Expected:** Success toast, the chip disappears, and the counter drops (e.g. 2/3 files).

☐ Pass ☐ Fail

---

## A11. Uploading does NOT check the checklist item

1. Find a requirement row that is **Not Submitted** but has a file attached (after A3).

**Expected:** The badge reads **"Copy attached"** (blue) — it does **not** automatically turn into "Received".

☐ Pass ☐ Fail

---

## A12. Checking does NOT require a file

1. On a requirement row with **no file**, click **Mark Submitted**.

**Expected:** The badge turns **"Received"** (green) with no file needed. Unmarking removes the Received state.

☐ Pass ☐ Fail

---

## A13. All four checklist states

Using one learner, make sure you have seen all four badge states:

| Badge | When |
|---|---|
| **Not Submitted** | no check, no file |
| **Received** | checked, no file |
| **Copy attached** | file only, not checked |
| **Received and copy attached** | checked + file |

☐ Pass ☐ Fail

---

## A14. During-enrollment attach (laptop only)

**Log in as:** `committee01` → Enrollment → **Enroll New Student**
1. Fill the wizard up to Step 3 (Enrollment Requirements).
2. Below the checkboxes, find **"Attach scanned copies (optional)"**.
3. Click **Choose file** on PSA/NSO Birth Certificate and pick a PDF.
4. **Cancel the enrollment** (go back / close the wizard without pressing Enroll).

**Expected:** The file chip shows in the wizard while filling out, but after cancelling **nothing was stored** — reopen the wizard (or the learner's checklist later); no file exists.

☐ Pass ☐ Fail

---

## A15. Files upload only when Enroll is pressed

1. Repeat A14 steps 1–3, but this time **press Enroll** to complete the enrollment.
2. Open the new learner's profile → **Document Checklist**.

**Expected:** The attached file is now on the PSA/NSO Birth Certificate row of the real checklist. If an upload failed at this moment, the enrollment still succeeded and a warning tells you to attach the file later.

☐ Pass ☐ Fail

---

## A16. Every action is in the Activity Log

**Log in as:** Administrator → **Activity Logs**
1. Search for entries made during A3–A10.

**Expected:** Each upload, replace, and delete is listed with the **user who did it**, the **action**, the **learner**, and the **date and time**.

☐ Pass ☐ Fail

---

## A17. No public links to files

1. While viewing an attached file (View button), copy the address from the browser tab.
2. Paste it into a fresh browser window where nobody is logged in.

**Expected:** The file cannot be opened — the address only works inside the app while logged in as an authorized role.

☐ Pass ☐ Fail

---

# Part B — Name Suffix

## B1. Suffix dropdown on the enrollment form

**Log in as:** `committee01` → Enrollment → **Enroll New Student** → Step 1
1. Look beside the Last Name field.

**Expected:** A **Name Suffix** dropdown with exactly: `Jr., Sr., II, III, IV, V, Other`. Choosing **Other** reveals a small text box for a custom suffix.

☐ Pass ☐ Fail

---

## B2. Enroll a learner with a suffix

1. Enroll a test learner with First name `Juan Pedro`, Last name `Dela Cruz`, Suffix **Jr.**
2. Complete the enrollment.

**Expected:** The learner is created. Open their profile — the name shows the suffix (e.g. "Juan Pedro Dela Cruz Jr.").

☐ Pass ☐ Fail

---

## B3. Suffix prints on every School Form

**Log in as:** `registrar01` → School Forms
1. Print **SF1** for the learner's section — the NAME column shows `DELA CRUZ, JUAN PEDRO Jr.` (suffix after the given names, uppercase parts).
2. Print **SF5** (if the learner is in a section) and **SF9** / **SF10** for the learner — the name row/cell shows the suffix in the standard format.

**Expected:** The suffix appears in **all four** forms, formatted `LAST, FIRST MIDDLE SUFFIX`.

☐ Pass ☐ Fail

---

## B4. Suffix appears everywhere the name is shown

1. Check the learner in: the student list (Registrar → Students), the Section Assignment queue, an At-Risk view, and a certificate (Certificate of Enrollment preview).

**Expected:** Every display shows the name **with** the suffix.

☐ Pass ☐ Fail

---

## B5. Duplicate check respects the suffix

1. Try to enroll a learner named exactly like B2's learner but with suffix **Sr.** (same first/middle/last).
2. Try to enroll one with the **same** suffix (another `Juan Pedro Dela Cruz Jr.`).

**Expected:** The **Sr.** version is allowed — a different suffix means a different learner. The second **Jr.** is detected as a duplicate.

☐ Pass ☐ Fail

---

## B6. Existing learners have no suffix until edited

1. Open any of the 23 pre-loaded demo learners → **Edit Details**.

**Expected:** The Name Suffix field starts **empty** (no suffix shown anywhere for them), and can be set by the Registrar/Committee (this edit asks for a reason — see the Student Details Edit test cases).

☐ Pass ☐ Fail

---

## B7. Sorting is by Last Name only

**Log in as:** `registrar01` → Students
1. Sort the student list by **Name**.

**Expected:** Learners are ordered **A→Z by surname** (e.g. "Bautista, Rhea" before "Dela Cruz, Juan Pedro Jr."), regardless of suffix or first name.

☐ Pass ☐ Fail

---

# Part C — School Form Field Population

## C1. Learner data auto-fills SF1

**Log in as:** `registrar01` → School Forms → **SF1**
1. Pick a section with the demo learners.
2. Look at the learner rows: Mother Tongue, IP, Religion, House#/Street, Barangay, Municipality, Province, **ZIP**, Father, Mother, Guardian, Relationship, Contact.

**Expected:** Every column that has data stored for the learner **prints automatically** — including the new **ZIP** column. Columns with no stored data are blank.

☐ Pass ☐ Fail

---

## C2. 4Ps / PWD appear in REMARKS

1. On SF1, find a learner who is tagged 4Ps or PWD (or tag one via the learner's classifications first).

**Expected:** The REMARKS column shows `4Ps` and/or `PWD` legend codes for that learner.

☐ Pass ☐ Fail

---

## C3. Saved SF edits still win over stored data

1. On SF1, edit one auto-filled cell for a learner (e.g. type a different Religion) and **save**.
2. Reload the page.

**Expected:** Your saved edit remains — manual saved edits always override the database value.

☐ Pass ☐ Fail

---

## C4. Imported LIS data reaches the forms (use with the LIS Import test file)

1. Run the LIS Import test (see `TEST_CASES_02_LIS_Import.md`) to fill learner details.
2. Reprint SF1.

**Expected:** The imported values now print in the SF1 columns without any typing.

☐ Pass ☐ Fail

---

## Sign-off

| Part | Tested by | Date | Result |
|---|---|---|---|
| A — Digital Requirements Upload | | | |
| B — Name Suffix | | | |
| C — Field Population | | | |
