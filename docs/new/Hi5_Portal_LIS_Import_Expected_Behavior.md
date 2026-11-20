# Hi5 Portal: LIS Import --- Expected Behavior

**For the repository holder**\
**Prepared:** November 9, 2026

> **Important:** The column names below are expected, not confirmed. The
> importer must be built against a real LIS export from the school.

## 1. Purpose

Let the Registrar import a DepEd LIS learner file to fill learner
details that Hi5 Portal does not yet hold, so they print automatically
on SF1 and the other School Forms instead of being typed by hand.

The import fills in **existing learners only**. It does not enroll
anyone and does not replace Hi5's own enrollment, transfer, or status
flows.

## 2. Who and Where

-   **Authorized users:** Registrar and Administrator. The file contains
    personal data for many learners, so importing is not available to
    other roles.
-   **Location:** Under the Registrar's tools as **Import from LIS**.
-   **Audit:** Every import is logged.

## 3. What Is Imported

  -----------------------------------------------------------------------
  LIS data                Destination             Behavior
  ----------------------- ----------------------- -----------------------
  LRN                     Match key               Never changed by
                                                  import. Used only to
                                                  find the learner.

  Full name, birthdate,   Identity fields         Compared, never
  sex                                             overwritten
                                                  automatically.
                                                  Differences go to a
                                                  mismatch list (see
                                                  Section 5).

  Mother tongue, IP       New learner fields      Fill if empty. Printed
  (ethnic group),                                 on SF1.
  religion                                        

  Address (house no. and  New address fields      Fill if empty. Printed
  street, barangay, city                          on SF1, replacing the
  or municipality,                                edit-only columns.
  province, ZIP)                                  

  Father, mother,         Learner fields          Fill if empty. Existing
  guardian name, guardian                         guardian and contact
  relationship, contact                           details are kept unless
  number                                          overwrite is chosen.

  Disability or special   PWD and classification  Import only if the file
  needs, other remarks    tags                    has a clear column.
                                                  Fill if empty. The
                                                  existing SNED tag rule
                                                  remains unchanged.
  -----------------------------------------------------------------------

### Data Not Imported

The importer must **not** import any of the following:

-   Enrollment status
-   BOSY and EOSY counts
-   Dropped status
-   Transferred-in and transferred-out status
-   Grades
-   Any other enrollment, transfer, or status-related data

Hi5's own enrollment, Transfer-In, and Transfer-Out flows remain the
source of truth for these values. The LIS import must not contradict or
modify them.

## 4. Import Flow

1.  The user chooses the file (`.xlsx`, `.xls`, or `.csv`, up to **10
    MB**) and the school year.
2.  The system finds the header row and automatically maps columns using
    known header names. The user can adjust any mapping before
    continuing.
3.  Cells are read as text and values are cleaned:
    -   Names are trimmed.
    -   Sex values `M` or `F` are converted to `male` or `female`.
    -   Dates are read as `mm/dd/yyyy`.
    -   LRNs are kept as 12-digit text.
4.  A preview is shown. **Nothing is saved yet.**
5.  For each field group, the user chooses one of the following:
    -   **Fill empty only** --- default
    -   **Overwrite**

    The user then presses **Confirm**.
6.  The import runs in one transaction. The system then shows a result
    summary with a downloadable report.

## 5. Preview and Matching Rules

  -----------------------------------------------------------------------
  Row result              Meaning                 Default action
  ----------------------- ----------------------- -----------------------
  **Matched, will         LRN found in Hi5; new   Update the selected
  update**                details are available   field groups.
                          to add.                 

  **Matched, no change**  Everything is already   Skip.
                          filled and equal.       

  **Mismatch**            The name, birthdate, or Do not change the
                          sex in the file differs learner. List both
                          from the corresponding  values. The Registrar
                          Hi5 value.              can correct the record
                                                  through **Edit
                                                  details**, using the
                                                  reason
                                                  `per LIS record`.

  **Not in Hi5**          The LRN is not enrolled Skip. Never create a
                          in Hi5 Portal.          learner.

  **Error**               Bad LRN (not 12         Skip and show the
                          digits), duplicate LRN  reason.
                          in the file, unreadable 
                          date, or unreadable     
                          sex.                    

  **Has saved SF edit**   A manually entered      Leave the saved edit
                          School Form value       untouched and flag it.
                          already exists for that 
                          field in the open       
                          school year.            
  -----------------------------------------------------------------------

## 6. Saving, History, and Safety

-   Each changed field is written to the change history with:
    -   Old value
    -   New value
    -   Reason: `LIS import`
    -   User
    -   Time
    -   Import batch ID
-   The Activity Log receives one summary entry per import.
-   The uploaded file is **not stored**. It is processed in memory and
    discarded. Only parsed values that are saved remain.
-   Importing the same file twice is safe: the second run shows no
    changes.
-   **Optional:** Provide an **Undo last import** feature. It restores
    the values changed by that batch using the change history.

## 7. Dependencies on Other Changes

The LIS import depends on the following changes:

-   **New learner columns:** Add fields for mother tongue, IP, religion,
    father, mother, guardian relationship, and address parts. These
    fields do not exist today.
-   **SF1 data source:** SF1 must read these fields, including the
    address, from the database. Today, these values are edit-only, and
    `students.address` is never read.
-   **Shared name formatter:** Use separate name parts and a shared name
    formatter so name comparison and suffix handling work consistently
    across every form.
-   **Change history:** Implement the change history table required by
    the student details edit feature.
-   **Real LIS sample file:** Obtain a real school LIS export to confirm
    the actual column names, header-row position, date formats, and sex
    formats before finalizing the importer.
