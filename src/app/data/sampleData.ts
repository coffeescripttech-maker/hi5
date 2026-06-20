export const SAMPLE_STUDENTS = [
  { id: "2026-07-0001", lrn: "123456789012", name: "Maria Santos", grade: 7, section: "Star", average: 92.5, sex: "Female", address: "123 Mabini St., Caloocan City", birthdate: "2012-03-15", guardian: "Elena Santos", contact: "09171234567", classification: ["4Ps"], status: "Enrolled" },
  { id: "2026-07-0002", lrn: "123456789013", name: "Juan dela Cruz", grade: 7, section: "Gold", average: 87.3, sex: "Male", address: "456 Rizal Ave., Quezon City", birthdate: "2012-07-22", guardian: "Pedro dela Cruz", contact: "09281234567", classification: [], status: "Enrolled" },
  { id: "2026-08-0001", lrn: "123456789014", name: "Ana Reyes", grade: 8, section: "Silver", average: 82.1, sex: "Female", address: "789 Bonifacio Blvd., Manila", birthdate: "2011-11-05", guardian: "Rosa Reyes", contact: "09391234567", classification: ["PWD"], status: "Enrolled" },
  { id: "2026-08-0002", lrn: "123456789015", name: "Carlo Mendoza", grade: 8, section: "Regular", average: 77.4, sex: "Male", address: "321 Luna St., Pasig", birthdate: "2011-04-18", guardian: "Mario Mendoza", contact: "09451234567", classification: ["Transferee"], status: "Enrolled" },
  { id: "2026-09-0001", lrn: "123456789016", name: "Sofia Villanueva", grade: 9, section: "Star", average: 95.2, sex: "Female", address: "654 Del Pilar St., Makati", birthdate: "2010-08-30", guardian: "Carmen Villanueva", contact: "09561234567", classification: [], status: "Enrolled" },
  { id: "2026-09-0002", lrn: "123456789017", name: "Miguel Torres", grade: 9, section: "Gold", average: 88.7, sex: "Male", address: "987 Aguinaldo St., Taguig", birthdate: "2010-02-14", guardian: "Jose Torres", contact: "09671234567", classification: ["4Ps"], status: "Enrolled" },
  { id: "2026-10-0001", lrn: "123456789018", name: "Isabella Garcia", grade: 10, section: "Silver", average: 83.5, sex: "Female", address: "147 Quezon St., Paranaque", birthdate: "2009-06-20", guardian: "Luz Garcia", contact: "09781234567", classification: [], status: "Enrolled" },
  { id: "2026-11-0001", lrn: "123456789019", name: "Rafael Aquino", grade: 11, section: "Star", average: 91.8, sex: "Male", address: "258 Laurel St., Las Pinas", birthdate: "2008-09-12", guardian: "Minda Aquino", contact: "09891234567", classification: [], status: "Enrolled" },
  { id: "2026-12-0001", lrn: "123456789020", name: "Gabriela Luna", grade: 12, section: "Gold", average: 86.4, sex: "Female", address: "369 Roxas St., Mandaluyong", birthdate: "2007-12-25", guardian: "Cora Luna", contact: "09901234567", classification: ["PWD"], status: "Enrolled" },
  { id: "2026-07-0003", lrn: "123456789021", name: "Mark Bautista", grade: 7, section: "Pending", average: null, sex: "Male", address: "741 Mabini St., Valenzuela", birthdate: "2012-05-08", guardian: "Ben Bautista", contact: "09121234567", classification: [], status: "Pending" },
];

export const SAMPLE_TEACHERS = [
  { id: "T-001", name: "Mr. Ramon Dela Cruz", subject: "Mathematics", sections: ["7-Star", "7-Gold", "8-Silver"], email: "rdelacruz@school.edu.ph" },
  { id: "T-002", name: "Ms. Linda Fernandez", subject: "English", sections: ["8-Regular", "9-Star", "9-Gold"], email: "lfernandez@school.edu.ph" },
  { id: "T-003", name: "Mr. Eduardo Ocampo", subject: "Science", sections: ["10-Silver", "11-Star", "12-Gold"], email: "eocampo@school.edu.ph" },
  { id: "T-004", name: "Ms. Patricia Lim", subject: "Filipino", sections: ["7-Star", "8-Silver"], email: "plim@school.edu.ph" },
  { id: "T-005", name: "Mr. Fernando Castro", subject: "MAPEH", sections: ["9-Star", "10-Silver", "11-Star"], email: "fcastro@school.edu.ph" },
];

