import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import {
  FileText,
  Download,
  Printer,
  X,
  Lock,
  CheckCircle,
  Shield,
  ChevronRight,
  FileSpreadsheet,
  BarChart2,
  BookOpen,
  ClipboardList
} from 'lucide-react';
import { studentsApi, StudentRow } from '../../services/students';
import { sectionsApi, SectionRow } from '../../services/sections';
import { enrollmentsApi, EnrollmentRow } from '../../services/enrollments';
import { useApp } from '../../context/AppContext';
import { SF1Register } from './sf1-register';
import { SF5Report } from './sf5-report';
import { SF9Report } from './sf9-report';

// --- Form Definitions ---
interface SchoolForm {
  code: string;
  title: string;
  subtitle: string;
  desc: string;
  icon: React.ReactNode;
  accessible: boolean;
  lockedReason?: string;
  managedBy?: string;
  authority?: string;
  color: string;
  border: string;
  bg: string;
  badge: string;
}

const SCHOOL_FORMS: SchoolForm[] = [
  {
    code: 'SF1',
    title: 'School Form 1',
    subtitle: 'School Register',
    desc: 'Official list of all enrolled learners with personal information, LRN, sex, age, classification (4Ps, PWD), and section assignment.',
    icon: <FileSpreadsheet size={22} className="text-blue-600" />,
    accessible: true,
    color: 'blue',
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    badge: 'bg-blue-100 text-blue-700'
  },
  {
    code: 'SF5',
    title: 'School Form 5',
    subtitle: 'Report on Promotion & Level of Proficiency',
    desc: 'End-of-year summary showing the number of learners promoted, retained, and dropped per grade level per section.',
    icon: <BarChart2 size={22} className="text-emerald-600" />,
    accessible: true,
    color: 'emerald',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700'
  },
  {
    code: 'SF9',
    title: 'School Form 9',
    subtitle: "Learner's Progress Report Card",
    desc: 'Quarterly report card per learner showing grades per subject, general average, attendance summary, and class adviser remarks.',
    icon: <ClipboardList size={22} className="text-violet-600" />,
    accessible: true,
    color: 'violet',
    border: 'border-violet-200',
    bg: 'bg-violet-50',
    badge: 'bg-violet-100 text-violet-700'
  },
  {
    code: 'SF10',
    title: 'School Form 10',
    subtitle: "Learner's Permanent Academic Record",
    desc: 'Comprehensive and permanent academic history record per learner, including all grades, attendance, and promotion status from all grade levels attended.',
    icon: <BookOpen size={22} className="text-indigo-600" />,
    accessible: true,
    color: 'indigo',
    border: 'border-indigo-200',
    bg: 'bg-indigo-50',
    badge: 'bg-indigo-100 text-indigo-700'
  }
];

type ActiveForm = 'SF1' | 'SF5' | 'SF9' | 'SF10' | null;

