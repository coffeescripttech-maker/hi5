import React, { useState, useEffect } from "react";
import { UserPlus, UserCheck, RefreshCw, Search, ChevronRight, Check, AlertCircle, CheckCircle, ArrowLeft, User, MapPin, Phone, BookOpen, FileText, X, UserMinus } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { studentsApi, StudentRow, CreateStudentPayload } from "../../services/students";
import { enrollmentsApi } from "../../services/enrollments";
import { schoolYearsApi } from "../../services/schoolYears";
import { sectionsApi, SectionRow } from "../../services/sections";

type Flow = "select" | "new" | "returning" | "drop";
type NewStep = 1 | 2 | 3 | 4 | 5;
type RetStep = 1 | 2 | 3 | 4;
type DropStep = 1 | 2 | 3;

const DROP_REASONS = [
  "Dropout — Family/Financial Reasons",
  "Dropout — Health Reasons",
  "Dropout — Relocation",
  "Transfer Out — To Another Public School",
  "Transfer Out — To Private School",
  "Transfer In — From Another School",
  "Other",
];

const GRADE_LEVELS = [7, 8, 9, 10, 11, 12];

const genStudentID = (grade: number) => {
  const yr = new Date().getFullYear() + 1;
  const g = String(grade).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `${yr}-${g}-${seq}`;
};

const getSection = (avg: number | null) => {
  if (avg === null) return "Pending Section";
  if (avg >= 90) return "Star Section";
  if (avg >= 85) return "Gold Section";
  if (avg >= 80) return "Silver Section";
  if (avg >= 75) return "Regular Section";
  return "Non-Reader Section";
};

