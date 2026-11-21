# Test Cases — LIS Import

**Source:** `docs/new/Hi5_Portal_LIS_Import_Expected_Behavior.md`
**Prepared:** November 21, 2026

---

## How to use this file

- Only the **Registrar** (and Administrator) can use this feature. Testing as another role is case L1.
- The sample file below matches some of the pre-loaded demo learners by LRN. **Nothing in these tests creates learners or deletes data.**
- If some learner details were already filled by a previous test run, those rows will show **"No change"** instead of "Will update" — that is correct behavior, not a failure.

## Prepare the test file

1. Open Notepad (or any text editor) and paste the CSV below exactly.
2. Save it as `lis-test.csv` (choose "All files" as the file type, and UTF-8 encoding).

```csv
LRN,Surname,First Name,Middle Name,Name Extension,Date of Birth,Sex,Mother Tongue,IP (Ethnic Group),Religion,House No./Street,Barangay,Municipality/City,Province,ZIP,Father's Name,Mother's Name,Guardian Name,Relationship,Contact No,Disability
900000000012,Torres,Ivan,,Jr.,06/15/2010,M,Tagalog,,Roman Catholic,12 Rizal St,Bagumbayan,Naga City,Camarines Sur,4400,Pedro Torres,Maria Torres,Maria Torres,Mother,09171234567,
900000000010,Reyes,Paolo,Santos,,09/21/2009,M,Bikol,Bicolano,Iglesia ni Cristo,3 Magsaysay Dr,Concepcion Pequena,Naga City,Camarines Sur,4400,,Ana Reyes,Ana Reyes,Mother,,Visual impairment
990000000001,Sample,Unknown,Learner,,01/01/2011,M,,,,,,,,,,,,,,
12345,Bad,Lrn,,,,M,,,,,,,,,,,,,,
900000000012,Torres,Duplicate,,,,M,,,,,,,,,,,,,,
```

Rows in this file, on purpose:

| Row | What it tests |
|---|---|
| Ivan Torres (Jr.) | A real learner — will update or no-change |
| Paolo Reyes | Real learner with a **wrong birthdate** in the file → mismatch |
| Sample Unknown | LRN not in Hi5 → skipped, never created |
| Bad Lrn | LRN is not 12 digits → error |
| Duplicate Torres | Same LRN twice in the file → error |

**Where things are:** Registrar menu → **Import from LIS** (`/registrar/lis-import`).

---

## L1. Only Registrar and Administrator can import

**Log in as:** a Teacher (or Principal)
1. Look through the whole menu.

**Expected:** There is **no** "Import from LIS" item. (Opening `/registrar/lis-import` directly is also blocked.)

☐ Pass ☐ Fail

---

## L2. Open the import page and choose the file

**Log in as:** `registrar01`
1. Registrar menu → **Import from LIS**.
2. Choose file → `lis-test.csv`. Keep the current school year selected.
3. Click **Preview Import**.

**Expected:** A mapping table appears (LRN ← LRN, Surname ← Surname, etc.), followed by result counters. **Nothing has been saved yet.**

☐ Pass ☐ Fail

---

## L3. The preview counts are correct

With the sample file you should see approximately:

| Counter | Rows |
|---|---|
| Will update | 1 (Ivan — or **0** with "No change" 1 if his details were already filled before) |
| Mismatch | 1 (Paolo — birthdate differs) |
| Not in Hi5 | 1 (Sample Unknown) |
| Error | 2 (bad LRN + duplicate LRN) |

**Expected:** The counters match the table above (allowing the Ivan no-change note).

☐ Pass ☐ Fail

---

## L4. Mismatches are listed with both values, and the learner is NOT changed

1. In the preview table, find the row marked **Mismatch** (Paolo Reyes).

**Expected:** The details show **both values**, e.g. `Birthdate: file 2009-09-21 vs Hi5 2010-06-15`. The learner's Hi5 record is **not** touched by the import — the Registrar resolves it via Edit Details (see `TEST_CASES_03_Student_Details_Edit.md`).

☐ Pass ☐ Fail

---

## L5. A learner not in Hi5 is never created

1. Find the row marked **Not in Hi5** (Sample Unknown).

**Expected:** It says the LRN is not enrolled in Hi5 and is **skipped — never created**. After the import, the learner count in Students is unchanged.

☐ Pass ☐ Fail

---

## L6. Bad and duplicate LRNs are reported

1. Find the two rows marked **Error**.

**Expected:** One says *"Bad LRN (not 12 digits)"*, the other *"Duplicate LRN in the file."*

☐ Pass ☐ Fail

---

## L7. Fill-empty-only (default) applies

1. On the mode panel, leave **"Fill empty only"** for every group.
2. Click **Confirm Import**.

**Expected:** Success message like *"Import complete — N field(s) updated."* Open the updated learner's profile → Edit Details: only fields that were **empty** now carry the file's values; fields the school already had were **not** overwritten.

☐ Pass ☐ Fail

---

## L8. Overwrite mode replaces values

1. Import the same file again, but set one group (e.g. **Mother tongue / IP / Religion**) to **Overwrite** before confirming.
2. First change one of those values on the learner (Edit Details) so the stored value differs from the file.

**Expected:** With Overwrite on, the stored value is replaced by the file's value; with Fill empty only, it would have been kept.

☐ Pass ☐ Fail

---

## L9. Re-importing the same file changes nothing

1. Run Preview again with the same file.

**Expected:** **Will update = 0** — everything matches now ("No change" for the imported learner).

☐ Pass ☐ Fail

---

## L10. The report can be downloaded

1. Click **Download report**.

**Expected:** A CSV file downloads listing every row with its result (LRN, name, result, details).

☐ Pass ☐ Fail

---

## L11. Changes appear in the learner's Change History

1. Open the imported learner's profile → **Change History** tab.

**Expected:** Every changed field is listed with its **old → new value**, reason **"LIS import"**, the user who ran it, and the date/time. (Old values are blank for fields that were empty before.)

☐ Pass ☐ Fail

---

## L12. PWD tag from the Disability column

1. Open `lis-test.csv` and add a value to the **Disability** column of Ivan's row (the learner that matched), e.g. `Visual impairment`. Save.
2. Import the file again (Fill empty only).
3. Open that learner's profile and check their classifications (also visible as `PWD` in the SF1 REMARKS column).

**Expected:** The matched learner receives the **PWD** classification automatically. A learner who already carries the PWD tag is not duplicated.

☐ Pass ☐ Fail

---

## L13. Large or wrong files are rejected

1. Try to import a file **larger than 10 MB**.
2. Try a **.docx** (or any non-spreadsheet file).

**Expected:** Both are rejected with a clear error before anything is read.

☐ Pass ☐ Fail

---

## L14. Enrollment data is never imported

1. Look at the preview mapping for a matched learner.

**Expected:** The import only offers learner **details** (mother tongue, IP, religion, address, ZIP, parents/guardian, contact, disability). It never offers enrollment status, section, grades, or BOSY/EOSY — those are ignored by design.

☐ Pass ☐ Fail

---

## L15. Activity Log records the import

**Log in as:** Administrator → **Activity Logs**

**Expected:** One summary entry per import: the file name, how many fields were updated, and how many mismatches / not-in-Hi5 / errors there were.

☐ Pass ☐ Fail

---

## Sign-off

| Tested by | Date | Result |
|---|---|---|
| | | |
