import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { Loader2, Printer, Users, BookOpen, Download } from 'lucide-react';
import { studentsApi, StudentRow } from '../../services/students';
import { sectionsApi, SectionRow } from '../../services/sections';
import { enrollmentsApi, EnrollmentRow } from '../../services/enrollments';
import { formsApi, SF9Row } from '../../services/forms';
import { schoolYearsApi } from '../../services/schoolYears';
import { useApp } from '../../context/AppContext';
import { exportToPdf } from '../../services/pdfExport';
import './sf1.css';
/* ── Constants (DepEd SF9 layout) ── */
const CORE_VALUES: { value: string; statements: string[] }[] = [
  {
    value: '1. Maka-Diyos',
    statements: [
      "Expresses one's spiritual beliefs while respecting the spiritual beliefs of others.",
      'Shows adherence to ethical principles by upholding truth in all undertakings.'
    ]
  },
  {
    value: '2. Makatao',
    statements: [
      'Is sensitive to individual, social, and cultural differences;',
      'Demonstrates contributions towards solidarity.'
    ]
  },
  {
    value: '3. Maka-Kalikasan',
    statements: [
      'Cares for environment and utilizes resources wisely, judiciously and economically.'
    ]
  },
  {
    value: '4. Maka-Bansa',
    statements: [
      'Demonstrates pride in being a Filipino; exercises the rights and responsibilities of a Filipino citizen.',
      'Demonstrates appropriate behavior in carrying out activities in school, community and country.'
    ]
  }
];

const DESCRIPTORS = [
  ['Outstanding', '90-100', 'Passed'],
  ['Very Satisfactory', '85-89', 'Passed'],
  ['Satisfactory', '80-84', 'Passed'],
  ['Fairly Satisfactory', '75-79', 'Passed'],
  ['Did Not Meet Expectations', 'Below 75', 'Failed']
];

const MARKINGS = [
  ['AO', 'Always Observed'],
  ['SO', 'Sometimes Observed'],
  ['RO', 'Rarely Observed'],
  ['NO', 'Not Observed']
];

const MONTHS = [
  'Jun',
  'Jul',
  'Aug',
  'Sept',
  'Oct',
  'Nov',
  'Dec',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Total'
];
const ATTENDANCE_ROWS_LABELS = [
  'No. of School Days',
  'No. of Days Present',
  'No. of Days Absent'
];

const MAPEH_SUBJECTS = ['Music', 'Arts', 'Physical Education', 'Health'];

/* ── Helpers ── */
function toNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

/** Parse a student name into last, first, and middle components */
function parseName(name: string): { last: string; first: string; middle: string } {
  // Try "Last, First Middle" format
  const comma = name.indexOf(',');
  if (comma >= 0) {
    const last = name.substring(0, comma).trim();
    const rest = name.substring(comma + 1).trim().split(/\s+/);
    const first = rest[0] || '';
    const middle = rest.slice(1).join(' ') || '';
    return { last, first, middle };
  }
  // Fallback: "First Middle Last"
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { last: parts[0], first: '', middle: '' };
  if (parts.length === 2) return { last: parts[1], first: parts[0], middle: '' };
  return { last: parts[parts.length - 1], first: parts[0], middle: parts.slice(1, -1).join(' ') };
}

/** Parse LRN into 12 individual digits for the LRN grid */
function lrnDigits(lrn: string): string[] {
  const padded = lrn.padStart(12, '0').slice(0, 12).split('');
  return padded;
}

/**
 * Group subjects from the API into rows for the SF9 table.
 * MAPEH sub-areas (Music, Arts, PE, Health) are grouped into one "MAPEH" row
 * with the average of all 4 MAPEH subjects as the final rating.
 */
interface SubjectRow {
  name: string;
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
  final: number | null;
  remarks: string;
}

