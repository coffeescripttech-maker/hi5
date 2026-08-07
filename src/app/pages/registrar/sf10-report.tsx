import { useState, useEffect } from 'react';
import {
  Loader2,
  Printer,
  Search,
  Users,
  Download,
  FileText
} from 'lucide-react';
import { studentsApi, StudentRow } from '../../services/students';
import { sectionsApi, SectionRow } from '../../services/sections';
import { settingsApi, SchoolSettingsRow } from '../../services/settings';
import { formsApi, SF10Row } from '../../services/forms';
import { useApp } from '../../context/AppContext';
import { useRoleAccent } from '../../utils/roleTheme';
import { exportToPdf } from '../../services/pdfExport';
import { downloadRenderedPdf } from '../../services/pdfRender';
import { SchoolFormTitleBlock } from '../../components/school-form-title';
import {
  SchoolFormHeader,
  useSchoolHeader
} from '../../components/school-form-header';
import './sf1.css';

/* ── Types ── */
interface LearningAreaRow {
  subject: string;
  q1: string;
  q2: string;
  q3: string;
  q4: string;
  finalRating: string;
  remarks: string;
}

interface RemedialRow {
  learningArea: string;
  finalRating: string;
  classmark: string;
  recomputedGrade: string;
  remarks: string;
}

interface ScholasticRecord {
  school: string;
  schoolId: string;
  district: string;
  division: string;
  region: string;
  classifiedGrade: string;
  section: string;
  schoolYear: string;
  adviser: string;
  signature: string;
  generalAverage: string;
  learningAreas: LearningAreaRow[];
  remedialsFrom: string;
  remedialsTo: string;
  remedialsClasses: RemedialRow[];
}

interface LearnerState {
  lastName: string;
  firstName: string;
  nameExt: string;
  middleName: string;
  sex: string;
  lrn: string;
  birthDate: string;
}

interface EligibilityState {
  elementaryCompleter: boolean;
  elementarySchoolName: string;
  schoolId: string;
  schoolAddress: string;
  generalAverage: string;
  citation: string;
  peptPasser: boolean;
  peptRating: string;
  alsAE: boolean;
  alsAERating: string;
  others: boolean;
  othersSpecify: string;
  examDate: string;
  testingCenter: string;
}

interface CertState {
  certDate: string;
  principalName: string;
}

const EMPTY_LEARNER: LearnerState = {
  lastName: '',
  firstName: '',
  nameExt: '',
  middleName: '',
  sex: '',
  lrn: '',
  birthDate: ''
};

const EMPTY_ELIGIBILITY: EligibilityState = {
  elementaryCompleter: false,
  elementarySchoolName: '',
  schoolId: '',
  schoolAddress: '',
  generalAverage: '',
  citation: '',
  peptPasser: false,
  peptRating: '',
  alsAE: false,
  alsAERating: '',
  others: false,
  othersSpecify: '',
  examDate: '',
  testingCenter: ''
};

const EMPTY_CERT: CertState = { certDate: '', principalName: '' };

const EMPTY_REMEDIAL = (): RemedialRow => ({
  learningArea: '',
  finalRating: '',
  classmark: '',
  recomputedGrade: '',
  remarks: ''
});

/* ── Helpers ── */

/** Parse "Last, First Middle" or "First Middle Last" into parts */
function parseName(name: string): {
  last: string;
  first: string;
  middle: string;
  ext: string;
} {
  const EXTS = ['JR', 'JR.', 'SR', 'SR.', 'II', 'III', 'IV', 'V', 'VI'];
  const comma = name.indexOf(',');
  if (comma >= 0) {
    const lastPart = name.substring(0, comma).trim();
    const rest = name
      .substring(comma + 1)
      .trim()
      .split(/\s+/);
    let first = '';
    let middle = '';
    let ext = '';
    if (
      rest.length > 1 &&
      EXTS.includes(rest[rest.length - 1].toUpperCase())
    ) {
      ext = rest.pop() as string;
    }
    first = rest[0] || '';
    middle = rest.slice(1).join(' ') || '';
    return { last: lastPart, first, middle, ext };
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1)
    return { last: parts[0], first: '', middle: '', ext: '' };
  let ext = '';
  if (
    parts.length >= 3 &&
    EXTS.includes(parts[parts.length - 1].toUpperCase())
  ) {
    ext = parts.pop() as string;
  }
  if (parts.length === 1)
    return { last: parts[0], first: '', middle: '', ext };
  if (parts.length === 2)
    return { last: parts[1], first: parts[0], middle: '', ext };
  return {
    last: parts[parts.length - 1],
    first: parts[0],
    middle: parts.slice(1, -1).join(' '),
    ext
  };
}

function fmt(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (isNaN(n)) return '';
  return String(Math.round(n * 100) / 100);
}

function remarksFor(avg: number | null | undefined): string {
  if (avg === null || avg === undefined || isNaN(Number(avg))) return '';
  return Number(avg) >= 75 ? 'Passed' : 'Failed';
}

/* ── MAPEH grouping (mirrors SF9 / Grade Management) ── */
const MAPEH_ORDER = ['Music', 'Arts', 'Physical Education', 'Health'];

function isMapehSubject(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return MAPEH_ORDER.some(s => s.toLowerCase() === lower);
}

