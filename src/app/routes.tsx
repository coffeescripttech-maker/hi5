import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
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
import { GradeManagement } from "./pages/teacher/GradeManagement";
import { UploadGrades } from "./pages/teacher/UploadGrades";
import { AutoSectioning } from "./pages/teacher/AutoSectioning";
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
import { RegistrarProfile } from "./pages/registrar/RegistrarProfile";
import { SubjectView } from "./pages/registrar/SubjectView";
import { SectionAssignment } from "./pages/registrar/SectionAssignment";
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

export const router = createBrowserRouter([
  { path: "/login", Component: Login },
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
      { path: "sections", Component: SectionCreation },
      { path: "forms/:formCode?", Component: SchoolForms },
    ],
  },
  {
    path: "/teacher", Component: Layout,
    children: [
      { index: true, Component: TeacherDashboard },
      { path: "enroll", Component: EnrollmentModule },
      { path: "grades", Component: GradeManagement },
      { path: "upload", Component: UploadGrades },
      { path: "sectioning", Component: AutoSectioning },
      { path: "sections", Component: SectionManagement },
      { path: "promote", Component: BulkPromotion },
      { path: "atrisk", Component: AtRiskDetection },
      { path: "profile", Component: TeacherProfile },
      { path: "documents", Component: DocumentManagement },
      { path: "my-students", Component: StudentList },
      { path: "schedule", Component: TeacherSchedule },
      { path: "guide", Component: SystemGuide },
      { path: "forms/:formCode?", Component: SchoolForms },
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
      { path: "profile", Component: RegistrarProfile },
      { path: "sections", Component: SectionCreation },
      { path: "subjects", Component: SubjectView },
      { path: "section-assignment", Component: SectionAssignment },
      { path: "certificates/enrollment", Component: CertificateOfEnrollment },
      { path: "certificates/good-moral", Component: GoodMoralCertificate },
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
      { path: "profile", Component: PrincipalProfile },
      { path: "guide", Component: SystemGuide },
    ],
  },
  { path: "/student/:id", Component: Layout, children: [{ index: true, Component: StudentProfile }] },
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "*", Component: NotFound },
]);
