# Student Lifecycle: Grade 7 → Grade 12 Graduation

This document maps the complete journey of one student through the HI5 Portal system, from first enrollment in Grade 7 to graduation as a Grade 12 completer.

The lifecycle spans **6 school years** (e.g., SY 2025-2026 → SY 2030-2031) and involves **3 roles**: Admin (setup), Teacher (enrollment/grades/promotion), and Registrar (section assignment).

---

## The Per-Grade Cycle (G7 → G8 → G9 → G10 → G11 → G12)

Each school year follows the same 6-step pattern:

| # | Role | Step | Detail |
|---|------|------|--------|
| 1 | **Teacher** | **Enroll Student** | Teacher creates the enrollment record. New students (G7) require full details (LRN, name, grade level, etc.). Returning students (G8–G12) are looked up by LRN and auto-populate. **Section is left blank** — student goes to the Pending Section Queue. |
| 2 | **Registrar** | **Assign Section** | Registrar sees all unassigned students in the **Pending Section Queue** on the Section Assignment page. Assigns them via one of four workflows: Manual, Random, Placement, or Carryover. |
| 3 | **Teacher** | **Encode Grades** | Adviser enters Q1–Q4 grades per subject on Grade Management. Can be done cell-by-cell or uploaded via Excel template. |
| 4 | **Teacher** | **Lock Grades** | Teacher locks grades per subject to prevent further edits. Unlocking requires a correction request workflow. |
| 5 | **Teacher** | **Generate School Forms** | Generate SF1 (School Register), SF5 (Promotion Report), SF9 (Report Card), SF10 (Permanent Record) at any point during/after grade encoding. |
| 6 | **Teacher** | **Bulk Promotion** | At year-end, run Bulk Promotion on the section. This creates enrollment records for the **next grade level** in the **next school year** and updates `students.grade_level`. |

After step 6, the cycle **repeats** for the next grade level.

---

## The Complete 6-Year Timeline

```
SY 2025-2026          SY 2026-2027          SY 2027-2028          SY 2028-2029          SY 2029-2030          SY 2030-2031
    │                      │                      │                      │                      │                      │
  Grade 7 ──Promote──►  Grade 8 ──Promote──►  Grade 9 ──Promote──►  Grade 10 ──Promote──►  Grade 11 ──Promote──►  Grade 12 ──Completer──►  🎓
    │                      │                      │                      │                      │                      │
  New Student             Returning Student      Returning Student      Returning Student      SHS Entry              Final Year
  enrollment              enrollment             enrollment             enrollment             (choose strand)        (no promotion)
    │                      │                      │                      │                      │                      │
  Registrar assigns       Registrar assigns       Registrar assigns       Registrar assigns       Registrar assigns       N/A
  section                 section                 section                 section                 section
    │                      │                      │                      │                      │                      │
  Teacher encodes         Teacher encodes         Teacher encodes         Teacher encodes         Teacher encodes         Teacher encodes
  grades → locks          grades → locks          grades → locks          grades → locks          grades → locks          grades → locks
                                                                                                                        │
                                                                                                                   Mark as
                                                                                                                   Completers
```

---

## Detailed Steps by Phase

### Phase A: Grade 7 Entry (New Student)

1. **Admin prepares** the school year, subjects, sections, section types, and strand tracks
2. **Teacher** goes to **Enrollment → New Student** and fills in:
   - LRN, full name, birthdate, sex, address, guardian, contact
   - Grade Level: **7**
   - Program: **Regular (Standard K-12)** or SHS (for G11 only)
   - Does **NOT** select a section
   - Toggles a few requirements as submitted
   - Clicks **Enroll**
