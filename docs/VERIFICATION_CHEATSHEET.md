# HI5 Portal — Client Verification Cheatsheet

> **Purpose:** One-page testing scripts so *you* (the client) can confirm the fixes are in.
> **How to read:**
> - `FIXED` → feature is implemented; go run the check to confirm it works for you.
> - `PARTIAL / OPEN` → still on our list; the check describes what the system *currently* does so you know what to expect.
> - **Prereqs:** app running (frontend :5173, API :3001). Logins below (password `password123` for all).

| Role | Username | Notes |
|------|----------|-------|
| Admin | `admin` | ICT coordinator / system admin |
| Teacher | `teacher01` | e.g. adviser of one section |
| Registrar | `registrar01` | Ms. Carla Reyes |
| Principal | (same users, role-scoped) | principal dashboard |

---

## 1. Admin / System-Wide

### 1.1 Hours per Week display (FIXED)
1. Login as **admin**.
2. Open **Subject Management**.
3. Look at the **Hrs/Week** column.
- **Expect:** readable text like `3 hrs/day · 4 days/wk (12 hrs/wk)` — **not** a string like `03.03.03.03`.
4. Check the same label when editing a subject and on the registrar’s Subject view.

### 1.2 School-Year stays on the active year (FIXED — restart smoke test)
1. Login as **admin** → **Academic Year Management**.
2. Confirm your current SY row is the active one (not grayed out).
3. (You) restart the server, then reopen the app.
4. Log back in — the dashboard/forms should still show the **same active school year**.
- **Expect:** it does **not** revert to a previous year.

### 1.3 Automated activity-log cleanup (FIXED)
- Login as **admin** → **Activity Logs**.
- **Expect:** logs older than 90 days are purged automatically (backend cron, no buttons needed).

### 1.4 No duplicate logout / search bars (FIXED)
1. Login as **admin**.
2. **Logout:** there should be exactly **one** logout — inside your profile menu (top-right avatar). The sidebar and top bar have no logout button.
3. **Search:** one global search (top bar). Pages like Students/LRN lookup keep their own specific search boxes — those are intentional, not duplicates.

### 1.5 Quick Actions removed (FIXED)
- Login each role (admin / principal / registrar / teacher).
- **Expect:** no “Quick Actions” suggestion panel on any dashboard.

---

## 2. Teacher Role

### 2.1 Can only encode own subject, view all (FIXED)
1. Login as **teacher01** → **Grade Management** (for the section you advise).
2. Rows/subjects **not** assigned to you show a **read-only lock** and their inputs are disabled.
3. Your assigned subject(s) remain editable.
- **Expect:** trying to save grades for a subject you don’t teach is blocked (server also returns 403).

### 2.2 Deadline → changes go through Registrar (FIXED)
1. On a subject past the grade deadline, attempt to edit a grade.
- **Expect:** edit is blocked with a message like *“The grade editing deadline has passed… contact the Registrar.”*
2. Use the **Correction Request** (Common Mistake) modal to request a change.
3. Login as **registrar01** → **Grade Corrections**: review the request and approve/reject.
- **Expect:** after approval the grade unlocks and updates.

### 2.3 Returning student shows previous grades (FIXED)
1. Login as **teacher** → **Enrollment** → switch to **Returning Student**.
2. Search a returning student by **LRN** (e.g. a `TST-` test LRN, or any student with prior academic history).
- **Expect:** before you can confirm enrollment, a **“Previous Grades & Academic History”** panel appears listing per-school-year subjects with Q1–Q4 / Final / Gen. Ave. It supplements their personal info.
3. Only then do the grade/program selection steps let you confirm.

---

## 3. Registrar

### 3.1 LIS Excel format (FIXED)
1. Login as **registrar01** → **LIS Export** → export the **Excel (.xlsx)**.
- **Expect:** a styled workbook — merged navy title row, school-year banner, **bold colored header row** (frozen), thin borders and zebra striping, plus an autofilter. Open it in Excel/WPS to confirm it looks like an official document, not a raw data dump.

### 3.2 LIS PDF official look (FIXED)
1. **LIS Export** → export the **PDF**.
- **Expect:** an official DepEd-style document: school logos + letterhead, title, a **bordered table** with repeating headers on every page, and a Registrar/Principal **signature block** — not plain text.

### 3.3 School Form preview-first + Edit (FIXED)
1. Login as **registrar01** → **SF1** (School Register).
2. Fill/load a form, then click **Print** or **Export PDF**.
- **Expect:** a **preview dialog opens first** (read-only — inputs are shown as static text).
3. In the preview click **Edit**.
- **Expect:** returns to the live form so you can correct mistakes; print/export always re-opens the preview.
4. Repeat on the **School Forms landing page** menu (SF1/SF5/SF9/SF10 shortcuts): “Print Form” / “Export PDF” there should **also** open the preview first (no more instant print).

### 3.4 Registrar dashboard charts (FIXED)
1. Login as **registrar01** → **Dashboard**.
- **Expect:** per-grade bar, program pie, section population, at-risk **plus** a new **Enrollment Trend** line chart (per school year) and a **Grade Distribution** bar chart (shown once grades are encoded).

---

## 4. Principal

### 4.1 Document export (FIXED)
1. Login with a principal-scoped account → **Export Center** (sidebar).
2. Export **SF1 PDF**, **SF5 PDF**, a consolidated **Reports PDF**, and **School-wide Data PDF**.
- **Expect:** each produces a downloadable, official-looking PDF.

### 4.2 Dashboard graphs (FIXED)
1. **Dashboard:** enrollment trend line chart, grade-distribution bar chart, at-risk overview, program/gender pies.
- **Expect:** all render with data (not empty/loading forever).

---

## 5. Visual / live checks still requested from you

| Check | How to test |
|-------|-------------|
| **SY stays active after restart** | Admin → Academic Year Management → set/confirm current SY → restart the server → log back in → the active SY is unchanged. |
| **SF5 / SF9 PDF borders** | Registrar → SF5 (and SF9) → Export PDF → check line spacing and borders render cleanly (report cards/registers should look crisp, not broken). 

Everything else from the client revision list is **implemented** — see sections 1–4 to re-verify each at your convenience.