function buildSubjectRows(subjects: SF9Row['subjects']): SubjectRow[] {
  const mapehItems: typeof subjects = [];
  const regularItems: typeof subjects = [];

  for (const s of subjects || []) {
    if (MAPEH_SUBJECTS.includes(s.subject_name)) {
      mapehItems.push(s);
    } else {
      regularItems.push(s);
    }
  }

  const rows: SubjectRow[] = regularItems.map(s => {
    const q1 = toNum(s.q1);
    const q2 = toNum(s.q2);
    const q3 = toNum(s.q3);
    const q4 = toNum(s.q4);
    const final = toNum(s.final_average);
    return {
      name: s.subject_name,
      q1,
      q2,
      q3,
      q4,
      final,
      remarks: final !== null ? (final >= 75 ? 'Passed' : 'Failed') : '—'
    };
  });

  // Group MAPEH sub-areas into one row
  if (mapehItems.length > 0) {
    const q1Vals = mapehItems
      .map(s => toNum(s.q1))
      .filter(v => v !== null) as number[];
    const q2Vals = mapehItems
      .map(s => toNum(s.q2))
      .filter(v => v !== null) as number[];
    const q3Vals = mapehItems
      .map(s => toNum(s.q3))
      .filter(v => v !== null) as number[];
    const q4Vals = mapehItems
      .map(s => toNum(s.q4))
      .filter(v => v !== null) as number[];
    const finals = mapehItems
      .map(s => toNum(s.final_average))
      .filter(v => v !== null) as number[];

    const avg = (arr: number[]) =>
      arr.length > 0
        ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100
        : null;
    const mapehFinal =
      finals.length > 0
        ? Math.round(
            (finals.reduce((a, b) => a + b, 0) / finals.length) * 100
          ) / 100
        : null;

    rows.push({
      name: 'MAPEH',
      q1: avg(q1Vals),
      q2: avg(q2Vals),
      q3: avg(q3Vals),
      q4: avg(q4Vals),
      final: mapehFinal,
      remarks:
        mapehFinal !== null ? (mapehFinal >= 75 ? 'Passed' : 'Failed') : '—'
    });
  }

  return rows;
}

