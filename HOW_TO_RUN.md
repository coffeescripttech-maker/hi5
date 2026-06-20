# Hi5 Portal — How to Run

## Requirements
- Node.js v18 or higher (https://nodejs.org)
- npm (comes with Node.js)

## Steps

1. Open a terminal in this folder
2. Run: npm install
3. Run: npm run dev
4. Open your browser at: http://localhost:5173

## Login Credentials (Sample)
- Admin:     username: admin       
- Teacher:   username: teacher01   
- Registrar: username: registrar01 
(No password required — just click Login)

## Pages Available
### Admin
- /admin          → Dashboard with charts
- /admin/users    → User Management
- /admin/logs     → Activity Logs
- /admin/settings → School Settings

### Teacher
- /teacher            → Dashboard
- /teacher/enroll     → Enrollment Module
- /teacher/grades     → Grade Management
- /teacher/upload     → Upload Grades (Excel)
- /teacher/sectioning → Auto Sectioning
- /teacher/sections   → Section Management

### Registrar
- /registrar          → Dashboard
- /registrar/students → Student Search
- /registrar/forms    → School Forms (SF1, SF5, SF10)
- /registrar/reports  → Reports

## Tech Stack
- React 18 + TypeScript
- Vite 6
- Tailwind CSS 4
- Recharts (charts)
- React Router 7
- Radix UI components