export const SAMPLE_SECTIONS = [
  { name: "7-Star", gradeLevel: 7, capacity: 45, current: 42, adviser: "Mr. Ramon Dela Cruz", minAvg: 90 },
  { name: "7-Gold", gradeLevel: 7, capacity: 45, current: 40, adviser: "Ms. Linda Fernandez", minAvg: 85 },
  { name: "7-Silver", gradeLevel: 7, capacity: 45, current: 38, adviser: "Mr. Eduardo Ocampo", minAvg: 80 },
  { name: "7-Regular", gradeLevel: 7, capacity: 45, current: 35, adviser: "Ms. Patricia Lim", minAvg: 75 },
  { name: "8-Star", gradeLevel: 8, capacity: 45, current: 43, adviser: "Mr. Fernando Castro", minAvg: 90 },
  { name: "8-Gold", gradeLevel: 8, capacity: 45, current: 41, adviser: "Mr. Ramon Dela Cruz", minAvg: 85 },
  { name: "8-Silver", gradeLevel: 8, capacity: 45, current: 37, adviser: "Ms. Linda Fernandez", minAvg: 80 },
  { name: "8-Regular", gradeLevel: 8, capacity: 45, current: 33, adviser: "Mr. Eduardo Ocampo", minAvg: 75 },
  { name: "9-Star", gradeLevel: 9, capacity: 50, current: 48, adviser: "Ms. Patricia Lim", minAvg: 90 },
  { name: "9-Gold", gradeLevel: 9, capacity: 50, current: 46, adviser: "Mr. Fernando Castro", minAvg: 85 },
  { name: "10-Silver", gradeLevel: 10, capacity: 50, current: 44, adviser: "Mr. Ramon Dela Cruz", minAvg: 80 },
  { name: "11-Star", gradeLevel: 11, capacity: 50, current: 49, adviser: "Ms. Linda Fernandez", minAvg: 90 },
  { name: "12-Gold", gradeLevel: 12, capacity: 50, current: 47, adviser: "Mr. Eduardo Ocampo", minAvg: 85 },
];

export const SAMPLE_GRADES = [
  { subject: "Mathematics", q1: 92, q2: 89, q3: 94, q4: 91, finalGrade: null },
  { subject: "English", q1: 88, q2: 90, q3: 87, q4: 92, finalGrade: null },
  { subject: "Science", q1: 95, q2: 93, q3: 96, q4: 94, finalGrade: null },
  { subject: "Filipino", q1: 85, q2: 87, q3: 83, q4: 86, finalGrade: null },
  { subject: "Araling Panlipunan", q1: 90, q2: 88, q3: 91, q4: 89, finalGrade: null },
  { subject: "MAPEH", q1: 93, q2: 95, q3: 92, q4: 94, finalGrade: null },
  { subject: "TLE / EPP", q1: 87, q2: 89, q3: 88, q4: 90, finalGrade: null },
  { subject: "Values Education", q1: 91, q2: 93, q3: 90, q4: 92, finalGrade: null },
];

export const ACTIVITY_LOGS = [
  { id: 1, user: "teacher01", action: "Enrolled new student: Mark Bautista (LRN: 123456789021)", timestamp: "2026-02-22 08:34:12", role: "Teacher" },
  { id: 2, user: "registrar01", action: "Generated SF1 for Grade 7-Star", timestamp: "2026-02-22 09:12:05", role: "Registrar" },
  { id: 3, user: "teacher02", action: "Uploaded past grades for Grade 8-Silver (23 records)", timestamp: "2026-02-22 09:45:33", role: "Teacher" },
  { id: 4, user: "admin", action: "Created new user account: teacher03 (Teacher)", timestamp: "2026-02-22 10:02:18", role: "Admin" },
  { id: 5, user: "teacher01", action: "Locked grades for Grade 7-Star - Mathematics", timestamp: "2026-02-22 10:30:44", role: "Teacher" },
  { id: 6, user: "registrar01", action: "Generated SF10 for student: Maria Santos", timestamp: "2026-02-22 11:05:22", role: "Registrar" },
  { id: 7, user: "admin", action: "Updated role assignment: lfernandez → Adviser 8-Silver", timestamp: "2026-02-22 11:22:07", role: "Admin" },
  { id: 8, user: "teacher03", action: "Enrolled returning student: Ana Reyes (LRN: 123456789014)", timestamp: "2026-02-22 12:00:55", role: "Teacher" },
  { id: 9, user: "registrar01", action: "Generated SF5 for Grade 7 students (42 records)", timestamp: "2026-02-22 13:15:30", role: "Registrar" },
  { id: 10, user: "admin", action: "Database backup initiated successfully", timestamp: "2026-02-22 14:00:00", role: "Admin" },
];

