import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, User, BookOpen, BarChart2, FileSpreadsheet, Layers,
  Phone, MapPin, Calendar, ChevronRight, CheckCircle, AlertCircle,
  GraduationCap, Hash, Shield, Download, Clock, Award, IdCard,
  Mail, Globe, Star, Activity, ExternalLink, MoreHorizontal,
  CreditCard, BadgeCheck, Bookmark, Users, Target
} from "lucide-react";
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

const STATUS_BADGE: Record<string, { bg: string; ring: string; label: string }> = {
  enrolled: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200/50", ring: "ring-emerald-500/20", label: "Enrolled" },
  pending: { bg: "bg-amber-50 text-amber-700 border-amber-200/50", ring: "ring-amber-500/20", label: "Pending" },
  dropped: { bg: "bg-red-50 text-red-600 border-red-200/50", ring: "ring-red-500/20", label: "Dropped" },
  transferred: { bg: "bg-blue-50 text-blue-700 border-blue-200/50", ring: "ring-blue-500/20", label: "Transferred" },
  graduated: { bg: "bg-purple-50 text-purple-700 border-purple-200/50", ring: "ring-purple-500/20", label: "Graduated" },
};

interface DetailRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
  highlight?: boolean;
  copyable?: boolean;
}

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
    setLoading(true);
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

  // ── helpers ──
  const getInitials = (name: string): string =>
    name.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  const statusBadge = student
    ? STATUS_BADGE[student.status] || {
        bg: "bg-gray-50 text-gray-500 border-gray-200/50",
        ring: "ring-gray-500/20",
        label: student.status,
      }
    : null;

  const DetailRow = ({ icon: Icon, label, value, highlight, copyable }: DetailRowProps) => (
    <div className="group flex items-start gap-3 py-3 border-b border-gray-100 last:border-0 transition-colors hover:bg-gray-50/40 px-3 -mx-3 rounded-lg">
      <div className="w-8 h-8 rounded-lg bg-gray-100/70 group-hover:bg-white flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors">
        <Icon size={14} className="text-gray-400 group-hover:text-gray-500 transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.05em]">{label}</p>
        <p className={`text-sm mt-0.5 ${highlight ? "font-bold text-emerald-700" : "font-medium text-gray-800"}`}>
          {value || "—"}
        </p>
      </div>
      {copyable && value && value !== "—" && (
        <button
          type="button"
          onClick={() => { navigator.clipboard.writeText(value); showToast("success", "Copied!"); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200/60 rounded-md mt-0.5"
          title="Copy"
        >
          <CreditCard size={13} className="text-gray-400" />
        </button>
      )}
    </div>
  );

  // ── loading skeleton ──
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-5">
        {/* skeleton header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
          <div className="h-1.5 bg-gradient-to-r from-emerald-200 via-green-200 to-emerald-200" />
          <div className="p-6 space-y-5">
            <div className="h-4 w-16 bg-gray-100 rounded-md" />
            <div className="flex items-start gap-5">
              <div className="w-20 h-20 rounded-2xl bg-gray-100" />
              <div className="flex-1 space-y-3 pt-1">
                <div className="h-6 w-48 bg-gray-100 rounded-lg" />
                <div className="h-4 w-36 bg-gray-50 rounded-md" />
                <div className="flex gap-2">
                  <div className="h-6 w-24 bg-gray-50 rounded-lg" />
                  <div className="h-6 w-20 bg-gray-50 rounded-lg" />
                  <div className="h-6 w-16 bg-gray-50 rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* skeleton tabs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
          <div className="flex gap-2 px-4 py-4 border-b border-gray-100">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-8 w-32 bg-gray-50 rounded-lg" />
            ))}
          </div>
          <div className="p-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="h-48 bg-gray-50 rounded-xl" />
            <div className="h-48 bg-gray-50 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // ── not found ──
  if (!student) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-300" />
          </div>
          <p className="text-gray-500 text-base font-semibold">Student not found</p>
          <p className="text-gray-400 text-sm mt-1">The student record may have been removed or the link is invalid.</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition"
          >
            <ArrowLeft size={14} /> Go back
          </button>
        </div>
      </div>
    );
  }

  // ── main ──
  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">

      {/* ────────── HERO CARD ────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow duration-200">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400" />
        <div className="p-5 sm:p-7">
          <button
            onClick={() => navigate(-1)}
            className="group flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition mb-5"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Back
          </button>

          <div className="flex flex-col sm:flex-row items-start gap-5 sm:gap-7">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-emerald-500 via-green-500 to-emerald-600 shadow-lg shadow-emerald-200/50 flex items-center justify-center">
                <span className="text-white text-2xl sm:text-3xl font-black tracking-tight">
                  {getInitials(student.name)}
                </span>
              </div>
              {/* status dot */}
              <span
                className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white shadow-sm
                  ${student.status === "enrolled" || student.status === "graduated" ? "bg-emerald-500" : ""}
                  ${student.status === "pending" ? "bg-amber-400" : ""}
                  ${student.status === "dropped" ? "bg-red-500" : ""}
                  ${student.status === "transferred" ? "bg-blue-500" : ""}
                `}
                title={statusBadge?.label || student.status}
              />
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 pt-1 w-full">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">{student.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-gray-400 text-sm font-mono">LRN: {student.lrn}</p>
                    <span className="text-gray-200">·</span>
                    <p className="text-gray-400 text-sm font-mono">ID: {student.student_id}</p>
                  </div>
                </div>
                {statusBadge && (
                  <span className={`inline-flex self-start items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border shadow-sm ${statusBadge.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.ring} bg-current`} />
                    {statusBadge.label}
                  </span>
                )}
              </div>

              {/* Badge row */}
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-emerald-200/50 shadow-xs">
                  <GraduationCap size={12} /> Grade {student.grade_level}
                </span>
                {student.enrollment && (
                  <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-blue-200/50 shadow-xs">
                    <BookOpen size={12} /> {student.enrollment.section_name}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-purple-200/50 capitalize shadow-xs">
                  <User size={12} /> {student.sex}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ────────── QUICK STATS ROW ────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: GraduationCap, label: "Grade Level", value: `Grade ${student.grade_level}`, color: "emerald" },
          { icon: BookOpen, label: "Current Section", value: student.enrollment?.section_name || "—", color: "blue" },
          { icon: Calendar, label: "Enrolled Date", value: student.enrollment?.enrollment_date || "—", color: "amber" },
          { icon: Activity, label: "Status", value: statusBadge?.label || student.status, color: student.status === "enrolled" ? "green" : student.status === "pending" ? "amber" : "gray" },
        ].map((stat, i) => {
          const colorMap: Record<string, string> = {
            emerald: "from-emerald-50 to-green-50 border-emerald-200/50 text-emerald-700",
            blue: "from-blue-50 to-indigo-50 border-blue-200/50 text-blue-700",
            amber: "from-amber-50 to-yellow-50 border-amber-200/50 text-amber-700",
            green: "from-emerald-50 to-green-50 border-emerald-200/50 text-emerald-700",
            gray: "from-gray-50 to-gray-50 border-gray-200/50 text-gray-600",
          };
          const badgeColor = student.status === "dropped" ? "from-red-50 to-red-50 border-red-200/50 text-red-600" : colorMap[stat.color] || colorMap.gray;
          return (
            <div
              key={i}
              className={`bg-gradient-to-br ${badgeColor} rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-default`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <stat.icon size={14} className="opacity-70" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em] opacity-70">{stat.label}</span>
              </div>
              <p className="text-base font-bold">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* ────────── TABS + CONTENT ────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow duration-200">
        {/* Tab bar */}
        <div className="border-b border-gray-100 overflow-x-auto">
          <div className="flex px-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-4 py-4 text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                    active
                      ? "text-emerald-700"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {/* background */}
                  <span
                    className={`absolute inset-0 transition-all duration-200 ${
                      active ? "bg-emerald-50/60" : "hover:bg-gray-50/60"
                    }`}
                  />
                  {/* active bottom bar */}
                  {active && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-emerald-500 to-green-400 rounded-full" />
                  )}
                  <Icon size={15} className={`relative ${active ? "text-emerald-500" : "text-gray-400"}`} />
                  <span className="relative">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div className="p-5 sm:p-7">

          {/* ══════ PERSONAL INFO ══════ */}
          {activeTab === "personal" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="bg-gradient-to-br from-gray-50/80 to-white border border-gray-100 rounded-xl overflow-hidden transition-shadow duration-200 hover:shadow-sm">
                <div className="flex items-center gap-2.5 px-5 pt-5 pb-3 border-b border-gray-100">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-xs">
                    <User size={14} className="text-emerald-700" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">Basic Information</h4>
                    <p className="text-[10px] text-gray-400 font-medium">Personal details and identifiers</p>
                  </div>
                </div>
                <div className="p-3">
                  <DetailRow icon={User} label="Full Name" value={student.name} />
                  <DetailRow icon={Hash} label="Student ID" value={student.student_id} copyable />
                  <DetailRow icon={IdCard} label="LRN" value={student.lrn} copyable />
                  <DetailRow icon={Calendar} label="Date of Birth" value={student.birthdate} />
                  <DetailRow icon={User} label="Sex" value={student.sex.charAt(0).toUpperCase() + student.sex.slice(1)} />
                  <DetailRow icon={GraduationCap} label="Grade Level" value={`Grade ${student.grade_level}`} highlight />
                </div>
              </div>

              {/* Contact Details */}
              <div className="bg-gradient-to-br from-gray-50/80 to-white border border-gray-100 rounded-xl overflow-hidden transition-shadow duration-200 hover:shadow-sm">
                <div className="flex items-center gap-2.5 px-5 pt-5 pb-3 border-b border-gray-100">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shadow-xs">
                    <Phone size={14} className="text-blue-700" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">Contact Details</h4>
                    <p className="text-[10px] text-gray-400 font-medium">Address and guardian information</p>
                  </div>
                </div>
                <div className="p-3">
                  <DetailRow icon={MapPin} label="Address" value={student.address || "Not provided"} />
                  <DetailRow icon={User} label="Guardian" value={student.guardian || "Not provided"} />
                  <DetailRow icon={Phone} label="Contact No." value={student.contact || "Not provided"} />
                  <DetailRow icon={Shield} label="Status" value={statusBadge?.label || student.status} />
                </div>
              </div>
            </div>
          )}

          {/* ══════ ENROLLMENT HISTORY ══════ */}
          {activeTab === "enrollment" && (
            <div>
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center">
                  <BookOpen size={14} className="text-emerald-700" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-800">Enrollment Records</h4>
                  <p className="text-[10px] text-gray-400 font-medium">Historical enrollment across school years</p>
                </div>
                <span className="ml-auto bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-emerald-100 shadow-xs">
                  {enrollments.length} record{enrollments.length !== 1 ? "s" : ""}
                </span>
              </div>

              {enrollments.length === 0 ? (
                <div className="text-center py-16 bg-gray-50/50 rounded-xl border border-gray-100">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                    <BookOpen size={32} className="text-emerald-300" />
                  </div>
                  <p className="text-gray-500 text-sm font-semibold">No enrollment records found</p>
                  <p className="text-gray-400 text-xs mt-1 max-w-xs mx-auto leading-relaxed">
                    Enrollment history will appear once the student is enrolled in a section.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="bg-gradient-to-r from-gray-50 to-gray-50/80">
                        {["School Year", "Grade Level", "Section", "Program", "Enrollment Date", "Status"].map(h => (
                          <th key={h} className="text-left px-5 py-3.5 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em] border-b border-gray-100">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {enrollments.map((e, idx) => {
                        const badge = STATUS_BADGE[e.status] || { bg: "bg-gray-50 text-gray-500 border-gray-200/50", ring: "", label: e.status };
                        return (
                          <tr
                            key={e.id}
                            className={`transition-all duration-150 ${
                              idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                            } hover:bg-emerald-50/40 hover:shadow-xs`}
                          >
                            <td className="px-5 py-4 font-semibold text-gray-800 text-sm">{e.sy_label}</td>
                            <td className="px-5 py-4 text-gray-600 text-sm">Grade {e.grade_level}</td>
                            <td className="px-5 py-4 text-gray-600 text-sm font-medium">{e.section_name}</td>
                            <td className="px-5 py-4">
                              <span className="text-[11px] font-medium text-gray-500 capitalize bg-gray-100 px-2 py-0.5 rounded-md">{e.program || "regular"}</span>
                            </td>
                            <td className="px-5 py-4 text-gray-500 text-sm">{e.enrollment_date}</td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border capitalize ${badge.bg}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                {badge.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══════ GRADE HISTORY ══════ */}
          {activeTab === "grades" && (
            <div>
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-100 to-yellow-100 flex items-center justify-center">
                  <BarChart2 size={14} className="text-amber-700" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-800">Grade History</h4>
                  <p className="text-[10px] text-gray-400 font-medium">Academic performance records per subject</p>
                </div>
              </div>

              <div className="text-center py-16 bg-gradient-to-b from-gray-50/80 to-white rounded-xl border border-gray-100">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <BarChart2 size={32} className="text-amber-400" />
                </div>
                <p className="text-gray-500 text-sm font-semibold mb-1">No Grade Records Yet</p>
                <p className="text-gray-400 text-xs max-w-sm mx-auto leading-relaxed">
                  Grade records will appear here once teachers encode them in the Grade Management module.
                  Each subject will display the final rating, equivalent descriptor, and school year.
                </p>
              </div>
            </div>
          )}

          {/* ══════ UPLOADED FILES ══════ */}
          {activeTab === "files" && (
            <div>
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                  <FileSpreadsheet size={14} className="text-blue-700" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-800">Uploaded Documents & Files</h4>
                  <p className="text-[10px] text-gray-400 font-medium">Requirements, forms, and other attachments</p>
                </div>
              </div>

              <div className="text-center py-16 bg-gradient-to-b from-gray-50/80 to-white rounded-xl border border-gray-100">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <FileSpreadsheet size={32} className="text-gray-300" />
                </div>
                <p className="text-gray-500 text-sm font-semibold mb-1">No Documents Uploaded</p>
                <p className="text-gray-400 text-xs max-w-sm mx-auto leading-relaxed">
                  Uploaded documents such as report cards (Form 138), Good Moral certificates,
                  PSA birth certificate, and other enrollment requirements will appear here.
                </p>
              </div>
            </div>
          )}

          {/* ══════ SECTION HISTORY ══════ */}
          {activeTab === "sections" && (
            <div>
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                  <Layers size={14} className="text-purple-700" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-800">Section Assignment History</h4>
                  <p className="text-[10px] text-gray-400 font-medium">All sections the student has been assigned to</p>
                </div>
                <span className="ml-auto bg-purple-50 text-purple-700 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-purple-100 shadow-xs">
                  {enrollments.length} record{enrollments.length !== 1 ? "s" : ""}
                </span>
              </div>

              {enrollments.length === 0 ? (
                <div className="text-center py-16 bg-gray-50/50 rounded-xl border border-gray-100">
                  <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-4">
                    <Layers size={32} className="text-purple-300" />
                  </div>
                  <p className="text-gray-500 text-sm font-semibold">No section assignment records found</p>
                  <p className="text-gray-400 text-xs mt-1 max-w-xs mx-auto leading-relaxed">
                    Section assignments will appear once the student is enrolled in a section.
                  </p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-6 top-3 bottom-3 w-0.5 bg-gradient-to-b from-emerald-200 via-blue-200 to-purple-200 rounded-full hidden sm:block" />

                  <div className="space-y-4">
                    {enrollments.map((e, idx) => {
                      const badge = STATUS_BADGE[e.status] || { bg: "bg-gray-50 text-gray-500 border-gray-200/50", ring: "", label: e.status };
                      const isEven = idx % 2 === 0;
                      const accentColor = isEven ? "emerald" : "blue";
                      const accentBg = isEven ? "bg-emerald-500" : "bg-blue-500";
                      const lightBg = isEven ? "bg-emerald-50/60" : "bg-blue-50/60";
                      const borderColor = isEven ? "border-emerald-200/60" : "border-blue-200/60";

                      return (
                        <div
                          key={e.id}
                          className={`relative flex gap-4 sm:gap-6 p-5 rounded-xl border ${borderColor} ${lightBg} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
                        >
                          {/* Timeline dot (desktop) */}
                          <div className={`hidden sm:flex w-12 h-12 rounded-xl ${accentBg} shadow-lg shadow-${accentColor}-500/20 items-center justify-center flex-shrink-0 mt-0.5 text-white text-lg`}>
                            {isEven ? "🏫" : "📚"}
                          </div>

                          {/* Mobile icon */}
                          <div className={`sm:hidden w-10 h-10 rounded-xl ${isEven ? "bg-emerald-100" : "bg-blue-100"} flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm`}>
                            <span className="text-base">{isEven ? "🏫" : "📚"}</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-gray-900">{e.section_name}</p>
                                  <span className="hidden sm:inline text-gray-300">·</span>
                                  <span className="text-xs font-medium text-gray-400">{e.program || "Regular"}</span>
                                </div>
                                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1.5 text-sm text-gray-500">
                                  <span className="inline-flex items-center gap-1.5">
                                    <Calendar size={12} className="text-gray-400" />
                                    SY {e.sy_label}
                                  </span>
                                  <span className="inline-flex items-center gap-1.5">
                                    <GraduationCap size={12} className="text-gray-400" />
                                    Grade {e.grade_level}
                                  </span>
                                  <span className="inline-flex items-center gap-1.5">
                                    <Clock size={12} className="text-gray-400" />
                                    {e.enrollment_date}
                                  </span>
                                </div>
                              </div>
                              <span className={`inline-flex self-start items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border whitespace-nowrap shadow-xs ${badge.bg}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                {badge.label}
                              </span>
                            </div>
                            {e.remarks && (
                              <div className="mt-3 pt-3 border-t border-gray-200/50">
                                <p className="text-xs text-gray-400 italic flex items-start gap-1.5">
                                  <span className="font-medium text-gray-500 not-italic">Remarks:</span>
                                  {e.remarks}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
