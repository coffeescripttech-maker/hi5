import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { ResetPassword } from "./pages/ResetPassword";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { UserManagement } from "./pages/admin/UserManagement";
import { SchoolSettings } from "./pages/admin/SchoolSettings";
import { AcademicYearManagement } from "./pages/admin/AcademicYearManagement";
import { AdminProfile } from "./pages/admin/AdminProfile";
import { SubjectManagement } from "./pages/admin/SubjectManagement";
import { DocumentManagement } from "./pages/teacher/DocumentManagement";
import { DatabaseBackup } from "./pages/admin/DatabaseBackup";
import { SectionCreation } from "./pages/admin/SectionCreation";
import { RoleAccessControl } from "./pages/admin/RoleAccessControl";
import { LisExport } from "./pages/admin/LisExport";
import { TeacherDashboard } from "./pages/teacher/TeacherDashboard";
import { EnrollmentModule } from "./pages/teacher/EnrollmentModule";
import { ReadingAssessments } from "./pages/teacher/ReadingAssessments";
import { GradeManagement } from "./pages/teacher/GradeManagement";
import { UploadGrades } from "./pages/teacher/UploadGrades";
import { SectionManagement } from "./pages/teacher/SectionManagement";
import { BulkPromotion } from "./pages/teacher/BulkPromotion";
import { AtRiskDetection } from "./pages/teacher/AtRiskDetection";
import { TeacherProfile } from "./pages/teacher/TeacherProfile";
import { StudentList } from "./pages/teacher/StudentList";
import { TeacherSchedule } from "./pages/teacher/TeacherSchedule";
import { RegistrarDashboard } from "./pages/registrar/RegistrarDashboard";
import { StudentSearch } from "./pages/registrar/StudentSearch";
import { SchoolForms } from "./pages/registrar/SchoolForms";
import { Reports } from "./pages/registrar/Reports";
import { EnrollmentReport } from "./pages/registrar/EnrollmentReport";
import { PromotionRecords } from "./pages/registrar/PromotionRecords";
import { Graduates } from "./pages/registrar/Graduates";
import { RegistrarAtRisk } from "./pages/registrar/RegistrarAtRisk";
import { GradeDistribution } from "./pages/registrar/GradeDistribution";
import { GradeCorrections } from "./pages/registrar/GradeCorrections";
import { DocumentCompletion } from "./pages/registrar/DocumentCompletion";
import { TransferManagement } from "./pages/registrar/TransferManagement";
import { RegistrarProfile } from "./pages/registrar/RegistrarProfile";
import { SubjectView } from "./pages/registrar/SubjectView";
import { SectionAssignment } from "./pages/registrar/SectionAssignment";
import { ScheduleModifier } from "./pages/registrar/ScheduleModifier";
import { MasterSchedule } from "./pages/registrar/MasterSchedule";
import { LisExport as RegistrarLisExport } from "./pages/registrar/LisExport";
import { PrincipalExportCenter } from "./pages/principal/PrincipalExportCenter";
import { CertificateOfEnrollment } from "./pages/registrar/CertificateOfEnrollment";
import { GoodMoralCertificate } from "./pages/registrar/GoodMoralCertificate";
import { PrincipalDashboard } from "./pages/principal/PrincipalDashboard";
import { EnrollmentFigures } from "./pages/principal/EnrollmentFigures";
import { GradeProgress } from "./pages/principal/GradeProgress";
import { AtRiskView } from "./pages/principal/AtRiskView";
import { EnrollmentTrend } from "./pages/principal/EnrollmentTrend";
import { PromotionStats } from "./pages/principal/PromotionStats";
import { SectionPopulation } from "./pages/principal/SectionPopulation";
import { PrincipalProfile } from "./pages/principal/PrincipalProfile";
import { StudentProfile } from "./pages/StudentProfile";
import { SystemGuide } from "./pages/SystemGuide";
import { NotFound } from "./pages/NotFound";
import { ActivityLogs } from "./pages/admin/ActivityLogs";
import { AdminRooms } from "./pages/admin/AdminRooms";
import { CommitteeDashboard } from "./pages/committee/CommitteeDashboard";
import { TransferApprovals } from "./pages/committee/TransferApprovals";

