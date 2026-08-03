# HI5 Portal — End-to-End Test Guide

> **Purpose:** Walk through every feature from a fresh database, one step at a time.
> **Prerequisites:** Node.js, MySQL/MariaDB, XAMPP (or any MySQL server) running.

---

## Phase 0 — Database Setup

```bash
# 1. Drop and recreate the database
mysql -u root -e "DROP DATABASE IF EXISTS hi5_portal; CREATE DATABASE hi5_portal;"

# 2. Run migrations (creates all tables)
cd server
npx tsx src/config/migrate.ts

# 3. Seed the database (sample users, students, subjects, sections, etc.)
npx tsx src/config/seed.ts

# 4. Start the server
npx tsx src/index.ts

# 5. In another terminal, start the frontend
cd ..
npm run dev
```

**Default logins** (password: `password123` for all):

| Role | Username | Name |
|------|----------|------|
| Admin | `admin` | System Administrator |
| Teacher | `teacher01` | Mr. Ramon Dela Cruz |
| Teacher | `teacher02` | Ms. Linda Fernandez |
| Teacher | `teacher03` | Mr. Eduardo Ocampo |
| Teacher | `teacher05` | Mr. Fernando Castro |
| Registrar | `registrar01` | Ms. Carla Reyes |
| Registrar | `registrar02` | Mr. Dennis Soriano |

---

## Phase 1 — Admin Setup (ICT Coordinator)

### 1.1 Login & Dashboard
1. Open `http://localhost:5173/login`
2. Login as **admin** / `password123`
3. **Verify:** Dashboard loads with blue/navy theme
4. **Verify:** Sidebar shows: Dashboard, User Management, Subject Management, Section Creation, School Settings, Database Backup, LIS Export, Activity Logs

### 1.2 View School Settings
1. Go to **School Settings** in sidebar
2. **Verify:** School name shows "Don Servillano Platon Memorial National High School"
3. **Verify:** Section type thresholds are visible (STE, Regular, SPFL, SPJ, Non-Reader with grade ranges)
4. ⚠️ **Test the bug fix:** Scroll through all section types — none should crash with "Cannot read properties of undefined (reading 'max_average')"
5. Expand a section type card (click it) — verify min/max average inputs appear

### 1.3 Manage Users
1. Go to **User Management**
2. **Verify:** 8 seeded users are listed (admin, teacher01-05, registrar01-02)
3. Click **Create User** — fill in a new teacher account:
   - Username: `testteacher`, Password: `password123`, Name: `Test Teacher`
   - Role: Teacher, Email: `test@school.edu.ph`
   - Status: Active
4. Click **Save** — verify success toast
5. **Verify:** New user appears in the table

### 1.4 Configure School Year
1. Go to **Academic Year Mgmt.**
2. **Verify:** SY `2025-2026` is current and enrollment is OPEN
3. **Verify:** SY `2026-2027` exists but is NOT current
4. Toggle enrollment OPEN/OFF for SY 2025-2026 — verify it changes

### 1.5 View/Edit Subjects
1. Go to **Subject Management**
2. **Verify:** 72 subjects exist (12 subjects × 6 grade levels 7–12)
3. **Verify:** MAPEH appears as 4 separate subjects (Music, Arts, Physical Education, Health)
4. Edit a subject name or hours — verify save works

### 1.6 View/Edit Sections
1. Go to **Section Creation**
2. **Verify:** 13 sections exist across Grades 7–12
3. **Verify:** Different section types appear (STE, SPFL, SPJ, Regular)
4. Click **Manage Types** button — verify modal lists section types with their icons and colors
5. Try creating a new section type — verify it appears in the dropdown

### 1.7 Database Backup
1. Go to **Database Backup**
2. Click **Create Backup** — verify backup runs successfully
3. **Verify:** Backup appears in the list with file size
4. ⚠️ **Test the bug fix:** If you got `'"mysqldump"' not recognized`, the `.env` file now has `MYSQLDUMP_PATH` set — it should work

