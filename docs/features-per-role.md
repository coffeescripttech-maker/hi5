# HI5 Portal — Comprehensive Feature Breakdown Per Role

> **School:** Don Servillano Platon Memorial National High School (DSPMNHS)  
> **Location:** Sta. Cruz, Tinambac, Camarines Sur  
> **SY:** 2025–2026 | **Grades:** 7–12 | **Students:** ~3,200

---

## 👑 ADMIN (11 Pages)

### 1. Admin Dashboard (`/admin`)

| Feature | Details |
|---|---|
| **Enrollment Analytics** | Bar chart comparing male vs female enrollment per grade level |
| **Enrollment Trend** | Area chart showing monthly enrollment growth |
| **Classification Pie Chart** | 4Ps / PWD / Transferee / Non-Reader / Regular breakdown |
| **Section Distribution** | Horizontal bar chart by section type (Star, Gold, Silver, Regular, Non-Reader) |
| **AI At-Risk Summary** | System-wide risk rate per grade level with visual bars |
| **Grade-Level Enrollment Table** | Enrolled vs capacity vs utilization percentage |
| **Stat Cards** | Total Enrolled, Active Teachers, Total Sections, Active System Users |
| **Recent Activity Log** | Last 6 system actions by any user |
| **Quick Navigation** | Links to User Management and School Settings |
| **Loading Skeleton** | Animated placeholder during data load |

### 2. User Account Management (`/admin/users`)

| Feature | Details |
|---|---|
| **Create User** | Add new accounts with name, username, email, temporary password, role |
| **Edit User** | Update existing user info, reassign roles |
| **Delete User** | Remove accounts with confirmation modal |
| **Role Permissions Display** | Click a role badge to see its complete permission checklist |
| **Search** | By name, username, or email |
| **Filters** | By role (All/Admin/Teacher/Registrar) and status (Active/Idle/Inactive) |
| **Activity Status** | Auto-computed: Active (<30 days), Idle (30–60 days), Inactive (>60 days) from last login |

### 3. Subject Management (`/admin/subjects`)

| Feature | Details |
|---|---|
| **Add Subject** | Name, grade level, hours/week, type (Core/Applied/Specialized), teacher assignment |
| **Edit Subject** | Update any subject field |
| **Delete Subject** | With confirmation dialog |
| **Grade Filter Tabs** | All Grades / Grade 7–12 toggle buttons |
| **Summary Cards** | Total subjects, count per type with color badges |
| **Subjects per Grade** | Grouped views with hrs/week total per grade |

### 4. Section Creation & Management (`/admin/sections`)

| Feature | Details |
|---|---|
| **Create Section** | Grade level, section type, capacity, minimum average, adviser assignment |
| **Edit Section** | Update capacity, min average, adviser |
| **Delete Section** | With confirmation modal |
| **Grade-Organized View** | Sections grouped by grade level (7–12) |
| **Color-Coded Types** | Star (gold), Gold (green), Silver (blue), Regular (gray), Non-Reader (red) |
| **Occupancy Bars** | Visual utilization indicator per section |
| **Summary Cards** | Total sections, total capacity, total enrolled |
| **Adviser Display** | Shows assigned teacher per section |

### 5. Academic Year Management (`/admin/academic-year`)

| Feature | Details |
|---|---|
| **SY Configuration** | Set current and incoming school year labels (e.g., 2025–2026 → 2026–2027) |
| **School-Wide Bulk Promotion** | Promote all eligible students (GA ≥ 75) grade by grade |
| **Promotion Summary Table** | From → To grade, total/promoted/retained counts |
| **Promotion Rate Progress Bars** | Visual percentage per transition |
| **Archive School Year** | Locks current records, initializes next SY |
| **Two-Step Guard** | Archiving disabled until promotion step is done |
| **Irreversible Warning** | Strong confirmation before archive execution |

### 6. School Settings (`/admin/settings`)

| Feature | Details |
|---|---|
| **School Information** | Editable school name, DepEd ID, region, division |
| **Active School Year** | Current SY display toggle |
| **Enrollment Period** | Open/Close toggle with visual indicator |
| **Auto-Sectioning Thresholds** | Configurable min/max averages per section type |
| **5 Threshold Tiers** | Star (90–100), Gold (85–89), Silver (80–84), Regular (75–79), Non-Reader (<75) |
| **Non-Reader Locked** | Fixed below 75 per DepEd policy |
| **Validation Notice** | Ensures 0–100 coverage without overlap |
| **Expandable Editors** | Per-threshold collapsible edit panels |

