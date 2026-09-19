/**
 * Principal Export Center.
 *
 * Gives the Principal read-only export capability over school documents,
 * reports, and school-wide data — per the 2026 role-permission policy.
 * All exports are generated client-side as professionally formatted PDFs
 * (official header, school information, bordered tables) using pdfmake.
 *
 * Routes: /principal/exports/:section (documents | reports | data)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import {
  FileText,
  BarChart2,
  Database,
  Loader2,
  Download,
  Calendar,
  Users,
  BookOpen,
  GraduationCap
} from 'lucide-react';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { schoolYearsApi, SchoolYearRow } from '../../services/schoolYears';
import { sectionsApi, SectionRow } from '../../services/sections';
import { settingsApi, SchoolSettingsRow } from '../../services/settings';
import { formsApi } from '../../services/forms';
import { enrollmentsApi } from '../../services/enrollments';
import { gradesApi } from '../../services/grades';
import { promotionsApi } from '../../services/promotions';
import { useApp } from '../../context/AppContext';

pdfMake.addVirtualFileSystem(pdfFonts);

const SECTION_LABELS: Record<string, string> = {
  documents: 'School Documents',
  reports: 'Reports',
  data: 'School-wide Data'
};

/* ── helpers ─────────────────────────────────────────────────────────── */

function buildHeaderRows(
  school: SchoolSettingsRow | null,
  syLabel: string,
  title: string
) {
  return [
    {
      alignment: 'center' as const,
      text: (
        school?.school_name ||
        'DON SERVILLANO PLATON MEMORIAL NATIONAL HIGH SCHOOL'
      ).toUpperCase(),
      bold: true,
      fontSize: 14,
      margin: [0, 0, 0, 2]
    },
    {
      alignment: 'center' as const,
      text:
        (school?.division || 'Schools Division of Camarines Sur') +
        ' · Sta. Cruz, Tinambac, Camarines Sur',
      fontSize: 9,
      margin: [0, 0, 0, 2]
    },
    {
      alignment: 'center' as const,
      text: `School Year ${syLabel || '—'} · Generated ${new Date().toLocaleString('en-PH')}`,
      fontSize: 8,
      italics: true,
      margin: [0, 0, 0, 8]
    },
    {
      alignment: 'center' as const,
      text: title.toUpperCase(),
      bold: true,
      fontSize: 11,
      margin: [0, 0, 0, 10]
    }
  ];
}

function downloadPdf(doc: any, filename: string) {
  pdfMake.createPdf(doc).download(`${filename}.pdf`);
}

