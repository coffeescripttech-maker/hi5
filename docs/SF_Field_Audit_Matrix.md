# School Form Field Audit Matrix

**Purpose (client revision C):** classify every available learner/school
field by how it relates to the School Forms — **Shown**, **Stored but Not
Shown**, or **Not Stored (design decision needed)** — so any stored data
that has a corresponding form field automatically populates it.
**After:** LIS Import Phase 2 (SF1 DB population) — 2026-11-18.

Legend: ✅ Shown (populated from the stored value) · ✏️ Edit-only (saved
School Form edits / typed on the form) · 🟡 Stored but Not Shown · ⬜ Not
Stored (design decision) · 🔷 Derived by the system.

---

## SF1 — School Register

| Field | Status | Source |
|---|---|---|
| School Name / ID / Region / Division / District | ✅ | `school_settings` |
| School Year | ✅ | `school_years` (current label) |
| Registered counts (M / F / Total) | 🔷 (edit ✏️) | derived from enrollments; saved edits override |
| BoSY / EoSY dates | ✅ (edit ✏️) | `school_years.enrollment_start/end_date`; edits override |
| LRN | ✅ | `students.lrn` |
| Name (Last, First, Middle + Suffix) | ✅ | `students.name` + name parts (shared formatter; suffix included) |
| Sex | ✅ | `students.sex` (M/F derived) |
| Birthdate | ✅ | `students.birthdate` |
| Age as of 1st Friday of June | 🔷 | derived from birthdate |
| Mother Tongue | ✅ **(new — LIS Phase 2)** | `students.mother_tongue` |
| IP (Ethnic Group) | ✅ **(new)** | `students.ip_ethnic_group` |
| Religion | ✅ **(new)** | `students.religion` |
| House #/Street/Sitio/Purok | ✅ **(new)** | `students.house_street` |
| Barangay | ✅ **(new)** | `students.barangay` |
| Municipality/City | ✅ **(new)** | `students.city_municipality` |
| Province | ✅ **(new)** | `students.province` |
| Father's Name | ✅ **(new)** | `students.father_name` |
| Mother's Maiden Name | ✅ **(new)** | `students.mother_name` |
| Guardian Name | ✅ | `students.guardian` |
| Guardian Relationship | ✅ **(new)** | `students.guardian_relationship` |
| Contact Number | ✅ | `students.contact` |
| Remarks (SHS track + electives) | 🔷 (edit ✏️) | derived for G11–G12; edits override |
| ZIP | 🟡 | `students.zip_code` stored (LIS-importable) — **no SF1 column yet** (adding one changes the sheet layout; queued) |
| Height / Weight | 🟡 | `students.height_cm / weight_cm` — no SF1 column (official SF1 2022 has none; SF2/health forms use them) |
| 4Ps member | 🟡 | `students.guardian_4ps` — prints via the REMARKS legend in practice; classify before wiring |
| PWD / SNED tag | 🟡 | `student_classifications` — legend-driven remarks; SNED rule unchanged per client |
| Learner Student-ID (ID no.) | 🟡 | `students.student_id` — official SF1 has no ID column |
| Prepared by / Certified signatures | ✏️ | saved SF edits + `school_settings.principal_name` |

## SF5 — Promotion Report

| Field | Status | Source |
|---|---|---|
| Learner Name (+ suffix) | ✅ | `students.name` |
| Track / Strand (G11+) | ✅ | `enrollments.strand_track_id` → `strand_tracks` |
| Subject final ratings | ✅ | `grades` |
| General Average | 🔷 | derived |
| Promotion status (Promoted/Retained) | 🔷 | derived vs passing grade 75 |
| Section / grade level | ✅ | `enrollments` + `sections` |
| Signatures | ✏️ | saved edits + settings |

## SF9 — Progress Report Card

| Field | Status | Source |
|---|---|---|
| Name (Last / First / Middle) | ✅ **uppercase display (item B)** | `students.name` parts |
| Name Suffix | ✅ **(new — item B)** | `students.name_ext` |
| LRN grid | ✅ | `students.lrn` |
| Sex / Age | ✅ / 🔷 | `students.sex` / derived from birthdate |
| School / SY / Grade & Section | ✅ | school settings + enrollment |
| Subject rows (Q1–Q3, Final, Remarks) | ✅ | `grades` (MAPEH/TLE grouped) |
| General Average | 🔷 | derived |
| Observed values (AO/SO/RO/NO) | ✅ | `sf9_form_data` |
| Attendance (months / days) | ✏️ | saved SF edits (teacher: own advisory only) |
| Signatures (Principal / Adviser) | ✏️ | saved edits + settings prefill |

## SF10 — Permanent Record

| Field | Status | Source |
|---|---|---|
| Last / First / Middle Name | ✅ **uppercase display (item B)** | `students.name` parts |
| Name Extension (Jr., II, …) | ✅ **(new — item B)** | `students.name_ext` |
| LRN grid | ✅ | `students.lrn` |
| Sex / Birthdate | ✅ | `students.sex / birthdate` |
| School / School ID / Division / Region | ✅ | `school_settings` |
| Scholastic Record table (per SY: subjects Q1–Q3, Final Rating, Remarks) | ✅ | `grades` per school year |
| School per SY (name + ID) | ✅ | `school_settings` (the SY's school identity) |
| Section / Adviser per SY | ✅ / ✏️ | `enrollments` + `sections` (adviser name editable) |
| General Average per SY | 🔷 | derived |
| Remedial Classes rows | ✏️ | saved SF10 edits |
| Eligibility for JHS block (Elementary school completer, PEPT / ALS A&E, testing center) | ⬜ | **Not stored** — edit-only; storing requires a design decision (separate table or learner columns) |
| Certification block (date, principal name) | ✏️ | saved edits + settings prefill |
| Learner address / guardian / contact | 🟡 | stored on the learner — the rendered SF10 learner block has **no address/guardian fields** (official JHS SF10 layout); classify before adding |

---

## Queued decisions (from the 🟡 rows)

1. **SF1 ZIP column** — ✅ **DONE (2026-11-20)**: the ZIP column was added to
   the SF1 sheet (funded by narrowing the father/mother columns; the total
   width stays within the 1467px print budget) and reads
   `students.zip_code`.
2. **SF10 learner address/guardian block** — confirm with the client whether
   the school's SF10 variant includes it before adding cells.
3. **4Ps / PWD on SF1 remarks** — ✅ **DONE (2026-11-20)**: the SF1 REMARKS
   cell now derives the `4Ps` / `PWD` legend codes from the learner's
   classifications (kept for SHS Track / Electives notes).
4. **SF5 suffix bug** — ✅ **FIXED (2026-11-20)**: SF5's local name formatter
   popped the last word as the surname, turning "Juan Dela Cruz Jr." into
   "Jr., Juan Dela Cruz". It now uses the shared suffix-aware
   `parseName` formatter (same as SF1/SF9/SF10).
