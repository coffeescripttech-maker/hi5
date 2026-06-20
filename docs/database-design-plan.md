# HI5 Portal — MySQL Database & Backend Design Plan

> **Project:** HI5 Portal — DSPMNHS School Management System  
> **Current State:** Frontend-only React SPA (~30 pages, no backend/API/database)  
> **Target:** Full-stack with MySQL + Node.js + Express REST API  
> **Style:** snake_case everywhere (TypeScript → MySQL → JSON API)  
> **Query Layer:** Direct MySQL2 driver + custom SQL (no ORM)

---

## Entity Relationships Summary

- **school_years** → enrollments, grades, promotions, at_risk_predictions
- **users** (unified: all roles in one table) → activity_logs, enrollments (enrolled_by), grade_corrections (requested_by/reviewed_by), promotions (promoted_by), backups, documents, at_risk_predictions, sections (adviser)
- **students** → enrollments, grades, grade_corrections, promotion_students, at_risk_predictions, student_classifications, documents
- **sections** → enrollments, teacher_section_assignments, promotions, promotion_students
- **subjects** → grades, teacher_subject_assignments, grade_corrections
- **teachers** (via `users` with `role = 'teacher'`) → teacher_section_assignments, teacher_subject_assignments, sections (adviser_id)

---

## MySQL Tables (21 Tables)

### 1. `school_years`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INT | PK AUTO_INCREMENT | |
| sy_label | VARCHAR(9) | NOT NULL UNIQUE | e.g. "2025-2026" |
| is_current | TINYINT(1) | NOT NULL DEFAULT 0 | Only one row can be 1 |
| enrollment_open | TINYINT(1) | NOT NULL DEFAULT 0 | Global enrollment toggle |
| enrollment_start_date | DATE | NULLABLE | |
| enrollment_end_date | DATE | NULLABLE | |
| created_at | DATETIME | DEFAULT NOW() | |
| updated_at | DATETIME | DEFAULT NOW() ON UPDATE | |

### 2. `users`

All system users (admin, teacher, registrar) in one table. Teacher employment info uses nullable columns.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INT | PK AUTO_INCREMENT | |
| username | VARCHAR(50) | NOT NULL UNIQUE | |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt hash |
| name | VARCHAR(150) | NOT NULL | Full name |
| email | VARCHAR(100) | NOT NULL UNIQUE | |
| role | ENUM('admin','teacher','registrar') | NOT NULL | |
| phone | VARCHAR(20) | NULLABLE | |
| address | TEXT | NULLABLE | |
| profile_photo_url | VARCHAR(255) | NULLABLE | File path |
| status | ENUM('active','idle','inactive') | NOT NULL DEFAULT 'active' | |
| employee_id | VARCHAR(30) | NULLABLE | e.g. "EMP-2019-001" |
| designation | VARCHAR(100) | NULLABLE | e.g. "Teacher I" |
| date_hired | DATE | NULLABLE | |
| last_login | DATETIME | NULLABLE | |
| login_attempts | TINYINT | NOT NULL DEFAULT 0 | Brute force tracking |
| locked_until | DATETIME | NULLABLE | Lockout expiry |
| created_at | DATETIME | DEFAULT NOW() | |
| updated_at | DATETIME | DEFAULT NOW() ON UPDATE | |

### 3. `students`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INT | PK AUTO_INCREMENT | Internal auto-increment ID |
| student_id | VARCHAR(20) | NOT NULL UNIQUE | Display ID like "2026-07-0001" |
| lrn | VARCHAR(12) | NOT NULL UNIQUE | 12-digit LRN |
| name | VARCHAR(150) | NOT NULL | |
| grade_level | TINYINT | NOT NULL | 7-12 |
| sex | ENUM('male','female') | NOT NULL | |
| birthdate | DATE | NOT NULL | |
| address | TEXT | NULLABLE | |
| guardian | VARCHAR(150) | NULLABLE | Parent/guardian name |
| contact | VARCHAR(20) | NULLABLE | Guardian contact |
| status | ENUM('enrolled','pending','dropped','transferred','graduated') | NOT NULL DEFAULT 'pending' | |
| created_at | DATETIME | DEFAULT NOW() | |
| updated_at | DATETIME | DEFAULT NOW() ON UPDATE | |