3. **System** creates the enrollment record with `section_id = NULL` and status `'enrolled'`
4. **Registrar** goes to **Section Assignment** → sees the student in **Pending Section Queue**
5. **Registrar** assigns to a section (e.g., 7-Diligence) using Manual, Random, or Placement workflow
6. **Teacher** views the student under **My Students** → sees them in the assigned section
7. **Teacher** encodes Q1–Q4 grades for all 12 subjects on **Grade Management**
8. **Teacher** locks grades per subject after encoding
9. **Teacher** generates School Forms (SF9 report card, SF10 permanent record)
10. **Teacher** runs **Bulk Promotion** → selects the section → sets target **Grade 8**
11. **System** creates new enrollment records in the **next school year** with the promoted student's data

### Phase B: Grade 8 → Grade 10 (Returning Student)

1. **Teacher** goes to **Enrollment → Returning Student**
2. Searches by the student's LRN
3. Student details auto-populate from the existing record
4. Selects the next grade level (**Grade 8** through **Grade 10**)
5. Does **NOT** select a section (leaves it blank)
6. Clicks **Enroll**
7. **Registrar** assigns section via Section Assignment (same as Phase A step 4-5)
8. **Teacher** encodes grades, locks, generates forms, and promotes (same as Phase A steps 6-11)

### Phase C: Grade 11 — SHS Entry (Strand Selection)

Same as Phase B, except:

1. When the Teacher selects **Grade 11**, the **Program** field offers SHS (Academic Track) / TVL tracks
2. A **Strand/Track** selector appears — Teacher picks a strand (e.g., STEM, ABM, HUMSS, TVL-ICT)
3. Grade 11 sections are typically strand-specific (e.g., 11-STEM-A, 11-ABM)

### Phase D: Grade 12 — Final Year

Same as Phase B for enrollment and grading, except:

1. **Bulk Promotion** button shows **"Mark as Completers"** with a purple theme instead of "Promote to Grade 13"
2. Clicking it calls `POST /api/promotions/complete` which:
   - Sets each student's enrollment status to `'completed'`
   - Updates each student's record to `status = 'graduated'`
   - Creates a promotion audit record
   - Decrements section `current_count`

---

## Role Responsibilities Summary

| Role | Responsibilities in Lifecycle |
|------|------------------------------|
| **Admin** | Create school years, subjects, sections, section types, strand tracks, manage users |
| **Teacher** | Enroll students, encode Q1-Q4 grades, lock grades, generate school forms, run bulk promotion, mark completers |
| **Registrar** | Assign sections from Pending Queue, monitor enrollment, generate certificates, run reports |
| **Principal** | View-only dashboards — enrollment figures, grade progress, promotion stats, at-risk students |

---

## Key Rules & Constraints

- **No promotion past Grade 12**: The backend rejects promote calls for Grade 12 with: `"Grade 12 students cannot be promoted. They should be marked as graduated."`
- **Only Grade 12 completes**: The `completeSection` endpoint validates that the section is Grade 12 — rejects if not.
- **Section assignment is optional at enrollment**: `section_id` is nullable; students without one appear as "Pending Section" until the Registrar assigns them.
- **Promotion creates next SY enrollment**: The promote endpoint auto-creates enrollment records in the next school year, linking the student to their new grade level.
- **Grades must be complete before promotion**: The promotion algorithm computes general averages from all graded subjects.
- **Retention is possible**: Students below the retention threshold (typically 75) are flagged as retained and stay in the same grade level.

---

## Accelerated Testing Approach

To walk one student through all 6 years in a single test session:

1. Pre-create 6 school years (Admin → Academic Year Management): `2025-2026`, `2026-2027`, `2027-2028`, `2028-2029`, `2029-2030`, `2030-2031`
2. Also pre-create sections for each grade level (Admin → Section Creation)
3. Set the **first SY as current**, do that year's steps:
   - Teacher enrolls → Registrar assigns section → Teacher grades → Teacher promotes
4. Switch current SY to the **next school year** (Admin → Academic Year Management)
5. Repeat: Teacher enrolls returning student → Registrar assigns section → Teacher grades → promotes
6. Continue until Grade 12, then **Mark as Completers**
