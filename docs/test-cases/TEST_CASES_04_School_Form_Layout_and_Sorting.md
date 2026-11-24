# Test Cases — School Form Layout, Sorting, and Section Assignment UI

**Covers:** the November 2026 fixes reported by the school — the misaligned SF1
register table, the SF10 school-name overflow and unreadable adviser name,
last-name sorting, and the hidden Single Placement tab.
**Prepared:** November 24, 2026

---

## How to use this file

- Test with the pre-loaded demo learners — nothing here changes learner data.
- Log in as `registrar01` unless the case says otherwise.

**Where things are:**

| Page | Path / Menu |
|---|---|
| School Forms | Registrar → **School Forms** → SF1 / SF5 / SF9 / SF10 |
| Student list | Registrar → **Students** |
| Section Assignment | Registrar → **Section Assignment** |

---

## SF1 — School Register

## SF1-1. The register table lines up (no shifted headers)

1. Open **SF1** for any section with enrolled learners.
2. Look at the two header rows above the learner columns.

**Expected:** Every group header sits exactly over its columns: **ADDRESS** spans **5** sub-columns (House #/Street/Sitio/Purok, Barangay, Municipality/City, Province, **ZIP**); **PARENTS** over Father's Name + Mother's Maiden Name; **GUARDIAN** over Name + Relationship. No header text bleeds into the neighboring column, and every learner column has a header above it.

☐ Pass ☐ Fail

---

## SF1-2. The ZIP column prints

1. Pick a learner whose ZIP code is stored (Registrar → Students → profile → Edit Details shows a ZIP value).
2. Look at their SF1 row, ZIP column.

**Expected:** The ZIP prints in its own column — not squeezed into Province, not empty when a ZIP is stored.

☐ Pass ☐ Fail

---

## SF1-3. REMARKS shows 4Ps / PWD

1. Find a learner tagged **4Ps** or **PWD** (their profile shows the classification).
2. Look at their SF1 row, REMARKS column.

**Expected:** The legend code `4Ps` and/or `PWD` appears in REMARKS. (SHS learners additionally show their Track / Electives notes there.)

☐ Pass ☐ Fail

---

## SF1-4. Learner rows are alphabetical by surname

1. Look at the SF1 learner rows for a mixed section.

**Expected:** Rows are ordered **A→Z by surname** (e.g. "Bautista, Rhea" before "Dela Cruz, Juan Pedro Jr."), ignoring the suffix when ordering.

☐ Pass ☐ Fail

---

# SF10 — Scholastic Record

## SF10-1. The school name stays inside its field

1. Open **SF10** for any learner and scroll to a **SCHOLASTIC RECORD** block.
2. Look at the first row of the yellow-bordered block: `School:` / `School ID:` / `District:` / `Division:` / `Region:`.

**Expected:** Even with a long school name, the value stays **inside the School field** — it never spills over the School ID field. (The school field is wider than before; a very long name shrinks its font instead of overflowing.)

☐ Pass ☐ Fail

---

## SF10-2. The adviser's name is readable

1. Look at the second row of the same block: `Classified as Grade:` / `Section:` / `School Year:` / `Name of Adviser/Teacher:` / `Signature:`.

**Expected:** The adviser field is now **wide** — the full teacher name is readable at normal size (previously it was squeezed into a sliver). Export or print the SF10 and check the PDF shows the same.

☐ Pass ☐ Fail

---

## SF10-3. SHS learners: Track/Strand on its own line

1. Open SF10 for a **Grade 11 or 12** learner.

**Expected:** The **Track/Strand** field appears on its own line inside the block (below the other fields) — nothing overlaps, nothing is cut off. For JHS learners (Grade 7–10) no Track field appears.

☐ Pass ☐ Fail

---

# Sorting

## SORT-1. The student list sorts by surname

1. Registrar → **Students** → sort the list by **Name**.

**Expected:** Learners are ordered **A→Z by surname** — "Bautista, Rhea" comes before "Dela Cruz, Juan Pedro Jr." even though "Dela" starts with D and the first names start with A–Z letters. The suffix is ignored for ordering.

☐ Pass ☐ Fail

---

## SORT-2. Other lists follow the same rule

1. Open the **Enrollment Report** and sort by Name; open **Section Assignment** and sort the queue by Name; (as a Teacher, open **My Students** and sort by Name).

**Expected:** All of them order by **surname** first, then given names — the same everywhere.

☐ Pass ☐ Fail

---

# Section Assignment UI

## SA-1. Single Placement is hidden

**Log in as:** `registrar01` (or committee01)
1. Registrar → **Section Assignment**.
2. Look at the tabs.

**Expected:** Only **Random (Gender-Balanced)**, **STE/SPFL (Eligibility)**, **Carry-Over (Prior Section)**, and **Manual Assignment** tabs are visible. There is **no** "Single Placement" tab.

☐ Pass ☐ Fail

---

## SA-2. The System Guide no longer mentions it

1. Open the **System Guide** → the Enrollment Committee role card and the "Assign Students to Sections" how-to.

**Expected:** Only Manual / Random / Placement / Carryover methods are named. No "Single Placement" anywhere.

☐ Pass ☐ Fail

---

## Sign-off

| Tested by | Date | Result |
|---|---|---|
| | | |