/** Average grade strings, ignoring blanks/non-numeric values. */
function avgOfStrings(vals: string[]): string {
  const nums = vals
    .map(v => (v === '' ? null : Number(v)))
    .filter((v): v is number => v !== null && !isNaN(v));
  if (nums.length === 0) return '';
  return fmt(nums.reduce((a, b) => a + b, 0) / nums.length);
}

type LearningAreaDisplay =
  | {
      kind: 'header';
      label: string;
      q1: string;
      q2: string;
      q3: string;
      q4: string;
      finalRating: string;
      remarks: string;
    }
  | { kind: 'row'; index: number; area: LearningAreaRow };

/**
 * Group the MAPEH components (Music, Arts, Physical Education, Health) under a
 * single averaged "MAPEH" header row while still listing each component
 * separately. The header's values are recomputed live from the editable
 * component rows on every render, so editing a component updates the average.
 */
function buildLearningAreaDisplay(
  areas: LearningAreaRow[]
): LearningAreaDisplay[] {
  if (areas.length === 0) return [];

  const components: { index: number; area: LearningAreaRow }[] = [];
  const result: LearningAreaDisplay[] = [];

  areas.forEach((area, index) => {
    if (isMapehSubject(area.subject)) components.push({ index, area });
    else result.push({ kind: 'row', index, area });
  });

  if (components.length === 0) return result;

  // Canonical DepEd order: Music, Arts, PE, Health
  const ordered = [...components].sort(
    (a, b) =>
      MAPEH_ORDER.indexOf(a.area.subject) - MAPEH_ORDER.indexOf(b.area.subject)
  );

  const q1 = avgOfStrings(ordered.map(c => c.area.q1));
  const q2 = avgOfStrings(ordered.map(c => c.area.q2));
  const q3 = avgOfStrings(ordered.map(c => c.area.q3));
  const q4 = avgOfStrings(ordered.map(c => c.area.q4));
  const finalRating = avgOfStrings(ordered.map(c => c.area.finalRating));

  const header: LearningAreaDisplay = {
    kind: 'header',
    label: 'MAPEH',
    q1,
    q2,
    q3,
    q4,
    finalRating,
    remarks: finalRating === '' ? '' : remarksFor(Number(finalRating))
  };

  // Like SF9: keep the regular learning areas in their listed (alphabetical)
  // order, then append the grouped MAPEH block — header + components.
  result.push(
    header,
    ...ordered.map(c => ({ kind: 'row' as const, index: c.index, area: c.area }))
  );
  return result;
}

function checkboxInput(props: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={e => props.onChange(e.target.checked)}
        className="w-4 h-4"
      />
      <span className="font-bold">{props.label}</span>
    </label>
  );
}