/* ── Component ── */
export function SF9Report() {
  const { showToast, role } = useApp();
  const [searchParams] = useSearchParams();
  const preselectedStudentId = searchParams.get('student_id');
  const preselectedSyId = searchParams.get('school_year_id');

  /* ── Filters ── */
  const [selectedGrade, setSelectedGrade] = useState('7');
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(
    null
  );
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(
    null
  );
  const [syId, setSyId] = useState(1);

  /* ── Data ── */
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sf9Data, setSf9Data] = useState<SF9Row | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Editable cell state (attendance, observed values) ── */
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [observedMarks, setObservedMarks] = useState<Record<string, string>>({});
  const [parentSignatures, setParentSignatures] = useState<Record<string, string>>({});
  const [transferFields, setTransferFields] = useState<Record<string, string>>({});

  const handleAttendanceChange = useCallback((rowLabel: string, month: string, value: string) => {
    const key = `${rowLabel}::${month}`;
    setAttendance(p => ({ ...p, [key]: value }));
  }, []);

  const getAttendance = useCallback((rowLabel: string, month: string): string => {
    return attendance[`${rowLabel}::${month}`] || '';
  }, [attendance]);

  const handleObservedChange = useCallback((cvIdx: number, stIdx: number, quarter: number, value: string) => {
    const key = `${cvIdx}-${stIdx}-Q${quarter}`;
    setObservedMarks(p => ({ ...p, [key]: value }));
  }, []);

  const getObserved = useCallback((cvIdx: number, stIdx: number, quarter: number): string => {
    return observedMarks[`${cvIdx}-${stIdx}-Q${quarter}`] || '';
  }, [observedMarks]);

  const handleSignatureChange = useCallback((quarter: string, value: string) => {
    setParentSignatures(p => ({ ...p, [quarter]: value }));
  }, []);

  const getSignature = useCallback((quarter: string): string => {
    return parentSignatures[quarter] || '';
  }, [parentSignatures]);

  const handleTransferChange = useCallback((field: string, value: string) => {
    setTransferFields(p => ({ ...p, [field]: value }));
  }, []);

  const getTransfer = useCallback((field: string): string => {
    return transferFields[field] || '';
  }, [transferFields]);

  useEffect(() => {
    const loadData = role === 'teacher'
      ? Promise.all([
          studentsApi.listMyStudents(),
          sectionsApi.listMySections(),
          enrollmentsApi.list(),
          schoolYearsApi.list(),
        ])
      : Promise.all([
          studentsApi.list(),
          sectionsApi.list(),
          enrollmentsApi.list(),
          schoolYearsApi.list(),
        ]);

    loadData
      .then(([studs, secs, enrs, years]) => {
        const activeSections = secs.filter((s: SectionRow) => s.is_active === 1);
        setStudents(studs);
        setSections(activeSections);
        setEnrollments(enrs);

        // Use provided school_year_id or find current
        const targetSyId = preselectedSyId
          ? parseInt(preselectedSyId)
          : years.find((y: any) => y.is_current === 1)?.id || 1;
        setSyId(targetSyId);

        // Check for pre-selected student from query params
        if (preselectedStudentId) {
          const sid = parseInt(preselectedStudentId);
          const enrollment = enrs.find(
            (e: EnrollmentRow) => e.student_id === sid && e.status === 'enrolled'
          );
          if (enrollment) {
            setSelectedGrade(String(enrollment.grade_level));
            // Set section and student — the effects will preserve these
            const sec = activeSections.find((s: SectionRow) => s.id === enrollment.section_id);
            if (sec) setSelectedSectionId(sec.id);
            setSelectedStudentId(sid);
            return;
          }
        }

        // Default: first section for Grade 7
        const g7 = activeSections.filter((s: SectionRow) => s.grade_level === 7);
        if (g7.length > 0) setSelectedSectionId(g7[0].id);
      })
      .catch(err =>
        showToast(
          'error',
          'Failed to load: ' + (err.detail?.error || err.message)
        )
      )
      .finally(() => setLoading(false));
  }, []);

  /* ── Derived ── */
  const gradeSections = useMemo(
    () => sections.filter(s => s.grade_level === parseInt(selectedGrade)),
    [sections, selectedGrade]
  );

  const sectionEnrollmentIds = useMemo(() => {
    return enrollments
      .filter(
        e =>
          e.grade_level === parseInt(selectedGrade) &&
          e.section_id === selectedSectionId &&
          e.status === 'enrolled'
      )
      .map(e => e.student_id);
  }, [enrollments, selectedGrade, selectedSectionId]);

  const enrolledStudents = useMemo(
    () => students.filter(s => sectionEnrollmentIds.includes(s.id)),
    [students, sectionEnrollmentIds]
  );

  // Auto-select first student when section changes
  useEffect(() => {
    if (enrolledStudents.length > 0) {
      if (
        selectedStudentId &&
        enrolledStudents.some(s => s.id === selectedStudentId)
      )
        return;
      setSelectedStudentId(enrolledStudents[0].id);
    } else {
      setSelectedStudentId(null);
    }
    setSf9Data(null);
  }, [selectedGrade, selectedSectionId]);

  // Reset section when grade changes — only if current section doesn't belong to the new grade
  useEffect(() => {
    const gs = sections.filter(s => s.grade_level === parseInt(selectedGrade));
    if (selectedSectionId && gs.some(s => s.id === selectedSectionId)) return;
    if (gs.length > 0) setSelectedSectionId(gs[0].id);
    else setSelectedSectionId(null);
    setSf9Data(null);
  }, [selectedGrade]);

  /* ── Fetch SF9 report ── */
  useEffect(() => {
    if (!selectedStudentId) return;
    setLoadingReport(true);
    setError(null);
    formsApi
      .sf9(selectedStudentId, syId)
      .then(data => setSf9Data(data))
      .catch(err =>
        setError(err.detail?.error || err.message || 'Failed to generate SF9')
      )
      .finally(() => setLoadingReport(false));
  }, [selectedStudentId, syId]);

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const subjectRows = sf9Data?.subjects
    ? buildSubjectRows(sf9Data.subjects)
    : [];
  const ga = toNum(sf9Data?.general_average);
  const gaRemarks = ga !== null ? (ga >= 75 ? 'PROMOTED' : 'RETAINED') : '—';

  /* ── Print ── */
  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = async () => {
    try {
      await exportToPdf({
        elementId: 'sf9-print-area',
        filename: `SF9_${selectedStudent?.lrn || selectedStudentId}`,
        orientation: 'landscape',
        format: 'letter',
      });
      showToast('success', 'PDF exported successfully.');
    } catch {
      showToast('error', 'Failed to export PDF. Please try again.');
    }
  };

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-5 animate-pulse">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-violet-200 via-purple-200 to-violet-200" />
          <div className="p-6 space-y-4">
            <div className="h-5 w-64 bg-gray-100 rounded-lg" />
            <div className="h-4 w-96 bg-gray-50 rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      {/* ── Print styles ── */}
      <style>{`
        @media print {
          body { font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          #sf9-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0.15in; }
          #sf9-print-area .print-page { page-break-after: always; }
          #sf9-print-area .print-page:last-child { page-break-after: avoid; }
          @page { size: letter landscape; margin: 0.3in; }
        }
      `}</style>
      {/* ── Filter Bar ── */}
      <div className="no-print max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-violet-400" />
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center shadow-xs">
                <BookOpen size={18} className="text-violet-700" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-sm">
                  SF9 — Learner's Progress Report Card
                </h2>
                <p className="text-xs text-gray-400">
                  {role === 'teacher'
                    ? 'Showing only your sections and students. Select grade, section, and student to generate the official report card.'
                    : 'Select grade level, section, and student to generate the official report card.'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-[0.05em]">
                  Grade Level
                </label>
                <select
                  value={selectedGrade}
                  onChange={e => setSelectedGrade(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 bg-white transition">
                  {[7, 8, 9, 10, 11, 12].map(g => (
                    <option key={g} value={g}>
                      Grade {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-[0.05em]">
                  Section
                </label>
                <select
                  value={selectedSectionId ?? ''}
                  onChange={e => setSelectedSectionId(parseInt(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 bg-white transition">
                  {gradeSections.length === 0 && (
                    <option value="">No sections</option>
                  )}
                  {gradeSections.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-[0.05em]">
                  Student
                </label>
                <select
                  value={selectedStudentId ?? ''}
                  onChange={e => {
                    setSelectedStudentId(parseInt(e.target.value));
                    setSf9Data(null);
                  }}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 bg-white transition">
                  {enrolledStudents.length === 0 && (
                    <option value="">No students enrolled</option>
                  )}
                  {enrolledStudents.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.lrn} — {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
              <Users size={12} />
              <span>
                {enrolledStudents.length} student
                {enrolledStudents.length !== 1 ? 's' : ''} · Grade{' '}
                {selectedGrade} ·{' '}
                {gradeSections.find(s => s.id === selectedSectionId)?.name ||
                  '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Loading / Error / Empty / Report ── */}
      {loadingReport && (
        <div className="no-print max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
            <Loader2
              size={28}
              className="animate-spin text-violet-500 mx-auto mb-3"
            />
            <p className="text-gray-500 font-semibold">
              Generating SF9 Report Card...
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Compiling grades from database
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="no-print max-w-5xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            <p className="font-bold mb-1">Error generating SF9</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {!loadingReport && !error && !sf9Data && selectedStudentId && (
        <div className="no-print max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
              <BookOpen size={28} className="text-violet-300" />
            </div>
            <p className="text-gray-500 text-sm font-semibold">
              No report card data
            </p>
            <p className="text-gray-400 text-xs mt-1">
              No grades found. Ensure grades are encoded before generating the
              SF9.
            </p>
          </div>
        </div>
      )}

      {!selectedStudentId && enrolledStudents.length === 0 && (
        <div className="no-print max-w-5xl mx-auto">
          <div className="bg-gray-50 rounded-2xl border border-gray-100 p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Users size={28} className="text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm font-semibold">
              No students enrolled
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Select a different grade level or section.
            </p>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────── */}
      {/* SF9 Official DepEd Two-Page Report Card                       */}
      {/* ────────────────────────────────────────────────────────────── */}
      {!loadingReport && sf9Data && selectedStudent && (
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
          {/* Toolbar */}
          <div className="no-print flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/80">
            <p className="text-sm text-gray-600 font-medium">
              <span className="text-violet-700 font-bold">SF9</span> —{' '}
              {selectedStudent.name}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportPdf}
                className="inline-flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-violet-50 text-violet-700 px-3.5 py-2 rounded-xl text-sm font-medium transition shadow-xs">
                <Download size={14} /> Export PDF
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-xl text-sm font-medium transition shadow-xs">
                <Printer size={14} /> Print
              </button>
            </div>
          </div>

          {/* ── Print Area ── */}
          <div
            id="sf9-print-area"
            className="p-4 sm:p-6 text-[10px] leading-tight text-black">
            {/* ========================================================== */}
            {/* PAGE 1 — Attendance + Learner Info                        */}
            {/* ========================================================== */}
            <div style={{ minWidth: '850px' }} className="print-page mb-10">
              <div className="grid grid-cols-2 gap-6">
                {/* ── Left: Attendance ── */}
                <div className="space-y-5">
                  <div>
                    <h3 className="text-center text-[12px] font-bold mb-1">
                      REPORT ON ATTENDANCE
                    </h3>
                    <table className="w-full border-collapse text-[9px]">
                      <thead>
                        <tr>
                          <th className="border border-black px-0.5 py-0.5" />
                          {MONTHS.map(m => (
                            <th
                              key={m}
                              className="border border-black px-0.5 py-0.5 font-bold text-center">
                              {m}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ATTENDANCE_ROWS_LABELS.map(label => (
                          <tr key={label}>
                            <td className="border border-black px-1 py-1 text-left font-semibold">
                              {label}
                            </td>
                            {MONTHS.map(m => (
                              <td key={m} className="border border-black p-0">
                                <input
                                  type="text"
                                  value={getAttendance(label, m)}
                                  onChange={e => handleAttendanceChange(label, m, e.target.value)}
                                  className="sf1-input h-5 w-full bg-transparent text-center text-[9px] outline-none focus:bg-amber-50"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-bold">
                      PARENT / GUARDIAN'S SIGNATURE
                    </h4>
                    <div className="mt-2 space-y-3 text-[11px]">
                      {[
                        '1st Quarter',
                        '2nd Quarter',
                        '3rd Quarter',
                        '4th Quarter'
                      ].map(q => (
                        <div key={q} className="flex items-end gap-1">
                          <span className="text-[11px] font-semibold whitespace-nowrap">
                            {q}:
                          </span>
                          <input
                            type="text"
                            value={getSignature(q)}
                            onChange={e => handleSignatureChange(q, e.target.value)}
                            className="sf1-input flex-1 border-b border-black bg-transparent text-[11px] pl-1 outline-none focus:bg-amber-50"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-center text-[11px] font-bold">
                      Certificate of Transfer
                    </h4>
                    <div className="mt-2 space-y-3 text-[11px]">
                      <div className="flex items-end gap-2">
                        <span className="text-[11px] font-semibold whitespace-nowrap">
                          Admitted to Grade:
                        </span>
                        <input
                          type="text"
                          value={getTransfer('admittedGrade')}
                          onChange={e => handleTransferChange('admittedGrade', e.target.value)}
                          className="sf1-input flex-1 border-b border-black bg-transparent text-[11px] pl-1 outline-none focus:bg-amber-50"
                        />
                        <span className="text-[11px] font-semibold whitespace-nowrap">
                          Section:
                        </span>
                        <input
                          type="text"
                          value={getTransfer('admittedSection')}
                          onChange={e => handleTransferChange('admittedSection', e.target.value)}
                          className="sf1-input flex-1 border-b border-black bg-transparent text-[11px] pl-1 outline-none focus:bg-amber-50"
                        />
                      </div>
                      <div className="flex items-end gap-1">
                        <span className="text-[11px] font-semibold whitespace-nowrap">
                          Eligibility for Admission to Grade:
                        </span>
                        <input
                          type="text"
                          value={getTransfer('eligibilityGrade')}
                          onChange={e => handleTransferChange('eligibilityGrade', e.target.value)}
                          className="sf1-input flex-1 border-b border-black bg-transparent text-[11px] pl-1 outline-none focus:bg-amber-50"
                        />
                      </div>
                      <div className="flex items-end gap-6 pt-2">
                        <span className="text-[11px] font-semibold whitespace-nowrap">
                          Approved:
                        </span>
                        <input
                          type="text"
                          value={getTransfer('approved')}
                          onChange={e => handleTransferChange('approved', e.target.value)}
                          className="sf1-input flex-1 border-b border-black bg-transparent text-[11px] pl-1 outline-none focus:bg-amber-50"
                        />
                      </div>
                      <div className="flex justify-between text-center text-[9px] italic">
                        <span className="flex-1">School Head</span>
                        <span className="flex-1">Adviser</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-center text-[11px] font-bold">
                      Cancellation of Eligibility to Transfer
                    </h4>
                    <div className="mt-2 space-y-3 text-[11px]">
                      <div className="flex items-end gap-1">
                        <span className="text-[11px] font-semibold whitespace-nowrap">
                          Admitted in:
                        </span>
                        <input
                          type="text"
                          value={getTransfer('cancelAdmitted')}
                          onChange={e => handleTransferChange('cancelAdmitted', e.target.value)}
                          className="sf1-input flex-1 border-b border-black bg-transparent text-[11px] pl-1 outline-none focus:bg-amber-50"
                        />
                      </div>
                      <div className="flex items-end gap-6">
                        <span className="text-[11px] font-semibold whitespace-nowrap">
                          Date:
                        </span>
                        <input
                          type="text"
                          value={getTransfer('cancelDate')}
                          onChange={e => handleTransferChange('cancelDate', e.target.value)}
                          className="sf1-input flex-1 border-b border-black bg-transparent text-[11px] pl-1 outline-none focus:bg-amber-50"
                        />
                      </div>
                      <div className="text-right text-[9px] italic">
                        School Head
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Right: Letterhead + Learner Info + Letter ── */}
                <div className="space-y-3">
                  {/* LRN grid */}
                  <div className="flex justify-between text-[10px] italic">
                    <span>SF9-SHS</span>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold not-italic">LRN</span>
                      <div className="flex">
                        {lrnDigits(
                          sf9Data.student?.lrn || selectedStudent.lrn
                        ).map((d, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center justify-center w-4 h-4 border border-black text-[8px] font-mono">
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Letterhead */}
                  <div className="flex items-center justify-center gap-2 text-center">
                    <div
                      className="w-10 h-10 rounded-full 
                     flex items-center justify-center text-xs font-bold text-gray-700">
                      <img
                        src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS_96lFoHFcY7YTT3NbY84OBer4jAMloUcfne1cTKV6lQ&s"
                        alt="Department of Education seal"
                        width={72}
                        height={72}
                        className="size-16 shrink-0 object-contain"
                      />
                    </div>
                    <div className="text-[11px] leading-tight">
                      <p>Republic of the Philippines</p>
                      <p className="text-[13px] font-bold">
                        DEPARTMENT OF EDUCATION
                      </p>
                      <p className="italic">Region V (Bicol Region)</p>
                    </div>
                  </div>
                  <div className="text-center text-[11px] leading-tight">
                    <p className="font-bold underline">
                      {sf9Data.school?.school_name || '—'}
                    </p>
                    <p className="italic">School</p>
                    <p className="mt-1 font-bold underline">
                      Schools Division of Camarines Sur
                    </p>
                    <p className="italic">Division</p>
                  </div>

                  {/* Learner identification */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-end gap-2">
                      <span className="text-[11px] font-semibold shrink-0">Name :</span>
                      {(() => {
                        const p = parseName(sf9Data.student?.name || selectedStudent.name);
                        return (
                          <>
                            <span className="flex-1 border-b border-black text-[11px] pl-1 leading-tight">{p.last}</span>
                            <span className="flex-1 border-b border-black text-[11px] pl-1 leading-tight">{p.first}</span>
                            <span className="flex-1 border-b border-black text-[11px] pl-1 leading-tight">{p.middle}</span>
                          </>
                        );
                      })()}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[9px]">
                      <span>Last Name</span>
                      <span>First Name</span>
                      <span>Middle Name</span>
                    </div>
                    <div className="flex items-end gap-4">
                      <div className="flex items-end gap-1 flex-1">
                        <span className="text-[11px] font-semibold">Age :</span>
                        <span className="flex-1 border-b border-black text-[11px] pl-1">
                          {sf9Data.student?.birthdate
                            ? new Date().getFullYear() -
                              new Date(sf9Data.student.birthdate).getFullYear()
                            : '—'}
                        </span>
                      </div>
                      <div className="flex items-end gap-1 flex-1">
                        <span className="text-[11px] font-semibold">Sex:</span>
                        <span className="flex-1 border-b border-black text-[11px] pl-1">
                          {sf9Data.student?.sex || '—'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-end gap-4">
                      <div className="flex items-end gap-1 flex-1">
                        <span className="text-[11px] font-semibold">
                          Grade :
                        </span>
                        <span className="flex-1 border-b border-black text-[11px] pl-1">
                          {sf9Data.student?.grade_level || ''}
                        </span>
                      </div>
                      <div className="flex items-end gap-1 flex-1">
                        <span className="text-[11px] font-semibold">
                          Section:
                        </span>
                        <span className="flex-1 border-b border-black text-[11px] pl-1">
                          {sf9Data.enrollment?.section_name || '—'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-end gap-1">
                      <span className="text-[11px] font-semibold">
                        Curriculum:
                      </span>
                      <span className="flex-1 border-b border-black text-[11px] pl-1">
                        {parseInt(selectedGrade) <= 10
                          ? 'JHS (K to 12)'
                          : 'SHS (K to 12)'}
                      </span>
                    </div>
                    <div className="flex items-end gap-1">
                      <span className="text-[11px] font-semibold">
                        School Year:
                      </span>
                      <span className="flex-1 border-b border-black text-[11px] pl-1">
                        {sf9Data.enrollment?.sy_label || '—'}
                      </span>
                    </div>
                    <div className="flex items-end gap-1">
                      <span className="text-[11px] font-semibold">
                        Track/ Strand:
                      </span>
                      <span className="flex-1 border-b border-black text-[11px] pl-1">
                        {parseInt(selectedGrade) >= 11 ? '—' : 'N/A (JHS)'}
                      </span>
                    </div>
                  </div>

                  {/* Letter */}
                  <div className="space-y-2 pt-3 text-[10px] italic leading-snug">
                    <p>Dear Parent/Guardian,</p>
                    <p className="pl-4">
                      This report card shows the ability and progress your child
                      has made in the different learning areas as well as
                      his/her core values.
                    </p>
                    <p className="pl-4">
                      The school welcomes you should you desire to know more
                      about your child's progress.
                    </p>
                  </div>

                  {/* Signatures */}
                  <div className="flex justify-between pt-6 text-center text-[10px]">
                    <div className="flex-1">
                      <span className="border-t border-black block mx-2 pt-0.5 italic">
                        Principal IV
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="font-bold">CLASS ADVISER</div>
                      <div className="italic">Adviser</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ========================================================== */}
            {/* PAGE 2 — Grades + Observed Values                         */}
            {/* ========================================================== */}
            <div style={{ minWidth: '850px' }} className="print-page">
              {/* Title */}
              <div className="flex items-center justify-between gap-4 mb-4">
                <div
                  className="w-10 h-10 rounded-full 
                     flex items-center justify-center text-xs font-bold text-gray-700">
                  <img
                    src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS_96lFoHFcY7YTT3NbY84OBer4jAMloUcfne1cTKV6lQ&s"
                    alt="Department of Education seal"
                    width={72}
                    height={72}
                    className="size-16 shrink-0 object-contain"
                  />
                </div>
                <div className="text-center">
                  <h2 className="text-[14px] font-bold">School Form 9 (SF9)</h2>
                  <p className="text-[11px] font-semibold">
                    Learner's Progress Report Card
                  </p>
                </div>
                <div className="w-[100px] flex-shrink-0 text-right text-[9px] italic text-gray-500">
                  DepEd Order No. 8, s. 2015
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* ── Left: Learning Progress and Achievement ── */}
                <div>
                  <h3 className="text-center text-[11px] font-bold mb-1">
                    REPORT ON LEARNING PROGRESS AND ACHIEVEMENT
                  </h3>
                  <table className="w-full border-collapse text-[9px]">
                    <colgroup>
                      <col style={{ width: '34%' }} />
                      <col span={4} style={{ width: '8%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '18%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th
                          rowSpan={2}
                          className="border border-black px-1 py-1 align-middle font-bold text-center">
                          Learning Areas
                        </th>
                        <th
                          colSpan={4}
                          className="border border-black px-1 py-0.5 font-bold text-center">
                          Quarter
                        </th>
                        <th
                          rowSpan={2}
                          className="border border-black px-1 py-1 align-middle font-bold text-center">
                          Final Rating
                        </th>
                        <th
                          rowSpan={2}
                          className="border border-black px-1 py-1 align-middle font-bold text-center">
                          Remarks
                        </th>
                      </tr>
                      <tr className="font-bold">
                        {[1, 2, 3, 4].map(q => (
                          <th
                            key={q}
                            className="border border-black px-1 py-0.5 text-center">
                            {q}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {subjectRows.map((row, i) => (
                        <tr key={row.name}>
                          <td className="border border-black px-1 py-0.5 text-left font-medium">
                            {row.name}
                          </td>
                          <td className="border border-black px-1 py-0.5 text-center">
                            {row.q1 !== null ? row.q1.toFixed(2) : '—'}
                          </td>
                          <td className="border border-black px-1 py-0.5 text-center">
                            {row.q2 !== null ? row.q2.toFixed(2) : '—'}
                          </td>
                          <td className="border border-black px-1 py-0.5 text-center">
                            {row.q3 !== null ? row.q3.toFixed(2) : '—'}
                          </td>
                          <td className="border border-black px-1 py-0.5 text-center">
                            {row.q4 !== null ? row.q4.toFixed(2) : '—'}
                          </td>
                          <td
                            className={`border border-black px-1 py-0.5 text-center font-bold ${row.final !== null && row.final >= 75 ? '' : 'text-red-700'}`}>
                            {row.final !== null ? row.final.toFixed(2) : '—'}
                          </td>
                          <td
                            className={`border border-black px-1 py-0.5 text-center font-medium ${row.remarks === 'Passed' ? '' : 'text-red-700'}`}>
                            {row.remarks}
                          </td>
                        </tr>
                      ))}

                      {/* General Average row */}
                      <tr className="font-bold">
                        <td
                          colSpan={5}
                          className="border border-black px-1 py-1 text-center">
                          General Average
                        </td>
                        <td
                          className={`border border-black px-1 py-1 text-center ${ga !== null && ga >= 75 ? '' : 'text-red-700'}`}>
                          {ga !== null ? ga.toFixed(2) : '—'}
                        </td>
                        <td
                          className={`border border-black px-1 py-1 text-center ${gaRemarks === 'PROMOTED' ? 'text-green-800' : 'text-red-700'}`}>
                          {gaRemarks}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* ── Right: Learner's Observed Values ── */}
                <div>
                  <h3 className="text-center text-[11px] font-bold mb-1">
                    REPORT ON LEARNER'S OBSERVED VALUES
                  </h3>
                  <table className="w-full border-collapse text-[9px]">
                    <colgroup>
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '44%' }} />
                      <col span={4} style={{ width: '10%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th
                          rowSpan={2}
                          className="border border-black px-1 py-1 align-middle font-bold text-center">
                          Core Values
                        </th>
                        <th
                          rowSpan={2}
                          className="border border-black px-1 py-1 align-middle font-bold text-center">
                          Behavior Statements
                        </th>
                        <th
                          colSpan={4}
                          className="border border-black px-1 py-0.5 font-bold text-center">
                          Quarter
                        </th>
                      </tr>
                      <tr className="font-bold">
                        {[1, 2, 3, 4].map(q => (
                          <th
                            key={q}
                            className="border border-black px-1 py-0.5 text-center">
                            {q}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {CORE_VALUES.map((cv, cvIdx) =>
                        cv.statements.map((st, stIdx) => (
                          <tr key={cv.value + stIdx}>
                            {stIdx === 0 ? (
                              <td
                                rowSpan={cv.statements.length}
                                className="border border-black px-1 py-1 text-left align-middle font-semibold">
                                {cv.value}
                              </td>
                            ) : null}
                            <td className="border border-black px-1 py-1 text-left align-middle leading-tight">
                              {st}
                            </td>
                            {[1, 2, 3, 4].map(q => (
                              <td key={q} className="border border-black p-0">
                                <select
                                  value={getObserved(cvIdx, stIdx, q)}
                                  onChange={e => handleObservedChange(cvIdx, stIdx, q, e.target.value)}
                                  className="sf1-input h-6 w-full bg-transparent text-center text-[9px] outline-none focus:bg-amber-50 appearance-none cursor-pointer">
                                  <option value="" />
                                  <option value="AO">AO</option>
                                  <option value="SO">SO</option>
                                  <option value="RO">RO</option>
                                  <option value="NO">NO</option>
                                </select>
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Legends ── */}
              <div className="mt-5 grid grid-cols-2 gap-6 text-[10px]">
                <div>
                  <div className="grid grid-cols-3 font-bold border-b border-black pb-0.5 mb-0.5">
                    <span>Descriptors</span>
                    <span>Grading Scale</span>
                    <span>Remarks</span>
                  </div>
                  {DESCRIPTORS.map(d => (
                    <div
                      key={d[0]}
                      className="grid grid-cols-3 border-b border-gray-200 py-0.5">
                      <span>{d[0]}</span>
                      <span>{d[1]}</span>
                      <span>{d[2]}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="grid grid-cols-2 font-bold border-b border-black pb-0.5 mb-0.5">
                    <span>Marking</span>
                    <span>Non-Numerical Rating</span>
                  </div>
                  {MARKINGS.map(m => (
                    <div
                      key={m[0]}
                      className="grid grid-cols-2 border-b border-gray-200 py-0.5">
                      <span>{m[0]}</span>
                      <span>{m[1]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* /sf9-print-area */}
        </div>
      )}
    </div>
  );
}
