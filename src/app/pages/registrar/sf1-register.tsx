import { useState, useEffect, useMemo } from 'react';
import { Printer, Loader2 } from 'lucide-react';
import './sf1.css';
import { Button } from '../../components/ui/button';
import { SchoolFormHeader } from '../../components/school-form-header';
import { studentsApi, StudentRow } from '../../services/students';
import { sectionsApi, SectionRow } from '../../services/sections';
import { enrollmentsApi, EnrollmentRow } from '../../services/enrollments';
import { settingsApi } from '../../services/settings';
import { useApp } from '../../context/AppContext';

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

/* ---------------------------------------------------------------- */
/* Reusable inline editable cell — shared via school-form-header     */
/* ---------------------------------------------------------------- */

export function SF1Register() {
  const { schoolName, schoolYearLabel } = useApp();

  // ── API data ──
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // ── Filter selections ──
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

  // ── Load data on mount ──
  useEffect(() => {
    Promise.all([
      studentsApi.list(),
      sectionsApi.list(),
      enrollmentsApi.list(),
      settingsApi.get(),
    ]).then(([studs, secs, enrs, settings]) => {
      console.log('[SF1] Students:', studs.length, 'Sections:', secs.length, 'Enrollments:', enrs.length);
      console.log('[SF1] Enrollments sample:', enrs.slice(0, 3));
      setStudents(studs);
      setSections(secs);
      setEnrollments(enrs);
      setHeader(prev => ({
        ...prev,
        schoolId: settings.school_id || prev.schoolId,
        region: settings.region || prev.region,
        division: settings.division || prev.division,
        district: settings.district || prev.district,
        schoolName: settings.school_name || prev.schoolName,
      }));
      const g7 = secs.filter(s => s.grade_level === 7 && s.is_active === 1);
      if (g7.length > 0) setSelectedSection(g7[0].name);
    }).finally(() => setDataLoading(false));
  }, []);

  // ── Sync school name & year from context ──
  useEffect(() => {
    setHeader(prev => ({
      ...prev,
      schoolName: schoolName || prev.schoolName,
      schoolYear: schoolYearLabel || prev.schoolYear,
    }));
  }, [schoolName, schoolYearLabel]);

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
      return;
    }
    console.log('[SF1] Found section:', section.id, section.name);
    const matchingEnrs = enrollments.filter(
      e => e.grade_level === parseInt(selectedGrade) && e.section_id === section.id && e.status === 'enrolled'
    );
    console.log('[SF1] Matching enrollments:', matchingEnrs.length, matchingEnrs.slice(0, 2));
    const enrolled = matchingEnrs
      .map(e => students.find(s => s.id === e.student_id))
      .filter(Boolean) as StudentRow[];
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
  }, [selectedSection, selectedGrade, enrollments, students, sections]);

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

  const filledCount = rows.filter(r => r.lrn).length;

  return (
    <div className="min-h-screen bg-muted/40 py-6">
      {/* Toolbar */}
      <div className="no-print mx-auto mb-4 flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">
            School Form 1 (SF1) — School Register
          </h1>
          <p className="text-sm text-muted-foreground">
            Select grade &amp; section to auto-populate, or fill manually.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> Print
          </Button>
        </div>
      </div>

      {/* Grade / Section Selector */}
      <div className="no-print mx-auto mb-4 max-w-[1400px] px-4">
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Grade Level</label>
            <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
              {[7, 8, 9, 10, 11, 12].map(g => <option key={g} value={g}>Grade {g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Section</label>
            <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
              {gradeSections.length === 0 && <option value="">No sections</option>}
              {gradeSections.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div className="text-xs text-gray-400 pb-1">
            {filledCount} student{filledCount !== 1 ? 's' : ''} loaded &middot; {rows.length} total rows
          </div>
        </div>
      </div>

      {/* Sheet */}
      <div className="sf1-sheet mx-auto w-fit max-w-full overflow-x-auto bg-white p-6 text-black shadow-sm">
        <div className="sf1-page" style={{ minWidth: '1340px' }}>
          {/* ---------- Title block ---------- */}
          <div className="mb-4 flex items-center justify-between gap-6">
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS_96lFoHFcY7YTT3NbY84OBer4jAMloUcfne1cTKV6lQ&s"
              alt="Department of Education seal"
              width={72}
              height={72}
              className="size-16 shrink-0 object-contain"
            />
            <div className="px-4 text-center">
              <h2 className="text-[15px] font-bold">
                School Form 1 (SF 1) School Register
              </h2>
              <p className="text-[9px] italic text-black/80">
                (This replaces Form 1, Master List &amp; STS Form 2-Family
                Background and Profile)
              </p>
            </div>
            <img
              src="data:image/png;base64,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"
              alt="Department of Education logo"
              width={150}
              height={82}
              className="h-12 w-auto shrink-0 object-contain"
            />
          </div>

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
          <SF1Footer />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Footer: indicator legend, summary counts, signatures             */
/* ---------------------------------------------------------------- */

function SF1Footer() {
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
              {['MALE', 'FEMALE', 'TOTAL'].map(label => (
                <tr key={label}>
                  <td className="border border-black px-2 py-0.5 text-left font-semibold">
                    {label}
                  </td>
                  <td className="border border-black p-0">
                    <input className="sf1-input h-5 w-full text-center outline-none focus:bg-amber-50" />
                  </td>
                  <td className="border border-black p-0">
                    <input className="sf1-input h-5 w-full text-center outline-none focus:bg-amber-50" />
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
            <div className="mt-6 border-t border-black pt-0.5 text-center">
              {s.caption}
            </div>
            <div className="mt-2 flex gap-4">
              <span>BoSY Date:</span>
              <span className="flex-1 border-b border-black" />
              <span>EoSY Date:</span>
              <span className="flex-1 border-b border-black" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
