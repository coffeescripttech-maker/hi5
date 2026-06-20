// ─── Student ────────────────────────────────────────────────────────────────
export interface Student {
  id: string;
  lrn: string;
  name: string;
  grade: number;
  section: string;
  average: number | null;
  sex: "Male" | "Female";
  address: string;
  birthdate: string;
  guardian: string;
  contact: string;
  classification: string[];
  status: "Enrolled" | "Pending" | "Dropped" | "Transferred" | "Graduated";
}

// ─── Teacher ─────────────────────────────────────────────────────────────────
export interface Teacher {
  id: string;
  name: string;
  subject: string;
  sections: string[];
  email: string;
}

// ─── Section ─────────────────────────────────────────────────────────────────
export interface Section {
  name: string;
  gradeLevel: number;
  capacity: number;
  current: number;
  adviser: string;
  minAvg: number;
}

// ─── Grade ───────────────────────────────────────────────────────────────────
export interface Grade {
  subject: string;
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
  finalGrade: number | null;
}

// ─── User ────────────────────────────────────────────────────────────────────
export type UserRole = "Admin" | "Teacher" | "Registrar";

export interface User {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  email: string;
  status: "Active" | "Inactive";
  lastLogin: string;
}

// ─── Activity Log ─────────────────────────────────────────────────────────────
export interface ActivityLog {
  id: number;
  user: string;
  action: string;
  timestamp: string;
  role: UserRole;
}

// ─── Enrollment Stats ─────────────────────────────────────────────────────────
export interface EnrollmentStat {
  grade: string;
  enrolled: number;
  capacity: number;
  male: number;
  female: number;
}

// ─── At-Risk Student ──────────────────────────────────────────────────────────
export type RiskLevel = "On Track" | "Needs Monitoring" | "At-Risk";
export type TrendDirection = "stable" | "declining" | "improving";

export interface AtRiskStudent {
  id: string;
  name: string;
  grade: number;
  section: string;
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
  trend: TrendDirection;
  risk: RiskLevel;
  riskScore: number;
  teacher: string;
}

// ─── Section Rule ─────────────────────────────────────────────────────────────
export interface SectionRule {
  range: string;
  section: string;
  color: string;
  icon: string;
}

// ─── Auth / Session ───────────────────────────────────────────────────────────
export interface AuthUser {
  username: string;
  name: string;
  role: UserRole;
  email: string;
}

// ─── Notification ─────────────────────────────────────────────────────────────
export type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "security";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}
