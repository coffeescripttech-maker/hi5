/**
 * Shared navigation definition for the HI5 Portal shell.
 *
 * Single source of truth for the per-role sidebar. Every item carries a
 * stable `key` used by the RBAC system (see server/src/services/permissions.ts
 * for the mirrored key lists). The Admin Role Access Control page renders
 * these same groups as its permission checklist.
 *
 * The key lists here MUST mirror the keys in server/src/services/permissions.ts.
 */
import React from 'react';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileText,
  BarChart2,
  Upload,
  Settings,
  GraduationCap,
  UserCheck,
  ShieldCheck,
  Calendar,
  Database,
  Layers,
  BookMarked,
  FileSpreadsheet,
  Search,
  Activity,
  User,
  AlertTriangle,
  UsersRound,
  TrendingUp,
  PieChart,
  ClipboardList,
  MessageSquare,
  Award
} from 'lucide-react';

export type Role = 'admin' | 'teacher' | 'registrar' | 'principal';

export interface NavItem {
  key: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export const NAV_BY_ROLE: Record<Role, NavGroup[]> = {
  admin: [
    {
      group: 'Overview',
      items: [{ key: 'admin_dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin' }]
    },
    {
      group: 'Management',
      items: [
        { key: 'admin_users', label: 'User Management', icon: Users, path: '/admin/users' },
        { key: 'admin_subjects', label: 'Subject Management', icon: BookOpen, path: '/admin/subjects' },
        { key: 'admin_sections', label: 'Section Creation', icon: Layers, path: '/admin/sections' },
        {
          key: 'admin_academic_year',
          label: 'Academic Year Mgmt.',
          icon: Calendar,
          path: '/admin/academic-year'
        }
      ]
    },
    {
      group: 'School Forms',
      items: [
        { key: 'admin_forms_sf1', label: 'SF1 — School Register', icon: FileSpreadsheet, path: '/admin/forms/sf1' },
        { key: 'admin_forms_sf5', label: 'SF5 — Promotion Report', icon: BarChart2, path: '/admin/forms/sf5' },
        { key: 'admin_forms_sf9', label: 'SF9 — Report Card', icon: FileText, path: '/admin/forms/sf9' },
        { key: 'admin_forms_sf10', label: 'SF10 — Permanent Record', icon: BookOpen, path: '/admin/forms/sf10' }
      ]
    },
    {
      group: 'System',
      items: [
        { key: 'admin_settings', label: 'School Settings', icon: Settings, path: '/admin/settings' },
        { key: 'admin_backup', label: 'Database Backup', icon: Database, path: '/admin/backup' },
        { key: 'admin_lis_export', label: 'LIS Export', icon: Upload, path: '/admin/lis-export' },
        { key: 'admin_logs', label: 'Activity Logs', icon: Activity, path: '/admin/logs' },
        { key: 'admin_rbac', label: 'Role Access Control', icon: ShieldCheck, path: '/admin/access-control' },
        { key: 'admin_profile', label: 'My Profile', icon: User, path: '/admin/profile' },
        { key: 'admin_guide', label: 'System Guide', icon: BookOpen, path: '/admin/guide' }
      ]
    }
  ],
  teacher: [
    {
      group: 'Overview',
      items: [{ key: 'teacher_dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/teacher' }]
    },
    {
      group: 'Student Management',
      items: [
        { key: 'teacher_enroll', label: 'Enrollment', icon: UserCheck, path: '/teacher/enroll' },
        { key: 'teacher_my_students', label: 'My Students', icon: UsersRound, path: '/teacher/my-students' },
        {
          key: 'teacher_sections',
          label: 'Section Management',
          icon: BookMarked,
          path: '/teacher/sections'
        },
        { key: 'teacher_promote', label: 'Bulk Promotion', icon: GraduationCap, path: '/teacher/promote' }
      ]
    },
    {
      group: 'Schedule',
      items: [
        { key: 'teacher_schedule', label: 'My Schedule', icon: Calendar, path: '/teacher/schedule' }
      ]
    },
    {
      group: 'School Forms',
      items: [
        { key: 'teacher_forms_sf1', label: 'SF1 — School Register', icon: FileSpreadsheet, path: '/teacher/forms/sf1' },
        { key: 'teacher_forms_sf5', label: 'SF5 — Promotion Report', icon: BarChart2, path: '/teacher/forms/sf5' },
        { key: 'teacher_forms_sf9', label: 'SF9 — Report Card', icon: FileText, path: '/teacher/forms/sf9' },
        { key: 'teacher_forms_sf10', label: 'SF10 — Permanent Record', icon: BookOpen, path: '/teacher/forms/sf10' }
      ]
    },
    {
      group: 'Academic',
      items: [
        { key: 'teacher_grades', label: 'Grade Management', icon: BookOpen, path: '/teacher/grades' },
        { key: 'teacher_upload', label: 'Upload Grades', icon: Upload, path: '/teacher/upload' },
        { key: 'teacher_documents', label: 'Document Management', icon: FileText, path: '/teacher/documents' },
        { key: 'teacher_atrisk', label: 'At-Risk Detection', icon: AlertTriangle, path: '/teacher/atrisk' }
      ]
    },
    {
      group: 'Account',
      items: [
        { key: 'teacher_profile', label: 'My Profile', icon: User, path: '/teacher/profile' },
        { key: 'teacher_guide', label: 'System Guide', icon: BookOpen, path: '/teacher/guide' }
      ]
    }
  ],
  registrar: [
    {
      group: 'Overview',
      items: [{ key: 'registrar_dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/registrar' }]
    },
    {
      group: 'Records',
      items: [
        { key: 'registrar_students', label: 'Student Search', icon: Search, path: '/registrar/students' },
        { key: 'registrar_section_assignment', label: 'Section Assignment', icon: Layers, path: '/registrar/section-assignment' },
        { key: 'registrar_promotions', label: 'Promotion Records', icon: GraduationCap, path: '/registrar/promotions' },
        { key: 'registrar_graduates', label: 'Alumni / Graduates', icon: Award, path: '/registrar/graduates' },
        { key: 'registrar_subjects', label: 'Subject Directory', icon: BookOpen, path: '/registrar/subjects' }
      ]
    },
    {
      group: 'School Forms',
      items: [
        { key: 'registrar_forms_sf1', label: 'SF1 — School Register', icon: FileSpreadsheet, path: '/registrar/forms/sf1' },
        { key: 'registrar_forms_sf5', label: 'SF5 — Promotion Report', icon: BarChart2, path: '/registrar/forms/sf5' },
        { key: 'registrar_forms_sf9', label: 'SF9 — Report Card', icon: FileText, path: '/registrar/forms/sf9' },
        { key: 'registrar_forms_sf10', label: 'SF10 — Permanent Record', icon: BookOpen, path: '/registrar/forms/sf10' }
      ]
    },
    {
      group: 'Reports & Monitoring',
      items: [
        { key: 'registrar_reports', label: 'Enrollment Report', icon: BarChart2, path: '/registrar/reports' },
        { key: 'registrar_sections', label: 'Section Management', icon: Layers, path: '/registrar/sections' },
        { key: 'registrar_grade_distribution', label: 'Grade Distribution', icon: BarChart2, path: '/registrar/grade-distribution' },
        { key: 'registrar_grade_corrections', label: 'Grade Corrections', icon: MessageSquare, path: '/registrar/grade-corrections' },
        { key: 'registrar_document_completion', label: 'Document Completion', icon: ClipboardList, path: '/registrar/document-completion' },
        { key: 'registrar_atrisk', label: 'At-Risk Students', icon: AlertTriangle, path: '/registrar/atrisk' }
      ]
    },
    {
      group: 'Certificates',
      items: [
        { key: 'registrar_certificate_enrollment', label: 'Certificate of Enrollment', icon: FileText, path: '/registrar/certificates/enrollment' },
        { key: 'registrar_certificate_good_moral', label: 'Good Moral Certificate', icon: UserCheck, path: '/registrar/certificates/good-moral' }
      ]
    },
    {
      group: 'Account',
      items: [
        { key: 'registrar_profile', label: 'My Profile', icon: User, path: '/registrar/profile' },
        { key: 'registrar_guide', label: 'System Guide', icon: BookOpen, path: '/registrar/guide' }
      ]
    }
  ],
  principal: [
    {
      group: 'Overview',
      items: [{ key: 'principal_dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/principal' }]
    },
    {
      group: 'Enrollment',
      items: [
        { key: 'principal_enrollment', label: 'Enrollment Figures', icon: TrendingUp, path: '/principal/enrollment-figures' },
        { key: 'principal_enrollment_trend', label: 'Enrollment Trend', icon: BarChart2, path: '/principal/enrollment-trend' },
        { key: 'principal_sections', label: 'Section Population', icon: PieChart, path: '/principal/section-population' }
      ]
    },
    {
      group: 'Academic',
      items: [
        { key: 'principal_grades', label: 'Grade Progress', icon: ClipboardList, path: '/principal/grade-progress' },
        { key: 'principal_promotions', label: 'Promotion Stats', icon: GraduationCap, path: '/principal/promotion-stats' },
        { key: 'principal_graduates', label: 'Alumni / Graduates', icon: Award, path: '/principal/graduates' },
        { key: 'principal_atrisk', label: 'At-Risk Students', icon: AlertTriangle, path: '/principal/at-risk' }
      ]
    },
    {
      group: 'Account',
      items: [
        { key: 'principal_profile', label: 'My Profile', icon: User, path: '/principal/profile' },
        { key: 'principal_guide', label: 'System Guide', icon: BookOpen, path: '/principal/guide' }
      ]
    }
  ]
};

/**
 * Menu keys that can never be disabled from the RBAC page — the role's
 * landing page, profile, and system guide stay always available so a
 * role can never be locked out of its own account section.
 */
export const CORE_KEYS: Record<Role, string[]> = {
  admin: ['admin_dashboard', 'admin_profile', 'admin_guide'],
  teacher: ['teacher_dashboard', 'teacher_profile', 'teacher_guide'],
  registrar: ['registrar_dashboard', 'registrar_profile', 'registrar_guide'],
  principal: ['principal_dashboard', 'principal_profile', 'principal_guide']
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  teacher: 'Teacher',
  registrar: 'Registrar',
  principal: 'Principal'
};