### 4. `student_classifications`

Flexible per-student, per-SY classification tags (4Ps, PWD, etc.).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INT | PK AUTO_INCREMENT | |
| student_id | INT | FK → students.id ON DELETE CASCADE | |
| classification | ENUM('4ps','pwd','transferee','non_reader','regular') | NOT NULL | |
| school_year_id | INT | FK → school_years.id | |
| created_at | DATETIME | DEFAULT NOW() | |
| **UNIQUE**( student_id, classification, school_year_id ) | | | |

### 5. `sections`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INT | PK AUTO_INCREMENT | |
| name | VARCHAR(30) | NOT NULL UNIQUE | e.g. "7-Star" |
| grade_level | TINYINT | NOT NULL | 7-12 |
| section_type | ENUM('star','gold','silver','regular','non_reader') | NOT NULL | |
| capacity | SMALLINT | NOT NULL | Max students |
| current_count | SMALLINT | NOT NULL DEFAULT 0 | Enrolled count |
| adviser_id | INT | FK → users.id ON DELETE SET NULL | Class adviser |
| min_average | DECIMAL(5,2) | NOT NULL | Min GA for this section |
| is_active | TINYINT(1) | NOT NULL DEFAULT 1 | Soft delete |
| created_at | DATETIME | DEFAULT NOW() | |
| updated_at | DATETIME | DEFAULT NOW() ON UPDATE | |

### 6. `section_type_config`

Configurable thresholds per grade for auto-sectioning.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INT | PK AUTO_INCREMENT | |
| section_type | ENUM('star','gold','silver','regular','non_reader') | NOT NULL | |
| grade_level | TINYINT | NOT NULL | Per-grade settings |
| min_average | DECIMAL(5,2) | NOT NULL | Floor average |
| max_average | DECIMAL(5,2) | NOT NULL | Ceiling average |
| color_code | VARCHAR(20) | NULLABLE | Tailwind/badge class |
| icon | VARCHAR(10) | NULLABLE | Emoji icon |
| **UNIQUE**( section_type, grade_level ) | | | |

### 7. `subjects`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INT | PK AUTO_INCREMENT | |
| name | VARCHAR(100) | NOT NULL | |
| grade_level | TINYINT | NOT NULL | 7-12 |
| hours_per_week | DECIMAL(4,1) | NOT NULL | |
| subject_type | ENUM('core','applied','specialized') | NOT NULL | |
| is_active | TINYINT(1) | NOT NULL DEFAULT 1 | Soft delete |
| created_at | DATETIME | DEFAULT NOW() | |
| updated_at | DATETIME | DEFAULT NOW() ON UPDATE | |
| **UNIQUE**( name, grade_level ) | | Subject name unique per grade | |

### 8. `teacher_subject_assignments`

Many-to-many: which teacher teaches which subject.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INT | PK AUTO_INCREMENT | |
| teacher_id | INT | FK → users.id ON DELETE CASCADE | role = 'teacher' |
| subject_id | INT | FK → subjects.id ON DELETE CASCADE | |
| school_year_id | INT | FK → school_years.id | |
| created_at | DATETIME | DEFAULT NOW() | |
| **UNIQUE**( teacher_id, subject_id, school_year_id ) | | | |

### 9. `teacher_section_assignments`

Many-to-many: which teacher handles which section (with adviser flag).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INT | PK AUTO_INCREMENT | |
| teacher_id | INT | FK → users.id ON DELETE CASCADE | role = 'teacher' |
| section_id | INT | FK → sections.id ON DELETE CASCADE | |
| school_year_id | INT | FK → school_years.id | |
| is_adviser | TINYINT(1) | NOT NULL DEFAULT 0 | Is this the class adviser? |
| created_at | DATETIME | DEFAULT NOW() | |
| **UNIQUE**( teacher_id, section_id, school_year_id ) | | | |

### 10. `enrollments`

