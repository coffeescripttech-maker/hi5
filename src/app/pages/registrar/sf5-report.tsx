'use client';

import { useState, useEffect, useMemo } from 'react';
import { Printer, Loader2, Download, FileSpreadsheet, FileText, BarChart2 } from 'lucide-react';
import './sf1.css';
import { Button } from '../../components/ui/button';
import { SchoolFormHeader } from '../../components/school-form-header';
import { studentsApi, StudentRow } from '../../services/students';
import { sectionsApi, SectionRow } from '../../services/sections';
import { enrollmentsApi, EnrollmentRow } from '../../services/enrollments';
import { schoolYearsApi, SchoolYearRow } from '../../services/schoolYears';
import { gradesApi, GradeRow } from '../../services/grades';
import { settingsApi } from '../../services/settings';
import { useApp } from '../../context/AppContext';
import { useRoleAccent } from '../../utils/roleTheme';
import { exportToPdf } from '../../services/pdfExport';
import { downloadRenderedPdf } from '../../services/pdfRender';
import { DocumentViewer } from '../../components/DocumentViewer';

/* ---------------------------------------------------------------- */
/* DepEd School Form 5 (SF5)                                        */
/* Report on Promotion and Level of Progress & Achievement          */
/* ---------------------------------------------------------------- */

type Leaf = { key: string; width: string };

const LEAF_COLUMNS: Leaf[] = [
  { key: 'lrn', width: '90px' },
  { key: 'name', width: '260px' },
  { key: 'average', width: '110px' },
  { key: 'action', width: '120px' },
  { key: 'incomplete_completed', width: '170px' },
  { key: 'incomplete_current', width: '170px' }
];

const TOTAL_ROWS = 25;

type RowData = Record<string, string>;

const SUMMARY_STATUS = ['PROMOTED', '*Conditionally Promoted', 'RETAINED'];

const PROGRESS_LEVELS = [
  ['Did Not Meet Expectations', '( 74% and below)'],
  ['Fairly Satisfactory', '( 75%-79%)'],
  ['Satisfactory', '( 80%-84%)'],
  ['Very Satisfactory', '( 85%-89%)'],
  ['Outstanding', '( 90%-100%)']
];

const GUIDELINES = [
  'Do not include Dropouts and Transferred Out (D.O.4, 2014)',
  'To be prepared by the Adviser. Final rating per learning area should be taken from the record of subject teachers. The class adviser should compute for the General Average. (leave it blank for *conditionally promoted)',
  'On the summary table, reflect the total number of learners PROMOTED (Final Grade of at least 75% in ALL learning areas), RETAINED (Did not meet expectations in three (3) or more learning areas) and *CONDITIONALLY PROMOTED (*did not meet expectations in not more than two (2) learning areas) and the Level of Progress and Achievement according to the individual General Average. All provisions on classroom assessment and the grading system in the said Order shall be in effect for all grade levels - Deped Order 29, s. 2015.',
  'Incomplete Learning Areas. The 1st sub-column refers to learning area/s that failed from previous SY but had been completed in the current SY. The 2nd sub-column presented the list of learning area/s that did not meet expectation during the current SY.',
  'Protocols of validation & submission is under the discretion of the Schools Division Superintendent.'
];

/* ---------------------------------------------------------------- */
/* Helpers                                                          */
/* ---------------------------------------------------------------- */

function formatName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts.pop()!;
  return `${last}, ${parts.join(' ')}`;
}

/** Group grade rows by student id. */
function groupGrades(rows: GradeRow[]): Map<number, GradeRow[]> {
  const m = new Map<number, GradeRow[]>();
  for (const r of rows) {
    const arr = m.get(r.student_id);
    if (arr) arr.push(r);
    else m.set(r.student_id, [r]);
  }
  return m;
}

/**
 * Per-subject final averages from raw per-quarter rows.
 * A subject's final = mean of its non-null quarter grades.
 */
