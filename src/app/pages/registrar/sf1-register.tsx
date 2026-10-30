import {
  useState,
  useEffect,
  useMemo,
  type Dispatch,
  type SetStateAction
} from 'react';
import {
  Printer,
  Loader2,
  Download,
  FileSpreadsheet,
  FileText,
  Save as SaveIcon
} from 'lucide-react';
import './sf1.css';
import { useFormEdits, editKey } from '../../hooks/useFormEdits';
import { FormEditsMenu } from '../../components/FormEditsMenu';
import { Button } from '../../components/ui/button';
import { SchoolFormHeader } from '../../components/school-form-header';
import { SchoolFormTitleBlock } from '../../components/school-form-title';
import { studentsApi, StudentRow } from '../../services/students';
import { sectionsApi, SectionRow } from '../../services/sections';
import { enrollmentsApi, EnrollmentRow } from '../../services/enrollments';
import { electivesApi } from '../../services/electives';
import { strandTracksApi } from '../../services/strandTracks';
import { schoolYearsApi, SchoolYearRow } from '../../services/schoolYears';
import { settingsApi } from '../../services/settings';
import { authApi } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useRoleAccent } from '../../utils/roleTheme';
import { exportToPdf } from '../../services/pdfExport';
import { downloadRenderedPdf } from '../../services/pdfRender';
import { FormPrintPreview } from '../../components/FormPrintPreview';
import { DocumentViewer } from '../../components/DocumentViewer';

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

