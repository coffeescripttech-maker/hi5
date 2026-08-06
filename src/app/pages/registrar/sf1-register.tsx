import { useState, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { Printer, Loader2, Download, FileSpreadsheet, FileText } from 'lucide-react';
import './sf1.css';
import { Button } from '../../components/ui/button';
import { SchoolFormHeader } from '../../components/school-form-header';
import { SchoolFormTitleBlock } from '../../components/school-form-title';
import { studentsApi, StudentRow } from '../../services/students';
import { sectionsApi, SectionRow } from '../../services/sections';
import { enrollmentsApi, EnrollmentRow } from '../../services/enrollments';
import { schoolYearsApi, SchoolYearRow } from '../../services/schoolYears';
import { settingsApi } from '../../services/settings';
import { useApp } from '../../context/AppContext';
import { exportToPdf } from '../../services/pdfExport';

/* ---------------------------------------------------------------- */
/* Column definitions matching DepEd School Form 1 (SF1)            */
/* ---------------------------------------------------------------- */

type Leaf = {
  key: string;
  title: string;
  sub?: string;
  width: string;
  blue?: boolean;
};

// Flat list of data columns (used to render body rows in order)
const LEAF_COLUMNS: Leaf[] = [
  { key: 'lrn', title: 'LRN', width: '90px' },
  {
    key: 'name',
    title: 'NAME',
    sub: '(Last Name, First Name, Middle Name)',
    width: '200px'
  },
  { key: 'sex', title: 'Sex', sub: '(M/F)', width: '40px' },
  { key: 'birthdate', title: 'BIRTH DATE', sub: '(mm/dd/yyyy)', width: '80px' },
  { key: 'age', title: 'AGE as of', sub: '1st Friday June', width: '55px' },
  { key: 'mothertongue', title: 'MOTHER TONGUE', width: '70px' },
  { key: 'ip', title: 'IP', sub: '(Ethnic Group)', width: '60px' },
  { key: 'religion', title: 'RELIGION', width: '70px' },
  // ADDRESS group
  {
    key: 'addr_house',
    title: 'House #/ Street/ Sitio/ Purok',
    width: '90px',
    blue: true
  },
  { key: 'addr_barangay', title: 'Barangay', width: '75px', blue: true },
  { key: 'addr_city', title: 'Municipality/ City', width: '80px', blue: true },
  { key: 'addr_province', title: 'Province', width: '75px', blue: true },
  // PARENTS group
  {
    key: 'father',
    title: "Father's Name (Last Name, First Name, Middle Name)",
    width: '130px',
    blue: true
  },
  {
    key: 'mother',
    title: "Mother's Maiden Name (Last Name, First Name, Middle Name)",
    width: '130px',
    blue: true
  },
  // GUARDIAN group
  { key: 'guardian_name', title: 'Name', width: '100px', blue: true },
  { key: 'guardian_rel', title: 'Relation-ship', width: '70px', blue: true },
  {
    key: 'contact',
    title: 'Contact Number of Parent or Guardian',
    width: '90px'
  },
  {
    key: 'remarks',
    title: 'REMARKS',
    sub: '(Please refer to the legend on last page)',
    width: '110px',
    blue: true
  }
];

const TOTAL_ROWS = 30;

type RowData = Record<string, string>;

/* ---------------------------------------------------------------- */
/* Helpers                                                          */
/* ---------------------------------------------------------------- */

function formatName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts.pop()!;
  return `${last}, ${parts.join(' ')}`;
}

function formatBirthdate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function computeAge(birthdate: string): number {
  const bd = new Date(birthdate);
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  const m = now.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--;
  return age;
}