One active enrollment per student per school year.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INT | PK AUTO_INCREMENT | |
| student_id | INT | FK → students.id ON DELETE CASCADE | |
| section_id | INT | FK → sections.id | |
| school_year_id | INT | FK → school_years.id | |
| enrollment_date | DATE | NOT NULL | |
| enrolled_by | INT | FK → users.id | Who enrolled |
| status | ENUM('enrolled','dropped','transferred') | NOT NULL DEFAULT 'enrolled' | |
| remarks | TEXT | NULLABLE | Reason if dropped/transferred |
| created_at | DATETIME | DEFAULT NOW() | |
| updated_at | DATETIME | DEFAULT NOW() ON UPDATE | |
| **UNIQUE**( student_id, school_year_id ) | | | |

### 11. `grades`

Normalized — one row per student per subject per quarter. API pivots to q1/q2/q3/q4 for frontend display.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INT | PK AUTO_INCREMENT | |
| student_id | INT | FK → students.id ON DELETE CASCADE | |
| subject_id | INT | FK → subjects.id | |
| enrollment_id | INT | FK → enrollments.id | |
| school_year_id | INT | FK → school_years.id | |
| quarter | TINYINT | NOT NULL | 1, 2, 3, or 4 |
| grade | DECIMAL(5,2) | NULLABLE | Numeric grade |
| is_locked | TINYINT(1) | NOT NULL DEFAULT 0 | Locked = final |
| locked_at | DATETIME | NULLABLE | |
| locked_by | INT | FK → users.id NULLABLE | |
| created_at | DATETIME | DEFAULT NOW() | |
| updated_at | DATETIME | DEFAULT NOW() ON UPDATE | |
| **UNIQUE**( student_id, subject_id, school_year_id, quarter ) | | | |

### 12. `grade_correction_requests`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INT | PK AUTO_INCREMENT | |
| student_id | INT | FK → students.id ON DELETE CASCADE | |
| subject_id | INT | FK → subjects.id | |
| school_year_id | INT | FK → school_years.id | |
| quarter | TINYINT | NULLABLE | If specific quarter |
| requested_by | INT | FK → users.id | The teacher |
| justification | TEXT | NOT NULL | |
| status | ENUM('pending','approved','rejected') | NOT NULL DEFAULT 'pending' | |
| reviewed_by | INT | FK → users.id NULLABLE | Registrar/Admin |
| reviewed_at | DATETIME | NULLABLE | |
| created_at | DATETIME | DEFAULT NOW() | |
| updated_at | DATETIME | DEFAULT NOW() ON UPDATE | |

### 13. `promotions`

Bulk promotion records — one per section promotion event.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INT | PK AUTO_INCREMENT | |
| section_id | INT | FK → sections.id | Source section |
| to_grade_level | TINYINT | NOT NULL | e.g. 7 → 8 |
| school_year_id | INT | FK → school_years.id | |
| promoted_by | INT | FK → users.id | Teacher who promoted |
| status | ENUM('completed','pending_review') | NOT NULL DEFAULT 'pending_review' | |
| created_at | DATETIME | DEFAULT NOW() | |

### 14. `promotion_students`

Individual student promotion results.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INT | PK AUTO_INCREMENT | |
| promotion_id | INT | FK → promotions.id ON DELETE CASCADE | |
| student_id | INT | FK → students.id | |
| from_section_id | INT | FK → sections.id | |
| to_section_id | INT | FK → sections.id NULLABLE | Set after re-sectioning |
| general_average | DECIMAL(5,2) | NULLABLE | GA at promotion time |
| is_retained | TINYINT(1) | NOT NULL DEFAULT 0 | GA < 75 = retained |
| created_at | DATETIME | DEFAULT NOW() | |

### 15. `at_risk_predictions`

AI Linear Regression model results per student per SY.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INT | PK AUTO_INCREMENT | |
| student_id | INT | FK → students.id ON DELETE CASCADE | |
| school_year_id | INT | FK → school_years.id | |
| q1_average | DECIMAL(5,2) | NULLABLE | Used in prediction |
| q2_average | DECIMAL(5,2) | NULLABLE | Used in prediction |
| q3_average | DECIMAL(5,2) | NULLABLE | Used in prediction |
| risk_score | DECIMAL(5,2) | NOT NULL | 0-100 scale |
| risk_level | ENUM('at_risk','needs_monitoring','on_track') | NOT NULL | |
| trend | ENUM('declining','stable','improving') | NOT NULL | Grade trajectory |
| predicted_by | INT | FK → users.id | Who ran the model |
| created_at | DATETIME | DEFAULT NOW() | |
| **UNIQUE**( student_id, school_year_id ) | | | |