export const router = createBrowserRouter([
  { path: "/login", Component: Login },
  { path: "/reset-password", Component: ResetPassword },
  {
    path: "/admin", Component: Layout,
    children: [
      { index: true, Component: AdminDashboard },
      { path: "users", Component: UserManagement },
      { path: "logs", Component: ActivityLogs },
      { path: "guide", Component: SystemGuide },
      { path: "settings", Component: SchoolSettings },
      { path: "academic-year", Component: AcademicYearManagement },
      { path: "profile", Component: AdminProfile },
      { path: "backup", Component: DatabaseBackup },
      { path: "access-control", Component: RoleAccessControl },
      { path: "lis-export", Component: LisExport },
      { path: "subjects", Component: SubjectManagement },
      { path: "rooms", Component: AdminRooms },
      { path: "sections", Component: SectionCreation },
      { path: "forms/:formCode?", Component: SchoolForms },
    ],
  },
  {
    path: "/teacher", Component: Layout,
    children: [
      { index: true, Component: TeacherDashboard },
      { path: "reading-assessments", Component: ReadingAssessments },
      { path: "grades", Component: GradeManagement },
      { path: "upload", Component: UploadGrades },
      { path: "sections", Component: SectionManagement },
      { path: "promote", Component: BulkPromotion },
      { path: "atrisk", Component: AtRiskDetection },
      { path: "profile", Component: TeacherProfile },
      { path: "documents", Component: DocumentManagement },
      { path: "my-students", Component: StudentList },
      { path: "schedule", Component: TeacherSchedule },
      { path: "guide", Component: SystemGuide },
      { path: "forms/:formCode?", Component: SchoolForms },
      // Section assignment and enrollment are committee duties; teachers kept the
      // routes earlier only to read their own sections, which SectionManagement
      // and StudentList already cover. Re-point the old paths so a stale bookmark
      // lands on the teacher-visible page instead of a removed module.
      { path: "enroll", element: <Navigate to="/teacher/my-students" replace /> },
      { path: "sectioning", element: <Navigate to="/teacher/sections" replace /> },
    ],
  },
  {
    path: "/registrar", Component: Layout,
    children: [
      { index: true, Component: RegistrarDashboard },
      { path: "students", Component: StudentSearch },
      { path: "graduates", Component: Graduates },
      { path: "forms/:formCode?", Component: SchoolForms },
      { path: "reports", Component: Reports },
      { path: "enrollment-report", Component: EnrollmentReport },
      { path: "promotions", Component: PromotionRecords },
      { path: "atrisk", Component: RegistrarAtRisk },
      { path: "grade-distribution", Component: GradeDistribution },
      { path: "grade-corrections", Component: GradeCorrections },
      { path: "document-completion", Component: DocumentCompletion },
      { path: "transfers", Component: TransferManagement },
      { path: "profile", Component: RegistrarProfile },
      { path: "sections", Component: SectionCreation },
      { path: "subjects", Component: SubjectView },
      { path: "section-assignment", Component: SectionAssignment },
      { path: "schedule-modifier", Component: ScheduleModifier },
      { path: "master-schedule", Component: MasterSchedule },
      { path: "lis-export", Component: RegistrarLisExport },
      { path: "certificates/enrollment", Component: CertificateOfEnrollment },
      { path: "certificates/good-moral", Component: GoodMoralCertificate },
      { path: "guide", Component: SystemGuide },
    ],
  },
  {
    // Enrollment Committee: its own duty pages. The duty modules themselves are
    // the shared Registrar/Admin components (enrollment, section assignment,
    // document checklist) — the committee holds Admin-equivalent permissions and
    // simply owns the decision. Transfer approvals are committee-only.
    path: "/committee", Component: Layout,
    children: [
      { index: true, Component: CommitteeDashboard },
      { path: "transfers", Component: TransferApprovals },
      { path: "enrollment", Component: EnrollmentModule },
      { path: "section-assignment", Component: SectionAssignment },
      { path: "documents", Component: DocumentCompletion },
      { path: "guide", Component: SystemGuide },
    ],
  },
  {
    path: "/principal", Component: Layout,
    children: [
      { index: true, Component: PrincipalDashboard },
      { path: "enrollment-figures", Component: EnrollmentFigures },
      { path: "enrollment", Component: EnrollmentFigures },
      { path: "grade-progress", Component: GradeProgress },
      { path: "grades", Component: GradeProgress },
      { path: "at-risk", Component: AtRiskView },
      { path: "enrollment-trend", Component: EnrollmentTrend },
      { path: "graduates", Component: Graduates },
      { path: "promotion-stats", Component: PromotionStats },
      { path: "promotions", Component: PromotionStats },
      { path: "section-population", Component: SectionPopulation },
      { path: "sections", Component: SectionPopulation },
      { path: "exports/:section", Component: PrincipalExportCenter },
      { path: "profile", Component: PrincipalProfile },
      { path: "guide", Component: SystemGuide },
    ],
  },
  { path: "/student/:id", Component: Layout, children: [{ index: true, Component: StudentProfile }] },
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "*", Component: NotFound },
]);
