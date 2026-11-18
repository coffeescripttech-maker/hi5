# Hi5 Portal: Student Details Edit --- Expected Behavior

**For the repository holder**\
**Prepared:** November 9, 2026

> **Basis:** Current code report (`PUT /api/students/:id`,
> `sf_form_edits`, `activity_logs`).

## 1. Purpose

Let staff correct a learner's details after enrollment, for example a
misspelled name or an incorrect LRN, with checks that prevent bad data,
a permanent history of every change, and no stale values left on the
School Forms.

There is **no approval step**. Safety comes from validation, required
reasons, history, and notifications.

## 2. Who Can Edit

  -----------------------------------------------------------------------
  Role              Routine fields    Identity fields   Closed school
                                                        year
  ----------------- ----------------- ----------------- -----------------
  Enrollment        Yes               Yes, with reason  No
  Committee                                             

  Registrar         Yes               Yes, with reason  Administrator
                                                        only (see Section
                                                        5)

  Administrator     Yes               Yes, with reason  Yes, with reason

  Teacher,          No                No                No
  Principal                                             
  -----------------------------------------------------------------------

## 3. Field Groups

  -----------------------------------------------------------------------
  Group                   Fields                  Rule
  ----------------------- ----------------------- -----------------------
  **Routine**             Address parts, contact  Edit freely. Every
                          number, guardian name   change is logged in the
                          and relationship,       change history.
                          father, mother, mother  
                          tongue, IP, religion,   
                          4Ps, PWD, height,       
                          weight                  

  **Identity**            First, middle, and last Reason required.
                          name; name suffix; LRN; Confirmation dialog.
                          birthdate; sex          Change history, SF
                                                  override reset, and
                                                  Registrar notification
                                                  (see Sections 4 and 5).

  **Not editable here**   Student ID, grade       Changed only through
                          level, section, status, their own flows
                          grades                  (enrollment,
                                                  sectioning, promotion,
                                                  grade encoding).
  -----------------------------------------------------------------------

## 4. Edit Flow

1.  The user opens a learner record and selects **Edit details**. Fields
    are pre-filled with current values. **Save** stays disabled until
    something changes.
2.  Changed fields are highlighted with the old value and new value.
3.  If an identity field changed, the user must choose a reason:
    -   Typo
    -   Per birth certificate
    -   Per LIS or LRN record
    -   Other, with a short note

    The reason is required.
4.  A confirmation dialog lists each change and its effects:
    -   School Forms with saved edits that will be reset
    -   Grade templates that must be re-downloaded (LRN only)
    -   Issued documents that will keep the old value
5.  On confirmation, everything happens in **one transaction**:
    -   Update the learner
    -   Write the change history
    -   Reset conflicting saved SF edits
    -   Send notifications

    If any step fails, nothing is saved.
6.  If the record was changed by someone else after the form was opened,
    the save returns a conflict message and shows the latest values
    (following the same pattern as the SF saved-edit conflict).

## 5. Validation and Rules

-   **LRN:** Exactly 12 digits and unique. If another learner has it,
    block the save and identify that learner. This check is currently
    missing from the update endpoint.
-   **Name:** First and last name are required. Trim extra spaces.
    Suffix must come from the list: `Jr.`, `Sr.`, `II`, `III`, `IV`,
    `V`, `Other`. Names are stored as separate parts, and the full name
    is composed by one shared formatter.
-   **Birthdate:** Must be a valid past date. Warn, but do not block, if
    the age is unusual for the grade level.
-   **Sex:** Must be `male` or `female`.
-   **Duplicate warning:** After a name, suffix, or birthdate change,
    warn if another learner matches. Warn only, since twins and similar
    names exist.
-   **After grades exist or an SF was generated:** Identity edits are
    still allowed, but the Registrar is notified in the app with the old
    and new values.
-   **After the school year is closed or promotion is done:** Identity
    fields are locked for the Enrollment Committee and Registrar. Only
    the Administrator can change them, with a reason.
-   **Archived learners:** Only the Administrator can edit them.

## 6. Effect on School Forms

-   SF1, SF5, SF9, and SF10 are generated from the learner record, so a
    correction appears on all four automatically.
-   A saved SF edit currently overrides the learner record. When an
    identity field changes, the system finds saved edits for that field
    for this learner in the open school year, resets them, and records
    the removed values in the change history. The confirmation dialog
    lists which forms are affected.
-   Saved edits in closed school years are not touched.
-   If a saved edit still differs from the learner record (for example,
    a header or signer field), the form shows the existing
    **Edited-fields** flag so nobody prints a stale value by accident.

## 7. History and Audit

-   A change history table stores:
    -   Learner
    -   Field
    -   Old value
    -   New value
    -   Reason
    -   Who changed it
    -   When it was changed

    This history is not purged, because the Activity Log is cleaned up
    after 90 days by default.
-   The learner record has a **History** tab showing this list, visible
    to the Enrollment Committee, Registrar, and Administrator.
-   The Activity Log also gets a short entry per save, with the learner
    and field names, for the Administrator's log view.
-   Reset SF edits are recorded in the same history.

## 8. Known Side Effects to Surface in the Screen

-   **LRN change:** Grade rows are linked by student ID, so grades are
    safe. The Excel grade import matches on LRN, so previously
    downloaded templates and workbooks fail with
    `LRN is not on this class roster` and must be downloaded again.
-   **Issued documents:** Certificates and LIS exports already issued
    keep the old name or LRN. The system cannot recall them.
-   **SF5:** For Grade 11 and above, the track is appended to the name
    cell, so the shared name formatter must handle this once, not
    separately in each form.