### 1.8 Activity Logs
1. Go to **Activity Logs**
2. **Verify:** Seeded activity logs are visible
3. Perform an action (e.g., create a user in User Management) — go back to logs and verify the new action appears

### 1.9 LIS Export
1. Go to **LIS Export**
2. **Verify:** Export options are available (learner profile, grades, enrolled list)

---

## Phase 2 — Teacher: Enrollment

### 2.1 Login as Teacher
1. Logout, login as **teacher01** / `password123`
2. **Verify:** Green theme, teacher sidebar with: Dashboard, Enrollment, My Students, Section Management, School Forms, Grade Management, etc.

### 2.2 Enroll a New Student (Grade 7)
1. Go to **Enrollment**
2. Click the **New Student** tab
3. Fill in:
   - LRN: `223344556677`
   - Name: `Juan Tamad`
   - Grade Level: **7**
   - Sex: **Male**
   - Birthdate: `2012-01-15`
   - Address, Guardian, Contact: any values
   - Program: **Regular (Standard K-12)**
4. ⚠️ **Do NOT select a section** — the Teacher enrolls without section assignment. The Registrar will assign the section later.
5. In the requirements checklist, toggle a few items as submitted
6. Click **Enroll**
7. **Verify:** Success message — student enrolled (with section showing as "Pending Section")

### 2.3 Enroll a New Student (Grade 11 — SHS)
1. Go back to **Enrollment** → **New Student**
2. Fill in:
   - LRN: `334455667788`
   - Name: `Maria Clara`
   - Grade Level: **11**
   - Sex: **Female**
   - Birthdate: `2008-03-20`
   - Program: **SHS (Academic Track)**
3. **Verify:** Strand/Track selector appears (since Grade 11)
4. Select **STEM** or any available strand
5. ⚠️ Again, **do NOT select a section** — leave it blank. Section will be assigned by the Registrar.
6. Submit requirements and enroll
7. **Verify:** Success — student shows "Pending Section"

### 2.4 Enroll a Returning Student
1. Go to **Enrollment** → **Returning Student**
2. Search by LRN: `123456789021` (Mark Bautista — currently "pending" status)
3. **Verify:** Student details auto-populate
4. Select Grade 8, Regular program
5. ⚠️ **Do NOT assign a section** — leave section blank. The Registrar will assign it via Section Assignment.
6. Click **Enroll**
7. **Verify:** Success — student enrolled with "Pending Section"

### 2.5 Enroll Balik-Aral (by LRN lookup)
1. Go to **Enrollment** → **Returning Student**
2. Type an LRN not in the system (e.g., `998877665544`)
3. **Verify:** "Student not found" or creates a new record flow

### 2.6 Verify Document Completion
1. Switch to **registrar01** account
2. Go to **Document Completion**
3. Select section **7-Diligence**
4. **Verify:** Juan Tamad appears in the table with requirement checkmarks
5. **Verify:** Summary cards show student count, completion rate

---

## Phase 3 — Teacher: Grade Encoding

### 3.1 View Class List
1. Login as **teacher01** (adviser of 7-Mabini / 7-Star)
2. Go to **My Students**
3. **Verify:** Seeded students appear in the section

### 3.2 Encode Grades
1. Go to **Grade Management**
2. Select section **7-Mabini** (or "7-Star" depending on seed mapping)
3. Select a student (e.g., Maria Santos — student_id 1, already has some grades)
4. **Verify:** 12 subject rows appear (including separate MAPEH: Music, Arts, PE, Health)
5. Click on a grade cell and enter values for a student who has no grades yet
   - Enter Q1–Q4 grades for 3 subjects
6. Click **Save**
7. **Verify:** Toast confirms grades saved

### 3.3 Upload Grades via Template
1. Go to **Upload Grades**
2. Download the template (Excel file)
3. Fill in grades for a few students
4. Upload the file back
5. **Verify:** Validation preview shows before saving

