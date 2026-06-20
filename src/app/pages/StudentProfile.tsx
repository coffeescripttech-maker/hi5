import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, User, BookOpen, BarChart2, FileSpreadsheet, Layers, Phone, MapPin, Download } from "lucide-react";
import { studentsApi, StudentDetail } from "../services/students";
import { enrollmentsApi, EnrollmentRow } from "../services/enrollments";
import { useApp } from "../context/AppContext";

const TABS = [
  { id: "personal", label: "Personal Information", icon: User },
  { id: "enrollment", label: "Enrollment History", icon: BookOpen },
  { id: "grades", label: "Grade History", icon: BarChart2 },
  { id: "files", label: "Uploaded Files", icon: FileSpreadsheet },
  { id: "sections", label: "Section History", icon: Layers },
];

export function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [activeTab, setActiveTab] = useState("personal");
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const studentId = parseInt(id);
    if (isNaN(studentId)) {
      showToast("error", "Invalid student ID");
      navigate(-1);
      return;
    }
    Promise.all([
      studentsApi.get(studentId),
      enrollmentsApi.list(),
    ]).then(([stud, enrs]) => {
      setStudent(stud);
      setEnrollments(enrs.filter(e => e.student_id === studentId));
    }).catch(err => {
      showToast("error", "Failed to load student: " + (err.detail?.error || err.message));
      navigate(-1);
    }).finally(() => setLoading(false));
  }, [id]);

  const getDescriptor = (avg: number): string => {
    if (avg >= 90) return "Outstanding";
    if (avg >= 85) return "Very Satisfactory";
    if (avg >= 80) return "Satisfactory";
    if (avg >= 75) return "Fairly Satisfactory";
    return "Did Not Meet Expectations";
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-400 text-sm">Loading student profile...</div>;
  }

  if (!student) {
    return <div className="p-10 text-center text-gray-400 text-sm">Student not found.</div>;
  }

  return (
    <div className="space-y-5">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition flex-shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="font-bold text-gray-800">Student Profile</h2>
          <p className="text-gray-500 text-sm">ID: {student.student_id}</p>
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-green-700 to-emerald-600 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-white text-2xl font-black">{student.name.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-xl">{student.name}</h3>
              <p className="text-green-200 text-sm mt-0.5">
                LRN: <span className="font-mono font-bold">{student.lrn}</span>
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full font-medium">Grade {student.grade_level}</span>
                {student.enrollment && (
                  <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full font-medium">{student.enrollment.section_name} Section</span>
                )}
                <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full font-medium capitalize">{student.sex}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-100 overflow-x-auto">
          <div className="flex">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                    activeTab === tab.id
                      ? "border-green-600 text-green-700"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Personal Info */}
          {activeTab === "personal" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wider">Basic Information</h4>
                {[
                  ["Full Name", student.name],
                  ["Student ID", student.student_id],
                  ["LRN", student.lrn],
                  ["Date of Birth", student.birthdate],
                  ["Sex", student.sex.charAt(0).toUpperCase() + student.sex.slice(1)],
                  ["Grade Level", `Grade ${student.grade_level}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <span className="text-gray-400 text-sm w-36 flex-shrink-0">{k}</span>
                    <span className="font-medium text-gray-800 text-sm">{v}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wider">Contact Details</h4>
                {[
                  ["Address", student.address || "—"],
                  ["Guardian", student.guardian || "—"],
                  ["Contact No.", student.contact || "—"],
                  ["Status", student.status.charAt(0).toUpperCase() + student.status.slice(1)],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <span className="text-gray-400 text-sm w-36 flex-shrink-0">{k}</span>
                    <span className="font-medium text-gray-800 text-sm">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Enrollment History */}
          {activeTab === "enrollment" && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-4">Enrollment Records</h4>
              {enrollments.length === 0 ? (
                <p className="text-gray-400 text-sm">No enrollment records found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-100 rounded-xl overflow-hidden">
                    <thead>
                      <tr className="bg-gray-50">
                        {["School Year", "Grade Level", "Section", "Enrollment Date", "Status"].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {enrollments.map(e => (
                        <tr key={e.id} className="border-t border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{e.sy_label}</td>
                          <td className="px-4 py-3 text-gray-600">Grade {e.grade_level}</td>
                          <td className="px-4 py-3 text-gray-600">{e.section_name}</td>
                          <td className="px-4 py-3 text-gray-600">{e.enrollment_date}</td>
                          <td className="px-4 py-3">
                            <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full capitalize">{e.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Grade History */}
          {activeTab === "grades" && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-4">Grade History</h4>
              <p className="text-gray-400 text-sm">Grade records will be displayed here once available. Teachers can encode grades in the Grade Management module.</p>
            </div>
          )}

          {/* Uploaded Files */}
          {activeTab === "files" && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-3">Uploaded Documents & Files</h4>
              <p className="text-gray-400 text-sm">No documents uploaded yet.</p>
            </div>
          )}

          {/* Section History */}
          {activeTab === "sections" && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-4">Section Assignment History</h4>
              {enrollments.length === 0 ? (
                <p className="text-gray-400 text-sm">No section assignment records found.</p>
              ) : (
                <div className="space-y-3">
                  {enrollments.map(e => (
                    <div key={e.id} className="flex gap-4 p-4 rounded-xl border bg-green-50 border-green-200">
                      <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-lg">📋</span>
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">{e.section_name}</p>
                        <p className="text-gray-500 text-sm">SY {e.sy_label} · Grade {e.grade_level}</p>
                        <p className="text-gray-500 text-xs mt-1">Enrolled: {e.enrollment_date}</p>
                        <p className="text-gray-400 text-xs mt-0.5">Status: {e.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
