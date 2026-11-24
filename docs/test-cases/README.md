# Hi5 Portal — Client Test Cases

One markdown per feature. Each case says **who logs in**, the **exact steps**, the **expected result**, and has a **Pass / Fail** box to mark.

| File | Feature | When to use |
|---|---|---|
| `TEST_CASES_01_Digital_Requirements_Name_Suffix_Field_Population.md` | Scanned requirement files on the Document Checklist (Take Photo / Choose File), Name Suffix, School Form auto-fill (incl. the new SF1 ZIP column and 4Ps/PWD remarks) | Test the enrollment document upload flow and the school-form population |
| `TEST_CASES_02_LIS_Import.md` | **Import Learner Details** — the template download and importing files (the small CSV sample and the real SF1 downloaded from LIS) | Test the import rework: template, SF1 .xls, Name differs, File import history |
| `TEST_CASES_03_Student_Details_Edit.md` | Editing learner details (reasons, change history, duplicate-LRN block with toast, graduated lock) | Test the learner edit feature |
| `TEST_CASES_04_School_Form_Layout_and_Sorting.md` | The November layout fixes: SF1 header alignment + ZIP, SF10 school/adviser fields, last-name sorting, hidden Single Placement tab | Test the fixes reported after the last deployment |

## Before you start

- Demo accounts: `committee01`, `registrar01`, `principal01`, plus any teacher account. The Administrator password was changed by the school.
- The 23 pre-loaded demo learners are safe to use — no test case deletes learner data.
- If a result says "No change" where you expected "Will update", a previous test run already filled that value — that is correct behavior.
- For the real SF1 import test (F1–F5 in file 02), use an **anonymized copy** of the file — never the real learners' personal data.

## Sign-off

When done, fill in the sign-off table at the bottom of each file and send the marked files back.