/** Format a date value as YYYY-MM-DD in local time (for <input type="date">). */
function formatDateInput(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/* ---------------------------------------------------------------- */
/* Reusable inline editable cell — shared via school-form-header     */
/* ---------------------------------------------------------------- */

export function SF1Register() {
  const { schoolName, schoolYearLabel } = useApp();

  // ── API data ──
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYearRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // ── Filter selections ──
  const [syId, setSyId] = useState(1);
  const [selectedGrade, setSelectedGrade] = useState("7");
  const [selectedSection, setSelectedSection] = useState("");

  // ── Form state ──
  const [rows, setRows] = useState<RowData[]>(() =>
    Array.from({ length: TOTAL_ROWS }, () => ({}))
  );
  const [header, setHeader] = useState({
    schoolId: '',
    region: 'Region VIII',
    division: '',
    district: '',
    schoolName: '',
    schoolYear: '',
    gradeLevel: '7',
    section: ''
  });
  // REGISTERED/BoSY/EoSY counts (rows: MALE, FEMALE, TOTAL; cols: BoSY, EoSY)
  const [registeredCounts, setRegisteredCounts] = useState<string[][]>([]);
  // BoSY / EoSY dates shared across both signature blocks
  const [signatureDates, setSignatureDates] = useState({
    bosyDate: '',
    eosyDate: ''
  });

  // ── Load data on mount ──
  useEffect(() => {
    Promise.all([
      studentsApi.list(),
      sectionsApi.list(),
      enrollmentsApi.list(),
      settingsApi.get(),
      schoolYearsApi.list(),
    ]).then(([studs, secs, enrs, settings, years]) => {
      console.log('[SF1] Students:', studs.length, 'Sections:', secs.length, 'Enrollments:', enrs.length);
      console.log('[SF1] Enrollments sample:', enrs.slice(0, 3));
      setStudents(studs);
      setSections(secs);
      setEnrollments(enrs);
      setSchoolYears(years);
      const currentYear = years.find((y: any) => y.is_current === 1);
      const targetSy = currentYear?.id || years[0]?.id || 1;
      setSyId(targetSy);
      setHeader(prev => ({
        ...prev,
        schoolId: settings.school_id || prev.schoolId,
        region: settings.region || prev.region,
        division: settings.division || prev.division,
        district: settings.district || prev.district,
        schoolName: settings.school_name || prev.schoolName,
      }));
      const active = secs.filter(s => s.is_active === 1);
      // Default to the first section (grade-ascending) that actually has
      // enrolled students in the selected school year, so the register never
      // opens on an empty section.
      const enrolledSection = enrs
        .filter(
          e => e.school_year_id === targetSy && e.status === 'enrolled'
        )
        .sort(
          (a, b) =>
            (a.section_grade_level ?? 99) - (b.section_grade_level ?? 99)
        )
        .find(e => e.section_id != null);
      if (enrolledSection && enrolledSection.section_id != null) {
        const sec = active.find(s => s.id === enrolledSection.section_id);
        if (sec) {
          setSelectedGrade(
            String(enrolledSection.section_grade_level ?? sec.grade_level)
          );
          setSelectedSection(sec.name);
          return;
        }
      }
      const g7 = active.filter(s => s.grade_level === 7);
      if (g7.length > 0) setSelectedSection(g7[0].name);
    }).finally(() => setDataLoading(false));
  }, []);

  // ── Sync school name & year (selected school year takes precedence) ──
  useEffect(() => {
    setHeader(prev => ({
      ...prev,
      schoolName: schoolName || prev.schoolName,
      schoolYear:
        schoolYears.find(y => y.id === syId)?.sy_label ||
        schoolYearLabel ||
        prev.schoolYear,
    }));
  }, [schoolName, schoolYearLabel, schoolYears, syId]);

  // ── Sync grade/section to header ──
  useEffect(() => {
    setHeader(prev => ({ ...prev, gradeLevel: selectedGrade, section: selectedSection }));
  }, [selectedGrade, selectedSection]);

  // ── Sections for current grade ──
  const gradeSections = useMemo(
    () => sections.filter(s => s.grade_level === parseInt(selectedGrade) && s.is_active === 1),
    [sections, selectedGrade]
  );

  // ── Reset section selection when grade changes ──
  useEffect(() => {
    if (selectedSection && !gradeSections.some(s => s.name === selectedSection)) {
      setSelectedSection(gradeSections.length > 0 ? gradeSections[0].name : '');
    } else if (!selectedSection && gradeSections.length > 0) {
      setSelectedSection(gradeSections[0].name);
    }
  }, [selectedGrade, gradeSections, selectedSection]);

  // ── Populate rows when section changes ──
  useEffect(() => {
    if (!selectedSection || !enrollments.length || !students.length) return;
    const section = sections.find(
      s => s.name === selectedSection && s.grade_level === parseInt(selectedGrade)
    );
    if (!section) {
      console.log('[SF1] No section found for', selectedSection, 'grade', selectedGrade);
      setRegisteredCounts([]);
      return;
    }
    console.log('[SF1] Found section:', section.id, section.name);
    const matchingEnrs = enrollments.filter(
      e => e.school_year_id === syId &&
        e.section_grade_level === parseInt(selectedGrade) &&
        e.section_id === section.id &&
        e.status === 'enrolled'
    );
    console.log('[SF1] Matching enrollments:', matchingEnrs.length, matchingEnrs.slice(0, 2));
    const enrolled = matchingEnrs
      .map(e => students.find(s => s.id === e.student_id))
      .filter(Boolean) as StudentRow[];
    // REGISTERED/BoSY/EoSY counts from the loaded roster (sex breakdown).
    // The data model holds a single enrollment snapshot per SY, so BoSY and
    // EoSY reflect the same enrolled roster until dropouts are tracked.
    const male = enrolled.filter(s => s.sex === 'male').length;
    const female = enrolled.filter(s => s.sex === 'female').length;
    const total = enrolled.length;
    setRegisteredCounts([
      [String(male), String(male)],
      [String(female), String(female)],
      [String(total), String(total)]
    ]);
    // BoSY/EoSY dates from the selected school year's enrollment window.
    const sy = schoolYears.find(y => y.id === syId);
    setSignatureDates({
      bosyDate: formatDateInput(sy?.enrollment_start_date ?? null),
      eosyDate: formatDateInput(sy?.enrollment_end_date ?? null)
    });
    const newRows: RowData[] = enrolled.map(s => ({
      lrn: s.lrn || '',
      name: formatName(s.name || ''),
      sex: s.sex === 'male' ? 'M' : s.sex === 'female' ? 'F' : '',
      birthdate: formatBirthdate(s.birthdate),
      age: s.birthdate ? String(computeAge(s.birthdate)) : '',
      mothertongue: '',
      ip: '',
      religion: '',
      addr_house: '', addr_barangay: '', addr_city: '', addr_province: '',
      father: '', mother: '',
      guardian_name: s.guardian || '',
      guardian_rel: '',
      contact: s.contact || '',
      remarks: '',
    }));
    while (newRows.length < TOTAL_ROWS) newRows.push({});
    setRows(newRows);
  }, [selectedSection, selectedGrade, syId, enrollments, students, sections, schoolYears]);

  // ── Cell / header helpers ──
  const setCell = (rowIndex: number, key: string, val: string) => {
    setRows(prev => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [key]: val };
      return next;
    });
  };
  const setH = (key: keyof typeof header, val: string) =>
    setHeader(prev => ({ ...prev, [key]: val }));

  // ── Loading ──
  if (dataLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        <Loader2 className="size-5 mr-2 animate-spin" />
        Loading students &amp; enrollment data...
      </div>
    );
  }

  // ── PDF Export ──
  const handleExportPdf = async () => {
    try {
      await exportToPdf({
        elementId: 'sf1-print-area',
        filename: `SF1_Register_Grade${selectedGrade}${selectedSection ? '_'+selectedSection : ''}`,
        orientation: 'landscape',
        format: 'letter',
      });
      // useApp() showToast can't be used without the hook — skip toast or import separately
    } catch {
      console.error('PDF export failed');
    }
  };

  const filledCount = rows.filter(r => r.lrn).length;

  return (
    <div className="space-y-5 pb-10">
      {/* ── Header Card ── */}
      <div className="no-print bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-200 flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">
                  School Form 1 (SF1) — School Register
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Select school year, grade &amp; section to auto-populate, or fill manually.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleExportPdf} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                <Download className="size-4" /> PDF
              </Button>
              <Button size="sm" onClick={() => window.print()} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm">
                <Printer className="size-4" /> Print
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Grade / Section Selector */}
      <div className="no-print bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.06em]">School Year</label>
              <select value={syId} onChange={e => setSyId(parseInt(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white transition">
                {schoolYears.length === 0 && <option value="">Loading years...</option>}
                {schoolYears.map(y => <option key={y.id} value={y.id}>{y.sy_label}{y.is_current === 1 ? ' (Current)' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.06em]">Grade Level</label>
              <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white transition">
                {[7, 8, 9, 10, 11, 12].map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.06em]">Section</label>
              <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white transition">
                {gradeSections.length === 0 && <option value="">No sections</option>}
                {gradeSections.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400 pb-1">
              <FileText size={14} className="text-indigo-400" />
              <span>{filledCount} student{filledCount !== 1 ? 's' : ''} loaded &middot; {rows.length} total rows</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sheet */}
      <div id="sf1-print-area" className="sf1-sheet mx-auto w-fit max-w-full overflow-x-auto bg-white p-6 text-black shadow-sm">
        <div className="sf1-page" style={{ minWidth: '1340px' }}>
          {/* ---------- Title block ---------- */}
          <SchoolFormTitleBlock
            title="School Form 1 (SF 1) School Register"
            subtitle="(This replaces Form 1, Master List & STS Form 2-Family Background and Profile)"
          />

          {/* ---------- Header fields ---------- */}
          <SchoolFormHeader header={header} onChange={setH} />

          {/* ---------- Register table ---------- */}
          <table className="w-full table-fixed border-collapse text-[10px]">
            <colgroup>
              {LEAF_COLUMNS.map(c => (
                <col key={c.key} style={{ width: c.width }} />
              ))}
            </colgroup>
            <thead>
              {/* Group header row */}
              <tr>
                <th
                  rowSpan={2}
                  className="border border-black bg-white px-1 py-1 align-middle font-bold">
                  LRN
                </th>
                <th
                  rowSpan={2}
                  className="border border-black px-1 py-1 align-middle font-bold">
                  NAME
                  <div className="font-normal text-red-700">
                    (Last Name, First Name, Middle Name)
                  </div>
                </th>
                <th
                  rowSpan={2}
                  className="border border-black px-1 py-1 align-middle font-bold">
                  Sex<div className="font-normal">(M/F)</div>
                </th>
                <th
                  rowSpan={2}
                  className="border border-black px-1 py-1 align-middle font-bold">
                  BIRTH DATE<div className="font-normal">(mm/dd/ yyyy)</div>
                </th>
                <th
                  rowSpan={2}
                  className="border border-black px-1 py-1 align-middle font-bold">
                  AGE as of<div className="font-normal">1st Friday June</div>
                </th>
                <th
                  rowSpan={2}
                  className="border border-black px-1 py-1 align-middle font-bold">
                  MOTHER TONGUE
                </th>
                <th
                  rowSpan={2}
                  className="border border-black px-1 py-1 align-middle font-bold">
                  IP<div className="font-normal">(Ethnic Group)</div>
                </th>
                <th
                  rowSpan={2}
                  className="border border-black px-1 py-1 align-middle font-bold">
                  RELIGION
                </th>
                <th
                  colSpan={4}
                  className="border border-black px-1 py-1 font-bold">
                  ADDRESS
                </th>
                <th
                  colSpan={2}
                  className="border border-black px-1 py-1 font-bold">
                  PARENTS
                </th>
                <th
                  colSpan={2}
                  className="border border-black px-1 py-1 font-bold">
                  GUARDIAN<div className="font-normal">(If not Parent)</div>
                </th>
                <th
                  rowSpan={2}
                  className="border border-black px-1 py-1 align-middle font-bold">
                  Contact Number of Parent or Guardian
                </th>
                <th
                  rowSpan={2}
                  className="border border-black px-1 py-1 align-middle font-bold">
                  REMARKS
                  <div className="font-normal text-red-700">
                    (Please refer to the legend on last page)
                  </div>
                </th>
              </tr>
              {/* Sub header row for grouped columns */}
              <tr className="text-blue-800">
                <th className="border border-black px-1 py-1 font-semibold">
                  House #/ Street/ Sitio/ Purok
                </th>
                <th className="border border-black px-1 py-1 font-semibold">
                  Barangay
                </th>
                <th className="border border-black px-1 py-1 font-semibold">
                  Municipality/ City
                </th>
                <th className="border border-black px-1 py-1 font-semibold">
                  Province
                </th>
                <th className="border border-black px-1 py-1 font-semibold">
                  Father's Name (Last Name, First Name, Middle Name)
                </th>
                <th className="border border-black px-1 py-1 font-semibold">
                  Mother's Maiden Name (Last Name, First Name, Middle Name)
                </th>
                <th className="border border-black px-1 py-1 font-semibold">
                  Name
                </th>
                <th className="border border-black px-1 py-1 font-semibold">
                  Relation-ship
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {LEAF_COLUMNS.map(c => (
                    <td key={c.key} className="border border-black p-0">
                      <input
                        value={row[c.key] ?? ''}
                        onChange={e => setCell(r, c.key, e.target.value)}
                        className="sf1-input h-6 w-full bg-transparent px-1 text-[10px] outline-none focus:bg-amber-50"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* ---------- Legend + summary + signatures footer ---------- */}
          <SF1Footer
            registeredCounts={registeredCounts}
            setRegisteredCounts={setRegisteredCounts}
            signatureDates={signatureDates}
            setSignatureDates={setSignatureDates}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Footer: indicator legend, summary counts, signatures             */
/* ---------------------------------------------------------------- */

function SF1Footer({
  registeredCounts,
  setRegisteredCounts,
  signatureDates,
  setSignatureDates
}: {
  registeredCounts: string[][];
  setRegisteredCounts: Dispatch<SetStateAction<string[][]>>;
  signatureDates: { bosyDate: string; eosyDate: string };
  setSignatureDates: Dispatch<
    SetStateAction<{ bosyDate: string; eosyDate: string }>
  >;
}) {
  const leftLegend = [
    [
      'Transferred Out',
      'T/O',
      'Name of  Public (P) Private (PR) School  & Effectivity Date'
    ],
    [
      'Transferred IN',
      'T/I',
      'Name of  Public (P) Private (PR) School  & Effectivity Date'
    ],
    ['Dropped', 'DRP', 'Reason and Effectivity Date'],
    ['Late Enrollment', 'LE', 'Reason (Enrollment beyond 1st Friday of June)']
  ];
  const rightLegend = [
    ['CCT', 'CCT Control/reference number & Effectivity Date'],
    ['B/A', 'Name of school last attended & Year'],
    ['LWD', 'Specify'],
    ['ACL', 'Specify Level & Effectivity Data']
  ];

  return (
    <div className="mt-3">
      <p className="mb-1 text-center text-[11px] font-bold">
        List and Code of Indicators under REMARKS column
      </p>
      <div className="flex flex-wrap gap-6 text-[10px]">
        {/* Legend tables */}
        <div className="flex-1 min-w-[520px]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="font-bold">
                <th className="border border-black px-1 py-0.5 text-left">
                  Indicator
                </th>
                <th className="border border-black px-1 py-0.5 text-left">
                  Code
                </th>
                <th className="border border-black px-1 py-0.5 text-left">
                  Required Information
                </th>
                <th className="border border-black px-1 py-0.5 text-left">
                  Code
                </th>
                <th className="border border-black px-1 py-0.5 text-left">
                  Required Information
                </th>
              </tr>
            </thead>
            <tbody>
              {leftLegend.map((l, i) => (
                <tr key={i}>
                  <td className="border border-black px-1 py-0.5 font-semibold">
                    {l[0]}
                  </td>
                  <td className="border border-black px-1 py-0.5">{l[1]}</td>
                  <td className="border border-black px-1 py-0.5">{l[2]}</td>
                  <td className="border border-black px-1 py-0.5 font-semibold">
                    {rightLegend[i][0]}
                  </td>
                  <td className="border border-black px-1 py-0.5">
                    {rightLegend[i][1]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary counts */}
        <div className="min-w-[200px]">
          <table className="w-full border-collapse text-center">
            <thead>
              <tr className="font-bold">
                <th className="border border-black px-2 py-0.5 text-left">
                  REGISTERED
                </th>
                <th className="border border-black px-2 py-0.5">BoSY</th>
                <th className="border border-black px-2 py-0.5">EoSY</th>
              </tr>
            </thead>
            <tbody>
              {['MALE', 'FEMALE', 'TOTAL'].map((label, i) => (
                <tr key={label}>
                  <td className="border border-black px-2 py-0.5 text-left font-semibold">
                    {label}
                  </td>
                  <td className="border border-black p-0">
                    <input
                      className="sf1-input h-5 w-full text-center outline-none focus:bg-amber-50"
                      value={registeredCounts[i]?.[0] ?? ''}
                      onChange={e =>
                        setRegisteredCounts(prev => {
                          const next = prev.map(r => [...r]);
                          if (!next[i]) next[i] = ['', ''];
                          next[i][0] = e.target.value;
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className="border border-black p-0">
                    <input
                      className="sf1-input h-5 w-full text-center outline-none focus:bg-amber-50"
                      value={registeredCounts[i]?.[1] ?? ''}
                      onChange={e =>
                        setRegisteredCounts(prev => {
                          const next = prev.map(r => [...r]);
                          if (!next[i]) next[i] = ['', ''];
                          next[i][1] = e.target.value;
                          return next;
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signatures */}
      <div className="mt-6 grid grid-cols-2 gap-12 text-[10px]">
        {[
          {
            role: 'Prepared by:',
            caption: '(Signature of Adviser over Printed Name)'
          },
          {
            role: 'Certified Correct:',
            caption: '(Signature of School Head over Printed Name)'
          }
        ].map(s => (
          <div key={s.role}>
            <p className="font-semibold">{s.role}</p>
            <input
              type="text"
              className="mt-5 w-full border-0 border-b border-black bg-transparent px-1 py-1 text-center text-[10px] font-semibold outline-none focus:bg-amber-50"
              placeholder="Name"
            />
            <div className="mt-0.5 text-center">{s.caption}</div>
            <div className="mt-2 flex items-center gap-2">
              <span className="whitespace-nowrap">BoSY Date:</span>
              <input
                type="date"
                className="flex-1 border-0 border-b border-black bg-transparent px-1 py-0.5 text-center text-[10px] outline-none focus:bg-amber-50"
                value={signatureDates.bosyDate}
                onChange={e =>
                  setSignatureDates(prev => ({
                    ...prev,
                    bosyDate: e.target.value
                  }))
                }
              />
              <span className="whitespace-nowrap">EoSY Date:</span>
              <input
                type="date"
                className="flex-1 border-0 border-b border-black bg-transparent px-1 py-0.5 text-center text-[10px] outline-none focus:bg-amber-50"
                value={signatureDates.eosyDate}
                onChange={e =>
                  setSignatureDates(prev => ({
                    ...prev,
                    eosyDate: e.target.value
                  }))
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