### 3.4 Lock Grades
1. Go to **Grade Management**
2. Select a section
3. Click **Lock Grades** for a subject
4. **Verify:** Confirmation modal appears
5. Confirm — grades are locked
6. **Verify:** Subject shows locked status

### 3.5 Grade Correction Request
1. While grades are locked, try editing a grade cell
2. **Verify:** Correction request modal appears (instead of direct edit)
3. Submit a correction reason
4. Record appears for registrar/admin to review

### 3.6 View Document Management
1. Go to **Document Management**
2. **Verify:** Grade submission status per subject is visible
3. **Verify:** Shows which subjects have submitted/locked grades

---

## Phase 4 — Teacher: Reports & Promotion

### 4.1 Generate School Forms (SF1, SF5, SF9, SF10)
1. Go to **School Forms** → **SF1 — School Register**
2. Select section and grade level
3. **Verify:** PDF generates with student list
4. Go to **SF9 — Report Card**
5. Select a student (e.g., Maria Santos)
6. **Verify:** Report card preview appears with grades per quarter
7. Click **Export PDF** — verify PDF downloads

### 4.2 AI At-Risk Detection
1. Go to **At-Risk Detection**
2. **Verify:** Students with declining grade trajectories are flagged
3. **Verify:** Color-coded badges: Green (On Track), Yellow (Needs Monitoring), Red (At-Risk)
4. If no data yet, seed some grades or encode low grades for a student

### 4.3 Bulk Promotion
1. Ensure a section has complete grades
2. Go to **Bulk Promotion**
3. Select a Grade 7 section
4. Set target grade: **Grade 8**
5. Click **Promote**
6. **Verify:** Success modal shows promoted students count
7. **Verify:** Promotion record appears in history

### 4.4 Grade 12 → Completers
1. Go to **Bulk Promotion**
2. Select a Grade 12 section (e.g., **12-Jacinto**)
3. **Verify:** UI switches to purple theme — "Mark as Completers" button
4. Click **Mark as Completers**
5. **Verify:** Success modal for completers

---

## Phase 5 — Registrar: Monitoring & Reports

### 5.1 Registrar Dashboard
1. Login as **registrar01** / `password123`
2. **Verify:** Dashboard shows:
   - Total enrolled students
   - Gender breakdown card (male/female counts with bar)
   - Classification summaries (4Ps, PWD, Transferee)
   - Enrollment per grade bar chart

### 5.2 Student Search & Records
1. Go to **Student Search**
2. Search by name: `Maria`
3. **Verify:** Matching students appear
4. Click on a student — **Verify:** Full profile loads with enrollment history

### 5.3 Section Assignment (Key Step — Complete BEFORE 5.4)
1. Go to **Section Assignment**
2. **Verify "Pending Section Queue":** The students enrolled in Phase 2 (Juan Tamad, Maria Clara, Mark Bautista) appear here with no section assigned
3. **Assign each student to a section using one of these workflows:**
   - **Manual** — pick each student and assign to a section directly (good for testing)
   - **Random** — automatically distribute unassigned students across available sections
   - **Placement** — for STE/SPFL exam passers
   - **Carryover** — promote G11→G12 students
4. **Verify:** After assignment, students disappear from Pending Queue and appear in their target section
5. Switch to **teacher01** — go to **My Students** — **Verify:** Students now appear in their assigned sections

### 5.4 Enrollment Report (with Export)
1. Go to **Enrollment Report**
2. **Verify:** Table shows all enrolled students with LRN, Name, Sex, Grade, Section
3. **Verify:** Sex column shows Male/Female badges (not dashes)
4. **Verify:** Classification column shows classifications
5. Click **CSV** — verify CSV downloads with proper columns
6. Click **Excel** — verify .xls downloads (opens in Excel)
7. Click **PDF** — verify PDF renders with the full table
8. Click **Print** — verify print dialog opens
9. **Verify:** Charts section shows enrollment per grade bar chart + classification pie chart