export function SchoolForms() {
  const { showToast, role } = useApp();
  const { formCode } = useParams<{ formCode?: string }>();
  const userLabel = role === 'teacher' ? 'Class Adviser' : role === 'admin' ? 'Admin' : 'Registrar';
  const initialForm = formCode?.toUpperCase() as ActiveForm;
  const [activeForm, setActiveForm] = useState<ActiveForm>(initialForm || null);
  const [selectedGrade, setSelectedGrade] = useState('7');

  // Sync form when navigating between SF routes
  useEffect(() => {
    if (formCode) {
      const code = formCode.toUpperCase() as ActiveForm;
      setActiveForm(code);
      setGenerated(false);
    }
  }, [formCode]);
  const [selectedSection, setSelectedSection] = useState('Star');
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(
    null
  );
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  // API data
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([studentsApi.list(), sectionsApi.list(), enrollmentsApi.list()])
      .then(([studs, secs, enrs]) => {
        setStudents(studs);
        setSections(secs);
        setEnrollments(enrs);
        if (studs.length > 0) setSelectedStudentId(studs[0].id);
      })
      .catch(err => {
        showToast(
          'error',
          'Failed to load data: ' + (err.detail?.error || err.message)
        );
      })
      .finally(() => setLoading(false));
  }, []);

  // Enrolled students for selected grade
  const studentsInGrade = students.filter(
    s => s.grade_level === parseInt(selectedGrade) && s.status === 'enrolled'
  );

  // Enrollment stats per grade level (derived from real data)
  const gradeLevels = [7, 8, 9, 10, 11, 12];
  const enrollmentStats = gradeLevels.map(g => {
    const enrolled = enrollments.filter(
      e => e.grade_level === g && e.status === 'enrolled'
    ).length;
    return { grade: `Grade ${g}`, enrolled, capacity: 0 };
  });

  const handleGenerate = () => {
    setGenerating(true);
    setGenerated(false);
    setTimeout(() => {
      setGenerating(false);
      setGenerated(true);
    }, 1400);
  };

  const currentForm = SCHOOL_FORMS.find(f => f.code === activeForm);
  const accessibleForms = SCHOOL_FORMS.filter(f => f.accessible);
  const selectedStudent = students.find(s => s.id === selectedStudentId);

  if (loading) {
    return (
      <div className="p-10 text-center text-gray-400 text-sm">
        Loading form data...
      </div>
    );
  }

  // SF1 gets the full interactive fillable register (not a modal preview)
  if (formCode?.toUpperCase() === 'SF1') {
    return <SF1Register />;
  }

  // SF5 gets the full interactive fillable report
  if (formCode?.toUpperCase() === 'SF5') {
    return <SF5Report />;
  }

  // SF9 gets the full report card with grade+section+student filters
  if (formCode?.toUpperCase() === 'SF9') {
    return <SF9Report />;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <FileSpreadsheet size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg">
              Official School Form Generation
            </h2>
            <p className="text-blue-200 text-sm">
              DepEd-authorized forms — {userLabel} access
            </p>
          </div>
        </div>
      </div>

      {/* Legal Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Shield size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-amber-800 text-sm font-semibold">
            Legal Compliance Notice
          </p>
          <p className="text-amber-700 text-xs mt-0.5 leading-relaxed">
            Forms are generated in accordance with DepEd Order No. 74, s. 2010
            and DepEd Order No. 8, s. 2015.
            {role === 'teacher'
              ? ' Generated forms must be submitted to the Registrar for official stamping.'
              : ''}
          </p>
        </div>
      </div>

      {/* Accessible Forms */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle size={16} className="text-emerald-500" />
          <h3 className="font-semibold text-gray-800">
            Forms Available to {userLabel}
          </h3>
          <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-medium border border-emerald-200">
            {accessibleForms.length} forms
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {accessibleForms.map(form => (
            <button
              key={form.code}
              onClick={() => {
                setActiveForm(form.code as ActiveForm);
                setGenerated(false);
              }}
              className={`bg-white text-left rounded-xl border-2 ${form.border} hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group flex flex-col`}>
              <div
                className={`${form.bg} px-4 py-3 flex items-center justify-between flex-shrink-0`}>
                <div className="flex items-center gap-2.5">
                  {form.icon}
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${form.badge} border ${form.border}`}>
                    {form.code}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    ✓ Authorized
                  </span>
                  <ChevronRight
                    size={15}
                    className="text-gray-400 group-hover:translate-x-0.5 transition-transform"
                  />
                </div>
              </div>
              <div className="p-4 flex flex-col flex-1">
                <p className="font-bold text-gray-800">{form.title}</p>
                <p
                  className="text-sm font-semibold mt-0.5 min-h-[2.5rem]"
                  style={{
                    color:
                      form.color === 'blue'
                        ? '#2563eb'
                        : form.color === 'emerald'
                          ? '#059669'
                          : form.color === 'violet'
                            ? '#7c3aed'
                            : '#4f46e5'
                  }}>
                  {form.subtitle}
                </p>
                <p className="text-gray-500 text-xs mt-2 leading-relaxed flex-1">
                  {form.desc}
                </p>
                <div
                  className="mt-3 flex items-center gap-1.5 text-xs font-medium"
                  style={{
                    color:
                      form.color === 'blue'
                        ? '#2563eb'
                        : form.color === 'emerald'
                          ? '#059669'
                          : form.color === 'violet'
                            ? '#7c3aed'
                            : '#4f46e5'
                  }}>
                  <FileSpreadsheet size={12} />
                  Click to generate
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Generator Modal */}
      {activeForm && currentForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-blue-700 to-blue-900 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  {currentForm.icon}
                </div>
                <div>
                  <h3 className="font-bold text-white">
                    {currentForm.title} — {currentForm.subtitle}
                  </h3>
                  <p className="text-blue-200 text-xs mt-0.5">
                    School Year 2025–2026 · Authorized: {userLabel}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveForm(null)}
                className="p-2 hover:bg-white/10 rounded-lg text-white">
                <X size={18} />
              </button>
            </div>

            {/* Config */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                    Grade Level
                  </label>
                  <select
                    value={selectedGrade}
                    onChange={e => {
                      setSelectedGrade(e.target.value);
                      setGenerated(false);
                    }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    {[7, 8, 9, 10, 11, 12].map(g => (
                      <option key={g} value={g}>
                        Grade {g}
                      </option>
                    ))}
                  </select>
                </div>
                {activeForm !== 'SF10' && activeForm !== 'SF9' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                      Section
                    </label>
                    <select
                      value={selectedSection}
                      onChange={e => {
                        setSelectedSection(e.target.value);
                        setGenerated(false);
                      }}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      {['Star', 'Gold', 'Silver', 'Regular'].map(s => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}
                {(activeForm === 'SF10' || activeForm === 'SF9') && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                      Student
                    </label>
                    <select
                      value={selectedStudentId ?? ''}
                      onChange={e => {
                        setSelectedStudentId(parseInt(e.target.value));
                        setGenerated(false);
                      }}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      {students
                        .filter(s => s.status === 'enrolled')
                        .map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                    School Year
                  </label>
                  <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option>2025–2026</option>
                    <option>2024–2025</option>
                  </select>
                </div>
                <div>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
                    {generating ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'Generate Form'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Document Preview */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              {!generated && !generating && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-blue-50 border-2 border-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FileText size={28} className="text-blue-300" />
                  </div>
                  <p className="font-semibold text-gray-500">
                    Configure options and click Generate
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    A document preview will appear here
                  </p>
                </div>
              )}
              {generating && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="relative w-14 h-14 mb-4">
                    <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                    <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin" />
                  </div>
                  <p className="font-semibold text-gray-600">
                    Generating {currentForm.code}...
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Compiling student data from database...
                  </p>
                </div>
              )}
              {generated && (
                <div
                  className="bg-white border border-gray-300 rounded-lg shadow-sm text-xs print:shadow-none"
                  id="sf-print-area">
                  {/* ── OFFICIAL DEPED HEADER ── */}
                  <div className="border-b-2 border-gray-400 p-4">
                    <div className="flex items-start gap-4">
                      <div className="text-center flex-1">
                        <p className="font-bold text-xs uppercase tracking-wide">
                          Republic of the Philippines
                        </p>
                        <p className="font-bold text-sm uppercase tracking-wider">
                          Department of Education
                        </p>
                        <p className="text-xs text-gray-600">
                          Region V (Bicol Region) · Schools Division of
                          Camarines Sur
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 text-center">
                      <div className="inline-block border-2 border-gray-800 px-8 py-1.5">
                        <p className="font-black text-sm tracking-widest uppercase">
                          {currentForm.code} —{' '}
                          {currentForm.subtitle.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-6 text-xs">
                      <p>
                        <span className="font-bold">School:</span> Don
                        Servillano Platon Memorial National High School
                      </p>
                      <p>
                        <span className="font-bold">School ID:</span> 301567
                      </p>
                      <p>
                        <span className="font-bold">District:</span> Tinambac
                        District
                      </p>
                      <p>
                        <span className="font-bold">Division:</span> Camarines
                        Sur
                      </p>
                      <p>
                        <span className="font-bold">Region:</span> V (Bicol
                        Region)
                      </p>
                      <p>
                        <span className="font-bold">School Year:</span>{' '}
                        2025–2026
                      </p>
                      {activeForm !== 'SF10' && activeForm !== 'SF9' && (
                        <>
                          <p>
                            <span className="font-bold">Grade Level:</span>{' '}
                            {selectedGrade}
                          </p>
                          <p>
                            <span className="font-bold">Section:</span>{' '}
                            {selectedSection}
                          </p>
                        </>
                      )}
                      <p>
                        <span className="font-bold">Date Generated:</span>{' '}
                        {new Date().toLocaleDateString('en-PH', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="p-4">
                    {/* ── SF1 — School Register ── */}
                    {activeForm === 'SF1' && (
                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <p className="font-bold text-xs uppercase tracking-wide text-blue-800 border-b border-blue-200 pb-1">
                            OFFICIAL LIST OF ENROLLED LEARNERS — GRADE{' '}
                            {selectedGrade} – {selectedSection.toUpperCase()}{' '}
                            SECTION
                          </p>
                          <p className="text-xs text-gray-500">
                            Class Adviser: —
                          </p>
                        </div>
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="bg-blue-800 text-white">
                              <th className="border border-blue-900 px-1.5 py-2 text-center">
                                #
                              </th>
                              <th className="border border-blue-900 px-1.5 py-2 text-left">
                                LRN
                              </th>
                              <th className="border border-blue-900 px-2 py-2 text-left">
                                Learner's Name (Last, First, MI)
                              </th>
                              <th className="border border-blue-900 px-1.5 py-2 text-center">
                                Sex
                              </th>
                              <th className="border border-blue-900 px-1.5 py-2 text-center">
                                Age
                              </th>
                              <th className="border border-blue-900 px-1.5 py-2 text-center">
                                Birthdate
                              </th>
                              <th className="border border-blue-900 px-1.5 py-2 text-center">
                                Address
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentsInGrade.slice(0, 10).map((s, i) => (
                              <tr
                                key={s.id}
                                className={
                                  i % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'
                                }>
                                <td className="border border-gray-300 px-1.5 py-1.5 text-center">
                                  {i + 1}
                                </td>
                                <td className="border border-gray-300 px-1.5 py-1.5 font-mono">
                                  {s.lrn}
                                </td>
                                <td className="border border-gray-300 px-2 py-1.5 font-medium">
                                  {s.name.split(' ').slice(-1)[0]},{' '}
                                  {s.name.split(' ').slice(0, -1).join(' ')}
                                </td>
                                <td className="border border-gray-300 px-1.5 py-1.5 text-center">
                                  {s.sex.charAt(0).toUpperCase()}
                                </td>
                                <td className="border border-gray-300 px-1.5 py-1.5 text-center">
                                  {new Date().getFullYear() -
                                    new Date(s.birthdate).getFullYear()}
                                </td>
                                <td className="border border-gray-300 px-1.5 py-1.5 text-center">
                                  {new Date(s.birthdate).toLocaleDateString(
                                    'en-PH',
                                    {
                                      month: 'short',
                                      day: '2-digit',
                                      year: 'numeric'
                                    }
                                  )}
                                </td>
                                <td className="border border-gray-300 px-2 py-1.5 text-gray-600">
                                  {s.address || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-blue-50 font-bold border-t-2 border-blue-400">
                              <td
                                colSpan={7}
                                className="border border-gray-300 px-2 py-1.5 text-xs">
                                TOTAL ENROLLMENT:{' '}
                                <span className="text-blue-800">
                                  {studentsInGrade.length}
                                </span>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}

                    {/* ── SF5 — Report on Promotion ── */}
                    {activeForm === 'SF5' && (
                      <div>
                        <p className="font-bold text-xs uppercase tracking-wide text-emerald-800 border-b border-emerald-200 pb-1 mb-3">
                          REPORT ON PROMOTION AND LEVEL OF PROFICIENCY — END OF
                          SCHOOL YEAR 2025–2026
                        </p>
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="bg-emerald-800 text-white">
                              <th
                                className="border border-emerald-900 px-2 py-2 text-left"
                                rowSpan={2}>
                                Grade Level
                              </th>
                              <th
                                className="border border-emerald-900 px-2 py-2 text-center"
                                rowSpan={2}>
                                Total Enrolled
                              </th>
                              <th
                                className="border border-emerald-900 px-2 py-2 text-center"
                                colSpan={2}>
                                Promoted
                              </th>
                              <th
                                className="border border-emerald-900 px-2 py-2 text-center"
                                rowSpan={2}>
                                Retained
                              </th>
                              <th
                                className="border border-emerald-900 px-2 py-2 text-center"
                                rowSpan={2}>
                                Dropped
                              </th>
                              <th
                                className="border border-emerald-900 px-2 py-2 text-center"
                                rowSpan={2}>
                                Promotion Rate
                              </th>
                            </tr>
                            <tr className="bg-emerald-700 text-white">
                              <th className="border border-emerald-900 px-2 py-1 text-center">
                                Male
                              </th>
                              <th className="border border-emerald-900 px-2 py-1 text-center">
                                Female
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {enrollmentStats.map((stat, i) => {
                              const promoted = Math.round(stat.enrolled * 0.94);
                              const retained = Math.round(stat.enrolled * 0.04);
                              const dropped =
                                stat.enrolled - promoted - retained;
                              return (
                                <tr
                                  key={stat.grade}
                                  className={
                                    i % 2 === 0
                                      ? 'bg-white'
                                      : 'bg-emerald-50/30'
                                  }>
                                  <td className="border border-gray-300 px-2 py-1.5 font-bold">
                                    {stat.grade}
                                  </td>
                                  <td className="border border-gray-300 px-2 py-1.5 text-center">
                                    {stat.enrolled}
                                  </td>
                                  <td className="border border-gray-300 px-2 py-1.5 text-center text-emerald-700">
                                    {promoted > 0
                                      ? Math.round(promoted * 0.47)
                                      : 0}
                                  </td>
                                  <td className="border border-gray-300 px-2 py-1.5 text-center text-emerald-700">
                                    {promoted > 0
                                      ? Math.round(promoted * 0.53)
                                      : 0}
                                  </td>
                                  <td className="border border-gray-300 px-2 py-1.5 text-center text-amber-600">
                                    {retained}
                                  </td>
                                  <td className="border border-gray-300 px-2 py-1.5 text-center text-red-500">
                                    {dropped}
                                  </td>
                                  <td className="border border-gray-300 px-2 py-1.5 text-center font-bold text-emerald-700">
                                    94.0%
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-emerald-100 font-bold border-t-2 border-emerald-500">
                              <td className="border border-gray-400 px-2 py-2">
                                TOTAL
                              </td>
                              <td className="border border-gray-400 px-2 py-2 text-center">
                                {enrollmentStats.reduce(
                                  (a, s) => a + s.enrolled,
                                  0
                                )}
                              </td>
                              <td className="border border-gray-400 px-2 py-2 text-center text-emerald-800">
                                —
                              </td>
                              <td className="border border-gray-400 px-2 py-2 text-center text-emerald-800">
                                —
                              </td>
                              <td className="border border-gray-400 px-2 py-2 text-center text-amber-700">
                                —
                              </td>
                              <td className="border border-gray-400 px-2 py-2 text-center text-red-600">
                                —
                              </td>
                              <td className="border border-gray-400 px-2 py-2 text-center text-emerald-800">
                                94.0%
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                        <div className="mt-4 border-t border-gray-200 pt-3">
                          <p className="font-bold text-xs mb-2">
                            PROFICIENCY LEVEL DISTRIBUTION:
                          </p>
                          <div className="grid grid-cols-4 gap-3 text-xs text-center">
                            {[
                              ['Beginning', '4.2%', 'text-red-600'],
                              ['Developing', '11.3%', 'text-amber-600'],
                              [
                                'Approaching Proficiency',
                                '38.5%',
                                'text-blue-600'
                              ],
                              [
                                'Proficient / Advanced',
                                '46.0%',
                                'text-emerald-600'
                              ]
                            ].map(([label, val, color]) => (
                              <div
                                key={label}
                                className="border border-gray-200 rounded p-2">
                                <p className={`font-bold text-sm ${color}`}>
                                  {val}
                                </p>
                                <p className="text-gray-500 mt-0.5">{label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── SF9 — Learner's Progress Report Card ── */}
                    {activeForm === 'SF9' &&
                      selectedStudent &&
                      (() => {
                        const subjects = [
                          'Filipino',
                          'English',
                          'Mathematics',
                          'Science',
                          'Araling Panlipunan',
                          'MAPEH',
                          'TLE/EPP',
                          'Values Education',
                          'ESP'
                        ];
                        const avgScore = 88;
                        return (
                          <div className="space-y-3">
                            <p className="font-bold text-xs uppercase tracking-wide text-violet-800 border-b border-violet-200 pb-1">
                              LEARNER'S PROGRESS REPORT CARD — SY 2025–2026
                            </p>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs border border-gray-200 rounded p-3 bg-violet-50/30">
                              <p>
                                <span className="font-bold">
                                  Learner's Name:
                                </span>{' '}
                                {selectedStudent.name}
                              </p>
                              <p>
                                <span className="font-bold">LRN:</span>{' '}
                                {selectedStudent.lrn}
                              </p>
                              <p>
                                <span className="font-bold">
                                  Grade Level & Section:
                                </span>{' '}
                                Grade {selectedStudent.grade_level}
                              </p>
                              <p>
                                <span className="font-bold">School Year:</span>{' '}
                                2025–2026
                              </p>
                              <p>
                                <span className="font-bold">
                                  Date of Birth:
                                </span>{' '}
                                {new Date(
                                  selectedStudent.birthdate
                                ).toLocaleDateString('en-PH', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                              <p>
                                <span className="font-bold">Sex:</span>{' '}
                                {selectedStudent.sex}
                              </p>
                              <p>
                                <span className="font-bold">School:</span>{' '}
                                DSPMNHS
                              </p>
                            </div>
                            <table className="w-full border-collapse text-xs">
                              <thead>
                                <tr className="bg-violet-800 text-white">
                                  <th className="border border-violet-900 px-2 py-2 text-left">
                                    Learning Area
                                  </th>
                                  <th className="border border-violet-900 px-2 py-2 text-center">
                                    Q1
                                  </th>
                                  <th className="border border-violet-900 px-2 py-2 text-center">
                                    Q2
                                  </th>
                                  <th className="border border-violet-900 px-2 py-2 text-center">
                                    Q3
                                  </th>
                                  <th className="border border-violet-900 px-2 py-2 text-center">
                                    Q4
                                  </th>
                                  <th className="border border-violet-900 px-2 py-2 text-center">
                                    Final Rating
                                  </th>
                                  <th className="border border-violet-900 px-2 py-2 text-center">
                                    Remarks
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {subjects.map((subj, i) => {
                                  const base = avgScore + ((i % 3) - 1);
                                  const vals = [
                                    base + 1,
                                    base - 1,
                                    base + 2,
                                    base
                                  ].map(v => Math.min(100, Math.max(75, v)));
                                  const final = Math.round(
                                    vals.reduce((a, b) => a + b, 0) / 4
                                  );
                                  return (
                                    <tr
                                      key={subj}
                                      className={
                                        i % 2 === 0
                                          ? 'bg-white'
                                          : 'bg-violet-50/20'
                                      }>
                                      <td className="border border-gray-300 px-2 py-1.5 font-medium">
                                        {subj}
                                      </td>
                                      {vals.map((v, j) => (
                                        <td
                                          key={j}
                                          className="border border-gray-300 px-2 py-1.5 text-center">
                                          {v}
                                        </td>
                                      ))}
                                      <td className="border border-gray-300 px-2 py-1.5 text-center font-bold text-violet-800">
                                        {final}
                                      </td>
                                      <td className="border border-gray-300 px-2 py-1.5 text-center font-medium text-emerald-600">
                                        {final >= 75 ? 'Passed' : 'Failed'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="bg-violet-100 font-bold border-t-2 border-violet-400">
                                  <td
                                    className="border border-gray-400 px-2 py-2"
                                    colSpan={5}>
                                    GENERAL AVERAGE
                                  </td>
                                  <td className="border border-gray-400 px-2 py-2 text-center text-violet-800">
                                    {avgScore}
                                  </td>
                                  <td className="border border-gray-400 px-2 py-2 text-center text-emerald-700">
                                    PROMOTED
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                            <div className="grid grid-cols-2 gap-4 mt-2">
                              <div className="border border-gray-200 rounded p-3">
                                <p className="font-bold text-xs mb-2 text-violet-700 uppercase tracking-wide">
                                  Attendance Summary
                                </p>
                                <table className="w-full text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-gray-100">
                                      <th className="border border-gray-200 px-2 py-1">
                                        Quarter
                                      </th>
                                      <th className="border border-gray-200 px-2 py-1 text-center">
                                        No. of Days
                                      </th>
                                      <th className="border border-gray-200 px-2 py-1 text-center">
                                        Absences
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {[
                                      ['Q1', '47', '2'],
                                      ['Q2', '48', '1'],
                                      ['Q3', '45', '0'],
                                      ['Q4', '46', '1']
                                    ].map(([q, days, abs]) => (
                                      <tr key={q}>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-medium">
                                          {q}
                                        </td>
                                        <td className="border border-gray-200 px-2 py-1 text-center">
                                          {days}
                                        </td>
                                        <td className="border border-gray-200 px-2 py-1 text-center">
                                          {abs}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div className="border border-gray-200 rounded p-3">
                                <p className="font-bold text-xs mb-2 text-violet-700 uppercase tracking-wide">
                                  Class Adviser's Remarks
                                </p>
                                <div className="border border-gray-200 rounded p-2 min-h-[60px] bg-gray-50 text-xs text-gray-500 italic">
                                  Learner consistently demonstrates academic
                                  diligence and positive conduct throughout the
                                  school year.
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                    {/* ── SF10 — Learner's Permanent Academic Record ── */}
                    {activeForm === 'SF10' &&
                      selectedStudent &&
                      (() => {
                        const subjects = [
                          'Filipino',
                          'English',
                          'Mathematics',
                          'Science',
                          'Araling Panlipunan',
                          'MAPEH',
                          'TLE/EPP',
                          'Values Education',
                          'ESP'
                        ];
                        const avgScore = 88;
                        return (
                          <div className="space-y-3">
                            <p className="font-bold text-xs uppercase tracking-wide text-indigo-800 border-b border-indigo-200 pb-1">
                              LEARNER'S PERMANENT ACADEMIC RECORD (SF10) —
                              JUNIOR HIGH SCHOOL
                            </p>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs border border-gray-200 rounded p-3 bg-indigo-50/30">
                              <p>
                                <span className="font-bold">
                                  Learner's Name:
                                </span>{' '}
                                {selectedStudent.name}
                              </p>
                              <p>
                                <span className="font-bold">LRN:</span>{' '}
                                {selectedStudent.lrn}
                              </p>
                              <p>
                                <span className="font-bold">
                                  Date of Birth:
                                </span>{' '}
                                {new Date(
                                  selectedStudent.birthdate
                                ).toLocaleDateString('en-PH', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                              <p>
                                <span className="font-bold">Sex:</span>{' '}
                                {selectedStudent.sex}
                              </p>
                              <p>
                                <span className="font-bold">Address:</span>{' '}
                                {selectedStudent.address || '—'}
                              </p>
                              <p>
                                <span className="font-bold">Guardian:</span>{' '}
                                {selectedStudent.guardian || '—'}
                              </p>
                              <p>
                                <span className="font-bold">School:</span> Don
                                Servillano Platon Memorial National High School
                              </p>
                              <p>
                                <span className="font-bold">School ID:</span>{' '}
                                301567
                              </p>
                            </div>
                            <p className="font-bold text-xs uppercase tracking-wide text-indigo-700 mt-1">
                              Academic Record — Grade{' '}
                              {selectedStudent.grade_level} · SY 2025–2026
                            </p>
                            <table className="w-full border-collapse text-xs">
                              <thead>
                                <tr className="bg-indigo-800 text-white">
                                  <th className="border border-indigo-900 px-2 py-2 text-left">
                                    Learning Area
                                  </th>
                                  <th className="border border-indigo-900 px-2 py-2 text-center">
                                    Q1
                                  </th>
                                  <th className="border border-indigo-900 px-2 py-2 text-center">
                                    Q2
                                  </th>
                                  <th className="border border-indigo-900 px-2 py-2 text-center">
                                    Q3
                                  </th>
                                  <th className="border border-indigo-900 px-2 py-2 text-center">
                                    Q4
                                  </th>
                                  <th className="border border-indigo-900 px-2 py-2 text-center">
                                    Final Rating
                                  </th>
                                  <th className="border border-indigo-900 px-2 py-2 text-center">
                                    Remarks
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {subjects.map((subj, i) => {
                                  const base = avgScore + ((i % 3) - 1);
                                  const vals = [
                                    base + 1,
                                    base - 1,
                                    base + 2,
                                    base
                                  ].map(v => Math.min(100, Math.max(75, v)));
                                  const final = Math.round(
                                    vals.reduce((a, b) => a + b, 0) / 4
                                  );
                                  return (
                                    <tr
                                      key={subj}
                                      className={
                                        i % 2 === 0
                                          ? 'bg-white'
                                          : 'bg-indigo-50/20'
                                      }>
                                      <td className="border border-gray-300 px-2 py-1.5 font-medium">
                                        {subj}
                                      </td>
                                      {vals.map((v, j) => (
                                        <td
                                          key={j}
                                          className="border border-gray-300 px-2 py-1.5 text-center">
                                          {v}
                                        </td>
                                      ))}
                                      <td className="border border-gray-300 px-2 py-1.5 text-center font-bold text-indigo-800">
                                        {final}
                                      </td>
                                      <td className="border border-gray-300 px-2 py-1.5 text-center font-medium text-emerald-600">
                                        Passed
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="bg-indigo-100 font-bold border-t-2 border-indigo-400">
                                  <td
                                    className="border border-gray-400 px-2 py-2"
                                    colSpan={5}>
                                    GENERAL AVERAGE
                                  </td>
                                  <td className="border border-gray-400 px-2 py-2 text-center text-indigo-800">
                                    {avgScore}
                                  </td>
                                  <td className="border border-gray-400 px-2 py-2 text-center text-emerald-700">
                                    PROMOTED
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        );
                      })()}
                  </div>

                  {/* Signatures */}
                  <div className="p-4 border-t-2 border-gray-400 mt-2">
                    <p className="text-xs text-gray-600 mb-4 italic">
                      I certify that the information contained herein is true
                      and correct based on official school records.
                    </p>
                    <div className="grid grid-cols-3 gap-6 text-center text-xs">
                      {[
                        { title: 'Class Adviser', name: '—' },
                        { title: 'School Principal', name: 'Dr. Maria Santos' },
                        { title: userLabel, name: '—' }
                      ].map(({ title, name }) => (
                        <div key={title}>
                          <div className="mt-10 border-t-2 border-gray-500 pt-2">
                            <p className="font-bold uppercase tracking-wide">
                              {name}
                            </p>
                            <p className="text-gray-600">{title}</p>
                            <p className="text-gray-400 mt-0.5">
                              Signature over Printed Name / Date
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-4 text-center">
                      Generated via Hi5 Portal · DSPMNHS ·{' '}
                      {new Date().toLocaleDateString('en-PH', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                      &nbsp;·&nbsp; Authorized under DepEd Order No. 74, s. 2010
                      and DepEd Order No. 8, s. 2015
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {generated && (
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0 bg-gray-50">
                <button
                  onClick={() => setActiveForm(null)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-100 transition">
                  Close
                </button>
                <button
                  className="flex items-center gap-2 flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2.5 rounded-xl text-sm font-medium transition justify-center"
                  onClick={() => window.print()}>
                  <Printer size={14} /> Print Form
                </button>
                <button
                  className="flex items-center gap-2 flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-medium transition justify-center"
                  onClick={() => window.print()}>
                  <Download size={14} /> Export PDF
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
