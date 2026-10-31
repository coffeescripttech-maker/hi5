import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { Loader2, Printer, Users, BookOpen, Download, Save as SaveIcon } from 'lucide-react';
import { studentsApi, StudentRow } from '../../services/students';
import { sectionsApi, SectionRow } from '../../services/sections';
import { enrollmentsApi, EnrollmentRow } from '../../services/enrollments';
import { formsApi, SF9Row } from '../../services/forms';
import { useFormEdits, editKey } from '../../hooks/useFormEdits';
import { FormEditsMenu } from '../../components/FormEditsMenu';
import { schoolYearsApi, SchoolYearRow } from '../../services/schoolYears';
import { subjectsApi } from '../../services/subjects';
import { electivesApi, ElectiveBatchRow } from '../../services/electives';
import { useApp } from '../../context/AppContext';
import { useRoleAccent } from '../../utils/roleTheme';
import { exportToPdf } from '../../services/pdfExport';
import { downloadRenderedPdf } from '../../services/pdfRender';
import { FormPrintPreview } from '../../components/FormPrintPreview';
import './sf1.css';
import { DocumentViewer } from '../../components/DocumentViewer';
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

/** DB stores `male`/`female`; render the standard DepEd labels. */
const SEX_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female'
};

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
function parseName(name: string): {
  last: string;
  first: string;
  middle: string;
} {
  // Try "Last, First Middle" format
  const comma = name.indexOf(',');
  if (comma >= 0) {
    const last = name.substring(0, comma).trim();
    const rest = name
      .substring(comma + 1)
      .trim()
      .split(/\s+/);
    const first = rest[0] || '';
    const middle = rest.slice(1).join(' ') || '';
    return { last, first, middle };
  }
  // Fallback: "First Middle Last"
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { last: parts[0], first: '', middle: '' };
  if (parts.length === 2)
    return { last: parts[1], first: parts[0], middle: '' };
  return {
    last: parts[parts.length - 1],
    first: parts[0],
    middle: parts.slice(1, -1).join(' ')
  };
}

/** Parse LRN into 12 individual digits for the LRN grid */
function lrnDigits(lrn: string): string[] {
  const padded = lrn.padStart(12, '0').slice(0, 12).split('');
  return padded;
}

/**
 * Build subject rows for the SF9 table.
 * MAPEH is rendered as one grouped block: a bold "MAPEH" header row carrying
 * the averaged ratings, followed by its four component rows (Music, Arts,
 * Physical Education, Health). The learner's per-component grades are visible
 * but stay organized under one label instead of looking scattered.
 */
interface SubjectRow {
  name: string;
  q1: number | null;
  q2: number | null;
  q3: number | null;
  final: number | null;
  remarks: string;
  isMapehHeader?: boolean;
  isMapehComponent?: boolean;
  /** Header row for a collapsed learning area (MAPEH, TLE specializations). */
  isGroupHeader?: boolean;
  isGroupComponent?: boolean;
}

