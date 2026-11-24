# Test Cases — Import Learner Details

**Source:** `docs/new/Hi5_Portal_Learner_Details_File_Import_Revised.md` (supersedes the "Import from LIS" naming in the original LIS Import doc)
**Prepared:** November 24, 2026

---

## How to use this file

- Only the **Registrar** (and Administrator) can use this feature. Testing as another role is case L1.
- The feature is called **Import Learner Details** — Hi5 does not connect to the DepEd LIS; you download the file from your LIS records (such as the SF1) and import it here.
- Learners are matched by LRN only. **Nothing in these tests creates learners or deletes data.**
- If some learner details were already filled by a previous test run, those rows will show **"No change"** instead of "Will update" — that is correct behavior, not a failure.

## Prepare the files

### File 1 — the template (case T1)

Download it from the page itself (see T1) — no preparation needed.

### File 2 — a small CSV (cases L2–L15)

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

### File 3 — the real SF1 from LIS (cases F1–F5)

Use an **anonymized copy** of the SF1 you downloaded from LIS (replace names, LRNs, and birth dates with fake values — the real file contains learners' personal data). Do **not** test with the real learners' names.

**Where things are:** Registrar menu → **Import Learner Details** (`/registrar/lis-import`).

---

## T1. Download template

**Log in as:** `registrar01`
1. Registrar menu → **Import Learner Details**.
2. Click **Download template**.
3. Open the downloaded `.xlsx`.

**Expected:** The file has two sheets: **"Learners"** — one header row with exactly these columns in order (LRN, Last Name, First Name, Middle Name, Name Suffix, Birth Date, Sex, Mother Tongue, IP (Ethnic Group), Religion, House No./Street/Sitio/Purok, Barangay, Municipality/City, Province, ZIP, Father's Name, Mother's Maiden Name, Guardian Name, Relationship, Contact Number, Disability) and **no learner data**; **"How to fill"** — one line per column with the mm/dd/yyyy date format and M/F sex values, saying only the LRN is required and blank cells are skipped. Type a 12-digit LRN into a row — Excel must keep it as text (no scientific notation like 9.00E+11).

☐ Pass ☐ Fail

---

## L1. Only Registrar and Administrator can import

**Log in as:** a Teacher (or Principal)
1. Look through the whole menu.

**Expected:** There is **no** "Import Learner Details" item. (Opening `/registrar/lis-import` directly is also blocked.)

☐ Pass ☐ Fail

---

## L2. Open the import page and choose the file

**Log in as:** `registrar01`
1. Registrar menu → **Import Learner Details**.
2. Confirm the note at the top: *"Hi5 does not connect to the DepEd LIS…"*.
3. Choose file → `lis-test.csv`. Keep the current school year selected.
4. Click **Preview Import**.

**Expected:** A mapping table appears (LRN ← LRN, Last Name ← Surname, etc.), followed by result counters. **Nothing has been saved yet.**

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

**Expected:** With Overwrite on, the stored value is replaced by the file's value; with Fill empty only, it would have been kept. (Empty cells in the file never overwrite anything, even in Overwrite mode.)

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

**Expected:** Every changed field is listed with its **old → new value**, reason **"File import"**, the user who ran it, and the date/time. (Older entries made before this change keep their original reason.)

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

**Expected:** One summary entry per import: *"Learner details file import"* with the file name, how many fields were updated, and how many mismatches / not-in-Hi5 / errors there were.

☐ Pass ☐ Fail

---

# The real SF1 from LIS (anonymized copy)

## F1. The SF1 opens and maps correctly

1. Choose file → the anonymized **SF1 .xls** → **Preview Import**.

**Expected:** The preview succeeds despite the title rows (school ID, region, division, school name, school year, grade level, section) above the heading, and the heading split over **two rows** (PARENTS over Father's Name and Mother's Maiden Name; GUARDIAN over Name and Relationship). The mapping table shows Guardian Name and Relationship correctly.

☐ Pass ☐ Fail

---

## F2. TOTAL rows, legend, and footer are ignored

1. Look at the preview rows and counters.

**Expected:** Every learner row in the block was read (e.g. 46 learners for a Grade 10 section). The `<=== TOTAL MALE ===`, `<=== TOTAL FEMALE ===`, and `<=== COMBINED ===` rows are **skipped without messages**; the REMARKS legend, signature lines, and the "Generated thru LIS" footer produce **no errors**. Reading stops at COMBINED.

☐ Pass ☐ Fail

---

## F3. Unrecognized columns are ignored, never errors

1. Look at the **"Columns not used"** list under the mapping.

**Expected:** Columns the import does not read (e.g. Age, Learning Modality, Remarks, or any column LIS adds) are **listed as ignored** — and the import still works. Confirm Import stays enabled.

☐ Pass ☐ Fail

---

## F4. A name that differs shows "Name differs" and changes nothing

1. In the anonymized SF1, change one matched learner's name spelling (e.g. add a hyphenated maiden surname) — keep the birthdate **correct**.
2. Preview → Confirm.

**Expected:** The row shows a **"Name differs"** warning with **both values** (file vs Hi5). The learner's name is **not changed** — but their **other fields still update**. The "Name differs" counter counts the row. (A learner whose **birthdate** differs is still a **Mismatch** and is not changed.)

☐ Pass ☐ Fail

---

## F5. Dates and values from the SF1 are read correctly

1. Check a learner whose details were updated from the SF1 (Edit Details or the preview details).

**Expected:** Dates written as **mm-dd-yyyy** text were read correctly; repeated spaces were collapsed to one; trailing commas were removed from parent names (e.g. `LAST, FIRST, MIDDLE,` → no trailing comma); parent names are stored **exactly as written** in the file (no reordering).

☐ Pass ☐ Fail

---

## Sign-off

| Tested by | Date | Result |
|---|---|---|
| | | |