### 16. `activity_logs`

System-wide audit trail.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | BIGINT | PK AUTO_INCREMENT | High volume expected |
| user_id | INT | FK → users.id ON DELETE SET NULL | |
| action | TEXT | NOT NULL | Human-readable |
| entity_type | VARCHAR(50) | NULLABLE | e.g. 'student', 'grade' |
| entity_id | VARCHAR(50) | NULLABLE | |
| created_at | DATETIME | DEFAULT NOW() | |
| INDEX( created_at ) | | For sorted queries | |

### 17. `backups`

Database backup records.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INT | PK AUTO_INCREMENT | |
| backup_type | ENUM('auto','manual') | NOT NULL | |
| file_path | VARCHAR(255) | NOT NULL | Server file path |
| file_size | BIGINT | NULLABLE | In bytes |
| record_count | INT | NULLABLE | |
| status | ENUM('success','failed','in_progress') | NOT NULL | |
| initiated_by | INT | FK → users.id NULLABLE | |
| created_at | DATETIME | DEFAULT NOW() | |

### 18. `uploaded_documents`

Uploaded files (grade sheets, PDFs, etc.).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INT | PK AUTO_INCREMENT | |
| student_id | INT | FK → students.id NULLABLE | Null if section-level |
| section_id | INT | FK → sections.id NULLABLE | |
| file_name | VARCHAR(255) | NOT NULL | Original filename |
| file_type | ENUM('pdf','xlsx','xls','docx') | NOT NULL | |
| file_path | VARCHAR(255) | NOT NULL | Storage path |
| file_size | INT | NULLABLE | In bytes |
| uploaded_by | INT | FK → users.id | |
| record_count | INT | NULLABLE | For grade uploads |
| quarter | TINYINT | NULLABLE | For grade uploads |
| status | ENUM('pending','validated','imported','failed') | NOT NULL DEFAULT 'pending' | Import status |
| created_at | DATETIME | DEFAULT NOW() | |

### 19. `notifications`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INT | PK AUTO_INCREMENT | |
| user_id | INT | FK → users.id NULLABLE | NULL = broadcast to role |
| role | ENUM('admin','teacher','registrar') | NULLABLE | Target role |
| type | ENUM('info','success','warning','error','security') | NOT NULL | |
| title | VARCHAR(200) | NOT NULL | |
| message | TEXT | NOT NULL | |
| created_at | DATETIME | DEFAULT NOW() | |

### 20. `notification_reads`

Read-receipt tracking per user.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | BIGINT | PK AUTO_INCREMENT | |
| notification_id | INT | FK → notifications.id ON DELETE CASCADE | |
| user_id | INT | FK → users.id ON DELETE CASCADE | |
| read_at | DATETIME | DEFAULT NOW() | |
| **UNIQUE**( notification_id, user_id ) | | | |

### 21. `school_settings`

Singleton — only one row.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INT | PK AUTO_INCREMENT | |
| school_name | VARCHAR(200) | NOT NULL | |
| school_id | VARCHAR(30) | NOT NULL | DepEd ID |
| region | VARCHAR(100) | NOT NULL | |
| division | VARCHAR(100) | NOT NULL | |
| district | VARCHAR(100) | NULLABLE | |
| current_sy_id | INT | FK → school_years.id | |
| updated_at | DATETIME | DEFAULT NOW() ON UPDATE | |

---

## Foreign Key Summary