/* ── Component ── */
export function SF10Report() {
  const { showToast } = useApp();
  const accent = useRoleAccent();
  const [header, setHeader] = useSchoolHeader();

  /* ── Student picker ── */
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(
    null
  );

  /* ── Report ── */
  const [sf10Data, setSf10Data] = useState<SF10Row | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  /* ── Lookups ── */
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [settings, setSettings] = useState<SchoolSettingsRow | null>(null);

  /* ── Form state ── */
  const [learner, setLearner] = useState<LearnerState>(EMPTY_LEARNER);
  const [eligibility, setEligibility] =
    useState<EligibilityState>(EMPTY_ELIGIBILITY);
  const [records, setRecords] = useState<ScholasticRecord[]>([]);
  const [cert, setCert] = useState<CertState>(EMPTY_CERT);

  useEffect(() => {
    Promise.all([
      studentsApi.list(),
      sectionsApi.list(),
      settingsApi.get()
    ])
      .then(([studs, secs, st]) => {
        setSections(secs);
        setSettings(st);
        setStudents(
          studs.filter(
            (s: StudentRow) =>
              s.status === 'enrolled' || s.status === 'graduated'
          )
        );
      })
      .catch(() => showToast('error', 'Failed to load data.'))
      .finally(() => setLoading(false));
  }, [showToast]);

  const filteredStudents = searchQuery.trim()
    ? students.filter(s => {
        const q = searchQuery.trim().toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.lrn.includes(q) ||
          s.student_id.toLowerCase().includes(q)
        );
      })
    : students;

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  useEffect(() => {
    if (!selectedStudentId) {
      setSf10Data(null);
      setRecords([]);
      setLearner(EMPTY_LEARNER);
      setEligibility(EMPTY_ELIGIBILITY);
      setCert(EMPTY_CERT);
      return;
    }
    let cancelled = false;
    setLoadingReport(true);
    setError(null);
    formsApi
      .sf10(selectedStudentId)
      .then(data => {
        if (cancelled) return;
        setSf10Data(data);
        buildForm(data);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load the permanent record.');
      })
      .finally(() => {
        if (!cancelled) setLoadingReport(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId]);

  /** Populate the fillable form from the fetched SF10 record */
  function buildForm(data: SF10Row) {
    const student = data.student;
    const p = parseName(student?.name || '');

    setLearner({
      lastName: p.last,
      firstName: p.first,
      nameExt: p.ext,
      middleName: p.middle,
      sex: (student?.sex || '').toUpperCase(),
      lrn: student?.lrn || '',
      birthDate: student?.birthdate || ''
    });

    const yrs = Object.values(data.school_years || {}).sort((a, b) =>
      a.sy_label.localeCompare(b.sy_label)
    );

    setRecords(
      yrs.map(sy => {
        const sec = sections.find(
          s =>
            s.name === sy.section_name && s.grade_level === sy.grade_level
        );
        return {
          school: data.school?.school_name || '',
          schoolId: data.school?.school_id || '',
          district: settings?.district || '',
          division: settings?.division || '',
          region: settings?.region || '',
          classifiedGrade: String(sy.grade_level ?? ''),
          section: sy.section_name || '',
          schoolYear: sy.sy_label,
          adviser: sec?.adviser_name || '',
          signature: '',
          generalAverage: fmt(sy.general_average),
          learningAreas: [...(sy.subjects || [])]
            // Same ordering as SF9: subjects listed alphabetically by name.
            .sort((a, b) => a.subject_name.localeCompare(b.subject_name))
            .map(sub => ({
              subject: sub.subject_name,
              q1: fmt(sub.q1),
              q2: fmt(sub.q2),
              q3: fmt(sub.q3),
              q4: fmt(sub.q4),
              finalRating: fmt(sub.final_average),
              remarks: remarksFor(sub.final_average)
            })),
          remedialsFrom: '',
          remedialsTo: '',
          remedialsClasses: [EMPTY_REMEDIAL(), EMPTY_REMEDIAL(), EMPTY_REMEDIAL()]
        };
      })
    );

    setCert(EMPTY_CERT);

    // Shared letterhead fields
    const last = yrs[yrs.length - 1];
    setHeader(
      'schoolId',
      data.school?.school_id || settings?.school_id || ''
    );
    setHeader('region', settings?.region || 'Region V');
    setHeader('division', settings?.division || '');
    setHeader('district', settings?.district || '');
    setHeader(
      'schoolName',
      data.school?.school_name || settings?.school_name || ''
    );
    setHeader('schoolYear', last?.sy_label || '');
    setHeader('gradeLevel', String(last?.grade_level ?? ''));
    setHeader('section', last?.section_name || '');
  }

  /* ── Update helpers ── */
  const setLearnerField = (key: keyof LearnerState, val: string) =>
    setLearner(prev => ({ ...prev, [key]: val }));

  const setEligField = (key: keyof EligibilityState, val: string | boolean) =>
    setEligibility(prev => ({ ...prev, [key]: val }));

  const setCertField = (key: keyof CertState, val: string) =>
    setCert(prev => ({ ...prev, [key]: val }));

  const updateRecord = (idx: number, field: keyof ScholasticRecord, val: string) =>
    setRecords(prev =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r))
    );

  const updateLearningArea = (
    idx: number,
    lIdx: number,
    field: keyof LearningAreaRow,
    val: string
  ) =>
    setRecords(prev =>
      prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              learningAreas: r.learningAreas.map((la, li) =>
                li === lIdx ? { ...la, [field]: val } : la
              )
            }
          : r
      )
    );

  const updateRemedial = (
    idx: number,
    rIdx: number,
    field: keyof RemedialRow,
    val: string
  ) =>
    setRecords(prev =>
      prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              remedialsClasses: r.remedialsClasses.map((rem, ri) =>
                ri === rIdx ? { ...rem, [field]: val } : rem
              )
            }
          : r
      )
    );

  /* ── Print ── */
  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    const options = {
      elementId: 'sf10-print-area',
      filename: `SF10_${selectedStudent?.lrn || selectedStudentId || 'record'}`,
      orientation: 'landscape' as const,
      format: 'letter' as const,
    };
    try {
      // Primary path: render server-side in Chrome so the PDF matches the
      // browser's Print Preview exactly (landscape table, page breaks, print
      // CSS), then auto-download.
      await downloadRenderedPdf(options);
      showToast('success', 'PDF exported successfully.');
    } catch {
      // Server render unavailable — fall back to the client-side pdfmake export.
      try {
        await exportToPdf(options);
        showToast('info', 'Server render unavailable — used local fallback.');
      } catch {
        showToast('error', 'Failed to export PDF. Please try again.');
      }
    } finally {
      setExporting(false);
    }
  };

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-5 animate-pulse">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className={`h-1.5 bg-gradient-to-r ${accent.gradient}`} />
          <div className="p-6 space-y-4">
            <div className="h-5 w-72 bg-gray-100 rounded-lg" />
            <div className="h-4 w-96 bg-gray-50 rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  const lastRecord = records[records.length - 1];
  const nextGrade =
    lastRecord && lastRecord.classifiedGrade
      ? String(parseInt(lastRecord.classifiedGrade, 10) + 1)
      : '';

  return (
    <div className="space-y-5 pb-10">
      {/* ── Print styles ── */}
      <style>{`
        @media print {
          body { font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          #sf10-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0.15in; }
          #sf10-print-area .print-page { page-break-after: always; }
          #sf10-print-area .print-page:last-child { page-break-after: avoid; }
          @page { size: letter landscape; margin: 0.3in; }
        }
      `}</style>

      {/* ── Filter Bar ── */}
      <div className="no-print">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className={`h-1.5 bg-gradient-to-r ${accent.gradient}`} />
          <div className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accent.tile} shadow-lg ${accent.tileShadow} flex items-center justify-center flex-shrink-0`}>
                  <FileText size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">
                    SF10 — Learner's Permanent Academic Record
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Search a learner to open their SF10-JHS (Formerly Form 137)
                    with grades auto-filled from the database.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPdf}
                  disabled={!sf10Data || exporting}
                  className={`inline-flex items-center gap-1.5 ${accent.button} disabled:opacity-40 text-white px-3.5 py-2 rounded-xl text-sm font-medium transition shadow-sm`}>
                  {exporting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  {exporting ? 'Generating…' : 'PDF'}
                </button>
                <button
                  onClick={handlePrint}
                  disabled={!sf10Data}
                  className="inline-flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 text-gray-700 px-3.5 py-2 rounded-xl text-sm font-medium transition shadow-sm">
                  <Printer size={14} /> Print
                </button>
              </div>
            </div>

            {/* Searchable learner picker */}
            <div className="relative max-w-xl">
              <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-[0.05em]">
                Learner
              </label>
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={searchQuery}
                  placeholder="Search by name, LRN, or ID number…"
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() =>
                    setTimeout(() => setShowSuggestions(false), 150)
                  }
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  className={`w-full border border-gray-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 ${accent.ring} bg-white transition`}
                />
              </div>
              {showSuggestions && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {filteredStudents.length === 0 && (
                    <div className="p-3 text-sm text-gray-400">
                      No learners match "{searchQuery}".
                    </div>
                  )}
                  {filteredStudents.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onMouseDown={() => {
                        setSelectedStudentId(s.id);
                        setSearchQuery(`${s.lrn} — ${s.name}`);
                        setShowSuggestions(false);
                        setSf10Data(null);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 hover:bg-gray-50 transition text-sm flex items-center justify-between gap-2`}>
                      <span className="font-medium text-gray-800 truncate">
                        {s.name}
                      </span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {s.lrn}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
              <Users size={12} />
              <span>
                {students.length} learner{students.length !== 1 ? 's' : ''}
                {selectedStudent
                  ? ` · Selected: ${selectedStudent.name}`
                  : ' · Search to open a permanent record'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Loading / Error / Empty ── */}
      {loadingReport && (
        <div className="no-print max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
            <Loader2
              size={28}
              className={`animate-spin ${accent.text} mx-auto mb-3`}
            />
            <p className="text-gray-500 font-semibold">
              Loading Permanent Academic Record…
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Compiling grades across school years from database
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="no-print max-w-5xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            <p className="font-bold mb-1">Error loading SF10</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {!loadingReport && !error && !sf10Data && selectedStudentId && (
        <div className="no-print max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className={`w-14 h-14 rounded-2xl ${accent.soft} flex items-center justify-center mx-auto mb-4`}>
              <Users size={28} className={accent.text} />
            </div>
            <p className="text-gray-500 text-sm font-semibold">
              No permanent record found
            </p>
            <p className="text-gray-400 text-xs mt-1">
              No enrollments or grades found for this learner.
            </p>
          </div>
        </div>
      )}

      {!selectedStudentId && (
        <div className="no-print max-w-5xl mx-auto">
          <div className="bg-gray-50 rounded-2xl border border-gray-100 p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Users size={28} className="text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm font-semibold">
              Search for a learner
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Type a name, LRN, or ID number above to open their SF10 permanent
              academic record.
            </p>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────── */}
      {/* SF10 Official DepEd Learner's Permanent Academic Record        */}
      {/* ────────────────────────────────────────────────────────────── */}
      {!loadingReport && sf10Data && selectedStudent && (
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-x-auto">
          <div
            id="sf10-print-area"
            className="p-4 sm:p-6 text-[10px] leading-tight text-black">
            <div style={{ minWidth: '960px' }}>
              {/* ── Shared letterhead title block (same as SF1) ── */}
              <SchoolFormTitleBlock
                title="Learner's Permanent Academic Record for Junior High School (SF10-JHS)"
                subtitle="(Formerly Form 137)"
              />

              {/* ── Shared header fields ── */}
              <SchoolFormHeader header={header} onChange={setHeader} />

              {/* ── LEARNER'S INFORMATION ── */}
              <div className="bg-yellow-100 border-2 border-gray-800 p-2 font-bold text-center mb-2">
                LEARNER'S INFORMATION
              </div>
              <div className="border-2 border-gray-800 p-2 mb-2">
                <div className="grid grid-cols-4 gap-4 mb-2">
                  {(
                    [
                      ['lastName', 'LAST NAME'],
                      ['firstName', 'FIRST NAME'],
                      ['nameExt', 'NAME EXTN. (Jr.,II)'],
                      ['middleName', 'MIDDLE NAME']
                    ] as [keyof LearnerState, string][]
                  ).map(([key, label]) => (
                    <div key={key} className="flex items-end gap-1">
                      <span className="font-bold whitespace-nowrap">
                        {label}:
                      </span>
                      <input
                        type="text"
                        value={learner[key]}
                        onChange={e =>
                          setLearnerField(key, e.target.value)
                        }
                        className="sf1-input flex-1 border-b-2 border-gray-800 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                      />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-end gap-1">
                    <span className="font-bold whitespace-nowrap">
                      Learner Reference Number (LRN):
                    </span>
                    <input
                      type="text"
                      value={learner.lrn}
                      onChange={e =>
                        setLearnerField('lrn', e.target.value)
                      }
                      className="sf1-input flex-1 border-b-2 border-gray-800 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                    />
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="font-bold whitespace-nowrap">
                      Birthdate:
                    </span>
                    <input
                      type="date"
                      value={learner.birthDate}
                      onChange={e =>
                        setLearnerField('birthDate', e.target.value)
                      }
                      className="sf1-input flex-1 border-b-2 border-gray-800 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                    />
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="font-bold">Sex:</span>
                    <input
                      type="text"
                      value={learner.sex}
                      onChange={e =>
                        setLearnerField('sex', e.target.value)
                      }
                      className="sf1-input w-16 border-b-2 border-gray-800 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                    />
                  </div>
                </div>
              </div>

              {/* ── ELIGIBILITY FOR JHS ENROLMENT ── */}
              <div className="bg-yellow-100 border-2 border-gray-800 p-2 font-bold text-center mb-2">
                ELIGIBILITY FOR JHS ENROLMENT
              </div>
              <div className="border-2 border-gray-800 p-3 mb-2">
                {/* Row 1 — Elementary completer + general average + citation */}
                <div className="grid grid-cols-12 gap-x-3 gap-y-2 mb-3">
                  <div className="col-span-12 sm:col-span-4 flex items-center gap-2">
                    {checkboxInput({
                      checked: eligibility.elementaryCompleter,
                      onChange: v => setEligField('elementaryCompleter', v),
                      label: 'Elementary School Completer'
                    })}
                  </div>
                  <div className="col-span-6 sm:col-span-4 flex items-baseline gap-1">
                    <span className="font-bold whitespace-nowrap">
                      General Average:
                    </span>
                    <input
                      type="text"
                      value={eligibility.generalAverage}
                      onChange={e =>
                        setEligField('generalAverage', e.target.value)
                      }
                      className="sf1-input flex-1 border-b-2 border-gray-800 bg-transparent px-1 text-[11px] text-center outline-none focus:bg-amber-50"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-4 flex items-baseline gap-1">
                    <span className="font-bold whitespace-nowrap">
                      Citation (If Any):
                    </span>
                    <input
                      type="text"
                      value={eligibility.citation}
                      onChange={e =>
                        setEligField('citation', e.target.value)
                      }
                      className="sf1-input flex-1 border-b-2 border-gray-800 bg-transparent px-1 text-[11px] text-center outline-none focus:bg-amber-50"
                    />
                  </div>
                </div>

                {/* Row 2 — Elementary school details */}
                <div className="grid grid-cols-12 gap-x-3 gap-y-2 mb-3">
                  <div className="col-span-12 sm:col-span-5 flex items-baseline gap-1">
                    <span className="font-bold whitespace-nowrap">
                      Name of Elementary School:
                    </span>
                    <input
                      type="text"
                      value={eligibility.elementarySchoolName}
                      onChange={e =>
                        setEligField('elementarySchoolName', e.target.value)
                      }
                      className="sf1-input flex-1 border-b-2 border-gray-800 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3 flex items-baseline gap-1">
                    <span className="font-bold whitespace-nowrap">
                      School ID:
                    </span>
                    <input
                      type="text"
                      value={eligibility.schoolId}
                      onChange={e => setEligField('schoolId', e.target.value)}
                      className="sf1-input flex-1 border-b-2 border-gray-800 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-4 flex items-baseline gap-1">
                    <span className="font-bold whitespace-nowrap">
                      Address of School:
                    </span>
                    <input
                      type="text"
                      value={eligibility.schoolAddress}
                      onChange={e =>
                        setEligField('schoolAddress', e.target.value)
                      }
                      className="sf1-input flex-1 border-b-2 border-gray-800 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                    />
                  </div>
                </div>

                {/* Sub-header — Other Credential Presented */}
                <div className="border border-gray-800 bg-gray-200 px-2 py-1 font-bold text-center text-[11px] mb-3">
                  OTHER CREDENTIALS PRESENTED
                </div>

                {/* Row 3 — PEPT / ALS */}
                <div className="grid grid-cols-12 gap-x-3 gap-y-2 mb-2">
                  <div className="col-span-6 flex items-center gap-2">
                    {checkboxInput({
                      checked: eligibility.peptPasser,
                      onChange: v => setEligField('peptPasser', v),
                      label: 'PEPT Passer'
                    })}
                    <span className="font-bold whitespace-nowrap">
                      Rating:
                    </span>
                    <input
                      type="text"
                      value={eligibility.peptRating}
                      onChange={e =>
                        setEligField('peptRating', e.target.value)
                      }
                      className="sf1-input w-16 border-b-2 border-gray-800 bg-transparent px-1 text-[11px] text-center outline-none focus:bg-amber-50"
                    />
                  </div>
                  <div className="col-span-6 flex items-center gap-2">
                    {checkboxInput({
                      checked: eligibility.alsAE,
                      onChange: v => setEligField('alsAE', v),
                      label: 'ALS A & E Passer'
                    })}
                    <span className="font-bold whitespace-nowrap">
                      Rating:
                    </span>
                    <input
                      type="text"
                      value={eligibility.alsAERating}
                      onChange={e =>
                        setEligField('alsAERating', e.target.value)
                      }
                      className="sf1-input w-16 border-b-2 border-gray-800 bg-transparent px-1 text-[11px] text-center outline-none focus:bg-amber-50"
                    />
                  </div>
                </div>

                {/* Row 4 — Others + exam date + testing center */}
                <div className="grid grid-cols-12 gap-x-3 gap-y-2">
                  <div className="col-span-12 sm:col-span-4 flex items-center gap-2">
                    {checkboxInput({
                      checked: eligibility.others,
                      onChange: v => setEligField('others', v),
                      label: 'Others (Pls. Specify):'
                    })}
                    <input
                      type="text"
                      value={eligibility.othersSpecify}
                      onChange={e =>
                        setEligField('othersSpecify', e.target.value)
                      }
                      className="sf1-input flex-1 border-b-2 border-gray-800 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-4 flex items-baseline gap-1">
                    <span className="font-bold whitespace-nowrap">
                      Date of Examination/Assessment:
                    </span>
                    <input
                      type="date"
                      value={eligibility.examDate}
                      onChange={e => setEligField('examDate', e.target.value)}
                      className="sf1-input flex-1 border-b-2 border-gray-800 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-4 flex items-baseline gap-1">
                    <span className="font-bold whitespace-nowrap">
                      Name and Address of Testing Center:
                    </span>
                    <input
                      type="text"
                      value={eligibility.testingCenter}
                      onChange={e =>
                        setEligField('testingCenter', e.target.value)
                      }
                      className="sf1-input flex-1 border-b-2 border-gray-800 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                    />
                  </div>
                </div>
              </div>

              {/* ── SCHOLASTIC RECORDS (one per school year) ── */}
              {records.map((record, idx) => (
                <div key={record.schoolYear || idx} className="print-page">
                  <div className="bg-yellow-100 border-2 border-gray-800 p-2 font-bold text-center mb-2 mt-4">
                    SCHOLASTIC RECORD — SY {record.schoolYear || '—'}
                  </div>

                  <div className="border-2 border-gray-800 p-2">
                    <div className="text-[11px] flex items-end gap-1 flex-wrap">
                      <span className="font-bold">School:</span>
                      <input
                        type="text"
                        value={record.school}
                        onChange={e =>
                          updateRecord(idx, 'school', e.target.value)
                        }
                        className="sf1-input inline border-b border-gray-800 w-48 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                      />
                      <span className="ml-4 font-bold">School ID:</span>
                      <input
                        type="text"
                        value={record.schoolId}
                        onChange={e =>
                          updateRecord(idx, 'schoolId', e.target.value)
                        }
                        className="sf1-input inline border-b border-gray-800 w-20 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                      />
                      <span className="ml-4 font-bold">District:</span>
                      <input
                        type="text"
                        value={record.district}
                        onChange={e =>
                          updateRecord(idx, 'district', e.target.value)
                        }
                        className="sf1-input inline border-b border-gray-800 w-24 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                      />
                      <span className="ml-4 font-bold">Division:</span>
                      <input
                        type="text"
                        value={record.division}
                        onChange={e =>
                          updateRecord(idx, 'division', e.target.value)
                        }
                        className="sf1-input inline border-b border-gray-800 w-24 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                      />
                      <span className="ml-4 font-bold">Region:</span>
                      <input
                        type="text"
                        value={record.region}
                        onChange={e =>
                          updateRecord(idx, 'region', e.target.value)
                        }
                        className="sf1-input inline border-b border-gray-800 w-20 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                      />
                    </div>
                    <div className="text-[11px] mt-2 flex items-end gap-1 flex-wrap">
                      <span className="font-bold">Classified as Grade:</span>
                      <input
                        type="text"
                        value={record.classifiedGrade}
                        onChange={e =>
                          updateRecord(idx, 'classifiedGrade', e.target.value)
                        }
                        className="sf1-input inline border-b border-gray-800 w-12 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                      />
                      <span className="ml-4 font-bold">Section:</span>
                      <input
                        type="text"
                        value={record.section}
                        onChange={e =>
                          updateRecord(idx, 'section', e.target.value)
                        }
                        className="sf1-input inline border-b border-gray-800 w-24 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                      />
                      <span className="ml-4 font-bold">School Year:</span>
                      <input
                        type="text"
                        value={record.schoolYear}
                        onChange={e =>
                          updateRecord(idx, 'schoolYear', e.target.value)
                        }
                        className="sf1-input inline border-b border-gray-800 w-24 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                      />
                      <span className="ml-4 font-bold">
                        Name of Adviser/Teacher:
                      </span>
                      <input
                        type="text"
                        value={record.adviser}
                        onChange={e =>
                          updateRecord(idx, 'adviser', e.target.value)
                        }
                        className="sf1-input inline border-b border-gray-800 w-40 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                      />
                      <span className="ml-4 font-bold">Signature:</span>
                      <input
                        type="text"
                        value={record.signature}
                        onChange={e =>
                          updateRecord(idx, 'signature', e.target.value)
                        }
                        className="sf1-input inline border-b border-gray-800 w-24 bg-transparent px-1 text-[11px] outline-none focus:bg-amber-50"
                      />
                    </div>
                  </div>

                  {/* Learning areas table */}
                  <table className="w-full border-collapse text-[11px] border-2 border-gray-800 border-t-0">
                    <thead>
                      <tr className="bg-gray-300">
                        <th
                          rowSpan={2}
                          className="border border-gray-800 p-1 font-bold text-left w-[38%]">
                          LEARNING AREAS
                        </th>
                        <th
                          colSpan={4}
                          className="border border-gray-800 p-1 font-bold">
                          QUARTERS
                        </th>
                        <th
                          rowSpan={2}
                          className="border border-gray-800 p-1 font-bold">
                          FINAL RATING
                        </th>
                        <th
                          rowSpan={2}
                          className="border border-gray-800 p-1 font-bold">
                          REMARKS
                        </th>
                      </tr>
                      <tr className="bg-gray-300">
                        <th className="border border-gray-800 p-1 font-bold">
                          1
                        </th>
                        <th className="border border-gray-800 p-1 font-bold">
                          2
                        </th>
                        <th className="border border-gray-800 p-1 font-bold">
                          3
                        </th>
                        <th className="border border-gray-800 p-1 font-bold">
                          4
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {buildLearningAreaDisplay(record.learningAreas).map(
                        (display, di) => {
                          if (display.kind === 'header') {
                            return (
                              <tr
                                key={`${record.schoolYear}-mapeh-header`}
                                className="bg-gray-200">
                                <td className="border border-gray-800 p-1 text-left font-bold uppercase">
                                  {display.label}
                                </td>
                                <td className="border border-gray-800 p-1 text-center font-bold">
                                  {display.q1}
                                </td>
                                <td className="border border-gray-800 p-1 text-center font-bold">
                                  {display.q2}
                                </td>
                                <td className="border border-gray-800 p-1 text-center font-bold">
                                  {display.q3}
                                </td>
                                <td className="border border-gray-800 p-1 text-center font-bold">
                                  {display.q4}
                                </td>
                                <td className="border border-gray-800 p-1 text-center font-bold">
                                  {display.finalRating}
                                </td>
                                <td className="border border-gray-800 p-1 text-center font-bold">
                                  {display.remarks}
                                </td>
                              </tr>
                            );
                          }
                          const { index: li, area } = display;
                          return (
                            <tr
                              key={`${record.schoolYear}-${area.subject}-${li}`}>
                              <td className="border border-gray-800 p-1 font-medium pl-6">
                                {area.subject}
                              </td>
                              <td className="border border-gray-800 p-0">
                                <input
                                  type="text"
                                  value={area.q1}
                                  onChange={e =>
                                    updateLearningArea(
                                      idx,
                                      li,
                                      'q1',
                                      e.target.value
                                    )
                                  }
                                  className="sf1-input w-full h-6 text-center border-0 bg-transparent text-[11px] outline-none focus:bg-amber-50"
                                />
                              </td>
                              <td className="border border-gray-800 p-0">
                                <input
                                  type="text"
                                  value={area.q2}
                                  onChange={e =>
                                    updateLearningArea(
                                      idx,
                                      li,
                                      'q2',
                                      e.target.value
                                    )
                                  }
                                  className="sf1-input w-full h-6 text-center border-0 bg-transparent text-[11px] outline-none focus:bg-amber-50"
                                />
                              </td>
                              <td className="border border-gray-800 p-0">
                                <input
                                  type="text"
                                  value={area.q3}
                                  onChange={e =>
                                    updateLearningArea(
                                      idx,
                                      li,
                                      'q3',
                                      e.target.value
                                    )
                                  }
                                  className="sf1-input w-full h-6 text-center border-0 bg-transparent text-[11px] outline-none focus:bg-amber-50"
                                />
                              </td>
                              <td className="border border-gray-800 p-0">
                                <input
                                  type="text"
                                  value={area.q4}
                                  onChange={e =>
                                    updateLearningArea(
                                      idx,
                                      li,
                                      'q4',
                                      e.target.value
                                    )
                                  }
                                  className="sf1-input w-full h-6 text-center border-0 bg-transparent text-[11px] outline-none focus:bg-amber-50"
                                />
                              </td>
                              <td className="border border-gray-800 p-0">
                                <input
                                  type="text"
                                  value={area.finalRating}
                                  onChange={e =>
                                    updateLearningArea(
                                      idx,
                                      li,
                                      'finalRating',
                                      e.target.value
                                    )
                                  }
                                  className="sf1-input w-full h-6 text-center border-0 bg-transparent text-[11px] font-bold outline-none focus:bg-amber-50"
                                />
                              </td>
                              <td className="border border-gray-800 p-1">
                                <input
                                  type="text"
                                  value={area.remarks}
                                  onChange={e =>
                                    updateLearningArea(
                                      idx,
                                      li,
                                      'remarks',
                                      e.target.value
                                    )
                                  }
                                  className="sf1-input w-full text-center border-0 bg-transparent text-[11px] outline-none focus:bg-amber-50"
                                />
                              </td>
                            </tr>
                          );
                        }
                      )}
                      {record.learningAreas.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="border border-gray-800 p-2 text-center italic text-gray-400">
                            No grades recorded for this school year.
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td
                          colSpan={6}
                          className="border border-gray-800 p-1 text-center italic font-bold">
                          General Average
                        </td>
                        <td className="border border-gray-800 p-1">
                          <input
                            type="text"
                            value={record.generalAverage}
                            onChange={e =>
                              updateRecord(
                                idx,
                                'generalAverage',
                                e.target.value
                              )
                            }
                            className="sf1-input w-full text-center border-0 bg-transparent text-[11px] font-bold outline-none focus:bg-amber-50"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Remedial classes */}
                  <table className="w-full border-collapse text-[11px] border-2 border-gray-800 mb-2">
                    <thead>
                      <tr className="bg-gray-200">
                        <th className="border border-gray-800 p-1 font-bold text-left w-1/5">
                          Remedial Classes
                        </th>
                        <th className="border border-gray-800 p-1 font-bold text-center">
                          Conducted from
                        </th>
                        <th className="border border-gray-800 p-1 font-bold text-center">
                          to
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-800 p-1"></td>
                        <td className="border border-gray-800 p-1">
                          <input
                            type="date"
                            value={record.remedialsFrom}
                            onChange={e =>
                              updateRecord(
                                idx,
                                'remedialsFrom',
                                e.target.value
                              )
                            }
                            className="sf1-input w-full border-0 bg-transparent text-[11px] outline-none focus:bg-amber-50"
                          />
                        </td>
                        <td className="border border-gray-800 p-1">
                          <input
                            type="date"
                            value={record.remedialsTo}
                            onChange={e =>
                              updateRecord(
                                idx,
                                'remedialsTo',
                                e.target.value
                              )
                            }
                            className="sf1-input w-full border-0 bg-transparent text-[11px] outline-none focus:bg-amber-50"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <table className="w-full border-collapse text-[11px] border-2 border-gray-800 mb-4">
                    <thead>
                      <tr className="bg-gray-200">
                        <th className="border border-gray-800 p-1 font-bold text-left">
                          Learning Areas
                        </th>
                        <th className="border border-gray-800 p-1 font-bold">
                          Final Rating
                        </th>
                        <th className="border border-gray-800 p-1 font-bold">
                          Remedial Class Mark
                        </th>
                        <th className="border border-gray-800 p-1 font-bold">
                          Recomputed Final Grade
                        </th>
                        <th className="border border-gray-800 p-1 font-bold">
                          Remarks
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.remedialsClasses.map((item, ri) => (
                        <tr key={`${record.schoolYear}-rem-${ri}`}>
                          <td className="border border-gray-800 p-1">
                            <input
                              type="text"
                              value={item.learningArea}
                              onChange={e =>
                                updateRemedial(
                                  idx,
                                  ri,
                                  'learningArea',
                                  e.target.value
                                )
                              }
                              className="sf1-input w-full border-0 bg-transparent text-[11px] outline-none focus:bg-amber-50"
                            />
                          </td>
                          <td className="border border-gray-800 p-0">
                            <input
                              type="text"
                              value={item.finalRating}
                              onChange={e =>
                                updateRemedial(
                                  idx,
                                  ri,
                                  'finalRating',
                                  e.target.value
                                )
                              }
                              className="sf1-input w-full h-6 text-center border-0 bg-transparent text-[11px] outline-none focus:bg-amber-50"
                            />
                          </td>
                          <td className="border border-gray-800 p-0">
                            <input
                              type="text"
                              value={item.classmark}
                              onChange={e =>
                                updateRemedial(
                                  idx,
                                  ri,
                                  'classmark',
                                  e.target.value
                                )
                              }
                              className="sf1-input w-full h-6 text-center border-0 bg-transparent text-[11px] outline-none focus:bg-amber-50"
                            />
                          </td>
                          <td className="border border-gray-800 p-0">
                            <input
                              type="text"
                              value={item.recomputedGrade}
                              onChange={e =>
                                updateRemedial(
                                  idx,
                                  ri,
                                  'recomputedGrade',
                                  e.target.value
                                )
                              }
                              className="sf1-input w-full h-6 text-center border-0 bg-transparent text-[11px] outline-none focus:bg-amber-50"
                            />
                          </td>
                          <td className="border border-gray-800 p-1">
                            <input
                              type="text"
                              value={item.remarks}
                              onChange={e =>
                                updateRemedial(
                                  idx,
                                  ri,
                                  'remarks',
                                  e.target.value
                                )
                              }
                              className="sf1-input w-full text-center border-0 bg-transparent text-[11px] outline-none focus:bg-amber-50"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {/* ── CERTIFICATION ── */}
              <div className="bg-yellow-100 border-2 border-gray-800 p-2 font-bold text-center mb-2 mt-4">
                CERTIFICATION
              </div>
              <div className="border-2 border-gray-800 p-3 mb-4">
                <div className="text-[11px] italic leading-relaxed mb-4">
                  CERTIFY that this is a true record of{' '}
                  <span className="font-bold not-italic">
                    {learner.lastName}
                    {learner.lastName ? ',' : ''} {learner.firstName}
                  </span>{' '}
                  with LRN{' '}
                  <span className="font-bold not-italic">
                    {learner.lrn || '____________'}
                  </span>{' '}
                  and that he/she is{' '}
                  <span className="font-bold">eligible for admission to grade</span>{' '}
                  <span className="font-bold not-italic">
                    {nextGrade || '____'}
                  </span>{' '}
                  of{' '}
                  <span className="font-bold not-italic">
                    {lastRecord?.school || '________________'}
                  </span>{' '}
                  School ID:{' '}
                  <span className="font-bold not-italic">
                    {lastRecord?.schoolId || '______'}
                  </span>{' '}
                  Last School Year Attended:{' '}
                  <span className="font-bold not-italic">
                    {lastRecord?.schoolYear || '__________'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-6 mt-8">
                  <div className="text-center">
                    <input
                      type="date"
                      value={cert.certDate}
                      onChange={e => setCertField('certDate', e.target.value)}
                      className="sf1-input w-full border-b-2 border-gray-800 mb-1 h-12 bg-transparent text-center text-[11px] outline-none focus:bg-amber-50"
                    />
                    <div className="text-[11px] font-bold">Date</div>
                  </div>
                  <div className="text-center">
                    <input
                      type="text"
                      value={cert.principalName}
                      onChange={e =>
                        setCertField('principalName', e.target.value)
                      }
                      placeholder="Signature over Printed Name"
                      className="sf1-input w-full border-b-2 border-gray-800 mb-1 h-12 bg-transparent text-center text-[11px] outline-none focus:bg-amber-50"
                    />
                    <div className="text-[11px] font-bold">
                      Name of Principal/School Head over Printed Name
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-2 border-dashed border-gray-400 h-12 flex items-center justify-center">
                      <span className="text-[10px]">
                        (Affix School Seal here)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