export function EnrollmentModule() {
  const { showToast } = useApp();
  const [flow, setFlow] = useState<Flow>("select");

  // New student state
  const [newStep, setNewStep] = useState<NewStep>(1);
  const [newData, setNewData] = useState({
    firstName: "", middleName: "", lastName: "",
    birthdate: "", sex: "Female",
    address: "", lrn: "", guardian: "", contact: "",
    classifications: [] as string[],
  });
  const [newGrade, setNewGrade] = useState<number | null>(null);
  const [newStudentID, setNewStudentID] = useState("");
  const [enrolledNew, setEnrolledNew] = useState(false);
  const [gradeFile, setGradeFile] = useState<File | null>(null);

  // Returning student state
  const [retStep, setRetStep] = useState<RetStep>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [foundStudent, setFoundStudent] = useState<StudentRow | null>(null);
  const [retGrade, setRetGrade] = useState<number | null>(null);
  const [enrolledRet, setEnrolledRet] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Drop/Transfer state
  const [dropStep, setDropStep] = useState<DropStep>(1);
  const [dropSearch, setDropSearch] = useState("");
  const [dropFound, setDropFound] = useState<StudentRow | null>(null);
  const [dropNotFound, setDropNotFound] = useState(false);
  const [dropReason, setDropReason] = useState("");
  const [dropRemarks, setDropRemarks] = useState("");
  const [dropDone, setDropDone] = useState(false);

  // API data state
  const [allStudents, setAllStudents] = useState<StudentRow[]>([]);
  const [allSections, setAllSections] = useState<SectionRow[]>([]);
  const [selectedSYId, setSelectedSYId] = useState<number>(1);

  // Fetch data on mount
  useEffect(() => {
    Promise.all([
      studentsApi.list(),
      sectionsApi.list(),
      schoolYearsApi.list(),
    ]).then(([students, sections, years]) => {
      setAllStudents(students);
      setAllSections(sections);
      const current = years.find(y => y.is_current === 1);
      if (current) setSelectedSYId(current.id);
    }).catch(err => {
      showToast("error", "Failed to load data: " + (err.detail?.error || err.message));
    });
  }, []);

  const toggleClassification = (val: string) => {
    setNewData(d => ({
      ...d,
      classifications: d.classifications.includes(val)
        ? d.classifications.filter(c => c !== val)
        : [...d.classifications, val],
    }));
  };

  const handleNewNext = () => {
    if (newStep === 2 && newGrade) {
      setNewStudentID(genStudentID(newGrade));
      setNewStep(3);
    } else if (newStep < 5) {
      setNewStep((newStep + 1) as NewStep);
    }
  };

  const handleSearch = () => {
    const found = allStudents.find(
      s => s.lrn === searchQuery || s.student_id === searchQuery
    );
    if (found) {
      setFoundStudent(found);
      setNotFound(false);
      setRetStep(2);
    } else {
      setNotFound(true);
    }
  };

  const handleRetNext = () => {
    if (retStep === 3 && retGrade) setRetStep(4);
    else if (retStep < 4) setRetStep((retStep + 1) as RetStep);
  };

  const resetAll = () => {
    setFlow("select");
    setNewStep(1);
    setNewData({ firstName: "", middleName: "", lastName: "", birthdate: "", sex: "Female", address: "", lrn: "", guardian: "", contact: "", classifications: [] });
    setNewGrade(null);
    setNewStudentID("");
    setGradeFile(null);
    setEnrolledNew(false);
    setRetStep(1);
    setSearchQuery("");
    setFoundStudent(null);
    setRetGrade(null);
    setEnrolledRet(false);
    setNotFound(false);
    setDropStep(1);
    setDropSearch("");
    setDropFound(null);
    setDropNotFound(false);
    setDropReason("");
    setDropRemarks("");
    setDropDone(false);
  };

  const handleConfirmNewEnrollment = async () => {
    if (!newGrade) return;
    try {
      const fullName = [newData.firstName, newData.middleName, newData.lastName].filter(Boolean).join(" ");
      const created = await studentsApi.create({
        student_id: newStudentID,
        lrn: newData.lrn,
        name: fullName,
        grade_level: newGrade,
        sex: newData.sex.toLowerCase() as "male" | "female",
        birthdate: newData.birthdate,
        address: newData.address || undefined,
        guardian: newData.guardian || undefined,
        contact: newData.contact || undefined,
      });
      // Find a section for this grade level
      const sectionMatch = allSections.find(s => s.grade_level === newGrade && s.current_count < s.capacity);
      if (sectionMatch) {
        await enrollmentsApi.create({
          student_id: created.id,
          section_id: sectionMatch.id,
          school_year_id: selectedSYId,
          enrollment_date: new Date().toISOString().split("T")[0],
        });
      }
      // Add classifications
      for (const cls of newData.classifications) {
        const clsMap: Record<string, string> = {
          "4Ps Beneficiary": "4ps",
          "PWD": "pwd",
          "Transferee": "transferee",
          "Non-Reader": "non_reader",
        };
        try {
          await studentsApi.addClassification(created.id, {
            classification: clsMap[cls] || "regular",
            school_year_id: selectedSYId,
          });
        } catch { /* skip individual failures */ }
      }
      setEnrolledNew(true);
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to enroll student");
    }
  };

  const handleConfirmReturning = async () => {
    if (!foundStudent || !retGrade) return;
    try {
      const sectionMatch = allSections.find(s => s.grade_level === retGrade && s.current_count < s.capacity);
      await enrollmentsApi.create({
        student_id: foundStudent.id,
        section_id: sectionMatch?.id || 0,
        school_year_id: selectedSYId,
        enrollment_date: new Date().toISOString().split("T")[0],
      });
      await studentsApi.update(foundStudent.id, { status: "enrolled" });
      setEnrolledRet(true);
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to re-enroll student");
    }
  };

  const handleConfirmDrop = async () => {
    if (!dropFound) return;
    try {
      const isTransferIn = dropReason.includes("Transfer In");
      const isTransfer = dropReason.includes("Transfer");
      const lbl = isTransferIn ? "Transfer In" : isTransfer ? "Transfer Out" : "Dropout";
      const newStatus = isTransferIn ? "transferred" : isTransfer ? "transferred" : "dropped";
      await studentsApi.update(dropFound.id, { status: newStatus as "dropped" | "transferred" });
      showToast("success", `${lbl} processed for ${dropFound.name}.`);
      setDropDone(true);
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to process drop/transfer");
    }
  };

  // ── FLOW SELECT ──────────────────────────────────────────
  if (flow === "select") {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <UserCheck size={20} className="text-green-700" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Enrollment Module</h2>
            <p className="text-gray-500 text-sm">Select enrollment type to proceed</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setFlow("new")}
              className="group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-green-200 hover:border-green-500 hover:bg-green-50 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <div className="w-16 h-16 bg-green-100 group-hover:bg-green-200 rounded-2xl flex items-center justify-center transition">
                <UserPlus size={30} className="text-green-700" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-800 text-lg">Enroll New Student</p>
                <p className="text-gray-500 text-sm mt-1">Complete data entry for first-time enrollees</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {["Full data entry", "Auto-ID generation", "Section assignment"].map(t => (
                    <span key={t} className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 text-green-700 font-medium text-sm group-hover:gap-3 transition-all">
                Start Enrollment <ChevronRight size={16} />
              </div>
            </button>

            <button
              onClick={() => setFlow("returning")}
              className="group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <div className="w-16 h-16 bg-emerald-100 group-hover:bg-emerald-200 rounded-2xl flex items-center justify-center transition">
                <RefreshCw size={30} className="text-emerald-700" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-800 text-lg">Enroll Returning Student</p>
                <p className="text-gray-500 text-sm mt-1">Auto-populate from existing records via LRN</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {["LRN search", "Auto-populate", "Grade promotion"].map(t => (
                    <span key={t} className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 text-emerald-700 font-medium text-sm group-hover:gap-3 transition-all">
                Search Student <ChevronRight size={16} />
              </div>
            </button>

            <button
              onClick={() => setFlow("drop")}
              className="group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-red-100 hover:border-red-400 hover:bg-red-50 transition-all duration-200 shadow-sm hover:shadow-md md:col-span-2"
            >
              <div className="w-16 h-16 bg-red-100 group-hover:bg-red-200 rounded-2xl flex items-center justify-center transition">
                <UserMinus size={30} className="text-red-600" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-800 text-lg">Student Drop / Transfer</p>
                <p className="text-gray-500 text-sm mt-1">Process student dropout or school transfer with official reason documentation</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {["Dropout processing", "Transfer Out", "Transfer In", "Reason on record"].map(t => (
                    <span key={t} className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 text-red-600 font-medium text-sm group-hover:gap-3 transition-all">
                Process Drop / Transfer <ChevronRight size={16} />
              </div>
            </button>
          </div>
        </div>

        {/* Recently enrolled */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Recently Enrolled Students</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">Student ID</th>
                  <th className="text-left px-6 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">LRN</th>
                  <th className="text-left px-6 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">Grade</th>
                  <th className="text-left px-6 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">Section</th>
                  <th className="text-left px-6 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allStudents.filter(s => s.status === "enrolled").slice(0, 6).map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3.5 font-mono text-xs text-gray-600">{s.student_id}</td>
                    <td className="px-6 py-3.5 font-medium text-gray-800">{s.name}</td>
                    <td className="px-6 py-3.5 font-mono text-xs text-gray-500">{s.lrn}</td>
                    <td className="px-6 py-3.5 text-gray-600">Grade {s.grade_level}</td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">—</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">Enrolled</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── NEW STUDENT FLOW ──────────────────────────────────────
  if (flow === "new") {
    const steps = ["Personal Details", "Grade Level", "Student ID", "Preview & Confirm"];
    const fullName = [newData.firstName, newData.middleName, newData.lastName].filter(Boolean).join(" ");

    if (enrolledNew) {
      return (
        <div className="max-w-lg mx-auto text-center py-16">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Enrollment Successful!</h2>
          <p className="text-gray-500 mb-4">{fullName} has been successfully enrolled.</p>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-600">Student ID Generated:</p>
            <p className="text-2xl font-bold text-green-700 font-mono mt-1">{newStudentID}</p>
            <p className="text-xs text-gray-400 mt-1">Grade {newGrade} · Section: Pending (awaiting grade computation)</p>
          </div>
          <button onClick={resetAll} className="bg-green-700 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-800 transition">
            Enroll Another Student
          </button>
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={resetAll} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="font-bold text-gray-800">Enroll New Student</h2>
            <p className="text-gray-500 text-sm">Complete all steps to finish enrollment</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 z-0" style={{ left: "10%", right: "10%" }} />
            {steps.map((s, i) => {
              const stepNum = i + 1;
              const done = newStep > stepNum;
              const active = newStep === stepNum;
              return (
                <div key={s} className="flex flex-col items-center gap-1.5 z-10 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    done ? "bg-green-600 text-white" : active ? "bg-green-700 text-white ring-4 ring-green-100" : "bg-gray-100 text-gray-400"
                  }`}>
                    {done ? <Check size={14} /> : stepNum}
                  </div>
                  <p className={`text-xs text-center hidden sm:block ${active ? "text-green-700 font-semibold" : done ? "text-green-600" : "text-gray-400"}`}>{s}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          {newStep === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2"><User size={18} className="text-green-600" /> Personal Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">First Name *</label>
                  <input type="text" value={newData.firstName} onChange={e => setNewData({...newData, firstName: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Maria" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Middle Name</label>
                  <input type="text" value={newData.middleName} onChange={e => setNewData({...newData, middleName: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Cruz" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Last Name *</label>
                  <input type="text" value={newData.lastName} onChange={e => setNewData({...newData, lastName: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Santos" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Birthdate *</label>
                  <input type="date" value={newData.birthdate} onChange={e => setNewData({...newData, birthdate: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sex *</label>
                  <select value={newData.sex} onChange={e => setNewData({...newData, sex: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option>Female</option>
                    <option>Male</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1"><MapPin size={12} className="inline mr-1" />Complete Address *</label>
                <input type="text" value={newData.address} onChange={e => setNewData({...newData, address: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="House No., Street, Barangay, City/Municipality, Province" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">LRN (12 digits) *</label>
                  <input type="text" maxLength={12} value={newData.lrn} onChange={e => setNewData({...newData, lrn: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="000000000000" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Guardian Name *</label>
                  <input type="text" value={newData.guardian} onChange={e => setNewData({...newData, guardian: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Full name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1"><Phone size={12} className="inline mr-1" />Contact Number *</label>
                  <input type="text" value={newData.contact} onChange={e => setNewData({...newData, contact: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="09XXXXXXXXX" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Classification (check all that apply)</label>
                <div className="flex flex-wrap gap-3">
                  {["4Ps Beneficiary", "PWD", "Transferee", "Non-Reader"].map(cls => (
                    <label key={cls} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${newData.classifications.includes(cls) ? "border-green-400 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                      <input type="checkbox" checked={newData.classifications.includes(cls)} onChange={() => toggleClassification(cls)} className="accent-green-600" />
                      <span className="text-sm">{cls}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {newStep === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2"><BookOpen size={18} className="text-green-600" /> Select Grade Level</h3>
              <p className="text-gray-500 text-sm">Select the grade level for the new student</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {GRADE_LEVELS.map(g => (
                  <button
                    key={g}
                    onClick={() => setNewGrade(g)}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${newGrade === g ? "border-green-500 bg-green-50 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <p className={`font-bold text-lg ${newGrade === g ? "text-green-700" : "text-gray-700"}`}>Grade {g}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{g <= 10 ? "Junior High" : "Senior High"}</p>
                    {newGrade === g && <p className="text-xs text-green-600 mt-1 font-medium">✓ Selected</p>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {newStep === 5 && (
            <div className="space-y-4 text-center">
              <h3 className="font-semibold text-gray-800">Auto-Generated Student ID</h3>
              <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-8">
                <p className="text-gray-500 text-sm mb-2">System Generated Student ID</p>
                <p className="text-4xl font-black text-green-700 font-mono tracking-wider">{newStudentID}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-gray-500">
                  <span><span className="font-bold text-gray-700">{newStudentID.split("-")[0]}</span> = School Year</span>
                  <span><span className="font-bold text-gray-700">{newStudentID.split("-")[1]}</span> = Grade Level</span>
                  <span><span className="font-bold text-gray-700">{newStudentID.split("-")[2]}</span> = Sequence No.</span>
                </div>
              </div>
              <p className="text-gray-400 text-sm">This ID is unique and will be used for all records of this student.</p>
            </div>
          )}

          {newStep === 5 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800">Enrollment Preview</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Student Information</p>
                  {[
                    ["Full Name", fullName || "—"],
                    ["Student ID", newStudentID],
                    ["LRN", newData.lrn || "—"],
                    ["Birthdate", newData.birthdate || "—"],
                    ["Sex", newData.sex],
                    ["Grade Level", `Grade ${newGrade}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-gray-500">{k}:</span>
                      <span className="font-medium text-gray-800 text-right max-w-[60%]">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contact & Classification</p>
                  {[
                    ["Address", newData.address || "—"],
                    ["Guardian", newData.guardian || "—"],
                    ["Contact", newData.contact || "—"],
                    ["Classification", newData.classifications.join(", ") || "None"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-gray-500">{k}:</span>
                      <span className="font-medium text-gray-800 text-right max-w-[60%]">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
                <AlertCircle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-orange-700 text-sm">Section Status: Pending Section</p>
                  <p className="text-orange-600 text-xs mt-0.5">New students without previous grades are temporarily assigned to Pending Section until their average is computed. The system will automatically move them to the appropriate section once grades are uploaded and computed.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {newStep > 1 && (
            <button
              onClick={() => setNewStep((newStep - 1) as NewStep)}
              className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
            >
              Back
            </button>
          )}
          {newStep < 4 ? (
            <button
              onClick={handleNewNext}
              disabled={newStep === 2 && !newGrade}
              className="flex-1 bg-green-700 hover:bg-green-800 text-white py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {newStep === 3 ? "Continue to Preview" : "Next Step"}
            </button>
          ) : (
            <button
              onClick={handleConfirmNewEnrollment}
              className="flex-1 bg-green-700 hover:bg-green-800 text-white py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
            >
              <CheckCircle size={16} /> Confirm Enrollment
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── RETURNING STUDENT FLOW ────────────────────────────────
  if (flow === "returning") {
    if (enrolledRet && foundStudent) {
      return (
        <div className="max-w-lg mx-auto text-center py-16">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Re-enrollment Successful!</h2>
          <p className="text-gray-500 mb-4">{foundStudent.name} has been enrolled for Grade {retGrade}.</p>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Student ID:</span>
              <span className="font-bold text-gray-800 font-mono">{foundStudent.student_id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Previous Grade:</span>
              <span className="font-medium text-gray-700">Grade {foundStudent.grade_level}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">New Grade:</span>
              <span className="font-bold text-green-700">Grade {retGrade}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Assigned Section:</span>
              <span className="font-bold text-green-700">—</span>
            </div>
          </div>
          <button onClick={resetAll} className="bg-green-700 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-800 transition">
            Enroll Another Student
          </button>
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={resetAll} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="font-bold text-gray-800">Enroll Returning Student</h2>
            <p className="text-gray-500 text-sm">Search by LRN or Student ID to auto-populate student records</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 z-0" style={{ left: "10%", right: "10%" }} />
            {["Search LRN/ID", "Auto-populated Details", "Select Grade Level", "Confirm"].map((s, i) => {
              const stepNum = i + 1;
              const done = retStep > stepNum;
              const active = retStep === stepNum;
              return (
                <div key={s} className="flex flex-col items-center gap-1.5 z-10 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${done ? "bg-green-600 text-white" : active ? "bg-green-700 text-white ring-4 ring-green-100" : "bg-gray-100 text-gray-400"}`}>
                    {done ? <Check size={14} /> : stepNum}
                  </div>
                  <p className={`text-xs text-center hidden sm:block ${active ? "text-green-700 font-semibold" : done ? "text-green-600" : "text-gray-400"}`}>{s}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          {retStep === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800">Search Student Record</h3>
              <p className="text-gray-500 text-sm">Enter the student's LRN or Student ID to retrieve their record.</p>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setNotFound(false); }}
                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter LRN (e.g. 123456789012) or Student ID (e.g. 2026-07-0001)"
                  />
                </div>
                <button onClick={handleSearch} className="bg-green-700 hover:bg-green-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition">
                  Search
                </button>
              </div>
              {notFound && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm">
                  <AlertCircle size={16} />
                  No student record found for "{searchQuery}". Please check the LRN or Student ID.
                </div>
              )}
              {allStudents.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-500 font-medium mb-2">Existing students (click to try):</p>
                  {allStudents.slice(0, 4).map(s => (
                    <button key={s.lrn} onClick={() => { setSearchQuery(s.lrn); setNotFound(false); }} className="text-xs text-green-600 hover:underline mr-3">
                      {s.lrn} ({s.name})
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {retStep === 2 && foundStudent && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle size={18} />
                <h3 className="font-semibold">Record Found – Auto-populated</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-3">Student Information</p>
                  {[
                    ["Full Name", foundStudent.name],
                    ["Student ID", foundStudent.student_id],
                    ["LRN", foundStudent.lrn],
                    ["Sex", foundStudent.sex === "male" ? "Male" : "Female"],
                    ["Address", foundStudent.address || "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-gray-500">{k}:</span>
                      <span className="font-medium text-gray-800 text-right max-w-[55%]">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3">Previous Academic Record</p>
                  {[
                    ["Previous Grade", `Grade ${foundStudent.grade_level}`],
                    ["Guardian", foundStudent.guardian || "—"],
                    ["Contact", foundStudent.contact || "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-gray-500">{k}:</span>
                      <span className="font-medium text-gray-800">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {retStep === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800">Select New Grade Level</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {GRADE_LEVELS.map(g => (
                  <button
                    key={g}
                    onClick={() => setRetGrade(g)}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${retGrade === g ? "border-green-500 bg-green-50 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <p className={`font-bold text-lg ${retGrade === g ? "text-green-700" : "text-gray-700"}`}>Grade {g}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{g <= 10 ? "Junior High" : "Senior High"}</p>
                    {retGrade === g && <p className="text-xs text-green-600 mt-1 font-medium">✓ Selected</p>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {retStep === 4 && foundStudent && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800">Confirm Re-Enrollment</h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                {[
                  ["Student Name", foundStudent.name],
                  ["Student ID", foundStudent.student_id],
                  ["LRN", foundStudent.lrn],
                  ["Previous Grade", `Grade ${foundStudent.grade_level}`],
                  ["New Grade Level", `Grade ${retGrade}`],
                  ["Assigned Section", getSection(null)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                    <span className="text-gray-500">{k}:</span>
                    <span className={`font-medium ${k === "Assigned Section" ? "text-green-700" : "text-gray-800"}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          {retStep > 1 && (
            <button onClick={() => setRetStep((retStep - 1) as RetStep)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
              Back
            </button>
          )}
          {retStep < 4 ? (
            <button
              onClick={handleRetNext}
              disabled={retStep === 3 && !retGrade}
              className="flex-1 bg-green-700 hover:bg-green-800 text-white py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              Next Step
            </button>
          ) : (
            <button onClick={handleConfirmReturning} className="flex-1 bg-green-700 hover:bg-green-800 text-white py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
              <CheckCircle size={16} /> Confirm Re-Enrollment
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── DROP / TRANSFER FLOW ─────────────────────────────────
  if (flow === "drop") {
    const isTransferIn = dropReason.includes("Transfer In");
    const isTransfer = dropReason.includes("Transfer");
    const actionLabel = isTransferIn ? "Transfer In" : isTransfer ? "Transfer Out" : "Dropout";

    if (dropDone && dropFound) {
      return (
        <div className="max-w-lg mx-auto text-center py-16">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">{actionLabel} Processed</h2>
          <p className="text-gray-500 mb-4">{dropFound.name}'s record has been updated with {actionLabel} status.</p>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Student:</span><span className="font-bold text-gray-800">{dropFound.name}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Student ID:</span><span className="font-mono text-gray-700">{dropFound.student_id}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Action:</span><span className="font-bold text-red-700">{actionLabel}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Reason:</span><span className="font-medium text-gray-700 text-right max-w-[55%]">{dropReason}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Date Processed:</span><span className="font-medium text-gray-700">{new Date().toLocaleDateString("en-PH")}</span></div>
          </div>
          <button onClick={resetAll} className="bg-red-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-red-700 transition">
            Process Another
          </button>
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={resetAll} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="font-bold text-gray-800">Student Drop / Transfer</h2>
            <p className="text-gray-500 text-sm">Search for a student, select action reason, and confirm</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 z-0" style={{ left: "10%", right: "10%" }} />
            {["Search Student", "Select Reason", "Confirm"].map((s, i) => {
              const stepNum = i + 1;
              const done = dropStep > stepNum;
              const active = dropStep === stepNum;
              return (
                <div key={s} className="flex flex-col items-center gap-1.5 z-10 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${done ? "bg-red-500 text-white" : active ? "bg-red-600 text-white ring-4 ring-red-100" : "bg-gray-100 text-gray-400"}`}>
                    {done ? <Check size={14} /> : stepNum}
                  </div>
                  <p className={`text-xs text-center hidden sm:block ${active ? "text-red-700 font-semibold" : done ? "text-red-500" : "text-gray-400"}`}>{s}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          {/* Step 1 — Search */}
          {dropStep === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Search size={16} className="text-red-500" /> Search Student Record</h3>
              <p className="text-gray-500 text-sm">Enter the student's LRN or Student ID to locate their record.</p>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text" value={dropSearch}
                    onChange={e => { setDropSearch(e.target.value); setDropNotFound(false); }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        const found = allStudents.find(s => s.lrn === dropSearch || s.student_id === dropSearch);
                        if (found) { setDropFound(found); setDropNotFound(false); setDropStep(2); }
                        else setDropNotFound(true);
                      }
                    }}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="Enter LRN or Student ID"
                  />
                </div>
                <button
                  onClick={() => {
                    const found = allStudents.find(s => s.lrn === dropSearch || s.student_id === dropSearch);
                    if (found) { setDropFound(found); setDropNotFound(false); setDropStep(2); }
                    else setDropNotFound(true);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition"
                >
                  Search
                </button>
              </div>
              {dropNotFound && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm">
                  <AlertCircle size={16} /> No record found for "{dropSearch}". Please check the LRN or Student ID.
                </div>
              )}
              {allStudents.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-500 font-medium mb-2">Existing students (click to try):</p>
                  {allStudents.slice(0, 4).map(s => (
                    <button key={s.lrn} onClick={() => { setDropSearch(s.lrn); setDropNotFound(false); }} className="text-xs text-red-500 hover:underline mr-3">
                      {s.lrn} ({s.name})
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Select Reason */}
          {dropStep === 2 && dropFound && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-red-600">
                <CheckCircle size={18} />
                <h3 className="font-semibold">Student Found — Select Action & Reason</h3>
              </div>
              {/* Student info strip */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-red-200 rounded-full flex items-center justify-center text-red-800 font-bold text-sm flex-shrink-0">
                  {dropFound.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800">{dropFound.name}</p>
                  <p className="text-xs text-gray-500">ID: {dropFound.student_id} · LRN: {dropFound.lrn} · Grade {dropFound.grade_level}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Action / Reason *</label>
                <div className="space-y-2">
                  {DROP_REASONS.map(r => (
                    <label key={r} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition ${dropReason === r ? "border-red-400 bg-red-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <input type="radio" name="dropReason" value={r} checked={dropReason === r} onChange={() => setDropReason(r)} className="accent-red-600" />
                      <span className="text-sm text-gray-700">{r}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Additional Remarks (optional)</label>
                <textarea
                  value={dropRemarks}
                  onChange={e => setDropRemarks(e.target.value)}
                  rows={3}
                  placeholder="Any additional information for the record..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 3 — Confirm */}
          {dropStep === 3 && dropFound && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800">Confirm {actionLabel}</h3>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                {[
                  ["Student Name", dropFound.name],
                  ["Student ID", dropFound.student_id],
                  ["LRN", dropFound.lrn],
                  ["Current Grade", `Grade ${dropFound.grade_level}`],
                  ["Action", actionLabel],
                  ["Reason", dropReason],
                  ...(dropRemarks ? [["Remarks", dropRemarks]] : []),
                  ["Date Processed", new Date().toLocaleDateString("en-PH")],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm border-b border-red-100 pb-2 last:border-0 last:pb-0">
                    <span className="text-gray-500">{k}:</span>
                    <span className={`font-medium text-right max-w-[60%] ${k === "Action" ? "text-red-700 font-bold" : "text-gray-800"}`}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">This action will update the student's enrollment status in the system. The student's academic records will be preserved for reference and SF10 generation.</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {dropStep > 1 && (
            <button onClick={() => setDropStep((dropStep - 1) as DropStep)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
              Back
            </button>
          )}
          {dropStep < 3 ? (
            <button
              onClick={() => setDropStep((dropStep + 1) as DropStep)}
              disabled={dropStep === 2 && !dropReason}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition"
            >
              Next Step
            </button>
          ) : (
            <button
              onClick={handleConfirmDrop}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
            >
              <CheckCircle size={16} /> Confirm {actionLabel}
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