| Table | FK Column | References | On Delete |
|---|---|---|---|
| student_classifications | student_id | students.id | CASCADE |
| student_classifications | school_year_id | school_years.id | — |
| sections | adviser_id | users.id | SET NULL |
| teacher_subject_assignments | teacher_id | users.id | CASCADE |
| teacher_subject_assignments | subject_id | subjects.id | CASCADE |
| teacher_subject_assignments | school_year_id | school_years.id | — |
| teacher_section_assignments | teacher_id | users.id | CASCADE |
| teacher_section_assignments | section_id | sections.id | CASCADE |
| teacher_section_assignments | school_year_id | school_years.id | — |
| enrollments | student_id | students.id | CASCADE |
| enrollments | section_id | sections.id | — |
| enrollments | school_year_id | school_years.id | — |
| enrollments | enrolled_by | users.id | — |
| grades | student_id | students.id | CASCADE |
| grades | subject_id | subjects.id | — |
| grades | enrollment_id | enrollments.id | — |
| grades | school_year_id | school_years.id | — |
| grades | locked_by | users.id | SET NULL |
| grade_correction_requests | student_id | students.id | CASCADE |
| grade_correction_requests | subject_id | subjects.id | — |
| grade_correction_requests | school_year_id | school_years.id | — |
| grade_correction_requests | requested_by | users.id | — |
| grade_correction_requests | reviewed_by | users.id | SET NULL |
| promotions | section_id | sections.id | — |
| promotions | school_year_id | school_years.id | — |
| promotions | promoted_by | users.id | — |
| promotion_students | promotion_id | promotions.id | CASCADE |
| promotion_students | student_id | students.id | — |
| promotion_students | from_section_id | sections.id | — |
| promotion_students | to_section_id | sections.id | SET NULL |
| at_risk_predictions | student_id | students.id | CASCADE |
| at_risk_predictions | school_year_id | school_years.id | — |
| at_risk_predictions | predicted_by | users.id | — |
| activity_logs | user_id | users.id | SET NULL |
| backups | initiated_by | users.id | SET NULL |
| uploaded_documents | student_id | students.id | SET NULL |
| uploaded_documents | section_id | sections.id | SET NULL |
| uploaded_documents | uploaded_by | users.id | — |
| notifications | user_id | users.id | SET NULL |
| notification_reads | notification_id | notifications.id | CASCADE |
| notification_reads | user_id | users.id | CASCADE |
| school_settings | current_sy_id | school_years.id | — |

---

## API Route Map

### Auth
| Method | Path | Role | Description |
|---|---|---|---|
| POST | /api/auth/login | All | Login → JWT token |
| POST | /api/auth/logout | All | Invalidate session |
| GET | /api/auth/me | All | Current user info |

### Users (Admin only)
| Method | Path | Description |
|---|---|---|
| GET | /api/users | List all users (filterable by role, status) |
| GET | /api/users/:id | Get user details |
| POST | /api/users | Create user account |
| PUT | /api/users/:id | Update user |
| DELETE | /api/users/:id | Delete user (deactivate) |

### Students (Teacher create/update, Registrar read)
| Method | Path | Description |
|---|---|---|
| GET | /api/students | List/search (filters: grade, section, sex, classification, search term) |
| GET | /api/students/:id | Full profile with enrollments, grades |
| POST | /api/students | Create student record |
| PUT | /api/students/:id | Update student info |
| POST | /api/students/:id/classifications | Add classification tag |

### Sections (Admin CRUD, Teacher/Registrar read)
| Method | Path | Description |
|---|---|---|
| GET | /api/sections | List (filter by grade) |
| GET | /api/sections/:id | Detail with enrolled students |
| POST | /api/sections | Create section (Admin) |
| PUT | /api/sections/:id | Update section (Admin) |
| DELETE | /api/sections/:id | Delete section (Admin) |

### Subjects (Admin CRUD, others read)
| Method | Path | Description |
|---|---|---|
| GET | /api/subjects | List (filter by grade) |
| GET | /api/subjects/:id | Subject detail |
| POST | /api/subjects | Create subject (Admin) |
| PUT | /api/subjects/:id | Update (Admin) |
| DELETE | /api/subjects/:id | Delete (Admin) |

### Enrollments (Teacher)
| Method | Path | Description |
|---|---|---|
| GET | /api/enrollments | List (filter by section, grade, SY) |
| POST | /api/enrollments | Enroll student |
| PUT | /api/enrollments/:id | Update (transfer/drop) |

### Grades (Teacher)
| Method | Path | Description |
|---|---|---|
| GET | /api/grades?student_id=&sy_id= | Get student grades (pivoted by quarter) |
| PUT | /api/grades | Bulk upsert grades |
| POST | /api/grades/lock | Lock all grades for a student |
| POST | /api/grades/unlock | Unlock grades |
| POST | /api/grades/corrections | Submit correction request |
| GET | /api/grades/corrections | List correction requests |

