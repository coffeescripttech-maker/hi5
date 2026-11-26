# Hi5 Portal: Learner Details File Import (Revised)

**Date:** November 24, 2026  
**Roles:** Registrar and Administrator only (unchanged)  
**Replaces:** The “Import from LIS” wording in `Hi5_Portal_LIS_Import_Expected_Behavior.md`
## Expected behavior for the rework of the LIS Import
### Why this change
The DepEd LIS is an online system. Public schools encode learners in LIS directly, and LIS offers no bulk
upload template for public schools. Hi5 therefore does not connect to LIS and must not present the import as
a LIS feature. The intended flow is: the Registrar downloads a file from LIS (most usefully the SF1 as an
Excel file), imports it in Hi5, and Hi5 fills in the learner details that are still missing. Everything not listed
below stays as it is today. This sheet was checked against a real SF1 downloaded from the DepEd LIS
(School Form 1, Grade 10 section, SY 2026-2027), which is an old-format Excel file (.xls).
### 1. What stays the same
- Only the Registrar and Administrator can see and use the import. Teacher, Principal, and Enrollment
Committee cannot.
- Learners are matched by LRN only. The import never creates learners and never deletes anything.
- Fill empty only is the default for every field group. Overwrite is optional per group.
- A birthdate that differs from Hi5 is a Mismatch. Both values are shown and the learner is not changed.
- A bad LRN (not 12 digits) and a duplicate LRN in the file are Errors.
- Preview first, then Confirm Import. Nothing is saved before Confirm.
- Enrollment status, section, grades, and BOSY/EOSY are never imported.
- Maximum file size is 10 MB. Accepted file types are .csv, .xlsx, and .xls. The .xls type is new, because
the SF1 downloaded from LIS is an .xls file.
- Every changed field is written to the learner's Change History with old value, new value, user, and date
and time.
- The Disability column adds the PWD classification once and never twice.
- Download report (a CSV of every row and its result) stays.
- A saved School Form edit still takes priority over the stored learner data, so an import will not change a
cell that already has a saved edit.
### 2. Rename everything that says "LIS"
Where Expected
Menu item Import Learner Details (was "Import from LIS")
Page title Import Learner Details from a File
Change History reason File import for new changes (was "LIS import"). Old history entries are not changed.
Activity Log entry Learner details file import, with file name, fields updated, and counts of mismatches,
not-in-Hi5, and errors.
Where Expected
Page URL May stay as it is or redirect. Old links must still work.
Note at the top of the page "Hi5 does not connect to the DepEd LIS. Download the file from your LIS records, such
as the SF1, and import it here. Download the template to see the columns Hi5 reads."
### 3. Download template
- A Download template button on the import page downloads an .xlsx file that contains no learner data.
- Sheet 1, "Learners": one header row and no data rows.
- Sheet 2, "How to fill": one line per column saying what to type, the date format (mm/dd/yyyy), and the
Sex values (M or F). It says only the LRN is required and blank cells are skipped.
- LRN cells are formatted as text so Excel does not turn a 12-digit LRN into scientific notation.
**Template columns, in order**
LRN, Last Name, First Name, Middle Name, Name Suffix, Birth Date, Sex, Mother Tongue, IP (Ethnic Group),
Religion, House No./Street/Sitio/Purok, Barangay, Municipality/City, Province, ZIP, Father's Name, Mother's Maiden
Name, Guardian Name, Relationship, Contact Number, Disability
### 4. The import accepts a file downloaded from LIS, not only the template
### Layout of a real LIS SF1
- Rows 1 to 4: title, school ID, region, division, school name, school year, grade level, and section.
- Rows 5 and 6: the heading, split over two rows with merged cells (for example PARENTS over "Father's
Name" and "Mother's Maiden Name", and GUARDIAN over "Name" and "Relationship").
- Row 7 onward: one row per learner. Male learners come first, then a row "TOTAL MALE", then female
learners, then "TOTAL FEMALE" and "COMBINED".
- After that: the REMARKS legend, signature lines, and the footer "Generated thru LIS" with the date.
### Finding the header and the learner rows
- The import looks through the first 15 rows of the first sheet for the row that contains an LRN heading.
That row and the row below it (if its cells are merged under a group heading) are read as one combined
heading, such as "Guardian Name" or "Father's Name".
- If no LRN heading is found, the file is rejected with: "No LRN column found. Download the template or
check the heading row."
- A learner row is a row with a 12-digit LRN. Rows whose name cell starts with "<===" (TOTAL MALE,
TOTAL FEMALE, COMBINED) are skipped without a message.
- Reading stops at the row labeled COMBINED, or at the heading "List and Code of Indicators under
REMARKS", whichever comes first. The legend, signatures, and footer are never counted as errors.
- A row inside the learner block that has a name but a missing or bad LRN is still an Error, as before.
### Matching headings
- Headings are matched ignoring upper or lower case, extra spaces, punctuation, and line breaks.
- Only the leading words are matched. Text in brackets is ignored, so "Sex (M/F)", "BIRTH DATE
(mm/dd/yyyy)", "MOTHER TONGUE (Grade 1 to 3 Only)", and "IP (Ethnic Group)" all match.
- A heading that is not recognized is ignored and listed in the preview under "Columns not used". It is
never an error.
**Field headings accepted (at minimum)**
LRN LRN, Learner Reference Number
Birth Date Birth Date, Birthdate, Date of Birth, DOB (text after the heading, such as mm/dd/yyyy, is
ignored)
Sex Sex, Gender
Mother Tongue Mother Tongue
IP IP, IP (Ethnic Group), Indigenous People, Ethnic Group
Religion Religion
Address House No./Street/Sitio/Purok, House #/Street, Address, Barangay, Municipality/City,
Municipality, Province
ZIP ZIP, ZIP Code, Postal Code
Father Father's Name, Father (SF1: "Father's Name (Last Name, First Name, Middle Name)")
Mother Mother's Maiden Name, Mother's Name, Mother (SF1: "Mother's Maiden Name (Last Name,
First Name, Middle Name)")
Guardian Guardian Name, Guardian, Name of Guardian (SF1: GUARDIAN group, heading "Name")
Relationship Relationship, Relationship to Learner (SF1: GUARDIAN group, heading "Relationship")
Contact Contact Number, Contact No, Contact Number of Parent or Guardian
Disability Disability, Disability Type
### Name column
- A single name column is accepted. In the real SF1 it is written in capitals with two commas, as in
"LAST,FIRST NAMES, MIDDLE". Names are never imported or changed by this feature.
- If the name in the file does not match the Hi5 learner (ignoring case, spacing, and a suffix), the row
shows a Name differs warning with both values. The learner's name is not changed, and the row can still
update other fields.
- The Name differs warning does not block anything. The birthdate Mismatch rule is unchanged.
### Values
- Dates are read as mm-dd-yyyy (the way the real SF1 writes them, as text), mm/dd/yyyy, yyyy-mm-dd, or
Excel date cells.
- Sex is read as M, F, Male, or Female.
- Empty cells never overwrite anything, even in Overwrite mode.
- Repeated spaces are collapsed to one (the SF1 has values such as "NCR FOURTH DISTRICT"), and
leading or trailing spaces and commas are removed.
- Father and mother names are stored as written in the file after that cleaning (for example the mother's
maiden name "LAST,FIRST,MIDDLE," loses its trailing comma). They are not reordered.
- These SF1 columns are never imported: Age, Learning Modality, and Remarks.
- If a cell has more than 255 characters, that field is reported as an error for that row and the rest of the
row is still processed.
### Reference: what the real SF1 sample contained
One Grade 10 section, 46 learners (24 male, 22 female), downloaded from LIS. Counts of learners with a
value:
Hi5 field In the SF1 sample Note
Mother tongue 46 of 46 LIS values such as "Bikol", "Bikol, Central", "Tagalog"
Religion 46 of 46 LIS categories such as "Christianity", "Others"
Barangay, Municipality, Province 46 of 46 Province may carry extra spaces
Father 44 of 46 Two learners have none in LIS
Mother (maiden name) 46 of 46 Written with a trailing comma
IP (Ethnic Group) 0 of 46 Empty in LIS, so it stays empty
House #/Street/Sitio/Purok 0 of 46 Empty in LIS
Guardian name, relationship,
contact number
0 of 46 Empty in LIS
ZIP Not in SF1 Only in the Hi5 template
Disability (PWD) Not in SF1 Only in the Hi5 template; the SF1 Remarks column holds
codes such as T/I and is ignored
### 5. Preview page
- A mapping table lists each Hi5 field, the column heading it was matched to, and a status: Matched, Not
found in file, or Ignored column.
- Counters: Will update, No change, Mismatch, Name differs, Not in Hi5, Error.
- If only the LRN could be matched and no detail column at all, the page says so and Confirm Import is
disabled.
### 6. Test cases that must change (for the repo holder)
TEST_CASES_02_LIS_Import.md uses "Import from LIS" and the reason "LIS import" in cases L1, L2, L7,
L11, and L15. Update those labels to the new names above. Add cases for: template download, the real
SF1 .xls file (title rows, two-row heading, TOTAL rows, legend and footer), an unrecognized column, and a
Name differs warning. Test with an anonymized copy of the sample, never with real learner names.
### 7. Acceptance check
1. The menu says Import Learner Details and the note about LIS is visible on the page.
2. Download template gives an .xlsx with the columns in section 3 and no learner data.
3. The old lis-test.csv still imports with the same counters as before.
4. The real SF1 .xls from LIS imports: the 46 learner rows are read, the TOTAL, legend, and footer rows
are ignored, and no errors come from them.
5. An unrecognized column is listed as ignored and the import still works.
6. A name that differs from Hi5 shows Name differs and changes nothing.
7. Change History shows "File import" for new changes.
8. Nothing else about enrollment, grades, or sections is affected.
### Open items
- Test with an anonymized copy of the sample SF1 (replace names, LRNs, and birth dates with fake
values), because it contains real learners' personal data.
- Confirm how father and mother names are stored in Hi5 today, so imported text looks the same as typed
text.
- Other grade levels and the Senior High SF1 may differ slightly (for example Grade 1 to 3 mother tongue,
or track and strand columns). Test one Senior High file if possible.
