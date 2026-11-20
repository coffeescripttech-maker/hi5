# LIS Import — Phased Implementation Plan

**Source:** `docs/Hi5_Portal_LIS_Import_Expected_Behavior.md` (client, 2026-11-09)
**Status:** **ALL CORE PHASES DONE (2026-11-20).** Phase 1 (migrations 050/051,
name formatter, backfill), Phase 2 (SF1 reads the DB + Field Audit Matrix +
Name Suffix), Student Details Edit, Phase 3 (import engine) and Phase 4
(Registrar UI) are implemented, runtime-verified and committed
(de9db0b, 7f84355, 64e9bfb, 1eded11, 5fbec5f). Remaining: calibration against
a real school LIS export file (the mapping UI is user-adjustable, so not
blocking); Phase 5 optional items.
**Companion spec received:** `docs/Hi5_Portal_Student_Details_Edit_Expected_Behavior.md`
— its §7 change-history design matches the `student_field_history` table built
in Phase 1 (learner, field, old→new, reason, who, when + batch id). The Edit
feature itself is a later phase; the table is designed for both.
**Goal:** Let the Registrar/Administrator import a DepEd LIS learner file to
fill missing learner details that print on SF1 and other School Forms —
**without** touching enrollment, transfer, status, or grade data, and
**without breaking** the currently working system.

---

## 0. Ground truth (verified against the live DB + code)

- `students` today has ONE name column (`name varchar(150)`), one `address`
  text column, `guardian`, `contact`, `sex` enum, `birthdate`. It has **no**
  mother tongue, IP, religion, father, mother, guardian-relationship, or
  address-part columns — exactly as the client doc states.
- SF1's learner cells (`mothertongue`, `ip`, `religion`, `addr_house`,
  `addr_barangay`, `addr_city`, `addr_province`, `father`, `mother`,
  `guardian_name`, `guardian_rel`, `contact`) are **edit-only**: they print
  from saved SF edits, and there are currently **zero** saved rows for those
  keys — a clean slate.
- Latest migration on record: **049**. New migrations start at **050**.
- The XLSX parse library the grade-template importer uses is already in the
  project (also reads .xls/.csv) — reusable.
- `docs/proposed_revision_after_defense.txt` is **empty (0 bytes)** — the
  sibling "student details edit + change history" revision the LIS doc
  depends on has no written spec yet. The change-history table below is
  designed generically so both features can share it.

---

## Phase 0 — Prerequisites & decisions (no code)

| # | Task | Owner |
|---|------|-------|
| LIS-0.1 | Obtain a **real LIS export file** from the school (the doc itself says column names are unconfirmed; the mapping UI will be built tolerant meanwhile) | Client |
| LIS-0.2 | Ask client for the **student-details-edit / change-history** revision doc (referenced as a dependency; the txt they sent is empty) | Client |
| LIS-0.3 | Decide name storage: **add name-part columns** (`last_name`, `first_name`, `middle_name`, `name_ext`) + a shared formatter (recommended — the doc says "separate name parts"), vs formatter-only | Client/dev |
| LIS-0.4 | Confirm address-parts vs the old single `address` column: parts become the SF1 source; single column kept as fallback when parts are empty | Dev |

---

## Phase 1 — Foundations (additive; zero behavior change) — ✅ DONE

| # | Task | Notes |
|---|------|-------|
| LIS-1.1 | ✅ **Migration 050** — new nullable `students` columns: `mother_tongue`, `ip_ethnic_group`, `religion`, `father_name`, `mother_name`, `guardian_relationship`, `house_street`, `barangay`, `city_municipality`, `province`, `zip_code`, + name parts `last_name`/`first_name`/`middle_name`/`name_ext`, + `idx_students_lrn` | Additive only; applied to production |
| LIS-1.2 | ✅ **Migration 051** — `student_field_history` table: `id, student_id, field, old_value, new_value, reason, changed_by, batch_id, created_at` + indexes. Shared by LIS import AND the Edit-details feature (its §7 matches) | Generic design |
| LIS-1.3 | ✅ **Shared name formatter** — `server/src/utils/nameFormatter.ts` (parse/join/compare, suffix handling) + client mirror `src/app/utils/nameFormatter.ts`; SF9/SF10 refactored to use it (their local copies removed) | 10/10 unit tests pass |
| LIS-1.4 | ✅ Backfill run — all 30 live learners have name parts from `name` via the formatter (`npm run backfill:name-parts`, idempotent) | Create/update now write parts through |
| LIS-1.5 | ✅ Formatter unit tests added to `npm test` | Pure functions |