### Promotions (Teacher submit, Registrar review)
| Method | Path | Description |
|---|---|---|
| GET | /api/promotions | List promotion records |
| GET | /api/promotions/:id | Detail with promoted students |
| POST | /api/promotions | Execute bulk promotion |

### At-Risk (Teacher, Registrar)
| Method | Path | Description |
|---|---|---|
| GET | /api/at-risk | List predictions (filter by grade, risk level) |
| POST | /api/at-risk/predict | Run AI prediction model |

### Documents (Teacher, Registrar)
| Method | Path | Description |
|---|---|---|
| GET | /api/documents | List documents (filter by section, student) |
| POST | /api/documents/upload | Upload file (multipart) |
| GET | /api/documents/:id/download | Download file |

### School Forms (Registrar)
| Method | Path | Description |
|---|---|---|
| GET | /api/forms/sf1 | SF1 — School Register data |
| GET | /api/forms/sf5 | SF5 — Report on Promotion |
| GET | /api/forms/sf9 | SF9 — Progress Report Card |
| GET | /api/forms/sf10 | SF10 — Permanent Academic Record |

### Activity Logs (Admin)
| Method | Path | Description |
|---|---|---|
| GET | /api/logs | List (paginated, filterable) |

### Backups (Admin)
| Method | Path | Description |
|---|---|---|
| GET | /api/backups | List backup history |
| POST | /api/backups | Trigger manual backup |

### Settings (Admin)
| Method | Path | Description |
|---|---|---|
| GET | /api/settings | Get school settings + section type config |
| PUT | /api/settings | Update school settings |

---

## Key SQL Query Patterns

### Grade Pivot (Frontend Display)
Maps normalized grade rows (one per quarter) to q1/q2/q3/q4 columns:

```sql
SELECT
  s.name AS subject_name,
  MAX(CASE WHEN g.quarter = 1 THEN g.grade END) AS q1,
  MAX(CASE WHEN g.quarter = 2 THEN g.grade END) AS q2,
  MAX(CASE WHEN g.quarter = 3 THEN g.grade END) AS q3,
  MAX(CASE WHEN g.quarter = 4 THEN g.grade END) AS q4,
  ROUND(AVG(g.grade), 2) AS final_average
FROM grades g
JOIN subjects s ON g.subject_id = s.id
WHERE g.student_id = ? AND g.school_year_id = ?
GROUP BY s.id, s.name
ORDER BY s.name;
```

### General Average Computation

```sql
SELECT ROUND(AVG(subject_avg.avg), 2) AS general_average
FROM (
  SELECT AVG(g.grade) AS avg
  FROM grades g
  WHERE g.student_id = ? AND g.school_year_id = ?
  GROUP BY g.subject_id
) AS subject_avg;
```

### Section Occupancy

```sql
SELECT
  s.id, s.name, s.grade_level, s.section_type,
  s.capacity, s.current_count,
  ROUND((s.current_count / s.capacity) * 100, 1) AS occupancy_pct
FROM sections s
WHERE s.grade_level = ? AND s.is_active = 1
ORDER BY s.name;
```

### Student Search (with filters)

```sql
SELECT s.*, sec.name AS section_name, e.status AS enrollment_status
FROM students s
LEFT JOIN enrollments e ON s.id = e.student_id AND e.school_year_id = ?
LEFT JOIN sections sec ON e.section_id = sec.id
WHERE (s.lrn LIKE ? OR s.name LIKE ? OR s.student_id LIKE ?)
  AND (s.grade_level = ? OR ? IS NULL)
  AND (s.sex = ? OR ? IS NULL)
ORDER BY s.name;
```

---

## Backend Project Structure

