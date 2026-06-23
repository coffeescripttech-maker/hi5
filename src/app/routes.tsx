import React from "react";
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
import { RegistrarDashboard } from "./pages/registrar/RegistrarDashboard";
import { StudentSearch } from "./pages/registrar/StudentSearch";
import { SchoolForms } from "./pages/registrar/SchoolForms";
import { Reports } from "./pages/registrar/Reports";
import { EnrollmentReport } from "./pages/registrar/EnrollmentReport";
import { PromotionRecords } from "./pages/registrar/PromotionRecords";
import { RegistrarAtRisk } from "./pages/registrar/RegistrarAtRisk";
import { RegistrarProfile } from "./pages/registrar/RegistrarProfile";
import { SubjectView } from "./pages/registrar/SubjectView";
import { SectionAssignment } from "./pages/registrar/SectionAssignment";
import { StudentProfile } from "./pages/StudentProfile";
import { NotFound } from "./pages/NotFound";
import { logsApi, ActivityLogRow } from "./services/logs";

function ActivityLogs() {
  const [logs, setLogs] = React.useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    logsApi.list({ limit: 100 })
      .then(setLogs)
      .catch(err => setError(err.detail?.error || err.message || "Failed to load logs"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="font-bold text-gray-800">System Activity Logs</h2>
        <p className="text-gray-500 text-sm mt-0.5">Full audit trail of all user actions in the system</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading logs...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500 text-sm">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-50 border-b border-blue-100">
                  <th className="text-left px-5 py-3.5 text-blue-700 font-semibold text-xs uppercase tracking-wider">Timestamp</th>
                  <th className="text-left px-4 py-3.5 text-blue-700 font-semibold text-xs uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3.5 text-blue-700 font-semibold text-xs uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3.5 text-blue-700 font-semibold text-xs uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-400 text-sm">No logs found.</td></tr>
                ) : logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-blue-50/20 transition">
                    <td className="px-5 py-3.5 text-gray-400 text-xs font-mono whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("en-PH")}
                    </td>
                    <td className="px-4 py-3.5 text-gray-700 font-medium text-xs">{log.user_name || "System"}</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">—</span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 text-xs">{log.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  { path: "/login", Component: Login },
  {
    path: "/admin", Component: Layout,
    children: [
      { index: true, Component: AdminDashboard },
      { path: "users", Component: UserManagement },
      { path: "logs", Component: ActivityLogs },
      { path: "settings", Component: SchoolSettings },
      { path: "academic-year", Component: AcademicYearManagement },
      { path: "profile", Component: AdminProfile },
      { path: "backup", Component: DatabaseBackup },
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
      { path: "forms/:formCode?", Component: SchoolForms },
    ],
  },
  {
    path: "/registrar", Component: Layout,
    children: [
      { index: true, Component: RegistrarDashboard },
      { path: "students", Component: StudentSearch },
      { path: "forms/:formCode?", Component: SchoolForms },
      { path: "reports", Component: Reports },
      { path: "enrollment-report", Component: EnrollmentReport },
      { path: "promotions", Component: PromotionRecords },
      { path: "atrisk", Component: RegistrarAtRisk },
      { path: "profile", Component: RegistrarProfile },
      { path: "sections", Component: SectionCreation },
      { path: "subjects", Component: SubjectView },
      { path: "section-assignment", Component: SectionAssignment },
    ],
  },
  { path: "/student/:id", Component: Layout, children: [{ index: true, Component: StudentProfile }] },
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "*", Component: NotFound },
]);