### 7. Database Backup (`/admin/backup`)

| Feature | Details |
|---|---|
| **Manual Backup** | One-click trigger with animated progress bar |
| **Auto-Backup Schedule** | Configurable frequency (Daily/Every 12h/Weekly), time, retention period |
| **Status Cards** | Last backup date, backup size, total backups, next auto-backup |
| **Backup History Table** | ID, date, time, type (Auto/Manual), size, records, status (Success/Failed) |
| **Download Action** | Download individual backup files |
| **RA 10173 Notice** | Data Privacy Act compliance reminder |

### 8. Admin Profile (`/admin/profile`)

| Feature | Details |
|---|---|
| **Profile Photo** | Upload with camera icon, max 2MB validation |
| **Personal Info** | Editable name, email, phone, address |
| **Employment Info** | Read-only: employee ID, designation, date hired, school ID, division, district |
| **Responsibilities Section** | 10-item Admin responsibility checklist |

### 9. Activity Logs (`/admin/logs`)
System-wide audit trail of user actions.

---

## 👨‍🏫 TEACHER (11 Pages)

### 1. Teacher Dashboard (`/teacher`)

| Feature | Details |
|---|---|
| **Stat Cards** | My Sections (5), Total Enrolled (238), Average Class Performance (85.4) |
| **Grade Distribution Chart** | Bar chart: Outstanding / Very Satisfactory / Satisfactory / Fairly Satisfactory / Did Not Meet |
| **Gender Distribution Pie** | Male vs female counts |
| **Quick Action Buttons** | Enroll Student, Encode Grades, Upload Grades (Excel) |
| **My Sections Table** | Section name, grade, enrolled, capacity, occupancy % |

### 2. Enrollment (`/teacher/enroll`)
Enroll new or returning students (separate page, accessed from dashboard quick action).

### 3. My Students (`/teacher/my-students`)

| Feature | Details |
|---|---|
| **Student Search** | By name, LRN, or Student ID with autocomplete suggestions |
| **Student List Table** | Student name, LRN, grade/section (color-badged), sex, average, View Profile |
| **Filtered by Teacher** | Only shows students in the teacher's assigned sections |
| **Section Color Badges** | Color-coded by section type |
| **View Profile Link** | Navigates to `/student/:id` |

### 4. Auto Sectioning (`/teacher/sectioning`)

| Feature | Details |
|---|---|
| **GA-Based Assignment** | Primary basis: General Average |
| **5 Tiers** | Star (90–100), Gold (85–89), Silver (80–84), Regular (75–79), Non-Reader (<75) |
| **Non-Reader Override** | Always placed in intervention section regardless of GA |
| **Gender Balancing** | Distribution tracked per tier |
| **Special Tags** | PWD and 4Ps flags visible for teacher awareness |
| **Animated Assignment** | Students assigned one by one with visual feedback |
| **Threshold Cards** | Quick reference of criteria per section type |
| **Gender Summary** | At-a-glance male/female balance per section |
| **How-It-Works Panel** | Expandable explanation of the sectioning logic |

### 5. Section Management (`/teacher/sections`)

| Feature | Details |
|---|---|
| **Section List** | All sections with search by name/adviser |
| **Grade Filter** | Tabs to view specific grade levels |
| **Section Detail Modal** | Shows enrolled students, capacity, available slots |
| **Print Class List** | Button in detail view |
| **Summary Cards** | Total sections, total enrolled, overall occupancy % |
| **Availability Column** | Color-coded: green/orange/red for slot availability |

### 6. Bulk Promotion (`/teacher/promote`)

| Feature | Details |
|---|---|
| **Section Selector** | Choose a section to promote (Grade 7–11 only) |
| **Promotion Preview** | Shows estimated total/promoted/retained counts |
| **Automatic Retention** | GA < 75 students excluded and retained |
| **Confirmation Modal** | Section details review before execution |
| **Promotion History** | ID, section, promoted to, student count, date, status |
| **Real-Time Visibility** | Promotions immediately visible in Registrar's records |

### 7. Grade Management (`/teacher/grades`)

| Feature | Details |
|---|---|
| **Student Selector** | Choose student by section and name |
| **Grade Encoding Sheet** | 8+ subjects × 4 quarters with input fields |
| **Real-Time Averages** | Per-subject averages and overall general average update on each keystroke |
| **Grade Descriptors** | Auto-computed: Outstanding (90+), Very Satisfactory (85–89), Satisfactory (80–84), Fairly Satisfactory (75–79), Did Not Meet (<75) |
| **Lock/Unlock** | Toggle to prevent further edits after submission |
| **Save & Lock** | One-click submit and lock |
| **Success Banner** | Confirmation with student/section details |
| **Locked Banner** | Orange warning when grades are locked |
| **Grade Correction Requests** | Submit correction with subject and justification |
| **Correction History** | All requests with status (Approved/Pending) |