```
server/
├── package.json
├── tsconfig.json
├── .env                         # DB creds, JWT secret
├── .env.example
├── src/
│   ├── index.ts                 # Express app entry point
│   ├── config/
│   │   └── database.ts          # MySQL2 connection pool
│   ├── middleware/
│   │   ├── auth.ts              # JWT verification
│   │   ├── roleGuard.ts         # Role-based access
│   │   └── errorHandler.ts      # Global error handler
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── users.routes.ts
│   │   ├── students.routes.ts
│   │   ├── sections.routes.ts
│   │   ├── subjects.routes.ts
│   │   ├── enrollments.routes.ts
│   │   ├── grades.routes.ts
│   │   ├── promotions.routes.ts
│   │   ├── atrisk.routes.ts
│   │   ├── forms.routes.ts
│   │   ├── documents.routes.ts
│   │   ├── backups.routes.ts
│   │   ├── logs.routes.ts
│   │   └── settings.routes.ts
│   ├── controllers/             # Route handler logic
│   ├── services/                # Business logic
│   │   ├── auth.service.ts
│   │   ├── grade.service.ts     # Averages, descriptors
│   │   ├── sectioning.service.ts# Auto-sectioning algorithm
│   │   ├── promotion.service.ts # Bulk promotion
│   │   ├── atrisk.service.ts    # Risk prediction
│   │   └── forms.service.ts     # SF generation
│   ├── queries/                 # Raw SQL query builders
│   │   └── *.queries.ts
│   └── utils/
│       └── validators.ts        # Input validation
├── migrations/                  # SQL migration files
│   ├── 001_create_school_years.sql
│   ├── 002_create_users.sql
│   ├── ...
│   └── 021_create_school_settings.sql
└── seeds/
    └── seed.sql                 # Seed data matching sampleData.ts
```

---

## Implementation Phasing

### Phase 1: Foundation (Week 1-2)
- Initialize `server/` with Node.js + Express + TypeScript
- Set up MySQL2 connection pool (connection.js)
- Create migration SQL files for all 21 tables
- Run initial migrations
- Create seed data matching existing `sampleData.ts`
- Implement auth routes (login, JWT middleware, /me endpoint)
- Role-based access guard middleware

### Phase 2: Core CRUD (Week 3-4)
- Users CRUD (Admin)
- Students CRUD (Teacher/Registrar)
- Sections CRUD (Admin) + read (Teacher/Registrar)
- Subjects CRUD (Admin) + read (Teacher/Registrar)
- School settings CRUD (Admin)
- Activity logs (auto-log on all mutating endpoints)

### Phase 3: Grading & Enrollment (Week 5-6)
- Enrollment endpoints (enroll, transfer, drop)
- Grade endpoints (bulk upsert, read pivoted)
- Grade lock/unlock functionality
- Grade correction request workflow
- Grade computation service (averages, descriptors)

### Phase 4: Advanced Features (Week 7-8)
- Auto-sectioning algorithm (GA-based tier assignment)
- Bulk promotion (section-level promotion with retention)
- At-risk prediction service (linear regression simulation)
- School forms data generation (SF1, SF5, SF9, SF10)
- Document upload/download (multipart)

### Phase 5: Admin Tools (Week 9)
- Database backup (manual trigger)
- Auto-backup scheduling
- Academic year management (archive, promote all)
- Notification system (creation, broadcast, read-tracking)

### Phase 6: Frontend Integration (Week 10-12)
- Create API service layer (`src/app/services/api.ts`)
- Add Axios/fetch wrapper with JWT handling
- Update all page components to call API instead of `sampleData.ts`
- Convert existing camelCase code to snake_case in TS interfaces
- Test all flows end-to-end
- Remove `sampleData.ts` dependency

---

## Verification Plan

1. **Database integrity**: Run all migrations → `DESCRIBE` each table → verify column types, constraints, FKs
2. **Seed data accuracy**: Verify counts match existing sample data (11 students, 5 teachers, 13 sections, 8 subjects, 7 users, 8 at-risk records)
3. **Auth flow**: Login (valid credentials → JWT returned) → Access protected endpoint (JWT required) → Access with invalid token (401) → Logout
4. **Grade flow**: Enroll student → Add Q1-Q4 grades → Lock grades (verify PUT returns 403) → Submit correction → Approve/reject → Verify grade updated
5. **Promotion flow**: Promote section → Verify new enrollment records created for next grade → Check promotion records visible in Registrar dashboard
6. **At-risk flow**: Run prediction → Verify risk scores 0-100 → Filter by risk level → Check trend calculation
7. **Frontend integration**: Every page loads data from API (not sampleData) → CRUD operations persist after page reload → All 30 pages functional