Phase-1 note on PWD: the Edit/LIS docs' "PWD" tag is handled through the
existing `student_classifications` flow (like 4Ps) in later phases — no extra
column required.

Acceptance: app behaves identically; forms unchanged; migrations applied to
production DB via the normal migration runner.

---

## Phase 2 — SF1 reads the database (the careful one)

| # | Task | Notes |
|---|------|-------|
| LIS-2.1 | `forms.controller getSF1` returns the new learner fields + address parts per learner | Additive fields in the payload |
| LIS-2.2 | SF1 page: learner cells now default to **DB values**; saved SF edits keep overriding (existing precedence untouched); `students.address` used only when parts are empty | Replaces the edit-only behavior the doc calls out |
| LIS-2.3 | Verify on the demo roster + screenshot regression before deploy | Gate: no visual diff on untouched cells |

Acceptance: SF1 prints whatever the DB holds; manual edits still work and
override; **Has saved SF edit** rows keep working.

---

## Phase 3 — LIS import backend (Registrar/Admin only)

| # | Task | Notes |
|---|------|-------|
| LIS-3.1 | `POST /api/lis-import/preview` — multipart upload (**≤10 MB**, `.xlsx/.xls/.csv`, processed **in memory, never stored**), + school year. Auto-detect header row, map columns via known-header dictionary; return mapping + per-row results. **No writes** | Reuse XLSX lib |
| LIS-3.2 | Row engine per the doc: **Matched will update / Matched no change / Mismatch (name·birthdate·sex — skip, list both) / Not in Hi5 (skip, never create) / Error (bad LRN, duplicate LRN in file, unreadable date/sex) / Has saved SF edit (flag, leave untouched)** | Name comparison via shared formatter |
| LIS-3.3 | Cleaning: trim names, `M/F → male/female`, dates `mm/dd/yyyy`, LRN as 12-digit text | Unit-tested (LIS-1.5) |
| LIS-3.4 | `POST /api/lis-import/apply` — per-field-group mode (`fill_empty_only` default / `overwrite`), single **transaction**; writes `student_field_history` rows (old→new, reason `LIS import`, user, batch id); one Activity Log summary entry; returns summary + downloadable report rows | Idempotent: second run = no changes |
| LIS-3.5 | Hard exclusions enforced: never import enrollment status, BOSY/EOSY, dropped/transferred, grades — Hi5's own flows stay the source of truth | Code-level denylist |
| LIS-3.6 | PWD / special-needs tags: import **only if the file has a clear column**, fill-if-empty, SNED rule untouched | |
| LIS-3.7 | Role guard: `registrar` + `admin` only; 10 MB cap; row cap (e.g. 5,000) | |

---

## Phase 4 — Registrar UI: "Import from LIS"

| # | Task | Notes |
|---|------|-------|
| LIS-4.1 | New page `/registrar/lis-import` (menu item hidden from other roles): file picker + SY selector → **mapping table** (auto-filled, user-adjustable) → **preview** (nothing saved) → per-group **Fill empty only / Overwrite** toggles → **Confirm** → result summary + **downloadable report** | Mismatch rows link to Edit details with reason `per LIS record` |
| LIS-4.2 | Empty/error states, progress indicator for big files, and the "importing the same file twice is safe" guarantee surfaced in the UI | |

---

## Phase 5 — Optional / later

| # | Task |
|---|------|
| LIS-5.1 | **Undo last import** — restore previous values from `student_field_history` by batch id (the doc marks this Optional) |
| LIS-5.2 | Calibrate header names/date/sex formats against the **real school LIS export** once it arrives (LIS-0.1) |
| LIS-5.3 | Client-acceptance pass mapping every section of the expected-behavior doc to a test case (T-LIS-01…) |

---

## Why this won't break the working system

1. **Additive migrations only** — no existing column is dropped or renamed;
   existing pages don't read the new columns until Phase 2 wires them.
2. **SF1 (Phase 2) is the only behavior change** and it is gated: saved SF
   edits keep overriding, fallback to the old single address, verified on the
   demo roster before deploy.
3. **Importer is write-isolated**: only whitelisted learner detail fields, a
   single transaction, full change history with a batch id (→ undoable), and
   hard exclusions for enrollment/status/grades.
4. **No file retention** — uploads are processed in memory and discarded, so
   no new storage surface for personal data.

## Open items for the client

1. Real LIS export file (LIS-0.1) — blocks final mapping, not the build.
2. The empty `proposed_revision_after_defense.txt` — is there a written spec
   for the student-details-edit feature that shares the change history?
3. Confirm name-part columns (LIS-0.3) — recommended.