function subjectFinals(
  rows: GradeRow[]
): Map<number, { name: string; avg: number }> {
  const acc = new Map<number, { name: string; sum: number; n: number }>();
  for (const r of rows) {
    if (r.grade == null) continue;
    const cur = acc.get(r.subject_id);
    if (cur) {
      cur.sum += Number(r.grade);
      cur.n += 1;
    } else {
      acc.set(r.subject_id, {
        name: r.subject_name,
        sum: Number(r.grade),
        n: 1
      });
    }
  }
  const out = new Map<number, { name: string; avg: number }>();
  for (const [sid, v] of acc) out.set(sid, { name: v.name, avg: v.sum / v.n });
  return out;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Column totals (MALE, FEMALE, TOTAL) across a MiniCountTable's rows. */
function colTotals(values: string[][]): number[] {
  const t = [0, 0, 0];
  for (const r of values) {
    for (let c = 0; c < 3; c++) t[c] += parseInt(r[c] || '0', 10) || 0;
  }
  return t;
}

/* ---------------------------------------------------------------- */
/* MiniCountTable — reusable summary table with input cells          */
/* ---------------------------------------------------------------- */

function MiniCountTable({
  title,
  rows,
  values,
  onChange,
  total
}: {
  title: string;
  rows: string[][];
  values?: string[][];
  onChange?: (row: number, col: number, val: string) => void;
  total?: number[];
}) {
  return (
    <table className="w-full border-collapse text-center text-[10px]">
      <thead>
        <tr>
          <th colSpan={4} className="border border-black px-1 py-1 font-bold">
            {title}
          </th>
        </tr>
        <tr className="font-bold">
          <th className="border border-black px-1 py-1 text-left">STATUS</th>
          <th className="border border-black px-1 py-1">MALE</th>
          <th className="border border-black px-1 py-1">FEMALE</th>
          <th className="border border-black px-1 py-1">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r[0]}>
            <td className="border border-black px-1 py-2 text-left font-semibold leading-tight">
              {r[0]}
              {r[1] ? <div className="font-normal">{r[1]}</div> : null}
            </td>
            {[0, 1, 2].map(c => (
              <td key={c} className="border border-black p-0">
                <input
                  className="sf1-input h-9 w-full text-center outline-none focus:bg-amber-50"
                  value={values?.[i]?.[c] ?? ''}
                  onChange={
                    onChange ? e => onChange(i, c, e.target.value) : undefined
                  }
                  readOnly={!onChange}
                />
              </td>
            ))}
          </tr>
        ))}
        {total && (
          <tr className="font-bold">
            <td className="border border-black px-1 py-2 text-left">TOTAL</td>
            {total.map((t, c) => (
              <td key={c} className="border border-black bg-gray-100 px-1">
                {t || ''}
              </td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
  );
}

export function SF5Report() {
  const { schoolName, schoolYearLabel, showToast } = useApp();
  const accent = useRoleAccent();

  // ── API data ──
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYearRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // ── Filter selections ──
  const [syId, setSyId] = useState(1);
  const [selectedGrade, setSelectedGrade] = useState('7');
  const [selectedSection, setSelectedSection] = useState('');

  // ── Form state ──
  const [rows, setRows] = useState<RowData[]>(() =>
    Array.from({ length: TOTAL_ROWS }, () => ({}))
  );
  const [enrolledStudents, setEnrolledStudents] = useState<StudentRow[]>([]);
  // Auto-computed counts for the two summary tables (3 cols: MALE, FEMALE, TOTAL)
  const [summaryCounts, setSummaryCounts] = useState<string[][]>([]);
  const [progressCounts, setProgressCounts] = useState<string[][]>([]);
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
      schoolYearsApi.list()
    ])
      .then(([studs, secs, enrs, settings, years]) => {
        console.log(
          '[SF5] Students:',
          studs.length,
          'Sections:',
          secs.length,
          'Enrollments:',
          enrs.length
        );
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
          schoolName: settings.school_name || prev.schoolName
        }));
        const active = secs.filter(s => s.is_active === 1);
        // Default to the first section (grade-ascending) that actually has
        // enrolled students in the selected school year, so the sheet never
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
      })
      .finally(() => setDataLoading(false));
  }, []);

  // ── Sync school name & year (selected school year takes precedence) ──
  useEffect(() => {
    setHeader(prev => ({
      ...prev,
      schoolName: schoolName || prev.schoolName,
      schoolYear:
        schoolYears.find(y => y.id === syId)?.sy_label ||
        schoolYearLabel ||
        prev.schoolYear
    }));
  }, [schoolName, schoolYearLabel, schoolYears, syId]);

  // ── Sync grade/section to header ──
  useEffect(() => {
    setHeader(prev => ({
      ...prev,
      gradeLevel: selectedGrade,
      section: selectedSection
    }));
  }, [selectedGrade, selectedSection]);

  // ── Sections for current grade ──
  const gradeSections = useMemo(
    () =>
      sections.filter(
        s => s.grade_level === parseInt(selectedGrade) && s.is_active === 1
      ),
    [sections, selectedGrade]
  );

  // ── Reset section selection when grade changes ──
  useEffect(() => {
    if (
      selectedSection &&
      !gradeSections.some(s => s.name === selectedSection)
    ) {
      setSelectedSection(gradeSections.length > 0 ? gradeSections[0].name : '');
    } else if (!selectedSection && gradeSections.length > 0) {
      setSelectedSection(gradeSections[0].name);
    }
  }, [selectedGrade, gradeSections, selectedSection]);

  // ── Populate rows when section changes ──
  useEffect(() => {
    if (!selectedSection || !enrollments.length || !students.length) return;
    const section = sections.find(
      s =>
        s.name === selectedSection && s.grade_level === parseInt(selectedGrade)
    );
    if (!section) return;
    const matchingEnrs = enrollments.filter(
      e =>
        e.school_year_id === syId &&
        e.section_grade_level === parseInt(selectedGrade) &&
        e.section_id === section.id &&
        e.status === 'enrolled'
    );
    const enrolled = matchingEnrs
      .map(e => students.find(s => s.id === e.student_id))
      .filter(Boolean) as StudentRow[];
    const newRows: RowData[] = enrolled.map(s => ({
      lrn: s.lrn || '',
      name: formatName(s.name || ''),
      average: '',
      action: '',
      incomplete_completed: '',
      incomplete_current: ''
    }));
    while (newRows.length < TOTAL_ROWS) newRows.push({});
    setRows(newRows);
    setEnrolledStudents(enrolled);

    // Clear derived tables while the section's grade data loads.
    setSummaryCounts([]);
    setProgressCounts([]);

    let cancelled = false;
    if (enrolled.length > 0) {
      // Previous school year for the "completed from previous SY" column.
      const sortedSy = [...schoolYears].sort((a, b) => a.id - b.id);
      const idx = sortedSy.findIndex(y => y.id === syId);
      const prevSyId = idx > 0 ? sortedSy[idx - 1].id : null;
      const enrolledIds = new Set(enrolled.map(s => s.id));

      Promise.all([
        gradesApi.list({ school_year_id: syId }),
        prevSyId ? gradesApi.list({ school_year_id: prevSyId }) : Promise.resolve<GradeRow[]>([])
      ])
        .then(([cur, prev]) => {
          if (cancelled) return;
          const curByStudent = groupGrades(
            cur.filter(g => enrolledIds.has(g.student_id))
          );
          const prevByStudent = groupGrades(
            prev.filter(g => enrolledIds.has(g.student_id))
          );

          const nextStats: Record<
            number,
            {
              average: string;
              action: string;
              incompleteCurrent: string;
              incompleteCompleted: string;
            }
          > = {};
          const summary = SUMMARY_STATUS.map(() => ({ male: 0, female: 0, total: 0 }));
          const progress = PROGRESS_LEVELS.map(() => ({ male: 0, female: 0, total: 0 }));

          enrolled.forEach(s => {
            const finals = subjectFinals(curByStudent.get(s.id) || []);
            const failedNow = [...finals.values()]
              .filter(f => f.avg < 75)
              .map(f => f.name);
            const genAvg = finals.size ? mean([...finals.values()].map(f => f.avg)) : null;

            const prevFinals = subjectFinals(prevByStudent.get(s.id) || []);
            const prevFailed = [...prevFinals.values()]
              .filter(f => f.avg < 75)
              .map(f => f.name);
            const completed = prevFailed.filter(n => !failedNow.includes(n));

            let action = '';
            if (genAvg != null) {
              if (failedNow.length === 0) action = 'PROMOTED';
              else if (failedNow.length <= 2) action = '*Conditionally Promoted';
              else action = 'RETAINED';
            }

            nextStats[s.id] = {
              average: genAvg != null ? String(Math.round(genAvg)) : '',
              action,
              incompleteCurrent: failedNow.join(', '),
              incompleteCompleted: completed.join(', ')
            };

            if (genAvg != null) {
              // SUMMARY TABLE buckets: PROMOTED, *CONDITIONALLY PROMOTED, RETAINED
              const si = failedNow.length === 0 ? 0 : failedNow.length <= 2 ? 1 : 2;
              summary[si].total++;
              if (s.sex === 'male') summary[si].male++;
              else if (s.sex === 'female') summary[si].female++;

              // LEVEL OF PROGRESS AND ACHIEVEMENT band by general average
              const pi =
                genAvg >= 90 ? 4 : genAvg >= 85 ? 3 : genAvg >= 80 ? 2 : genAvg >= 75 ? 1 : 0;
              progress[pi].total++;
              if (s.sex === 'male') progress[pi].male++;
              else if (s.sex === 'female') progress[pi].female++;
            }
          });

          setSummaryCounts(
            summary.map(x => [String(x.male), String(x.female), String(x.total)])
          );
          setProgressCounts(
            progress.map(x => [String(x.male), String(x.female), String(x.total)])
          );

          setRows(prev => {
            const next = [...prev];
            enrolled.forEach((s, i) => {
              const st = nextStats[s.id];
              if (st) {
                next[i] = {
                  ...next[i],
                  average: st.average,
                  action: st.action,
                  incomplete_completed: st.incompleteCompleted,
                  incomplete_current: st.incompleteCurrent
                };
              }
            });
            return next;
          });
        })
        .catch(() => {
          /* keep manual entry */
        });
    }
    return () => {
      cancelled = true;
    };
  }, [selectedSection, selectedGrade, syId, enrollments, students, sections, schoolYears]);

  // ── Cell helper ──
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

  const maleCount = enrolledStudents.filter(s => s.sex === 'male').length;
  const femaleCount = enrolledStudents.filter(s => s.sex === 'female').length;
  const combinedCount = enrolledStudents.length;

  const totalRow = (label: string, count: number) => (
    <tr className="bg-gray-50/80">
      <td className="border border-black p-0" />
      <td className="border border-black px-2 text-right text-[10px] font-bold">
        {label}
      </td>
      <td className="border border-black bg-gray-200 p-0" />
      <td className="border border-black bg-gray-200 p-0" />
      <td className="border border-black bg-gray-200 p-0" />
      <td className="border border-black bg-gray-200 p-0">
        <span className="flex h-full items-center justify-center text-[11px] font-bold">{count}</span>
      </td>
    </tr>
  );

  // ── PDF Export ──
  const handleExportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    const options = {
      elementId: 'sf5-print-area',
      filename: `SF5_Promotion_Grade${selectedGrade}${selectedSection ? '_'+selectedSection : ''}`,
      orientation: 'landscape' as const,
      format: 'letter' as const,
    };
    try {
      // Primary path: render server-side in Chrome so the PDF matches the
      // browser's Print Preview exactly (landscape report, page breaks, print
      // CSS), then auto-download.
      await downloadRenderedPdf(options);
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

  return (
    <div className="space-y-5 pb-10">
      {/* ── Header Card ── */}
      <div className="no-print bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className={`h-1.5 bg-gradient-to-r ${accent.gradient}`} />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accent.tile} shadow-lg ${accent.tileShadow} flex items-center justify-center flex-shrink-0`}>
                <BarChart2 size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">
                  School Form 5 (SF5) — Report on Promotion &amp; Level of Progress
                  &amp; Achievement
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Select school year, grade &amp; section to auto-populate, or fill
                  manually.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleExportPdf} disabled={exporting} className={`${accent.button} text-white shadow-sm`}>
                {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {exporting ? 'Generating…' : 'PDF'}
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
              <select
                value={syId}
                onChange={e => setSyId(parseInt(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 ${accent.ring} bg-white transition">
                {schoolYears.length === 0 && (
                  <option value="">Loading years...</option>
                )}
                {schoolYears.map(y => (
                  <option key={y.id} value={y.id}>
                    {y.sy_label}
                    {y.is_current === 1 ? ' (Current)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.06em]">Grade Level</label>
              <select
                value={selectedGrade}
                onChange={e => setSelectedGrade(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 ${accent.ring} bg-white transition">
                {[7, 8, 9, 10, 11, 12].map(g => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.06em]">Section</label>
              <select
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 ${accent.ring} bg-white transition">
                {gradeSections.length === 0 && (
                  <option value="">No sections</option>
                )}
                {gradeSections.map(s => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400 pb-1">
              <FileText size={14} className={accent.text} />
              <span>{filledCount} student{filledCount !== 1 ? 's' : ''} loaded &middot;{' '}
                {rows.length} total rows</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sheet */}
      <DocumentViewer>
        <div id="sf5-print-area" className="sf1-sheet mx-auto w-fit max-w-full overflow-x-auto bg-white p-6 text-black shadow-sm">
        <div className="sf1-page" style={{ minWidth: '1200px' }}>
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
                School Form 5 (SF 5) Report on Promotion and Level of Progress
                &amp; Achievement
              </h2>
              <p className="text-[9px] italic text-black/80">
                (This replaces Form 5, Report on Promotion and Level of Progress
                &amp; Achievement)
              </p>
            </div>
            <img
              src="data:image/png;base64,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"
              height={82}
              className="h-12 w-auto shrink-0 object-contain"
            />
          </div>

          <SchoolFormHeader header={header} onChange={setH} />

          {/* Body: main table (left) + summary/signatures (right) */}
          <div className="mt-2 flex items-start gap-4">
            {/* ---------- Main learner table ---------- */}
            <div className="flex-1">
              <table className="w-full table-fixed border-collapse text-[10px]">
                <colgroup>
                  {LEAF_COLUMNS.map(c => (
                    <col key={c.key} style={{ width: c.width }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th
                      rowSpan={2}
                      className="border border-black px-1 py-1 align-middle font-bold">
                      LRN
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-black px-1 py-1 align-middle font-bold">
                      LEARNER&apos;S NAME
                      <div className="font-normal">
                        (Last Name, First Name, Middle Name)
                      </div>
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-black px-1 py-1 align-middle font-bold">
                      GENERAL AVERAGE
                      <div className="font-normal">
                        (Whole numbers for non-honor as per Deped Order 8, s.
                        2015)
                      </div>
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-black px-1 py-1 align-middle font-bold">
                      ACTION TAKEN: PROMOTED, *CONDITIONALLY PROMOTED or
                      RETAINED
                    </th>
                    <th
                      colSpan={2}
                      className="border border-black px-1 py-1 font-bold">
                      INCOMPLETE LEARNING AREA/S
                    </th>
                  </tr>
                  <tr>
                    <th className="border border-black px-1 py-1 align-middle font-semibold text-blue-800">
                      Incomplete Learning Area/s from previous school year/s
                      that <u>had been completed</u> as of end of current School
                      Year
                    </th>
                    <th className="border border-black px-1 py-1 align-middle font-semibold text-blue-800">
                      Incomplete Learning Area/s as of end of current School
                      Year
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
                  {totalRow('TOTAL MALE', maleCount)}
                  {totalRow('TOTAL FEMALE', femaleCount)}
                  {totalRow('COMBINED', combinedCount)}
                </tbody>
              </table>
            </div>

            {/* ---------- Right panel ---------- */}
            <div className="w-[320px] shrink-0 space-y-4">
              <MiniCountTable
                title="SUMMARY TABLE"
                rows={SUMMARY_STATUS.map(s => [s, ''])}
                values={summaryCounts}
                onChange={(i, c, v) =>
                  setSummaryCounts(prev => {
                    const next = prev.map(r => [...r]);
                    if (!next[i]) next[i] = ['', '', ''];
                    next[i][c] = v;
                    return next;
                  })
                }
                total={
                  summaryCounts.length ? colTotals(summaryCounts) : undefined
                }
              />
              <MiniCountTable
                title="LEVEL OF PROGRESS AND ACHIEVEMENT"
                rows={PROGRESS_LEVELS}
                values={progressCounts}
                onChange={(i, c, v) =>
                  setProgressCounts(prev => {
                    const next = prev.map(r => [...r]);
                    if (!next[i]) next[i] = ['', '', ''];
                    next[i][c] = v;
                    return next;
                  })
                }
                total={
                  progressCounts.length ? colTotals(progressCounts) : undefined
                }
              />

              {/* Signatures */}
              <div className="space-y-5 pt-2 text-[10px]">
                {[
                  { role: 'PREPARED BY:', caption: 'Class Adviser' },
                  {
                    role: 'CERTIFIED CORRECT & SUBMITTED:',
                    caption: 'School Head'
                  },
                  { role: 'REVIEWED BY:', caption: 'Division Representative' }
                ].map(s => (
                  <div key={s.role}>
                    <p className="font-semibold">{s.role}</p>
                    <input
                      type="text"
                      className="mt-5 w-full border-0 border-b border-black bg-transparent px-1 py-1 text-center text-[10px] font-semibold outline-none focus:bg-amber-50"
                      placeholder={s.caption}
                    />
                    <div className="text-center text-[9px]">
                      (Name and Signature)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ---------- Guidelines footer ---------- */}
          <div className="mt-4 text-[9px] leading-snug">
            <p className="font-bold">GUIDELINES:</p>
            <ol className="ml-4 list-decimal space-y-1">
              {GUIDELINES.map((g, i) => (
                <li key={i} className={i === 0 ? 'font-bold italic' : ''}>
                  {g}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-right">
              School Form 5: Page _____ of _______
            </p>
          </div>
        </div>
      </div>
      </DocumentViewer>
    </div>
  );
}