### 5.5 Grade Distribution
1. Go to **Grade Distribution**
2. Select a grade level and section
3. **Verify:** Stacked bar chart shows per-subject grade distribution
4. **Verify:** Buckets: 90-100, 85-89, 80-84, 75-79, Below 75

### 5.6 Promotion Records
1. Go to **Promotion Records**
2. **Verify:** Shows promotion history from Phase 4

### 5.7 At-Risk Students (Read-Only)
1. Go to **At-Risk Students**
2. **Verify:** Same flagged students from teacher's at-risk detection, read-only view

### 5.8 Certificate Generation
1. Go to **Certificate of Enrollment**
2. Select a student
3. **Verify:** Certificate preview appears
4. Click **Export PDF** — verify PDF downloads
5. Go to **Good Moral Certificate** — repeat

### 5.9 Document Completion
1. Go to **Document Completion**
2. Select a section
3. **Verify:** Table shows all students with requirement checkmarks
4. **Verify:** Summary cards (Students, Fully Completed, Completion Rate)

---

## Phase 6 — Principal (View-Only)

### 6.1 Login as Principal
- Note: No principal user is seeded. Either:
  - Login as admin → User Management → create a principal account
  - Or use a pre-seeded principal if available

### 6.2 Verify View-Only Dashboards
1. **Dashboard** — school-wide overview with purple theme
2. **Enrollment Figures** — per-grade enrollment with gender breakdowns
3. **Enrollment Trend** — trend chart
4. **Section Population** — section population data
5. **Grade Progress** — grade submission completion across sections
6. **Promotion Stats** — promotion/retention statistics
7. **At-Risk Students** — read-only view

---

## Phase 7 — Cross-Cutting Tests

### 7.1 Database Backup & Restore
1. Login as **admin**
2. Go to **Database Backup**
3. Create a new backup — verify it succeeds
4. Click **Restore** on a backup — verify confirmation dialog
5. Confirm restore — verify success

### 7.2 SHS Track Management
1. Login as admin
2. Go to **Section Creation** → **Manage Types**
3. **Verify:** Strand/Track table is visible
4. Add/edit/delete a strand track

### 7.3 Teacher Schedule
1. Login as **teacher01**
2. Go to **My Schedule**
3. **Verify:** Weekly timetable grid is visible (may be empty if no schedules seeded)

### 7.4 Activity Logs
1. Login as admin
2. Go to **Activity Logs**
3. **Verify:** All actions from this test session are recorded

---

## Bug Verification Checklist

After implementing fixes, verify these specific items:

| Bug | Where to Test | Expected Result |
|-----|--------------|-----------------|
| `mysqldump` not recognized | Admin → Database Backup → Create Backup | Backup succeeds (uses MYSQLDUMP_PATH from .env) |
| `catch (err: any)` parse error | Teacher → Bulk Promotion | Page loads without syntax error |
| JSX sibling parse error | Teacher → Enrollment → Returning Student (step 3) | Page renders without syntax error |
| `VenusAndMars` missing export | Registrar → Dashboard | Dashboard loads without module error |
| `max_average` of undefined | Admin → School Settings | All section type cards render without crash |
| Duplicate catch block | Teacher → Bulk Promotion → Promote | Promotion succeeds or shows error toast once (not twice) |

---

## Data Flow Summary

```
Admin creates:  School Year → Subjects → Sections → Users
                              ↓
Teacher enrolls: New/Returning Students (no section assigned)
                              ↓
Registrar assigns: Section Assignment → Pending Queue → Assign to Section
                              ↓
Teacher encodes grades → Locks grades → Generates School Forms
                              ↓
Teacher promotes: Bulk Promotion next grade (G7→G8→G9→G10→G11→G12)
                              ↓
Grade 12 → Mark as Completers → Graduation
                              ↓
Registrar monitors: Dashboard → Reports → Certificates → At-Risk
                              ↓
Principal views: Enrollment Figures → Grade Progress → Promotion Stats
```