/** Heading each collapsed subject_group reports under. */
const GROUP_HEADINGS: Record<string, string> = { tle: 'TLE/EPP', tvl: 'TVL' };

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

  // TLE specializations share subject_group 'tle' and are reported under one
  // heading alongside TLE/EPP, mirroring the MAPEH block below.
  const groupedItems = new Map<string, typeof subjects>();
  for (const s of regularItems) {
    if (!s.subject_group) continue;
    const list = groupedItems.get(s.subject_group) ?? [];
    list.push(s);
    groupedItems.set(s.subject_group, list);
  }

  const avgOf = (items: typeof subjects, pick: (s: (typeof subjects)[number]) => number | null) => {
    const vals = items.map(pick).filter(v => v !== null) as number[];
    return vals.length > 0
      ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
      : null;
  };

  const toRow = (s: (typeof subjects)[number], flags: Partial<SubjectRow> = {}): SubjectRow => {
    const final = toNum(s.final_average);
    return {
      name: s.subject_name,
      q1: toNum(s.q1),
      q2: toNum(s.q2),
      q3: toNum(s.q3),
      final,
      remarks: final !== null ? (final >= 75 ? 'Passed' : 'Failed') : '—',
      ...flags
    };
  };

  const rows: SubjectRow[] = [];

  // Emit each grouped block (header + members) at the first member's position.
  const emittedGroups = new Set<string>();
  for (const s of regularItems) {
    if (s.subject_group && !emittedGroups.has(s.subject_group)) {
      emittedGroups.add(s.subject_group);
      const members = groupedItems.get(s.subject_group)!;
      const headerFinal = avgOf(members, m => toNum(m.final_average));
      rows.push({
        name: GROUP_HEADINGS[s.subject_group] ?? s.subject_group,
        isGroupHeader: true,
        q1: avgOf(members, m => toNum(m.q1)),
        q2: avgOf(members, m => toNum(m.q2)),
        q3: avgOf(members, m => toNum(m.q3)),
        final: headerFinal,
        remarks: headerFinal !== null ? (headerFinal >= 75 ? 'Passed' : 'Failed') : '—'
      });
      for (const m of members) rows.push(toRow(m, { isGroupComponent: true }));
      continue;
    }
    if (s.subject_group) continue;
    rows.push(toRow(s));
  }

  // Group MAPEH sub-areas under one "MAPEH" header row, then list each
  // component separately so its own ratings are readable.
  if (mapehItems.length > 0) {
    const mapehFinal = avgOf(mapehItems, s => toNum(s.final_average));

    rows.push({
      name: 'MAPEH',
      isMapehHeader: true,
      q1: avgOf(mapehItems, s => toNum(s.q1)),
      q2: avgOf(mapehItems, s => toNum(s.q2)),
      q3: avgOf(mapehItems, s => toNum(s.q3)),
      final: mapehFinal,
      remarks: mapehFinal !== null ? (mapehFinal >= 75 ? 'Passed' : 'Failed') : '—'
    });

    // Render components in the canonical DepEd order: Music, Arts, PE, Health
    const orderedMapeh = [...mapehItems].sort(
      (a, b) => MAPEH_SUBJECTS.indexOf(a.subject_name) - MAPEH_SUBJECTS.indexOf(b.subject_name)
    );
    for (const s of orderedMapeh) rows.push(toRow(s, { isMapehComponent: true }));
  }

  return rows;
}