export const ENROLLMENT_STATS = [
  { grade: "Grade 7", enrolled: 155, capacity: 180, male: 78, female: 77 },
  { grade: "Grade 8", enrolled: 154, capacity: 180, male: 80, female: 74 },
  { grade: "Grade 9", enrolled: 94, capacity: 100, male: 47, female: 47 },
  { grade: "Grade 10", enrolled: 44, capacity: 50, male: 22, female: 22 },
  { grade: "Grade 11", enrolled: 49, capacity: 50, male: 25, female: 24 },
  { grade: "Grade 12", enrolled: 47, capacity: 50, male: 23, female: 24 },
];

export const USERS = [
  { id: 1, username: "admin", name: "System Administrator", role: "Admin", email: "admin@school.edu.ph", status: "Active", lastLogin: "2026-02-22 08:00" },
  { id: 2, username: "teacher01", name: "Mr. Ramon Dela Cruz", role: "Teacher", email: "rdelacruz@school.edu.ph", status: "Active", lastLogin: "2026-02-22 07:45" },
  { id: 3, username: "teacher02", name: "Ms. Linda Fernandez", role: "Teacher", email: "lfernandez@school.edu.ph", status: "Active", lastLogin: "2026-02-22 07:50" },
  { id: 4, username: "teacher03", name: "Mr. Eduardo Ocampo", role: "Teacher", email: "eocampo@school.edu.ph", status: "Active", lastLogin: "2026-02-22 08:10" },
  { id: 5, username: "teacher04", name: "Ms. Patricia Lim", role: "Teacher", email: "plim@school.edu.ph", status: "Inactive", lastLogin: "2026-02-20 14:30" },
  { id: 6, username: "registrar01", name: "Ms. Carla Reyes", role: "Registrar", email: "creyes@school.edu.ph", status: "Active", lastLogin: "2026-02-22 08:05" },
  { id: 7, username: "registrar02", name: "Mr. Dennis Soriano", role: "Registrar", email: "dsoriano@school.edu.ph", status: "Active", lastLogin: "2026-02-22 08:20" },
];

export const SECTION_RULES = [
  { range: "90 – 100", section: "Star Section", color: "bg-yellow-400", icon: "⭐" },
  { range: "85 – 89", section: "Gold Section", color: "bg-amber-500", icon: "🥇" },
  { range: "80 – 84", section: "Silver Section", color: "bg-gray-400", icon: "🥈" },
  { range: "75 – 79", section: "Regular Section", color: "bg-blue-400", icon: "📚" },
  { range: "Below 75", section: "Non-Reader Section", color: "bg-red-400", icon: "📖" },
];

export const AT_RISK_STUDENTS = [
  { id: "2026-07-0001", name: "Maria Santos", grade: 7, section: "Star", q1: 92, q2: 89, q3: 84, q4: null, trend: "declining", risk: "Needs Monitoring", riskScore: 62, teacher: "Mr. Ramon Dela Cruz" },
  { id: "2026-08-0002", name: "Carlo Mendoza", grade: 8, section: "Regular", q1: 78, q2: 74, q3: 70, q4: null, trend: "declining", risk: "At-Risk", riskScore: 88, teacher: "Ms. Linda Fernandez" },
  { id: "2026-09-0002", name: "Miguel Torres", grade: 9, section: "Gold", q1: 90, q2: 88, q3: 87, q4: null, trend: "stable", risk: "On Track", riskScore: 15, teacher: "Mr. Eduardo Ocampo" },
  { id: "2026-08-0001", name: "Ana Reyes", grade: 8, section: "Silver", q1: 83, q2: 80, q3: 75, q4: null, trend: "declining", risk: "At-Risk", riskScore: 81, teacher: "Mr. Eduardo Ocampo" },
  { id: "2026-10-0001", name: "Isabella Garcia", grade: 10, section: "Silver", q1: 85, q2: 84, q3: 83, q4: null, trend: "stable", risk: "Needs Monitoring", riskScore: 45, teacher: "Mr. Ramon Dela Cruz" },
  { id: "2026-07-0002", name: "Juan dela Cruz", grade: 7, section: "Gold", q1: 88, q2: 87, q3: 88, q4: null, trend: "stable", risk: "On Track", riskScore: 10, teacher: "Mr. Ramon Dela Cruz" },
  { id: "2026-11-0001", name: "Rafael Aquino", grade: 11, section: "Star", q1: 94, q2: 92, q3: 91, q4: null, trend: "stable", risk: "On Track", riskScore: 8, teacher: "Ms. Patricia Lim" },
  { id: "2026-12-0001", name: "Gabriela Luna", grade: 12, section: "Gold", q1: 87, q2: 82, q3: 77, q4: null, trend: "declining", risk: "At-Risk", riskScore: 79, teacher: "Mr. Fernando Castro" },
];