// Flat list of data columns (used to render body rows in order).
// These are exactly the columns required by the official DepEd SF1 School
// Register (no quarterly-grade columns — those belong to the SF9/SF10).
// The widths sum to 1460px: legal-landscape print area is 1306px wide at
// 96dpi and `.sf1-page` is scaled with zoom 0.89, so 1306 / 0.89 = 1467px is
// the layout budget. Staying just under it fills the printable width without
// triggering Chrome's shrink-to-fit (which used to squeeze the text when the
// 21-column table was 1766px wide).
const LEAF_COLUMNS: Leaf[] = [
  { key: 'lrn', title: 'LRN', width: '82px' },
  {
    key: 'name',
    title: 'NAME',
    sub: '(Last Name, First Name, Middle Name)',
    width: '179px'
  },
  { key: 'sex', title: 'Sex', sub: '(M/F)', width: '36px' },
  { key: 'birthdate', title: 'BIRTH DATE', sub: '(mm/dd/yyyy)', width: '72px' },
  { key: 'age', title: 'AGE as of', sub: '1st Friday June', width: '50px' },
  { key: 'mothertongue', title: 'MOTHER TONGUE', width: '63px' },
  { key: 'ip', title: 'IP', sub: '(Ethnic Group)', width: '55px' },
  { key: 'religion', title: 'RELIGION', width: '63px' },
  // ADDRESS group
  {
    key: 'addr_house',
    title: 'House #/ Street/ Sitio/ Purok',
    width: '82px',
    blue: true
  },
  { key: 'addr_barangay', title: 'Barangay', width: '68px', blue: true },
  { key: 'addr_city', title: 'Municipality/ City', width: '72px', blue: true },
  { key: 'addr_province', title: 'Province', width: '68px', blue: true },
  // PARENTS group
  {
    key: 'father',
    title: "Father's Name (Last Name, First Name, Middle Name)",
    width: '118px',
    blue: true
  },
  {
    key: 'mother',
    title: "Mother's Maiden Name (Last Name, First Name, Middle Name)",
    width: '118px',
    blue: true
  },
  // GUARDIAN group
  { key: 'guardian_name', title: 'Name', width: '91px', blue: true },
  { key: 'guardian_rel', title: 'Relation-ship', width: '63px', blue: true },
  {
    key: 'contact',
    title: 'Contact Number of Parent or Guardian',
    width: '82px'
  },
  {
    key: 'remarks',
    title: 'REMARKS',
    sub: '(Please refer to the legend on last page)',
    width: '98px',
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
/* Reusable inline editable cell shared via school-form-header     */
/* ---------------------------------------------------------------- */

export function SF1Register() {
  const { schoolName, schoolYearLabel, showToast, role } = useApp();
  const accent = useRoleAccent();

  // â”€â”€ API data â”€â”€
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYearRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  // Print confirmation preview no form goes straight to window.print().
  const [previewOpen, setPreviewOpen] = useState(false);

  // â”€â”€ Filter selections â”€â”€
  const [syId, setSyId] = useState(1);
  const [selectedGrade, setSelectedGrade] = useState('7');
  const [selectedSection, setSelectedSection] = useState('');

  // â”€â”€ Form state â”€â”€
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
  // Auto-populated signature names: Prepared by = the user generating the
  // form; Certified Correct = school head from school settings. Both stay
  // editable so the user can correct them before printing.
  const [signers, setSigners] = useState({ prepared: '', certified: '' });
  // Strengthened SHS Curriculum: track names (incl. deactivated legacy strands
  // for historical rosters) + per-learner elective picks for the REMARKS cell.
  const [trackNameById, setTrackNameById] = useState<
    Record<number, string>
  >({});
  const [electivesByStudent, setElectivesByStudent] = useState<
    Record<number, string[]>
  >({});

  // â”€â”€ Load data on mount â”€â”€
  useEffect(() => {
    Promise.all([
      role === 'teacher' ? studentsApi.listMyStudents() : studentsApi.list(),
      role === 'teacher' ? sectionsApi.listMySections() : sectionsApi.list(),
      enrollmentsApi.list(),
      settingsApi.get(),
      schoolYearsApi.list()
    ])
      .then(([studs, secs, enrs, settings, years]) => {
        console.log(
          '[SF1] Students:',
          studs.length,
          'Sections:',
          secs.length,
          'Enrollments:',
          enrs.length
        );
        console.log('[SF1] Enrollments sample:', enrs.slice(0, 3));
        setStudents(studs);
        setSections(secs);
        setEnrollments(enrs);
        setSchoolYears(years);
        const currentYear = years.find((y: any) => y.is_current === 1);
        const targetSy = currentYear
          ? currentYear.id
          : years[0]
            ? years[0].id
            : null;
        setSyId(targetSy ?? 1);
        setHeader(prev => ({
          ...prev,
          schoolId: settings.school_id || prev.schoolId,
          region: settings.region || prev.region,
          division: settings.division || prev.division,
          district: settings.district || prev.district,
          schoolName: settings.school_name || prev.schoolName
        }));
        // School head (principal) for the signature block; the "Prepared by"
        // name is the account generating the form. Saved edits (even cleared
        // ones) beat these prefills.
        setSigners(prev => ({
          ...prev,
          certified:
            prev.certified !== ''
              ? prev.certified
              : sf1Edits.get(null, 'signer:certified') ??
                 (settings.principal_name || '')
        }));
        const active = secs.filter(s => s.is_active === 1);
        // Default to the first section (grade-ascending) that actually has
        // enrolled students in the selected school year, so the register never
        // opens on an empty section.
        const enrolledSection = enrs
          .filter(e => e.school_year_id === targetSy && e.status === 'enrolled')
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

  // Prefill the "Prepared by" signature with the signing account's name
  // (a saved edit, even a cleared one, beats this prefill).
  useEffect(() => {
    authApi
      .me()
      .then(me => {
        setSigners(prev => ({
          ...prev,
          prepared:
            prev.prepared !== ''
              ? prev.prepared
              : (sf1Edits.get(null, 'signer:prepared') ?? (me.name || ''))
        }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track names for the REMARKS cell (legacy strands stay printable).
  useEffect(() => {
    strandTracksApi
      .list({ include_inactive: true })
      .then(rows =>
        setTrackNameById(Object.fromEntries(rows.map(t => [t.id, t.name])))
      )
      .catch(() => {});
  }, []);

  // Per-learner elective picks for the REMARKS cell.
  useEffect(() => {
    if (!syId) return;
    electivesApi
      .assignmentsBatch(syId)
      .then(rows => {
        const map: Record<number, string[]> = {};
        for (const r of rows) {
          (map[r.student_id] ??= []).push(r.subject_name);
        }
        setElectivesByStudent(map);
      })
      .catch(() => {});
  }, [syId]);

  // â”€â”€ Sync school name & year (selected school year takes precedence) â”€â”€
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

  // â”€â”€ Sync grade/section to header â”€â”€
  useEffect(() => {
    setHeader(prev => ({
      ...prev,
      gradeLevel: selectedGrade,
      section: selectedSection
    }));
  }, [selectedGrade, selectedSection]);

  // â”€â”€ Sections for current grade â”€â”€
  const gradeSections = useMemo(
    () =>
      sections.filter(
        s => s.grade_level === parseInt(selectedGrade) && s.is_active === 1
      ),
    [sections, selectedGrade]
  );

  // â”€â”€ Saved School Form Edits (docs/MAJOR_CHANGES_IN_FORMS.txt) â”€â”€
  // Every handwritten SF1 cell, header identity field, signer, summary count
  // and BoSY/EoSY date is stored per (learner, school year, field) and is
  // re-applied by the row-builder effect below. Rule 10 (strict): teachers
  // may not save SF1 edits — only the Registrar/Administrator can.
  const sectionId = useMemo(
    () =>
      sections.find(
        s =>
          s.name === selectedSection &&
          s.grade_level === parseInt(selectedGrade)
      )?.id ?? null,
    [sections, selectedSection, selectedGrade]
  );
  const sf1Edits = useFormEdits({
    form: 'SF1',
    schoolYearId: syId,
    sectionId,
    enabled: !!sectionId && !!syId
  });
  const canSaveFormEdits = role === 'admin' || role === 'registrar';
  // Parallel of `rows`: which learner each row belongs to (filler rows and
  // empty last rows have no learner and are not persisted).
  const [rowStudentIds, setRowStudentIds] = useState<(number | null)[]>([]);

  // â”€â”€ Reset section selection when grade changes â”€â”€
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

  // â”€â”€ Populate rows when section changes â”€â”€
  useEffect(() => {
    if (!selectedSection || !enrollments.length || !students.length) return;
    const section = sections.find(
      s =>
        s.name === selectedSection && s.grade_level === parseInt(selectedGrade)
    );
    if (!section) {
      console.log(
        '[SF1] No section found for',
        selectedSection,
        'grade',
        selectedGrade
      );
      setRegisteredCounts([]);
      return;
    }
    console.log('[SF1] Found section:', section.id, section.name);
    const matchingEnrs = enrollments.filter(
      e =>
        e.school_year_id === syId &&
        e.section_grade_level === parseInt(selectedGrade) &&
        e.section_id === section.id &&
        e.status === 'enrolled'
    );
    console.log(
      '[SF1] Matching enrollments:',
      matchingEnrs.length,
      matchingEnrs.slice(0, 2)
    );
    const enrolled = matchingEnrs
      .map(e => students.find(s => s.id === e.student_id))
      .filter(Boolean) as StudentRow[];    // REGISTERED/BoSY/EoSY counts from the loaded roster (sex breakdown).
    // The data model holds a single enrollment snapshot per SY, so BoSY and
    // EoSY reflect the same enrolled roster until dropouts are tracked.
    const male = enrolled.filter(s => s.sex === 'male').length;
    const female = enrolled.filter(s => s.sex === 'female').length;
    const total = enrolled.length;
    // Saved School Form Edits: saved + unsaved summary-count edits (valuesRef
    // merges both) override the automatically derived counts.
    const merged = sf1Edits.valuesRef.current;
    const baseCounts = [
      [String(male), String(male)],
      [String(female), String(female)],
      [String(total), String(total)]
    ];
    for (let r = 0; r < baseCounts.length; r++) {
      for (let c = 0; c < 2; c++) {
        // Rule 11/12: derived count = system baseline for the marker/menu.
        sf1Edits.setBase(null, `reg:${r}:${c}`, baseCounts[r][c]);
        const sv = merged[editKey(null, `reg:${r}:${c}`)];
        if (sv !== undefined) baseCounts[r][c] = sv;
      }
    }
    setRegisteredCounts(baseCounts);
    // BoSY/EoSY dates from the selected school year's enrollment window, with
    // saved (or unsaved) manual dates taking precedence.
    const sy = schoolYears.find(y => y.id === syId);
    const sysBosy = merged[editKey(null, 'sigdate:bosyDate')];
    const sysEosy = merged[editKey(null, 'sigdate:eosyDate')];
    // Rule 11/12: the enrollment-window dates are the system baseline.
    sf1Edits.setBase(
      null,
      'sigdate:bosyDate',
      formatDateInput(sy?.enrollment_start_date ?? null)
    );
    sf1Edits.setBase(
      null,
      'sigdate:eosyDate',
      formatDateInput(sy?.enrollment_end_date ?? null)
    );
    setSignatureDates({
      bosyDate:
        sysBosy !== undefined
          ? sysBosy
          : formatDateInput(sy?.enrollment_start_date ?? null),
      eosyDate:
        sysEosy !== undefined
          ? sysEosy
          : formatDateInput(sy?.enrollment_end_date ?? null)
    });
    const newRows: RowData[] = enrolled.map(s => {
      const enr = matchingEnrs.find(e => e.student_id === s.id);
      const trackName = enr?.strand_track_id
        ? trackNameById[enr.strand_track_id] || ''
        : '';
      const picks = electivesByStudent[s.id] || [];
      // Strengthened SHS Curriculum: SHS learners print their curriculum track
      // and electives as plain text in the REMARKS cell.
      const remarks =
        (s.grade_level ?? 0) >= 11
          ? [
              trackName ? `Track: ${trackName}` : '',
              picks.length ? `Electives: ${picks.join(', ')}` : ''
            ]
              .filter(Boolean)
              .join(' · ')
          : '';
      return {
        lrn: s.lrn || '',
        name: formatName(s.name || ''),
        sex: s.sex === 'male' ? 'M' : s.sex === 'female' ? 'F' : '',
        birthdate: formatBirthdate(s.birthdate),
        age: s.birthdate ? String(computeAge(s.birthdate)) : '',
        mothertongue: '',
        ip: '',
        religion: '',
        addr_house: '',
        addr_barangay: '',
        addr_city: '',
        addr_province: '',
        father: '',
        mother: '',
        guardian_name: s.guardian || '',
        guardian_rel: '',
        contact: s.contact || '',
        remarks
      };
    });
    while (newRows.length < TOTAL_ROWS) newRows.push({});
    // Apply saved + unsaved edits over the derived cells, and record which
    // learner each row belongs to (filler rows stay null and never persist).
    const sids: (number | null)[] = new Array(TOTAL_ROWS).fill(null);
    enrolled.forEach((s, i) => {
      sids[i] = s.id;
      const overlay: RowData = { ...newRows[i] };
      for (const cellKey of Object.keys(overlay)) {
        // Rule 11/12: record the freshly derived system value as the edit's
        // baseline so the Edited marker and menu can compare against it.
        sf1Edits.setBase(s.id, `s:${cellKey}`, String(newRows[i][cellKey] ?? ''));
        const sv = merged[editKey(s.id, `s:${cellKey}`)];
        if (sv !== undefined) overlay[cellKey] = sv;
      }
      newRows[i] = overlay;
    });
    setRowStudentIds(sids);
    setRows(newRows);
  }, [
    selectedSection,
    selectedGrade,
    syId,
    enrollments,
    students,
    sections,
    schoolYears,
    trackNameById,
    electivesByStudent,
    // Re-run once the saved-edits fetch settles so saved cells overlay in.
    sf1Edits.loading,
    sf1Edits.error
  ]);

  // â”€â”€ Cell / header helpers â”€â”€
  const setCell = (rowIndex: number, key: string, val: string) => {
    setRows(prev => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [key]: val };
      return next;
    });
    // Persist per-learner cells; filler rows (no learner) stay ephemeral.
    const sid = rowStudentIds[rowIndex];
    if (sid != null) sf1Edits.setValue(sid, `s:${key}`, val);
  };
  // Header identity fields (school ID/region/division/district/school name)
  // are savable school-wide values; grade/section/year stay system-synced
  // (they must keep matching the selected roster, rule 2 spirit).
  const HEADER_SAVABLE_KEYS = new Set([
    'schoolId',
    'region',
    'division',
    'district',
    'schoolName'
  ]);
  const setH = (key: keyof typeof header, val: string) => {
    setHeader(prev => ({ ...prev, [key]: val }));
    if (HEADER_SAVABLE_KEYS.has(key))
      sf1Edits.setValue(null, `header:${key}`, val);
  };
  const handleSignerChange = (
    key: 'prepared' | 'certified',
    val: string
  ) => {
    setSigners(prev => ({ ...prev, [key]: val }));
    sf1Edits.setValue(null, `signer:${key}`, val);
  };
  const handleSigDateChange = (key: 'bosyDate' | 'eosyDate', val: string) => {
    setSignatureDates(prev => ({ ...prev, [key]: val }));
    sf1Edits.setValue(null, `sigdate:${key}`, val);
  };
  const handleRegCountChange = (
    row: number,
    col: number,
    value: string
  ) => {
    setRegisteredCounts(prev => {
      const next = prev.map(r => [...r]);
      if (!next[row]) next[row] = ['', ''];
      next[row][col] = value;
      return next;
    });
    sf1Edits.setValue(null, `reg:${row}:${col}`, value);
  };
  // Once the saved-edits fetch settles, overlay saved signer names (after the
  // system prefill effects; a saved empty value wins over the prefill).
  useEffect(() => {
    if (sf1Edits.loading) return;
    const merged = sf1Edits.valuesRef.current;
    const savedSigners = {
      prepared: merged[editKey(null, 'signer:prepared')],
      certified: merged[editKey(null, 'signer:certified')]
    };
    if (savedSigners.prepared !== undefined || savedSigners.certified !== undefined) {
      setSigners(prev => ({
        prepared:
          savedSigners.prepared !== undefined
            ? savedSigners.prepared
            : prev.prepared,
        certified:
          savedSigners.certified !== undefined
            ? savedSigners.certified
            : prev.certified
      }));
    }
    const savedHeader: Partial<Record<keyof typeof header, string>> = {};
    for (const k of HEADER_SAVABLE_KEYS) {
      const sv = merged[editKey(null, `header:${k}`)];
      if (sv !== undefined)
        (savedHeader as Record<string, string>)[k] = sv;
    }
    if (Object.keys(savedHeader).length > 0) {
      setHeader(prev => ({ ...prev, ...savedHeader }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sf1Edits.loading, sf1Edits.error, syId, sectionId]);

  // â”€â”€ Loading â”€â”€
  if (dataLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        <Loader2 className="size-5 mr-2 animate-spin" />
        Loading students &amp; enrollment data...
      </div>
    );
  }

  // â”€â”€ PDF Export â”€â”€
  /* Explicit save per docs/MAJOR_CHANGES_IN_FORMS.txt rule 3. */
  const handleSaveEdits = async () => {
    if (!sectionId) return;
    try {
      const { saved } = await sf1Edits.save();
      showToast(
        'success',
        saved > 0
          ? `Saved ${saved} SF1 edit${saved === 1 ? '' : 's'}.`
          : 'Nothing new to save — SF1 is up to date.'
      );
    } catch (err: any) {
      showToast(
        'error',
        err?.message || 'Failed to save SF1 edits. Please try again.'
      );
    }
  };

  const handleExportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    const options = {
      elementId: 'sf1-print-area',
      filename: `SF1_Register_Grade${selectedGrade}${selectedSection ? '_' + selectedSection : ''}`,
      orientation: 'landscape' as const,
      format: 'letter' as const
    };
    try {
      // Primary path: render server-side in Chrome so the PDF matches the
      // browser's Print Preview exactly (A4 landscape register, page breaks,
      // the zoom that fits all columns), then auto-download.
      await downloadRenderedPdf(options);
    } catch {
      // Server render unavailable fall back to the client-side pdfmake export.
      try {
        await exportToPdf(options);
        showToast('info', 'Server render unavailable used local fallback.');
      } catch {
        showToast('error', 'Failed to export PDF. Please try again.');
      }
    } finally {
      setExporting(false);
    }
  };

  const filledCount = rows.filter(r => r.lrn).length;

  return (
    <div className="space-y-5 pb-10">
      {/* â”€â”€ Header Card â”€â”€ */}
      <div className="no-print bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className={`h-1.5 bg-gradient-to-r ${accent.gradient}`} />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accent.tile} shadow-lg ${accent.tileShadow} flex items-center justify-center flex-shrink-0`}>
                <FileSpreadsheet size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">
                  School Form 1 (SF1) School Register
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Select school year, grade &amp; section to auto-populate, or
                  fill manually.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canSaveFormEdits && (
                <div className="flex items-center gap-2 mr-1">
                  {sf1Edits.isDirty && (
                    <span className="text-[11px] font-semibold text-amber-600 whitespace-nowrap">
                      ● {sf1Edits.dirtyCount} unsaved edit{sf1Edits.dirtyCount === 1 ? '' : 's'}
                    </span>
                  )}
                  <Button
                    size="sm"
                    onClick={handleSaveEdits}
                    disabled={sf1Edits.saving || !sectionId}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                    {sf1Edits.saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <SaveIcon className="size-4" />
                    )}
                    Save
                  </Button>
                </div>
              )}
              <FormEditsMenu api={sf1Edits} canSave={canSaveFormEdits} />
              <Button
                size="sm"
                onClick={() => setPreviewOpen(true)}
                disabled={exporting}
                className={`${accent.button} text-white shadow-sm`}>
                {exporting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {exporting ? 'Generatingâ€¦' : 'PDF'}
              </Button>
              <Button
                size="sm"
                onClick={() => setPreviewOpen(true)}
                className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm">
                <Printer className="size-4" /> Print
              </Button>
            </div>
          </div>
        </div>
      </div>

      <FormPrintPreview
        open={previewOpen}
        title="SF1 School Register"
        elementId="sf1-print-area"
        onClose={() => setPreviewOpen(false)}
        onExportPdf={handleExportPdf}
        exporting={exporting}
        orientation="landscape"
        format="letter"
      />

      {/* Grade / Section Selector */}
      <div className="no-print bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.06em]">
                School Year
              </label>
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
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.06em]">
                Grade Level
              </label>
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
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.06em]">
                Section
              </label>
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
              <span>
                {filledCount} student{filledCount !== 1 ? 's' : ''} loaded
                &middot; {rows.length} total rows
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sheet */}
      <DocumentViewer>
        <div
          id="sf1-print-area"
          className="sf1-sheet mx-auto w-fit max-w-full overflow-x-auto bg-white p-6 text-black shadow-sm">
          <div className="sf1-page" style={{ minWidth: '1460px' }}>
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
                          className={`sf1-input h-6 w-full bg-transparent px-1 text-[10px] outline-none focus:bg-amber-50${
                      rowStudentIds[r] != null &&
                      sf1Edits.isEdited(rowStudentIds[r], `s:${c.key}`)
                        ? ' sf-edited-cell'
                        : ''
                      }`}
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
              onRegCountChange={handleRegCountChange}
              signatureDates={signatureDates}
              onSigDateChange={handleSigDateChange}
              signers={signers}
              onSignerChange={handleSignerChange}
            />
          </div>
        </div>
      </DocumentViewer>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Footer: indicator legend, summary counts, signatures             */
/* ---------------------------------------------------------------- */

function SF1Footer({
  registeredCounts,
  onRegCountChange,
  signatureDates,
  onSigDateChange,
  signers,
  onSignerChange
}: {
  registeredCounts: string[][];
  onRegCountChange: (row: number, col: number, value: string) => void;
  signatureDates: { bosyDate: string; eosyDate: string };
  onSigDateChange: (key: 'bosyDate' | 'eosyDate', value: string) => void;
  signers: { prepared: string; certified: string };
  onSignerChange: (key: 'prepared' | 'certified', value: string) => void;
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
                      onChange={e => onRegCountChange(i, 0, e.target.value)}
                    />
                  </td>
                  <td className="border border-black p-0">
                    <input
                      className="sf1-input h-5 w-full text-center outline-none focus:bg-amber-50"
                      value={registeredCounts[i]?.[1] ?? ''}
                      onChange={e => onRegCountChange(i, 1, e.target.value)}
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
            key: 'prepared',
            role: 'Prepared by:',
            caption: '(Signature of Adviser over Printed Name)'
          },
          {
            key: 'certified',
            role: 'Certified Correct:',
            caption: '(Signature of School Head over Printed Name)'
          }
        ].map(s => (
          <div key={s.role}>
            <p className="font-semibold">{s.role}</p>
            <input
              type="text"
              className="mt-5 w-full border-0 border-b border-black bg-transparent px-1 py-1 text-center text-[10px] font-semibold outline-none focus:bg-amber-50"
              value={signers[s.key as keyof typeof signers]}
              onChange={e =>
                onSignerChange(
                  s.key as 'prepared' | 'certified',
                  e.target.value
                )
              }
              placeholder="Name"
            />
            <div className="mt-0.5 text-center">{s.caption}</div>
            <div className="mt-2 flex items-center gap-2">
              <span className="whitespace-nowrap">BoSY Date:</span>
              <input
                type="date"
                className="flex-1 border-0 border-b border-black bg-transparent px-1 py-0.5 text-center text-[10px] outline-none focus:bg-amber-50"
                value={signatureDates.bosyDate}
                onChange={e => onSigDateChange('bosyDate', e.target.value)}
              />
              <span className="whitespace-nowrap">EoSY Date:</span>
              <input
                type="date"
                className="flex-1 border-0 border-b border-black bg-transparent px-1 py-0.5 text-center text-[10px] outline-none focus:bg-amber-50"
                value={signatureDates.eosyDate}
                onChange={e => onSigDateChange('eosyDate', e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