### 8. Upload Grades (Excel) (`/teacher/upload`)

| Feature | Details |
|---|---|
| **Download Template** | Pre-formatted Excel with LRN, Name, Grade Level, 8 subjects, Average formula |
| **File Upload** | Drag & drop or file browser (.xlsx, .xls) |
| **Validation Preview** | Records displayed with pass/fail indicators |
| **Error Detection** | Invalid LRN (non-12-digit), grade > 100 |
| **Summary Cards** | Total records, valid records, errors found |
| **Error Panel** | Expandable list of specific errors per row |
| **Auto-Sectioning Post-Import** | Students assigned to sections based on computed averages |
| **4-Step Guide** | Visual progress tracker: Download → Upload → Validate → Import |
| **Import Confirmation** | Shows assigned sections per student |

### 9. Document Management (`/teacher/documents`)

| Feature | Details |
|---|---|
| **Grade Records Table** | Filename, section, subject, quarter, students, average, date, status |
| **Status Tracking** | Locked (final), Submitted (uploaded, awaiting lock), Pending (not submitted) |
| **Status Cards** | Counts per status for quick overview |
| **Search** | By filename, section, or subject |
| **Filters** | By status and quarter (Q1–Q4) |
| **Actions** | View and download for non-pending documents |

### 10. At-Risk Detection (`/teacher/atrisk`)

| Feature | Details |
|---|---|
| **AI Prediction Model** | Linear Regression analyzing Q1 → Q2 → Q3 grade trajectories |
| **Risk Score (0–100)** | Auto-computed per student |
| **3 Classifications** | At-Risk (<70), Needs Monitoring (70–84), On Track (85+) |
| **Run Prediction Button** | Triggers model with animated feedback |
| **Summary Cards** | Counts per classification level |
| **Filter Tabs** | All / At-Risk / Needs Monitoring / On Track |
| **Grade Trajectory** | Q1, Q2, Q3 values with trend arrows (↑ ↓ →) |
| **Risk Bar** | Color-coded visual indicator |
| **Student Detail Modal** | Full breakdown with struggling subjects identified |
| **AI Recommendations** | Specific intervention suggestions per risk level |
| **How-It-Works Panel** | Transparency on model methodology |

### 11. Teacher Profile (`/teacher/profile`)

| Feature | Details |
|---|---|
| **Profile Photo** | Upload with camera button |
| **Personal Info** | Editable name, email, phone, address |
| **Employment Info** | Read-only: assigned subject, designation, employee ID, date hired |

---

## 🗂️ REGISTRAR (9 Pages)

### 1. Registrar Dashboard (`/registrar`)

| Feature | Details |
|---|---|
| **Enrollment Cards** | Per-grade: enrolled count, capacity, utilization bar |
| **Digital Logbook** | Total enrolled count across all grades |
| **Promotion Rate** | Percentage from previous school year |
| **Enrollment Bar Chart** | Enrolled vs capacity by grade (Recharts) |
| **4Ps & PWD Pie Chart** | Classification distribution |
| **School Form Quick Actions** | Clickable cards for SF1, SF5, SF9, SF10 |
| **Section Population Chart** | Top 5 sections by size (horizontal bars) |

### 2. Student Search (`/registrar/students`)

| Feature | Details |
|---|---|
| **Advanced Search** | By name, LRN, or Student ID with autocomplete |
| **Filters** | Grade level, sex, classification (4Ps/PWD/Transferee) |
| **Expandable Filter Panel** | Toggle visibility |
| **Student Records Table** | ID, name, LRN, grade, section (color-badged), sex, average, classification tags, status |
| **Export CSV** | One-click download |
| **View Profile Link** | Navigates to full student profile |
| **Live Result Count** | Updates as filters change |

### 3. School Forms Generation (`/registrar/forms`)