/** Age in whole years from an ISO/date string (returns NaN if unparseable). */
function computeAge(birthdate: string): number {
  const d = new Date(birthdate);
  if (Number.isNaN(d.getTime())) return NaN;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function PrincipalExportCenter() {
  const { section = 'documents' } = useParams<{ section?: string }>();
  const { showToast } = useApp();
  const [school, setSchool] = useState<SchoolSettingsRow | null>(null);
  const [schoolYears, setSchoolYears] = useState<SchoolYearRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [selectedSY, setSelectedSY] = useState<number | undefined>(undefined);
  const [selectedSection, setSelectedSection] = useState<number | undefined>(
    undefined
  );
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  const effective = SECTION_LABELS[section] ? section : 'documents';

  useEffect(() => {
    let cancelled = false;
    Promise.all([settingsApi.get(), schoolYearsApi.list(), sectionsApi.list()])
      .then(([settings, sys, secs]) => {
        if (cancelled) return;
        setSchool(settings);
        setSchoolYears(sys);
        setSections(secs);
        const current = sys.find(y => y.is_current === 1);
        setSelectedSY(current?.id ?? sys[0]?.id);
        setSelectedSection(secs[0]?.id);
      })
      .catch(err =>
        showToast(
          'error',
          'Failed to load export data: ' + (err.detail?.error || err.message)
        )
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const syLabel = useMemo(
    () => schoolYears.find(y => y.id === selectedSY)?.sy_label || '',
    [schoolYears, selectedSY]
  );
  const sectionName = useMemo(
    () => sections.find(s => s.id === selectedSection)?.name || '',
    [sections, selectedSection]
  );

  const runExport = async (
    key: string,
    filename: string,
    build: () => Promise<any>
  ) => {
    if (exporting) return;
    setExporting(key);
    try {
      const doc = await build();
      downloadPdf(doc, filename);
      showToast('success', `${filename} exported.`);
    } catch (err: any) {
      showToast(
        'error',
        err.detail?.error || err.message || 'PDF generation failed.'
      );
    } finally {
      setExporting(null);
    }
  };

  /* ── Document exports (SF forms) ── */
  const exportSF5 = () =>
    runExport('sf5', `SF5-${sectionName || 'All'}-${syLabel}`, async () => {
      if (!selectedSY || !selectedSection)
        throw new Error('Select a school year and section first.');
      const data = await formsApi.sf5(selectedSection, selectedSY);
      const header = buildHeaderRows(
        school,
        syLabel,
        'SF5 — Report on Promotion'
      );
      return {
        content: [
          ...header,
          {
            table: {
              headerRows: 1,
              widths: ['auto', '*', 'auto', 'auto', 'auto'],
              body: [
                ['LRN', 'Student', 'Section', 'GWA', 'Status'],
                ...(Array.isArray(data.students) ? data.students : []).map(
                  s => [
                    s.lrn,
                    s.name,
                    s.section_name,
                    s.general_average === null
                      ? 'INC'
                      : String(s.general_average),
                    s.promotion_status
                  ]
                )
              ]
            },
            layout: 'lightHorizontalLines'
          },
          {
            text: `Total: ${data.total_students} · Promoted: ${data.promoted} · Retained: ${data.retained}`,
            fontSize: 9,
            margin: [0, 8, 0, 0]
          }
        ],
        pageOrientation: 'landscape',
        defaultStyle: { fontSize: 8 }
      };
    });

  const exportSF1 = () =>
    runExport('sf1', `SF1-${sectionName || 'All'}-${syLabel}`, async () => {
      if (!selectedSY || !selectedSection)
        throw new Error('Select a school year and section first.');
      const data = await formsApi.sf1(selectedSection, selectedSY);
      // Backend returns { form, school, total_students, groupings } — flatten
      // the per-grade/section groups into a single students array.
      const groupings = (data as any).groupings || {};
      const flatStudents = Object.values(groupings).flatMap((grade: any) =>
        Object.values(grade?.sections || {}).flatMap((sect: any) =>
          Array.isArray(sect?.students) ? sect.students : []
        )
      );
      const header = buildHeaderRows(
        school,
        syLabel,
        'SF1 — School Register (First Grading)'
      );
      return {
        content: [
          ...header,
          {
            table: {
              headerRows: 1,
              widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
              body: [
                ['LRN', 'Student', 'Sex', 'Birthdate', 'Age', 'GWA'],
                ...flatStudents.map((s: any) => [
                  s.lrn ?? '',
                  s.name ?? '',
                  s.sex ?? '',
                  s.birthdate ?? '',
                  s.birthdate ? String(computeAge(s.birthdate)) : '',
                  s.general_average != null ? String(s.general_average) : ''
                ])
              ]
            },
            layout: 'lightHorizontalLines'
          }
        ],
        pageOrientation: 'landscape',
        defaultStyle: { fontSize: 8 }
      };
    });

  /* ── Report exports ── */
  const exportReports = () =>
    runExport('reports', `School-Reports-${syLabel}`, async () => {
      const [stats, submissions, promos] = await Promise.all([
        enrollmentsApi.stats(selectedSY),
        gradesApi.submissionStatus({ school_year_id: selectedSY }),
        promotionsApi.list()
      ]);
      const gradeTable = submissions.by_grade.map(g => ({
        grade: `Grade ${g.grade_level}`,
        sections: `${g.submitted}/${g.total}`,
        pct: `${g.pct.toFixed(0)}%`
      }));
      const genderTable = stats.gender_by_grade.map(g => [
        g.grade,
        String(g.male),
        String(g.female),
        String(g.total)
      ]);
      return {
        content: [
          ...buildHeaderRows(school, syLabel, 'School Reports'),
          {
            text: '1. Enrollment by Grade & Sex',
            bold: true,
            fontSize: 10,
            margin: [0, 0, 0, 4]
          },
          {
            table: {
              headerRows: 1,
              widths: ['*', 'auto', 'auto', 'auto'],
              body: [['Grade', 'Male', 'Female', 'Total'], ...genderTable]
            },
            layout: 'lightHorizontalLines'
          },
          {
            text: '2. Grade Submission Status',
            bold: true,
            fontSize: 10,
            margin: [0, 14, 0, 4]
          },
          {
            table: {
              headerRows: 1,
              widths: ['*', 'auto', 'auto'],
              body: [
                ['Grade Level', 'Sections Submitted', '%'],
                ...gradeTable.map(r => [r.grade, r.sections, r.pct])
              ]
            },
            layout: 'lightHorizontalLines'
          },
          {
            text: `3. Promotion Records (${promos.length})`,
            bold: true,
            fontSize: 10,
            margin: [0, 14, 0, 4]
          },
          ...promos
            .slice(0, 25)
            .map(
              p =>
                `${p.sy_label} · ${p.section_name} → G${p.to_grade_level} · ${p.student_count} students (${p.status})`
            )
            .map(t => ({ text: `•  ${t}`, fontSize: 9, margin: [0, 1, 0, 1] }))
        ],
        pageOrientation: 'landscape',
        defaultStyle: { fontSize: 8 }
      };
    });

  /* ── School-wide data export ── */
  const exportData = () =>
    runExport('data', `School-Wide-Data-${syLabel}`, async () => {
      const dist = await gradesApi.getDistribution({
        school_year_id: selectedSY
      });
      const subjectRows = (
        Array.isArray(dist.subjects) ? dist.subjects : []
      ).map(s => [
        s.subject_name,
        String(s.total_students),
        s.mean_grade == null ? '—' : Number(s.mean_grade).toFixed(2),
        s.pass_rate == null ? '—' : `${Number(s.pass_rate).toFixed(1)}%`
      ]);
      const overallPct =
        dist.overall_pass_rate == null
          ? '—'
          : `${Number(dist.overall_pass_rate).toFixed(1)}%`;
      return {
        content: [
          ...buildHeaderRows(
            school,
            syLabel,
            'School-wide Data — Grade Distribution'
          ),
          {
            text: `Overall pass rate: ${overallPct} across ${dist.total_students ?? 0} students`,
            fontSize: 9,
            margin: [0, 0, 0, 6]
          },
          {
            table: {
              headerRows: 1,
              widths: ['*', 'auto', 'auto', 'auto'],
              body: [
                ['Subject', 'Students', 'Mean Grade', 'Pass Rate'],
                ...subjectRows
              ]
            },
            layout: 'lightHorizontalLines'
          }
        ],
        pageOrientation: 'landscape',
        defaultStyle: { fontSize: 8 }
      };
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const tabs = [
    { key: 'documents', label: 'School Documents', icon: FileText },
    { key: 'reports', label: 'Reports', icon: BarChart2 },
    { key: 'data', label: 'School-wide Data', icon: Database }
  ];

  const ExportButton = ({
    busy,
    onClick,
    label
  }: {
    busy: boolean;
    onClick: () => void;
    label: string;
  }) => (
    <button
      onClick={onClick}
      disabled={busy}
      className="w-full inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all">
      {busy ? (
        <Loader2 size={15} className="animate-spin" />
      ) : (
        <Download size={15} />
      )}
      {busy ? 'Preparing…' : label}
    </button>
  );

  const selectCls =
    'border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center">
            <FileText size={20} className="text-purple-700" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Export Center</h2>
            <p className="text-gray-500 text-sm">
              Official PDF exports of school documents, reports, and data
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <select
            value={selectedSY ?? ''}
            onChange={e =>
              setSelectedSY(
                e.target.value ? parseInt(e.target.value) : undefined
              )
            }
            className={selectCls}>
            {schoolYears.map(sy => (
              <option key={sy.id} value={sy.id}>
                {sy.sy_label}
                {sy.is_current === 1 ? ' (Current)' : ''}
              </option>
            ))}
          </select>
          {effective === 'documents' && (
            <select
              value={selectedSection ?? ''}
              onChange={e =>
                setSelectedSection(
                  e.target.value ? parseInt(e.target.value) : undefined
                )
              }
              className={selectCls}>
              {sections.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} (G{s.grade_level})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => {
          const active = effective === t.key;
          return (
            <a
              key={t.key}
              href={`/principal/exports/${t.key}`}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                active
                  ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-purple-300'
              }`}>
              <t.icon size={15} /> {t.label}
            </a>
          );
        })}
      </div>

      {/* Documents */}
      {effective === 'documents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1.5">
              <BookOpen size={16} className="text-purple-700" />
              <h3 className="font-bold text-gray-800 text-sm">
                SF1 — School Register
              </h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              First-grading register for the selected section.
            </p>
            <ExportButton
              busy={exporting === 'sf1'}
              onClick={exportSF1}
              label="Export SF1 PDF"
            />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1.5">
              <GraduationCap size={16} className="text-purple-700" />
              <h3 className="font-bold text-gray-800 text-sm">
                SF5 — Report on Promotion
              </h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Promotion summary with general weighted average.
            </p>
            <ExportButton
              busy={exporting === 'sf5'}
              onClick={exportSF5}
              label="Export SF5 PDF"
            />
          </div>
        </div>
      )}

      {/* Reports */}
      {effective === 'reports' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Users size={16} className="text-purple-700" />
            <h3 className="font-bold text-gray-800 text-sm">
              Consolidated School Reports
            </h3>
          </div>
          <p className="text-xs text-gray-400 mb-2">
            Enrollment by grade & sex, grade submission status, and promotion
            records for {syLabel || 'the selected school year'}.
          </p>
          <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-4">
            <Calendar size={12} /> Generated with official school header
          </div>
          <ExportButton
            busy={exporting === 'reports'}
            onClick={exportReports}
            label="Export Reports PDF"
          />
        </div>
      )}

      {/* Data */}
      {effective === 'data' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Database size={16} className="text-purple-700" />
            <h3 className="font-bold text-gray-800 text-sm">
              School-wide Grade Distribution
            </h3>
          </div>
          <p className="text-xs text-gray-400 mb-2">
            Per-subject student counts, mean grades, and pass rates across the
            school for {syLabel || 'the selected school year'}.
          </p>
          <ExportButton
            busy={exporting === 'data'}
            onClick={exportData}
            label="Export Data PDF"
          />
        </div>
      )}
    </div>
  );
}