/* ── Component ── */
export function SF9Report() {
  const { showToast, role } = useApp();
  const accent = useRoleAccent();
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
  const [schoolYears, setSchoolYears] = useState<SchoolYearRow[]>([]);

  /* ── Strengthened SHS: teacher's elective rosters ── */
  // Elective subjects the teacher handles; picking one switches the student
  // picker from "my sections" to "learners who picked this elective".
  const [myElectives, setMyElectives] = useState<
    { id: number; name: string; grade_level: number }[]
  >([]);
  const [electiveBatch, setElectiveBatch] = useState<ElectiveBatchRow[]>([]);
  const [electiveFilter, setElectiveFilter] = useState<number | null>(null);

  /* ── Data ── */
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sf9Data, setSf9Data] = useState<SF9Row | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Print confirmation preview — no form goes straight to window.print().
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Editable cell state (observed values auto-save) ── */
  const [observedMarks, setObservedMarks] = useState<Record<string, string>>(
    {}
  );
  const [observedSaved, setObservedSaved] = useState(false);
  const [signerNames, setSignerNames] = useState({ principal: '', adviser: '' });

  // ── Saved School Form Edits (docs/MAJOR_CHANGES_IN_FORMS.txt) ──
  // Attendance cells, parent signatures, certificate-of-transfer fields and
  // signer names are stored per (learner, school year) and re-applied the
  // next time anyone opens this report card. Role note (rule 10 strict):
  // teachers may save only attendance cells and observed values, and only
  // for learners of a section they advise — the server enforces this, and
  // the Save button below mirrors it.
  const sf9Edits = useFormEdits({
    form: 'SF9',
    schoolYearId: syId,
    studentId: selectedStudentId,
    enabled: !!selectedStudentId,
  });
  const canSaveFormEdits = role === 'admin' || role === 'registrar' || role === 'teacher';
  const editableStudentId = selectedStudentId ?? 0;

  const handleAttendanceChange = useCallback(
    (rowLabel: string, month: string, value: string) => {
      sf9Edits.setValue(editableStudentId, `attendance:${rowLabel}:${month}`, value);
    },
    [sf9Edits, editableStudentId]
  );

  const getAttendance = useCallback(
    (rowLabel: string, month: string): string => {
      return sf9Edits.get(editableStudentId, `attendance:${rowLabel}:${month}`) ?? '';
    },
    [sf9Edits, editableStudentId]
  );

  const handleObservedChange = useCallback(
    (cvIdx: number, stIdx: number, quarter: number, value: string) => {
      const key = `${cvIdx}-${stIdx}-Q${quarter}`;
      setObservedMarks(p => ({ ...p, [key]: value }));
    },
    []
  );

  const getObserved = useCallback(
    (cvIdx: number, stIdx: number, quarter: number): string => {
      return observedMarks[`${cvIdx}-${stIdx}-Q${quarter}`] || '';
    },
    [observedMarks]
  );

  const handleSignatureChange = useCallback(
    (quarter: string, value: string) => {
      sf9Edits.setValue(editableStudentId, `parentSig:${quarter}`, value);
    },
    [sf9Edits, editableStudentId]
  );

  const getSignature = useCallback(
    (quarter: string): string => {
      return sf9Edits.get(editableStudentId, `parentSig:${quarter}`) ?? '';
    },
    [sf9Edits, editableStudentId]
  );

  const handleTransferChange = useCallback(
    (field: string, value: string) => {
      sf9Edits.setValue(editableStudentId, `transfer:${field}`, value);
    },
    [sf9Edits, editableStudentId]
  );

  const getTransfer = useCallback(
    (field: string): string => {
      return sf9Edits.get(editableStudentId, `transfer:${field}`) ?? '';
    },
    [sf9Edits, editableStudentId]
  );

  // Signer names are stored with priority: manual > saved > system prefill.
  // `signer:principal` is a school-wide shared field for the SY (rule 8, saved
  // once); `signer:adviser` is per learner.
  const handleSignerChange = useCallback(
    (key: 'principal' | 'adviser', value: string) => {
      setSignerNames(prev => ({ ...prev, [key]: value }));
      sf9Edits.setValue(
        key === 'principal' ? null : editableStudentId,
        `signer:${key}`,
        value
      );
    },
    [sf9Edits, editableStudentId]
  );

  // Full-set signer assignment: saved edit (manual/unsaved included via the
  // hook layers) > system prefill. Used on the SF9 fetch AND after a Reset
  // in the Edited-fields menu, so removed edits stop showing immediately.
  const applySignersFor = useCallback(
    (data: typeof sf9Data) => {
      const enrollment = enrollments.find(
        e => e.student_id === selectedStudentId && e.school_year_id === syId
      );
      const sec =
        enrollment?.section_id != null
          ? sections.find(s => s.id === enrollment.section_id)
          : null;
      setSignerNames({
        principal:
          sf9Edits.get(null, 'signer:principal') ??
          data?.school?.principal_name ??
          '',
        adviser:
          sf9Edits.get(selectedStudentId, 'signer:adviser') ??
          (data?.enrollment?.adviser_name || sec?.adviser_name || '')
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sf9Edits, selectedStudentId, syId, enrollments, sections]
  );

  // Re-apply saved signer names once the edits fetch completes (overrides the
  // system prefill; a saved empty value means the prefill stays cleared).
  useEffect(() => {
    if (sf9Edits.loading) return;
    applySignersFor(sf9Data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sf9Edits.loading, sf9Edits.error, sf9Edits.resetTick, selectedStudentId, syId]);

  useEffect(() => {
    // Load all sections and students (the SF9 endpoint is available to any
    // authenticated user) so previous school years remain reachable even when
    // the student was under a different adviser's section that year.
    Promise.all([
      role === "teacher" ? studentsApi.listMyStudents() : studentsApi.list(),
      role === "teacher" ? sectionsApi.listMySections() : sectionsApi.list(),
      enrollmentsApi.list(),
      schoolYearsApi.list(),
      role === "teacher"
        ? subjectsApi
            .assigned()
            .then(subs =>
              subs
                .filter(s => s.subject_type === 'elective' && s.is_active === 1)
                .map(s => ({
                  id: s.id,
                  name: s.name,
                  grade_level: s.grade_level
                }))
            )
            .catch(() => [])
        : Promise.resolve([])
    ])
      .then(([studs, secs, enrs, years, electives]) => {
        const activeSections = secs.filter(
          (s: SectionRow) => s.is_active === 1
        );
        setStudents(studs);
        setSections(activeSections);
        setEnrollments(enrs);
        setSchoolYears(years);
        setMyElectives(electives);

        // Use provided school_year_id or find current
        let targetSyId: number | null = null;
        if (preselectedSyId) {
          targetSyId = parseInt(preselectedSyId);
        } else {
          const currentYear = years.find((y: any) => y.is_current === 1);
          targetSyId = currentYear ? currentYear.id : null;
        }
        setSyId(targetSyId ?? 1);

        // Check for pre-selected student from query params
        if (preselectedStudentId) {
          const sid = parseInt(preselectedStudentId);
          // Prefer the enrollment for the requested school year; fall back to
          // any active enrollment so the student is still reachable.
          const enrollment =
            enrs.find(
              (e: EnrollmentRow) =>
                e.student_id === sid &&
                e.school_year_id === targetSyId &&
                e.status === 'enrolled'
            ) ||
            enrs.find(
              (e: EnrollmentRow) =>
                e.student_id === sid &&
                e.school_year_id === targetSyId
            ) ||
            enrs.find(
              (e: EnrollmentRow) => e.student_id === sid && e.status === 'enrolled'
            );
          if (
            enrollment &&
            (role !== "teacher" || studs.some(s => s.id === sid))
          ) {
            const gradeStr = String(
              enrollment.section_grade_level ??
                (enrs.find(
                  (e: EnrollmentRow) =>
                    e.student_id === sid && e.section_grade_level != null
                )?.section_grade_level) ??
                ''
            );
            if (gradeStr) setSelectedGrade(gradeStr);
            // Set section and student — the effects will preserve these
            const sec =
              (enrollment.section_id != null
                ? activeSections.find((s: SectionRow) => s.id === enrollment.section_id)
                : null) ??
              activeSections.find(
                (s: SectionRow) =>
                  String(s.grade_level) === gradeStr &&
                  enrs.some(
                    (e: EnrollmentRow) =>
                      e.student_id === sid && e.section_id === s.id
                  )
              ) ??
              (gradeStr
                ? activeSections.find((s: SectionRow) => String(s.grade_level) === gradeStr)
                : null);
            if (sec) setSelectedSectionId(sec.id);
            setSelectedStudentId(sid);
            return;
          }
          // Strengthened SHS: the preselected learner may be on the teacher's
          // roster via an elective — their section (if any) belongs to someone
          // else, so no enrollment row is visible to the teacher. Resolve the
          // grade from the roster itself and open the report card directly.
          if (
            role === "teacher" &&
            studs.some((s: StudentRow) => s.id === sid)
          ) {
            const stu = studs.find((s: StudentRow) => s.id === sid)!;
            setSelectedGrade(String(stu.grade_level));
            setSelectedSectionId(null);
            setSelectedStudentId(sid);
            return;
          }
        }

        // Default: jump to the first *sectioned* student enrolled in the target
        // school year so the page opens on a populated roster. An enrollment
        // with no section yet (section_id NULL) must be skipped — otherwise the
        // grade is set but the section dropdown stays empty.
        const syEnrolled = enrs.filter(
          (e: EnrollmentRow) =>
            e.school_year_id === targetSyId && e.status === 'enrolled'
        );
        const syEnr = syEnrolled.find((e: EnrollmentRow) => e.section_id != null) ?? null;

        if (syEnr) {
          const gradeStr = String(syEnr.section_grade_level ?? '');
          setSelectedGrade(gradeStr);
          // Pick a section that belongs to that grade. Prefer the enrolled
          // student's own section; otherwise fall back to any active section of
          // that grade that has enrolled learners.
          const sec =
            activeSections.find((s: SectionRow) => s.id === syEnr.section_id) ??
            activeSections.find(
              (s: SectionRow) =>
                String(s.grade_level) === gradeStr &&
                enrs.some(
                  (e: EnrollmentRow) =>
                    e.school_year_id === targetSyId &&
                    e.status === 'enrolled' &&
                    e.section_id === s.id
                )
            ) ??
            activeSections.find((s: SectionRow) => String(s.grade_level) === gradeStr);
          if (sec) setSelectedSectionId(sec.id);
          setSelectedStudentId(syEnr.student_id);
        } else {
          // No sectioned enrollment in this year — open on whatever grade the
          // raw enrollments point at, then land on its first section.
          const gradeFromAny = syEnrolled.find(
            (e: EnrollmentRow) => e.section_grade_level != null
          )?.section_grade_level;
          const gradeStr = String(gradeFromAny ?? 7);
          setSelectedGrade(gradeStr);
          const gradeSecs = activeSections.filter(
            (s: SectionRow) => String(s.grade_level) === gradeStr
          );
          if (gradeSecs.length > 0) setSelectedSectionId(gradeSecs[0].id);
        }
      })
      .catch(err =>
        showToast(
          'error',
          'Failed to load: ' + (err.detail?.error || err.message)
        )
      )
      .finally(() => setLoading(false));
  }, []);

  // Elective picks for the selected school year (teacher view: used to resolve
  // which learners are on each elective's roster).
  useEffect(() => {
    if (role !== 'teacher' || !syId) return;
    let cancelled = false;
    electivesApi
      .assignmentsBatch(syId)
      .then(rows => {
        if (!cancelled) setElectiveBatch(rows);
      })
      .catch(() => {
        /* elective rosters are optional — section flow still works */
      });
    return () => {
      cancelled = true;
    };
  }, [role, syId]);

  /* ── Derived ── */
  const gradeSections = useMemo(
    () => sections.filter(s => s.grade_level === parseInt(selectedGrade)),
    [sections, selectedGrade]
  );

  const sectionEnrollmentIds = useMemo(() => {
    return enrollments
      .filter(
        e =>
          e.school_year_id === syId &&
          e.section_grade_level === parseInt(selectedGrade) &&
          e.section_id === selectedSectionId &&
          e.status === 'enrolled'
      )
      .map(e => e.student_id);
  }, [enrollments, selectedGrade, selectedSectionId, syId]);

  const enrolledStudents = useMemo(() => {
    // Strengthened SHS: when the teacher picked one of their electives, the
    // student list is that elective's pickers (they span sections) instead of
    // a single section's roster.
    if (electiveFilter != null) {
      const rosterIds = new Set(
        electiveBatch
          .filter(b => b.subject_id === electiveFilter)
          .map(b => b.student_id)
      );
      return students.filter(s => rosterIds.has(s.id));
    }
    return students.filter(s => sectionEnrollmentIds.includes(s.id));
  }, [
    electiveFilter,
    electiveBatch,
    students,
    sectionEnrollmentIds
  ]);

  // Auto-select first student when section changes
  useEffect(() => {
    if (enrolledStudents.length > 0) {
      if (
        selectedStudentId &&
        enrolledStudents.some(s => s.id === selectedStudentId)
      )
        return;
      setSelectedStudentId(enrolledStudents[0].id);
    } else if (
      selectedStudentId &&
      students.some(s => s.id === selectedStudentId)
    ) {
      // Keep a preselected learner that sits outside the section filter —
      // elective-roster students (Strengthened SHS) reach this page via the
      // ?student_id= deep link and must not be cleared by the empty section.
    } else {
      setSelectedStudentId(null);
    }
    setSf9Data(null);
  }, [selectedGrade, selectedSectionId, syId, electiveFilter, electiveBatch, students]);

  // Reset section when grade changes — only if current section doesn't belong to the new grade
  useEffect(() => {
    setElectiveFilter(null);
    const gs = sections.filter(s => s.grade_level === parseInt(selectedGrade));
    if (selectedSectionId && gs.some(s => s.id === selectedSectionId)) return;
    if (gs.length > 0) setSelectedSectionId(gs[0].id);
    else setSelectedSectionId(null);
    setSf9Data(null);
  }, [selectedGrade]);

  // Reset editable form fields whenever the student changes, so previously
  // entered values for a different learner do not persist on screen or in the
  // print/export. (Saved school-form edits clean themselves up: the
  // sf9Edits hook drops unsaved local edits when the student/SY changes.)
  useEffect(() => {
    setObservedMarks({});
    setObservedSaved(false);
    setSignerNames({ principal: '', adviser: '' });
  }, [selectedStudentId, syId]);

  /* ── Fetch SF9 report ── */
  useEffect(() => {
    if (!selectedStudentId) return;
    setLoadingReport(true);
    setError(null);
    formsApi
      .sf9(selectedStudentId, syId)
      .then(data => {
        setSf9Data(data);
      })
      .catch(err =>
        setError(err.detail?.error || err.message || 'Failed to generate SF9')
      )
      .finally(() => setLoadingReport(false));
  }, [selectedStudentId, syId, enrollments, sections]);

  // ── Persisted Observed Values ──
  // Load the learner's saved observed-value marks for this SY, then
  // debounce-save locally made selections so they survive student switches,
  // refreshes, PDF exports and print previews.
  useEffect(() => {
    if (!selectedStudentId) return;
    let cancelled = false;
    formsApi
      .sf9FormData(selectedStudentId, syId)
      .then(({ observed_values }) => {
        if (!cancelled && observed_values) setObservedMarks(observed_values);
      })
      .catch(() => {
        // No saved data — an empty map is fine.
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStudentId, syId]);

  useEffect(() => {
    if (!selectedStudentId) return;
    if (!Object.keys(observedMarks).length) return; // nothing to save yet
    const t = setTimeout(() => {
      formsApi
        .saveSF9FormData(selectedStudentId, syId, observedMarks)
        .then(() => setObservedSaved(true))
        .catch(err =>
          showToast(
            'error',
            err.detail?.error || err.message || 'Failed to save observed values'
          )
        );
    }, 1200);
    return () => clearTimeout(t);
  }, [observedMarks, selectedStudentId, syId]);

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const subjectRows = sf9Data?.subjects
    ? buildSubjectRows(sf9Data.subjects)
    : [];
  const ga = toNum(sf9Data?.general_average);

  /* ── Print ── */
  const handlePrint = () => {
    window.print();
  };

  /* ── Explicit Save (docs/MAJOR_CHANGES_IN_FORMS.txt rule 3) ── */
  // Saves the pending attendance/signature/transfer/signer edits and flushes
  // the observed values immediately (they normally auto-save on debounce).
  const handleSaveEdits = async () => {
    if (!selectedStudentId) return;
    const errors: string[] = [];
    if (Object.keys(observedMarks).length > 0) {
      try {
        await formsApi.saveSF9FormData(selectedStudentId, syId, observedMarks);
        setObservedSaved(true);
      } catch (err: any) {
        errors.push(err?.detail?.error || 'observed values failed to save');
      }
    }
    let saved = 0;
    try {
      const res = await sf9Edits.save();
      saved = res.saved;
    } catch (err: any) {
      errors.push(err?.message || 'form edits failed to save');
    }
    if (errors.length > 0) {
      showToast('error', 'Some edits were not saved: ' + errors.join('; '));
    } else {
      showToast(
        'success',
        saved > 0
          ? `Saved ${saved} SF9 edit${saved === 1 ? '' : 's'}.`
          : 'Nothing new to save — SF9 is up to date.'
      );
    }
  };

  const handleExportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    const options = {
      elementId: 'sf9-print-area',
      filename: `SF9_${selectedStudent?.lrn || selectedStudentId}`,
      orientation: 'landscape' as const,
      format: 'letter' as const,
    };
    try {
      // Primary path: render server-side in Chrome so the PDF matches the
      // browser's Print Preview exactly (landscape report card, page breaks,
      // print CSS), then auto-download.
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
          /* !important is required: the app-wide dark theme remaps the body
             element, and without this the card prints on themed paper. */
          html, body { font-family: 'Times New Roman', Times, serif; color: #000 !important; background: #fff !important; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          #sf9-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0.15in; }
          #sf9-print-area .print-page { page-break-after: always; }
          #sf9-print-area .print-page:last-child { page-break-after: avoid; }
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
                  <BookOpen size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">
                    SF9 — Learner's Progress Report Card
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Pick a school year, then grade, section, and student to
                    generate the official report card. Previous years show that
                    year's own section and grades.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canSaveFormEdits && (
                  <div className="flex items-center gap-2 mr-1">
                    {sf9Edits.isDirty && (
                      <span className="text-[11px] font-semibold text-amber-600 whitespace-nowrap">
                        ● {sf9Edits.dirtyCount} unsaved edit{sf9Edits.dirtyCount === 1 ? '' : 's'}
                      </span>
                    )}
                    <button
                      onClick={handleSaveEdits}
                      disabled={sf9Edits.saving || !selectedStudentId}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-sm font-medium transition shadow-sm disabled:opacity-40">
                      {sf9Edits.saving ? <Loader2 size={14} className="animate-spin" /> : <SaveIcon size={14} />}
                      Save
                    </button>
                  </div>
                )}
                <FormEditsMenu api={sf9Edits} canSave={canSaveFormEdits} />
                <button
                  onClick={() => setPreviewOpen(true)}
                  disabled={exporting}
                  className={`inline-flex items-center gap-1.5 ${accent.button} text-white px-3.5 py-2 rounded-xl text-sm font-medium transition shadow-sm disabled:opacity-40`}>
                  {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {exporting ? 'Generating…' : 'PDF'}
                </button>
                <button
                  onClick={() => setPreviewOpen(true)}
                  className="inline-flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-xl text-sm font-medium transition shadow-sm">
                  <Printer size={14} /> Print
                </button>
              </div>
            </div>

            <FormPrintPreview
              open={previewOpen}
              title="SF9 — Report Card"
              elementId="sf9-print-area"
              onClose={() => setPreviewOpen(false)}
              onExportPdf={handleExportPdf}
              exporting={exporting}
              orientation="landscape"
              format="letter"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-[0.05em]">
                  School Year
                </label>
                <select
                  value={syId}
                  onChange={e => {
                    const nextSy = parseInt(e.target.value);
                    setSyId(nextSy);
                    setSf9Data(null);
                    // If a student is selected and was enrolled that year,
                    // jump the grade/section to their section for that year
                    // so the dropdowns match the report card.
                    if (selectedStudentId) {
                      const enr = enrollments.find(
                        en =>
                          en.student_id === selectedStudentId &&
                          en.school_year_id === nextSy &&
                          en.status === 'enrolled'
                      );
                      if (enr && enr.section_id) {
                        setSelectedGrade(String(enr.section_grade_level));
                        setSelectedSectionId(enr.section_id);
                      }
                    }
                  }}
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
                <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-[0.05em]">
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
                <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-[0.05em]">
                  Section
                </label>
                <select
                  value={selectedSectionId ?? ''}
                  onChange={e => {
                    setElectiveFilter(null);
                    setSelectedSectionId(parseInt(e.target.value));
                  }}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 ${accent.ring} bg-white transition">
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
              {role === 'teacher' && myElectives.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-indigo-500 mb-1 uppercase tracking-[0.05em]">
                    My Elective
                  </label>
                  <select
                    value={electiveFilter ?? ''}
                    onChange={e => {
                      const v = e.target.value ? parseInt(e.target.value) : null;
                      setElectiveFilter(v);
                      if (v != null) setSelectedSectionId(null);
                      setSf9Data(null);
                    }}
                    className="w-full border border-indigo-100 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white transition">
                    <option value="">By section…</option>
                    {myElectives.map(el => (
                      <option key={el.id} value={el.id}>
                        ⚡ {el.name} (G{el.grade_level})
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 ${accent.ring} bg-white transition">
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
                {electiveFilter != null
                  ? `Elective: ${myElectives.find(el => el.id === electiveFilter)?.name ?? '—'}`
                  : gradeSections.find(s => s.id === selectedSectionId)?.name ||
                    '—'}{' '}
                ·{' '}
                {schoolYears.find(y => y.id === syId)?.sy_label || '—'}
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
              className={`animate-spin ${accent.text} mx-auto mb-3`}
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
            <div className={`w-14 h-14 rounded-2xl ${accent.soft} flex items-center justify-center mx-auto mb-4`}>
              <BookOpen size={28} className={accent.text} />
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
              No one was enrolled in this section for{' '}
              {schoolYears.find(y => y.id === syId)?.sy_label || 'this school year'}.
              Select a different grade level, section, or school year.
            </p>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────── */}
      {/* SF9 Official DepEd Two-Page Report Card                       */}
      {/* ────────────────────────────────────────────────────────────── */}
      {!loadingReport && sf9Data && selectedStudent && (
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden print:border-transparent print:shadow-none">
          {/* ── Print Area ── */}
          <DocumentViewer>
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
                                  onChange={e =>
                                    handleAttendanceChange(
                                      label,
                                      m,
                                      e.target.value
                                    )
                                  }
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
                        '3rd Quarter'
                      ].map(q => (
                        <div key={q} className="flex items-end gap-1">
                          <span className="text-[11px] font-semibold whitespace-nowrap">
                            {q}:
                          </span>
                          <input
                            type="text"
                            value={getSignature(q)}
                            onChange={e =>
                              handleSignatureChange(q, e.target.value)
                            }
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
                          onChange={e =>
                            handleTransferChange(
                              'admittedGrade',
                              e.target.value
                            )
                          }
                          className="sf1-input flex-1 border-b border-black bg-transparent text-[11px] pl-1 outline-none focus:bg-amber-50"
                        />
                        <span className="text-[11px] font-semibold whitespace-nowrap">
                          Section:
                        </span>
                        <input
                          type="text"
                          value={getTransfer('admittedSection')}
                          onChange={e =>
                            handleTransferChange(
                              'admittedSection',
                              e.target.value
                            )
                          }
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
                          onChange={e =>
                            handleTransferChange(
                              'eligibilityGrade',
                              e.target.value
                            )
                          }
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
                          onChange={e =>
                            handleTransferChange('approved', e.target.value)
                          }
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
                          onChange={e =>
                            handleTransferChange(
                              'cancelAdmitted',
                              e.target.value
                            )
                          }
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
                          onChange={e =>
                            handleTransferChange('cancelDate', e.target.value)
                          }
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
                      <span className="text-[11px] font-semibold shrink-0">
                        Name :
                      </span>
                      {(() => {
                        const p = parseName(
                          sf9Data.student?.name || selectedStudent.name
                        );
                        return (
                          <>
                            <span className="flex-1 border-b border-black text-[11px] pl-1 leading-tight">
                              {p.last}
                            </span>
                            <span className="flex-1 border-b border-black text-[11px] pl-1 leading-tight">
                              {p.first}
                            </span>
                            <span className="flex-1 border-b border-black text-[11px] pl-1 leading-tight">
                              {p.middle}
                            </span>
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
                          {sf9Data.student?.sex
                            ? SEX_LABELS[sf9Data.student.sex.toLowerCase()] ??
                              sf9Data.student.sex
                            : '—'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-end gap-4">
                      <div className="flex items-end gap-1 flex-1">
                        <span className="text-[11px] font-semibold">
                          Grade :
                        </span>
                        <span className="flex-1 border-b border-black text-[11px] pl-1">
                          {sf9Data.enrollment?.grade_level ||
                            sf9Data.student?.grade_level ||
                            ''}
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
                        {parseInt(selectedGrade) >= 11
                          ? sf9Data.enrollment?.strand_track_name || '—'
                          : 'N/A (JHS)'}
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
                      <input
                        type="text"
                        className="block w-full mx-2 border-0 border-b border-black bg-transparent px-1 py-1 text-center text-[10px] italic outline-none focus:bg-amber-50"
                        value={signerNames.principal}
                        onChange={e => handleSignerChange('principal', e.target.value)}
                        placeholder="Name"
                      />
                      <div className="italic mt-0.5">Principal IV</div>
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        className="block w-full mx-2 border-0 border-b border-black bg-transparent px-1 py-1 text-center text-[10px] font-semibold outline-none focus:bg-amber-50"
                        value={signerNames.adviser}
                        onChange={e => handleSignerChange('adviser', e.target.value)}
                        placeholder="Name"
                      />
                      <div className="mt-0.5 font-bold">CLASS ADVISER</div>
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
                      <col span={3} style={{ width: '8%' }} />
                      <col style={{ width: '16%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th
                          rowSpan={2}
                          className="border border-black px-1 py-1 align-middle font-bold text-center">
                          Learning Areas
                        </th>
                        <th
                          colSpan={3}
                          className="border border-black px-1 py-0.5 font-bold text-center">
                          Quarter
                        </th>
                        <th
                          rowSpan={2}
                          className="border border-black px-1 py-1 align-middle font-bold text-center">
                          Final Rating
                        </th>
                      </tr>
                      <tr className="font-bold">
                        {[1, 2, 3].map(q => (
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
                        <tr key={`${row.name}-${i}`} className={row.isMapehHeader || row.isGroupHeader ? 'bg-gray-50' : ''}>
                          <td
                            className={`border border-black px-1 py-0.5 text-left ${
                              row.isMapehHeader || row.isGroupHeader
                                ? 'font-bold uppercase'
                                : row.isMapehComponent || row.isGroupComponent
                                  ? 'font-medium pl-6'
                                  : 'font-medium'
                            }`}>
                            {row.name}
                          </td>
                          <td
                            className="border border-black px-1 py-0.5 text-center">
                            {row.q1 !== null ? row.q1.toFixed(2) : '—'}
                          </td>
                          <td
                            className="border border-black px-1 py-0.5 text-center">
                            {row.q2 !== null ? row.q2.toFixed(2) : '—'}
                          </td>
                          <td
                            className="border border-black px-1 py-0.5 text-center">
                            {row.q3 !== null ? row.q3.toFixed(2) : '—'}
                          </td>
                          <td
                            className={`border border-black px-1 py-0.5 text-center font-bold ${row.final !== null && row.final >= 75 ? '' : 'text-red-700'}`}>
                            {row.final !== null ? row.final.toFixed(2) : '—'}
                          </td>
                        </tr>
                      ))}

                      {/* General Average row */}
                      <tr className="font-bold">
                        <td
                          colSpan={4}
                          className="border border-black px-1 py-1 text-center">
                          General Average
                        </td>
                        <td
                          className={`border border-black px-1 py-1 text-center ${ga !== null && ga >= 75 ? '' : 'text-red-700'}`}>
                          {ga !== null ? ga.toFixed(2) : '—'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* ── Right: Learner's Observed Values ── */}
                <div>
                  <h3 className="text-center text-[11px] font-bold mb-1">
                    REPORT ON LEARNER'S OBSERVED VALUES
                    {observedSaved && (
                      <span className="ml-2 text-emerald-600">✓ saved</span>
                    )}
                  </h3>
                  <table className="w-full border-collapse text-[9px]">
                    <colgroup>
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '44%' }} />
                      <col span={3} style={{ width: '10%' }} />
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
                          colSpan={3}
                          className="border border-black px-1 py-0.5 font-bold text-center">
                          Quarter
                        </th>
                      </tr>
                      <tr className="font-bold">
                        {[1, 2, 3].map(q => (
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
                            {[1, 2, 3].map(q => (
                              <td key={q} className="border border-black p-0 text-center">
                                <select
                                  value={getObserved(cvIdx, stIdx, q)}
                                  onChange={e =>
                                    handleObservedChange(
                                      cvIdx,
                                      stIdx,
                                      q,
                                      e.target.value
                                    )
                                  }
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
          </DocumentViewer>
        </div>
      )}
    </div>
  );
}