| Feature | Details |
|---|---|
| **SF1 — School Register** | Official enrolled learner list: LRN, name, sex, age, birthdate, 4Ps/PWD flags, address |
| **SF5 — Promotion Report** | Per-grade: total enrolled, promoted (M/F), retained, dropped, promotion rate, proficiency distribution |
| **SF9 — Progress Report Card** | Per-student: quarterly grades per subject, final ratings, attendance summary, adviser remarks |
| **SF10 — Permanent Record** | Complete academic history across all grade levels attended |
| **Form Configuration** | Grade, section, student, school year selectors |
| **Legal Compliance** | DepEd Order No. 74, s. 2010 and DepEd Order No. 8, s. 2015 citations |
| **Official Header** | Republic of the Philippines + DepEd branding |
| **Print & Export PDF** | Readable formatted output |
| **Signatory Fields** | Class Adviser, Principal, Registrar digital signature blocks |

### 4. Promotion Records (`/registrar/promotions`)

| Feature | Details |
|---|---|
| **Real-Time Feed** | Promotion records submitted by teachers, immediately visible |
| **Summary Cards** | Total promotions, students promoted, completed count |
| **Expandable Records** | Click to expand: record ID, from-to section, students, submitted by, date |
| **Student Name Sample** | Shows promoted student names per record |
| **Actions** | View Full Report, Export Record |

### 5. Subject Directory (`/registrar/subjects`)

| Feature | Details |
|---|---|
| **View-Only Reference** | All subjects as configured by Admin |
| **Grade Filter Tabs** | All Grades / specific grade level |
| **Summary Cards** | Total subjects, count per type (Core/Applied/Specialized) |
| **Subject Table** | Subject name, type badge (color-coded), hours/week |

### 6. Enrollment Report (`/registrar/reports`)

| Feature | Details |
|---|---|
| **Enrollment Stats** | Per-grade enrollment with utilization bars |
| **Total & Promotion Summary** | Aggregate cards |
| **Dual Search** | By LRN and by name |
| **Filters** | Grade level, section, classification (4Ps/PWD/Transferee/Non-Reader/Regular) |
| **Sortable Table** | Click column headers: LRN, name, sex, grade, section, average |
| **CSV Export** | Downloads filtered enrollment data |
| **Live Count** | Updates as filters change |
| **Charts** | Enrollment bar chart + 4Ps/PWD pie chart |

### 7. Section Management (`/registrar/sections`)
View sections (same layout as Admin/Techer section views).

### 8. At-Risk Students — System-Wide (`/registrar/atrisk`)

| Feature | Details |
|---|---|
| **Cross-Section View** | All at-risk students across all grades and teachers |
| **Classification Cards** | At-Risk, Needs Monitoring, On Track counts |
| **Filter Tabs** | All / At-Risk / Needs Monitoring / On Track |
| **Grade Trajectory** | Q1, Q2, Q3 values with trend arrows |
| **Risk Score Bar** | Color-coded visual indicator |
| **Teacher Attribution** | Shows which teacher handles each student |

### 9. Registrar Profile (`/registrar/profile`)

| Feature | Details |
|---|---|
| **Profile Photo** | Upload with camera button |
| **Personal Info** | Editable name, email, phone, address |
| **Employment Info** | Read-only: employee ID, designation, date hired, division, district |
| **Responsibilities** | 10-item Registrar checklist (SF generation, records management, etc.) |

---

## 🔧 CROSS-CUTTING / SHARED FEATURES

| Feature | Roles | Details |
|---|---|---|
| **Login System** | All | Role selection cards, password show/hide, 5-attempt lockout (5-min), forgot password flow |
| **Dark Mode** | All | Toggle in sidebar top bar, persists via context |
| **Notification Center** | All | Role-specific notifications, security alerts, read tracking, mark all read |
| **Responsive Sidebar** | All | Full / Icons-only / Hidden modes, mobile overlay |
| **Student Profile** | Teacher, Registrar | 5 tabs: Personal Info, Enrollment History, Grade History (by SY), Uploaded Files, Section History |
| **Data Privacy (RA 10173)** | All | Compliance notices on Login, Backup, Forms pages |
| **Recharts Visualizations** | All | Bar, Pie, Area, Line charts throughout dashboards |
| **AppContext State** | All | Role, auth, dark mode, toast notifications, promotion history, login attempts/lockout, read notifications, security alerts |

---

## 📊 PAGE COUNT SUMMARY

| Role | Pages | Primary Focus |
|---|---|---|
| **Admin** | 11 | Configuration, user/subject/section setup, system settings, backups |
| **Teacher** | 11 | Student management, grading, sectioning, promotion, at-risk detection |
| **Registrar** | 9 | Records management, DepEd forms, enrollment reports, promotion oversight |
| **Shared** | 2 | Login, Student Profile |
| **Total** | **~30** | Full enrollment-to-records lifecycle |
