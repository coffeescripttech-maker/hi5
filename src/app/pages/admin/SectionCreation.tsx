import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Layers,
  Plus,
  CheckCircle,
  Trash2,
  Edit2,
  X,
  AlertTriangle,
  Users,
  Search,
  ChevronRight,
  GraduationCap,
  Palette,
  Lock,
  Copy
} from 'lucide-react';
import {
  sectionsApi,
  SectionRow,
  CreateSectionPayload,
  UpdateSectionPayload,
  TeacherBrief,
  SubjectTeachersRow,
  TeacherDraft,
  assignmentsFromDraft,
  updateTeachers,
  getSectionTeachers,
  subjectCatalog,
  applyTeachers,
  teachingCoverage,
  copyPreviousYear
} from '../../services/sections';
import { sectionTypesApi, SectionType } from '../../services/sectionTypes';
import { schoolYearsApi, SchoolYearRow } from '../../services/schoolYears';
import { useApp } from '../../context/AppContext';
import { HybridTable } from '../../components/HybridTable';
import { ModalShell } from '../../components/ModalShell';

const FALLBACK_COLORS = 'bg-gray-100 text-gray-700 border-gray-200';

const DEFAULT_SECTION_COLORS: Record<string, string> = {
  star: 'bg-amber-100 text-amber-700 border-amber-200',
  gold: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  silver: 'bg-slate-100 text-slate-700 border-slate-200',
  regular: 'bg-blue-100 text-blue-700 border-blue-200',
  non_reader: 'bg-red-100 text-red-700 border-red-200'
};

/* ── Reusable Teacher Search ── */
function TeacherSearch({
  value,
  onChange,
  teachers,
  placeholder,
  getConflict
}: {
  value: string;
  onChange: (id: string, name: string) => void;
  teachers: TeacherBrief[];
  placeholder?: string;
  getConflict?: (teacherId: number) => string | null;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sync query from initial value (numeric ID) on first render
  useEffect(() => {
    if (value && !query) {
      const t = teachers.find(u => u.id === parseInt(value));
      if (t) setQuery(`${t.name} (ID: ${t.id})`);
    }
  }, [value, teachers]);

  const filtered = query.trim()
    ? teachers
        .filter(
          t =>
            t.name.toLowerCase().includes(query.toLowerCase()) ||
            String(t.id).includes(query) ||
            (t.employee_id || '').toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 8)
    : teachers.slice(0, 8);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (t: TeacherBrief) => {
    setQuery(`${t.name} (ID: ${t.id})`);
    onChange(String(t.id), t.name || '');
    setOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    onChange('', '');
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || 'Search teacher by name or ID...'}
          className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400 transition-all bg-white"
        />
        {query && (
          <button
            onClick={handleClear}
            className="touch-target inline-flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition">
            <X size={14} />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 z-50 overflow-hidden max-h-64 overflow-y-auto">
          {filtered.map(t => {
            const conflictName = getConflict?.(t.id) || null;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelect(t)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition text-left border-b border-gray-50 last:border-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm ${conflictName ? 'bg-red-100 text-red-600' : 'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700'}`}>
                  {(t.name || '?').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {t.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    <span className="font-mono">ID: {t.id}</span>
                    {t.employee_id ? ` · ${t.employee_id}` : ''}
                    {t.designation ? ` · ${t.designation}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {conflictName ? (
                    <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 whitespace-nowrap">
                      Taken — {conflictName}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 whitespace-nowrap">
                      Available
                    </span>
                  )}
                  <ChevronRight
                    size={14}
                    className="text-gray-300 flex-shrink-0"
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
      {open && query.trim() && filtered.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 p-4 text-center">
          <p className="text-sm text-gray-400">
            No teachers found matching "{query}"
          </p>
        </div>
      )}
    </div>
  );
}

function getSectionColor(
  typeName: string,
  sectionTypes: SectionType[],
  defaultColors: Record<string, string>
): string {
  // Prefer known default colors for built-in types
  if (defaultColors[typeName]) return defaultColors[typeName];
  // Use color_code from the database if available
  const st = sectionTypes.find(t => t.name === typeName);
  if (st?.color_code) return st.color_code;
  return FALLBACK_COLORS;
}

/* ── Subject Teachers rows (new_requirement.txt R2, R3, R5) ──────────────
 * One row per grade+program subject (electives excluded — they live on the
 * elective offering). Teachers are chips; adding a second is a co-teacher.
 * "Apply to sections…" fans one subject's teachers out to other sections.
 */
function SubjectTeacherRows({
  subjects,
  draft,
  teachers,
  onSet,
  onApply
}: {
  subjects: Pick<
    SubjectTeachersRow,
    'id' | 'name' | 'subject_group' | 'program' | 'subject_type'
  >[];
  draft: TeacherDraft;
  teachers: TeacherBrief[];
  onSet: (subjectId: number, ids: number[]) => void;
  onApply?: (subject: SubjectTeachersRow) => void;
}) {
  if (subjects.length === 0) {
    return (
      <p className="text-xs text-gray-400 px-1 py-3">
        No graded subjects found for this grade level and track yet.
      </p>
    );
  }
  const teacherName = (id: number) =>
    teachers.find(t => t.id === id)?.name ?? `ID ${id}`;
  return (
    <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 max-h-72 overflow-y-auto bg-white">
      {subjects.map(sub => {
        const ids = draft[sub.id] ?? [];
        return (
          <div
            key={sub.id}
            className="px-3.5 py-2.5 flex items-center gap-2.5 flex-wrap">
            <div className="min-w-0 flex-1 basis-40">
              <p className="text-sm text-gray-800 font-medium truncate leading-tight">
                {sub.name}
              </p>
              {sub.subject_group && (
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md mt-0.5 inline-block">
                  {sub.subject_group.toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {ids.length === 0 && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                  No teacher
                </span>
              )}
              {ids.map(tid => (
                <span
                  key={tid}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                  {teacherName(tid)}
                  <button
                    type="button"
                    onClick={() => onSet(sub.id, ids.filter(i => i !== tid))}
                    className="text-blue-400 hover:text-red-500 transition"
                    title="Remove teacher">
                    <X size={11} />
                  </button>
                </span>
              ))}
              <select
                value=""
                onChange={e => {
                  const tid = Number(e.target.value);
                  if (tid) onSet(sub.id, [...ids, tid]);
                }}
                className="text-[11px] font-semibold text-blue-600 border border-blue-200 rounded-full px-2 py-1 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-100 max-w-[9.5rem]">
                <option value="">+ teacher…</option>
                {teachers
                  .filter(t => !ids.includes(t.id))
                  .map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name.length > 20 ? `${t.name.slice(0, 20)}…` : t.name}
                    </option>
                  ))}
              </select>
              {onApply && ids.length > 0 && (
                <button
                  type="button"
                  onClick={() => onApply(sub as SubjectTeachersRow)}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 border border-blue-200 rounded-full px-2 py-1 hover:bg-blue-50 transition"
                  title="Assign these teachers to the same subject in other sections">
                  Apply to sections…
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SectionCreation() {
  const { showToast, role } = useApp();
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherBrief[]>([]);
  const [sectionTypes, setSectionTypes] = useState<SectionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState<SectionRow | null>(null);
  const [editForm, setEditForm] = useState({
    capacity: '',
    adviser_id: '',
    minAvg: '',
    maxAvg: ''
  });
  const [form, setForm] = useState({
    gradeLevel: '7',
    sectionName: '',
    type: 'ste',
    capacity: '45',
    adviser_id: '',
    minAvg: '85',
    maxAvg: ''
  });

  // ── Subject teachers per section (new_requirement.txt R1-R10) ──
  const canEditTeachers = role === 'admin' || role === 'registrar';
  const canViewCoverage =
    role === 'admin' || role === 'registrar' || role === 'principal';
  const [currentYear, setCurrentYear] = useState<SchoolYearRow | null>(null);
  const [prevYear, setPrevYear] = useState<SchoolYearRow | null>(null);
  // section_id -> number of its grade-level subjects without a teacher
  const [coverage, setCoverage] = useState<Record<number, number>>({});
  // Create-mode: catalog rows + draft (saved only after the section exists)
  const [catRows, setCatRows] = useState<SubjectTeachersRow[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [draft, setDraft] = useState<TeacherDraft>({});
  // Edit-mode: stored rows + draft + warn-only schedule notes
  const [editSubjects, setEditSubjects] = useState<SubjectTeachersRow[]>([]);
  const [editTeachers, setEditTeachers] = useState<TeacherDraft>({});
  const [editTeachersLoading, setEditTeachersLoading] = useState(false);
  const [editWarnings, setEditWarnings] = useState<string[]>([]);
  // R4 — apply one subject's teachers to many sections
  const [applyTarget, setApplyTarget] = useState<{
    subjectId: number;
    name: string;
    teacherIds: number[];
    teacherNames: string;
  } | null>(null);
  const [applyIds, setApplyIds] = useState<number[]>([]);
  const [applyBusy, setApplyBusy] = useState(false);
  // R9 — admin copy-forward
  const [showCopy, setShowCopy] = useState(false);
  const [copyOverwrite, setCopyOverwrite] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);

  // ── Manage Types modal state ──
  const [showManageTypes, setShowManageTypes] = useState(false);
  const [typesLoading, setTypesLoading] = useState(false);
  const [typeFormMode, setTypeFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingType, setEditingType] = useState<SectionType | null>(null);
  const [typeForm, setTypeForm] = useState({
    name: '',
    label: '',
    color_code: '',
    icon: '',
    sort_order: '0'
  });
  const [deleteTypeId, setDeleteTypeId] = useState<SectionType | null>(null);

  // ── Unique adviser per grade validation ──
  const findAdviserConflict = (
    grade: number,
    adviserId: string,
    excludeSectionId?: number
  ): SectionRow | null => {
    if (!adviserId) return null;
    const id = parseInt(adviserId);
    return (
      sections.find(
        s =>
          s.grade_level === grade &&
          s.adviser_id === id &&
          s.id !== excludeSectionId
      ) || null
    );
  };

  const getTeacherName = (adviserId: string): string => {
    if (!adviserId) return '';
    const t = teachers.find(t => t.id === parseInt(adviserId));
    return t ? t.name : '';
  };

  const fetchSections = useCallback(() => {
    setLoading(true);
    sectionsApi
      .list()
      .then(setSections)
      .catch(err =>
        showToast(
          'error',
          'Failed to load sections: ' + (err.detail?.error || err.message)
        )
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSections();
    // Load teachers for adviser search
    sectionsApi
      .listTeachers()
      .then(setTeachers)
      .catch(() => {});
    // Load section types
    sectionTypesApi
      .list()
      .then(setSectionTypes)
      .catch(() => {});
  }, []);

  // Current + previous school year (assignments and copy-forward are year-scoped)
  useEffect(() => {
    if (!canEditTeachers) return;
    schoolYearsApi
      .current()
      .then(cur => {
        setCurrentYear(cur);
        setPrevYear(null);
        schoolYearsApi
          .list()
          .then(all => {
            const older = all.filter(y => y.id < cur.id).sort((a, b) => b.id - a.id);
            setPrevYear(older[0] ?? null);
          })
          .catch(() => {});
      })
      .catch(() => {});
  }, [canEditTeachers]);

  // R8 — teacherless-subject counts per section (current school year)
  const fetchCoverage = useCallback(() => {
    if (!currentYear || !canViewCoverage) return;
    teachingCoverage(currentYear.id)
      .then(rows =>
        setCoverage(
          Object.fromEntries(rows.map(r => [r.section_id, r.subjects_without_teacher]))
        )
      )
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentYear, canViewCoverage]);

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  // Create mode — catalog for the chosen grade + track (electives excluded, R5)
  useEffect(() => {
    if (!showForm || !canEditTeachers || !currentYear) return;
    setDraft({});
    setCatRows([]);
    setCatLoading(true);
    subjectCatalog(parseInt(form.gradeLevel), form.type)
      .then(rows => setCatRows(rows as SubjectTeachersRow[]))
      .catch(() => {})
      .finally(() => setCatLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, form.gradeLevel, form.type, currentYear, canEditTeachers]);

  const createConflict = (): SectionRow | null => {
    if (!form.adviser_id) return null;
    return findAdviserConflict(parseInt(form.gradeLevel), form.adviser_id);
  };

  const handleAdd = async () => {
    const conflict = createConflict();
    if (conflict) {
      showToast(
        'error',
        `${getTeacherName(form.adviser_id)} is already assigned to "${conflict.name}" in Grade ${form.gradeLevel}`
      );
      return;
    }
    try {
      const payload: CreateSectionPayload = {
        name: `${form.gradeLevel}-${form.sectionName}`,
        grade_level: parseInt(form.gradeLevel),
        section_type: form.type,
        capacity: parseInt(form.capacity),
        min_average: parseInt(form.minAvg),
        max_average: form.maxAvg ? parseFloat(form.maxAvg) : null,
        adviser_id: form.adviser_id ? parseInt(form.adviser_id) : undefined
      };
      const created = await sectionsApi.create(payload);
      // Subject Teachers part — save the drafted teachers onto the new section
      let warnings: string[] = [];
      if (currentYear) {
        const assignments = assignmentsFromDraft(draft);
        if (assignments.length > 0) {
          const resp = await updateTeachers(created.id, {
            school_year_id: currentYear.id,
            assignments
          });
          warnings = resp.warnings;
        }
      }
      setShowForm(false);
      setSaved(true);
      setDraft({});
      setCatRows([]);
      setForm({
        gradeLevel: '7',
        sectionName: '',
        type: 'ste',
        capacity: '45',
        adviser_id: '',
        minAvg: '85',
        maxAvg: ''
      });
      setTimeout(() => setSaved(false), 2500);
      if (warnings.length > 0) {
        showToast(
          'warning',
          `Section created. ${warnings.length} schedule note(s) — review in Edit. Example: ${warnings[0]}`
        );
      } else {
        showToast('success', 'Section created.');
      }
      fetchSections();
      fetchCoverage();
    } catch (err: any) {
      showToast(
        'error',
        err.detail?.error || err.message || 'Failed to create section'
      );
    }
  };

  const openEdit = (sec: SectionRow) => {
    setEditTarget(sec);
    setEditWarnings([]);
    setEditSubjects([]);
    setEditTeachers({});
    setEditForm({
      capacity: String(sec.capacity),
      adviser_id: sec.adviser_id ? String(sec.adviser_id) : '',
      minAvg: String(sec.min_average),
      maxAvg: sec.max_average ? String(sec.max_average) : ''
    });
    if (canEditTeachers && currentYear) {
      setEditTeachersLoading(true);
      getSectionTeachers(sec.id, currentYear.id)
        .then(resp => {
          setEditSubjects(resp.subjects);
          const d: TeacherDraft = {};
          resp.subjects.forEach(s => {
            if (s.teacher_ids.length > 0) d[s.id] = s.teacher_ids;
          });
          setEditTeachers(d);
        })
        .catch(() => {})
        .finally(() => setEditTeachersLoading(false));
    }
  };

  // R4 — apply the draft's teachers for one subject to other sections
  const openApply = (sub: SubjectTeachersRow | Pick<SubjectTeachersRow, 'id' | 'name' | 'subject_group' | 'program' | 'subject_type'>) => {
    if (!editTarget || !currentYear) return;
    const ids = editTeachers[sub.id] ?? [];
    if (ids.length === 0) return;
    const names = ids
      .map(tid => teachers.find(t => t.id === tid)?.name ?? `ID ${tid}`)
      .join(', ');
    setApplyTarget({
      subjectId: sub.id,
      name: sub.name,
      teacherIds: ids,
      teacherNames: names
    });
    // Default: the other active sections of the same grade level
    setApplyIds(
      sections
        .filter(s => s.id !== editTarget.id && s.grade_level === editTarget.grade_level)
        .map(s => s.id)
    );
  };

  const handleApply = async () => {
    if (!applyTarget || !currentYear || !editTarget) return;
    setApplyBusy(true);
    try {
      const resp = await applyTeachers({
        school_year_id: currentYear.id,
        subject_id: applyTarget.subjectId,
        teacher_ids: applyTarget.teacherIds,
        section_ids: applyIds
      });
      const skippedNote =
        resp.skipped.length > 0
          ? ` · ${resp.skipped.length} skipped (${resp.skipped
              .slice(0, 2)
              .map(s => {
                const nm = sections.find(x => x.id === s.section_id)?.name ?? `#${s.section_id}`;
                return `${nm}: ${s.reason}`;
              })
              .join('; ')}${resp.skipped.length > 2 ? '…' : ''})`
          : '';
      const warnNote = resp.warnings.length > 0 ? ` · ${resp.warnings.length} schedule note(s)` : '';
      showToast(
        resp.assigned.length > 0 ? 'success' : 'info',
        `"${applyTarget.name}": ${resp.assigned.length} section(s) updated${skippedNote}${warnNote}`
      );
      setApplyTarget(null);
      // The list may need a reload if apply touched other grade/track sections
      sectionsApi.list().then(setSections).catch(() => {});
      fetchCoverage();
    } catch (err: any) {
      showToast(
        'error',
        err.detail?.error || err.message || 'Failed to apply teachers to sections'
      );
    } finally {
      setApplyBusy(false);
    }
  };

  const editConflict = (): SectionRow | null => {
    if (!editTarget || !editForm.adviser_id) return null;
    return findAdviserConflict(
      editTarget.grade_level,
      editForm.adviser_id,
      editTarget.id
    );
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    const conflict = editConflict();
    if (conflict) {
      showToast(
        'error',
        `${getTeacherName(editForm.adviser_id)} is already assigned to "${conflict.name}" in Grade ${editTarget.grade_level}`
      );
      return;
    }
    try {
      const payload: UpdateSectionPayload = {
        capacity: parseInt(editForm.capacity),
        adviser_id: editForm.adviser_id ? parseInt(editForm.adviser_id) : null,
        min_average: parseInt(editForm.minAvg),
        max_average: editForm.maxAvg ? parseFloat(editForm.maxAvg) : null
      };
      // Full replace of the stored (section, subject) -> teacher rows.
      let warnings: string[] = [];
      if (currentYear) {
        const resp = await updateTeachers(editTarget.id, {
          school_year_id: currentYear.id,
          assignments: assignmentsFromDraft(editTeachers)
        });
        warnings = resp.warnings;
      }
      await sectionsApi.update(editTarget.id, payload);
      // R7 — schedule overlaps warn but never block the save
      if (warnings.length > 0) {
        setEditWarnings(warnings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        fetchSections();
        fetchCoverage();
        return; // keep the modal open so the notes are visible
      }
      setEditTarget(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      fetchSections();
      fetchCoverage();
    } catch (err: any) {
      showToast(
        'error',
        err.detail?.error || err.message || 'Failed to update section'
      );
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await sectionsApi.delete(id);
      setSections(prev => prev.filter(s => s.id !== id));
      setDeleteId(null);
      showToast('success', 'Section deleted.');
    } catch (err: any) {
      showToast(
        'error',
        err.detail?.error || err.message || 'Failed to delete section'
      );
    }
  };

  // R9 — administrator opt-in copy-forward from the previous school year
  const handleCopy = async () => {
    if (!prevYear || !currentYear) return;
    setCopyBusy(true);
    try {
      const resp = await copyPreviousYear({
        from_school_year_id: prevYear.id,
        to_school_year_id: currentYear.id,
        overwrite: copyOverwrite
      });
      showToast(
        resp.copied > 0 ? 'success' : 'info',
        resp.message ||
          `Copied ${resp.copied} assignment(s) across ${resp.sections_touched} section(s).` +
            (resp.sections_without_match && resp.sections_without_match.length > 0
              ? ` No match for: ${resp.sections_without_match.join(', ')}.`
              : '')
      );
      setShowCopy(false);
      fetchSections();
      fetchCoverage();
    } catch (err: any) {
      showToast(
        'error',
        err.detail?.error || err.message || 'Failed to copy assignments'
      );
    } finally {
      setCopyBusy(false);
    }
  };

  // R8 — missing-teacher count for a section row (null = cannot determine)
  const missingFor = (sec: SectionRow): number | null =>
    canViewCoverage && coverage[sec.id] !== undefined ? coverage[sec.id] : null;

  const byGrade = [7, 8, 9, 10, 11, 12].map(g => ({
    grade: g,
    sections: sections.filter(s => s.grade_level === g)
  }));

  const totalCapacity = sections.reduce((a, s) => a + s.capacity, 0);
  const totalEnrolled = sections.reduce((a, s) => a + s.current_count, 0);

  return (
    <div className="space-y-5 max-w-6xl mx-auto px-3 sm:px-0">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-400" />
        <div className="p-5 sm:p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-200 flex items-center justify-center flex-shrink-0">
              <Layers size={22} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">
                Section Creation & Management
              </h2>
              <p className="text-gray-500 text-sm">
                Create, configure, and manage class sections per grade level
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {saved && (
              <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                <CheckCircle size={14} /> Saved.
              </span>
            )}
            <button
              onClick={() => {
                setShowManageTypes(true);
                setTypesLoading(true);
                sectionTypesApi
                  .list()
                  .then(types => {
                    setSectionTypes(types);
                    setTypesLoading(false);
                  })
                  .catch(() => setTypesLoading(false));
              }}
              className="flex items-center justify-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all flex-1 sm:flex-none">
              <Palette size={15} /> Manage Types
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all flex-1 sm:flex-none">
              <Plus size={15} /> Create Section
            </button>
            {role === 'admin' && currentYear && prevYear && (
              <button
                onClick={() => {
                  setShowCopy(true);
                  setCopyOverwrite(false);
                }}
                title={`Copy subject-teacher assignments from ${prevYear.sy_label} into ${currentYear.sy_label}`}
                className="flex items-center justify-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all flex-1 sm:flex-none">
                <Copy size={15} /> Copy Teachers
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">
              Total Sections
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
              <Layers size={14} className="text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">
            {sections.length}
          </p>
          <p className="text-xs text-gray-400 mt-1">Across all grades</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">
              Total Capacity
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
              <Users size={14} className="text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">
            {totalCapacity}
          </p>
          <p className="text-xs text-gray-400 mt-1">Student slots available</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">
              Total Enrolled
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
              <GraduationCap size={14} className="text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">
            {totalEnrolled}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {totalCapacity > 0
              ? `${Math.round((totalEnrolled / totalCapacity) * 100)}% occupancy`
              : 'No sections'}
          </p>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg
              className="animate-spin w-5 h-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
          <p className="text-gray-400 text-sm font-medium">
            Loading sections...
          </p>
        </div>
      ) : (
        byGrade.map(({ grade, sections: gradeSections }) => (
          <div
            key={grade}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
              <div className="flex items-center gap-3">
                <span className="bg-blue-50 text-blue-700 text-[11px] font-bold px-3 py-1 rounded-full border border-blue-100">
                  Grade {grade}
                </span>
                <span className="text-xs text-gray-500 font-medium">
                  {gradeSections.length} section
                  {gradeSections.length !== 1 && 's'}
                </span>
              </div>
            </div>
            {gradeSections.length === 0 ? (
              <p className="text-xs text-gray-400 px-6 py-5">
                No sections created for Grade {grade} yet.
              </p>
            ) : (
              <HybridTable
                desktop={
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead className="bg-gray-50/80">
                        <tr>
                          {[
                            { label: 'Section', key: 'section' },
                            { label: 'Adviser', key: 'adviser' },
                            { label: 'Capacity', key: 'capacity' },
                            { label: 'Enrolled', key: 'enrolled' },
                            { label: 'Threshold', key: 'minAvg' },
                            { label: 'Occupancy', key: 'occupancy' },
                            { label: 'Actions', key: 'actions' }
                          ].map(col => (
                            <th
                              key={col.key}
                              className={`px-4 py-3.5 text-${col.key === 'capacity' || col.key === 'enrolled' || col.key === 'minAvg' || col.key === 'occupancy' ? 'center' : 'left'}`}>
                              <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                                {col.label}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="">
                        {gradeSections.map((sec, idx) => {
                          const pct = Math.round(
                            (sec.current_count / sec.capacity) * 100
                          );
                          return (
                            <tr
                              key={sec.id}
                              className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-blue-50/50 transition-colors duration-150`}>
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${getSectionColor(sec.section_type, sectionTypes, DEFAULT_SECTION_COLORS)}`}>
                                    {sec.name}
                                  </span>
                                  {(() => {
                                    const missing = missingFor(sec);
                                    return missing !== null && missing > 0 ? (
                                      <span
                                        className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1"
                                        title={`${missing} subject(s) in this section still have no teacher`}>
                                        <AlertTriangle size={10} /> {missing} no teacher
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
                              </td>
                              <td className="px-4 py-3.5">
                                {sec.adviser_name ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0 shadow-sm">
                                      {sec.adviser_name.charAt(0)}
                                    </div>
                                    <span className="text-sm text-gray-700 font-medium">
                                      {sec.adviser_name}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-gray-400">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-center font-medium text-gray-700">
                                {sec.capacity}
                              </td>
                              <td className="px-4 py-3.5 text-center font-bold text-blue-700">
                                {sec.current_count}
                              </td>
                              <td className="px-4 py-3.5 text-center text-xs text-gray-500 font-medium">
                                {sec.max_average
                                  ? `${sec.min_average} – ${sec.max_average}`
                                  : `${sec.min_average}+`}
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                    <div
                                      className={`h-1.5 rounded-full transition-all ${pct >= 95 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-500 font-medium">
                                    {pct}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => openEdit(sec)}
                                    className="text-blue-400 hover:text-blue-600 transition p-1.5 rounded-lg hover:bg-blue-50">
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => setDeleteId(sec.id)}
                                    className="text-red-400 hover:text-red-600 transition p-1.5 rounded-lg hover:bg-red-50">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                }
                mobile={
                  <ul className="">
                    {gradeSections.map(sec => {
                      const pct = Math.round(
                        (sec.current_count / sec.capacity) * 100
                      );
                      return (
                        <li key={sec.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${getSectionColor(sec.section_type, sectionTypes, DEFAULT_SECTION_COLORS)}`}>
                                  {sec.name}
                                </span>
                                {(() => {
                                  const missing = missingFor(sec);
                                  return missing !== null && missing > 0 ? (
                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1">
                                      <AlertTriangle size={10} /> {missing} no teacher
                                    </span>
                                  ) : null;
                                })()}
                                <span className="text-xs text-gray-400 font-medium">
                                  {sec.max_average
                                    ? `thresh ${sec.min_average} – ${sec.max_average}`
                                    : `${sec.min_average}+ min avg`}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                {sec.adviser_name ? (
                                  <>
                                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-600 text-[10px] font-bold flex-shrink-0">
                                      {sec.adviser_name.charAt(0)}
                                    </div>
                                    <span className="text-sm text-gray-700 font-medium truncate">
                                      Adviser: {sec.adviser_name}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-sm text-gray-400">
                                    No adviser assigned
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                <span>
                                  Capacity{' '}
                                  <strong className="text-gray-700">
                                    {sec.capacity}
                                  </strong>
                                </span>
                                <span>
                                  Enrolled{' '}
                                  <strong className="text-blue-700">
                                    {sec.current_count}
                                  </strong>
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <div className="w-24 bg-gray-100 rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full transition-all ${pct >= 95 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 font-medium">
                                  {pct}% occupancy
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => openEdit(sec)}
                                className="text-blue-400 hover:text-blue-600 transition p-2 rounded-lg hover:bg-blue-50 touch-target">
                                <Edit2 size={15} />
                              </button>
                              <button
                                onClick={() => setDeleteId(sec.id)}
                                className="text-red-400 hover:text-red-600 transition p-2 rounded-lg hover:bg-red-50 touch-target">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                }
              />
            )}
          </div>
        ))
      )}

      {/* ── Create Section Modal ── */}
      <ModalShell
        open={showForm}
        onClose={() => setShowForm(false)}
        maxWidth="max-w-xl"
        bodyClassName="p-0">
        <div className="px-6 py-5 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-400 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Layers size={18} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Create New Section</h3>
              <p className="text-blue-200 text-xs">
                Set up a new class section with its curriculum track and adviser
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(false)}
            className="p-2 hover:bg-white/10 rounded-lg text-white/80 transition">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                Grade Level
              </label>
              <select
                value={form.gradeLevel}
                onChange={e =>
                  setForm(p => ({ ...p, gradeLevel: e.target.value }))
                }
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400 bg-white">
                {[7, 8, 9, 10, 11, 12].map(g => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                Section Name
              </label>
              <input
                type="text"
                value={form.sectionName}
                onChange={e =>
                  setForm(p => ({ ...p, sectionName: e.target.value }))
                }
                placeholder="e.g. Mabini, Sampaguita"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                Curriculum Track
              </label>
              <select
                value={form.type}
                onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400 bg-white">
                {sectionTypes
                  .filter(t => t.is_active)
                  .map(t => (
                    <option key={t.name} value={t.name}>
                      {t.label || t.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                Capacity
              </label>
              <input
                type="number"
                value={form.capacity}
                onChange={e =>
                  setForm(p => ({ ...p, capacity: e.target.value }))
                }
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                Min. Average
              </label>
              <input
                type="number"
                value={form.minAvg}
                onChange={e => setForm(p => ({ ...p, minAvg: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                Max. Average <span className="text-gray-300">(optional)</span>
              </label>
              <input
                type="number"
                value={form.maxAvg}
                onChange={e => setForm(p => ({ ...p, maxAvg: e.target.value }))}
                placeholder="e.g. 100"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                Adviser (optional)
              </label>
              <TeacherSearch
                value={form.adviser_id}
                onChange={id => setForm(p => ({ ...p, adviser_id: id }))}
                teachers={teachers}
                placeholder="Search available teachers..."
                getConflict={teacherId => {
                  const c = findAdviserConflict(
                    parseInt(form.gradeLevel),
                    String(teacherId)
                  );
                  return c ? c.name : null;
                }}
              />
            </div>
            {canEditTeachers && currentYear && (
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em]">
                    Subject Teachers
                  </label>
                  <span className="text-[10px] text-gray-400">
                    Saved after the section is created
                  </span>
                </div>
                {catLoading ? (
                  <div className="border border-gray-100 rounded-xl px-4 py-5 text-center text-xs text-gray-400">
                    Loading subjects…
                  </div>
                ) : (
                  <SubjectTeacherRows
                    subjects={catRows}
                    draft={draft}
                    teachers={teachers}
                    onSet={(sid, ids) => setDraft(p => ({ ...p, [sid]: ids }))}
                  />
                )}
                <p className="text-[10px] text-gray-400 mt-1.5">
                  Elective subjects (NC II areas) are never listed here — their
                  teachers are assigned on the elective offering. Adding a
                  second teacher makes them co-teachers.
                </p>
              </div>
            )}
          </div>
          <div className="bg-blue-50/60 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
            Section:{' '}
            <strong>
              {form.gradeLevel}-{form.sectionName || '?'}
            </strong>{' '}
            · Track:{' '}
            <strong>
              {sectionTypes.find(t => t.name === form.type)?.label || form.type}
            </strong>{' '}
            · Capacity: <strong>{form.capacity}</strong> · Threshold:{' '}
            <strong>
              {form.maxAvg
                ? `${form.minAvg} – ${form.maxAvg}`
                : `${form.minAvg}+`}
            </strong>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50/50">
          <button
            onClick={() => setShowForm(false)}
            className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            onClick={handleAdd}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all">
            Create Section
          </button>
        </div>
      </ModalShell>

      {/* ── Edit Section Modal ── */}
      {editTarget !== null && (
        <ModalShell
          open
          onClose={() => setEditTarget(null)}
          maxWidth="max-w-xl"
          bodyClassName="p-0">
          <div className="px-6 py-5 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-400 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Edit2 size={18} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white">Edit Section</h3>
                <p className="text-blue-200 text-xs">
                  Editing:{' '}
                  <span className="font-semibold text-blue-100">
                    {editTarget.name}
                  </span>{' '}
                  · Grade {editTarget.grade_level} ·{' '}
                  {sectionTypes.find(t => t.name === editTarget.section_type)
                    ?.label || editTarget.section_type}
                </p>
              </div>
            </div>
            <button
              onClick={() => setEditTarget(null)}
              className="p-2 hover:bg-white/10 rounded-lg text-white/80 transition">
              <X size={18} />
            </button>
          </div>
          <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
            {editWarnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle size={12} /> Saved, with{' '}
                  {editWarnings.length} schedule note
                  {editWarnings.length !== 1 && 's'}:
                </p>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  {editWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                <p className="mt-1 opacity-80">
                  These notes never block saving — adjust the Master Schedule if
                  needed.
                </p>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                Adviser
              </label>
              <TeacherSearch
                value={editForm.adviser_id}
                onChange={id => setEditForm(p => ({ ...p, adviser_id: id }))}
                teachers={teachers}
                placeholder="Search available teachers..."
                getConflict={teacherId => {
                  if (!editTarget) return null;
                  const c = findAdviserConflict(
                    editTarget.grade_level,
                    String(teacherId),
                    editTarget.id
                  );
                  return c ? c.name : null;
                }}
              />
            </div>
            {canEditTeachers &&
              currentYear &&
              (() => (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em]">
                      Subject Teachers
                      <span className="ml-1 font-medium normal-case text-gray-400">
                        {currentYear.sy_label}
                      </span>
                    </label>
                    <span className="text-[10px] text-gray-400">
                      Co-teachers allowed · electives excluded
                    </span>
                  </div>
                  {editTeachersLoading ? (
                    <div className="border border-gray-100 rounded-xl px-4 py-5 text-center text-xs text-gray-400">
                      Loading assignments…
                    </div>
                  ) : (
                    <SubjectTeacherRows
                      subjects={editSubjects}
                      draft={editTeachers}
                      teachers={teachers}
                      onSet={(sid, ids) =>
                        setEditTeachers(p => ({ ...p, [sid]: ids }))
                      }
                      onApply={sub => openApply(sub)}
                    />
                  )}
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    “Apply to sections…” assigns these teachers to the same
                    subject in other sections (one save for all).
                  </p>
                </div>
              ))()}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                  Capacity
                </label>
                <input
                  type="number"
                  value={editForm.capacity}
                  onChange={e =>
                    setEditForm(p => ({ ...p, capacity: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                  Min. Average
                </label>
                <input
                  type="number"
                  value={editForm.minAvg}
                  onChange={e =>
                    setEditForm(p => ({ ...p, minAvg: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                  Max. Average <span className="text-gray-300">(optional)</span>
                </label>
                <input
                  type="number"
                  value={editForm.maxAvg}
                  onChange={e =>
                    setEditForm(p => ({ ...p, maxAvg: e.target.value }))
                  }
                  placeholder="e.g. 100"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400"
                />
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50/50">
            <button
              onClick={() => setEditTarget(null)}
              className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              onClick={handleEditSave}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all">
              Save Changes
            </button>
          </div>
        </ModalShell>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteId !== null && (
        <ModalShell
          open
          onClose={() => setDeleteId(null)}
          maxWidth="max-w-sm"
          bodyClassName="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle size={22} className="text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Delete Section</h3>
              <p className="text-gray-500 text-xs">This cannot be undone</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-5">
            Are you sure you want to delete this section? All student
            assignments to this section will be cleared.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteId(null)}
              className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              onClick={() => handleDelete(deleteId)}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all">
              Delete
            </button>
          </div>
        </ModalShell>
      )}

      {/* ── Apply Subject to Other Sections (R4) ── */}
      {applyTarget !== null && (
        <ModalShell
          open
          onClose={() => setApplyTarget(null)}
          maxWidth="max-w-md"
          bodyClassName="p-0">
          <div className="px-6 py-5 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-400 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Users size={18} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white">Apply to sections</h3>
                <p className="text-blue-200 text-xs truncate max-w-[16rem]">
                  {applyTarget.name} · {applyTarget.teacherNames}
                </p>
              </div>
            </div>
            <button
              onClick={() => setApplyTarget(null)}
              className="p-2 hover:bg-white/10 rounded-lg text-white/80 transition">
              <X size={18} />
            </button>
          </div>
          <div className="p-5 space-y-1.5 max-h-[50vh] overflow-y-auto">
            <p className="text-xs text-gray-500 mb-2">
              Pick the sections that will get this subject's teacher(s). Same
              grade sections are pre-ticked; mismatched grades/tracks are
              skipped by the server.
            </p>
            {sections
              .filter(s => s.id !== editTarget?.id)
              .map(s => (
                <label
                  key={s.id}
                  className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-gray-50 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyIds.includes(s.id)}
                    onChange={() =>
                      setApplyIds(prev =>
                        prev.includes(s.id)
                          ? prev.filter(i => i !== s.id)
                          : [...prev, s.id]
                      )
                    }
                    className="accent-blue-600 w-4 h-4"
                  />
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${getSectionColor(s.section_type, sectionTypes, DEFAULT_SECTION_COLORS)}`}>
                    {s.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    Grade {s.grade_level} · {s.section_type}
                  </span>
                </label>
              ))}
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50/50">
            <button
              onClick={() => setApplyTarget(null)}
              className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={applyBusy || applyIds.length === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all">
              Apply ({applyIds.length})
            </button>
          </div>
        </ModalShell>
      )}

      {/* ── Copy Teachers from Previous Year (R9, admin) ── */}
      {showCopy && currentYear && prevYear && (
        <ModalShell
          open
          onClose={() => setShowCopy(false)}
          maxWidth="max-w-sm"
          bodyClassName="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Copy size={22} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Copy Subject Teachers</h3>
              <p className="text-gray-500 text-xs">
                {prevYear.sy_label} → {currentYear.sy_label}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Copies every section's subject-teacher assignments from{' '}
            <strong>{prevYear.sy_label}</strong> into{' '}
            <strong>{currentYear.sy_label}</strong>. Advisers live on each
            section and are not part of this copy.
          </p>
          <label className="flex items-center gap-2.5 text-sm text-gray-700 mb-5 cursor-pointer">
            <input
              type="checkbox"
              checked={copyOverwrite}
              onChange={e => setCopyOverwrite(e.target.checked)}
              className="accent-blue-600 w-4 h-4"
            />
            Replace existing {currentYear.sy_label} assignments first
          </label>
          {copyOverwrite && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
              Existing {currentYear.sy_label} assignments will be deleted before
              copying.
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setShowCopy(false)}
              className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              onClick={handleCopy}
              disabled={copyBusy}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all">
              Copy
            </button>
          </div>
        </ModalShell>
      )}

      {/* ── Manage Types Modal ── */}
      <ModalShell
        open={showManageTypes}
        onClose={() => {
          setShowManageTypes(false);
          setTypeFormMode(null);
          setEditingType(null);
          setDeleteTypeId(null);
        }}
        maxWidth="max-w-2xl"
        bodyClassName="p-0">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-400 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Palette size={18} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Manage Section Types</h3>
              <p className="text-blue-200 text-xs">
                Add, edit, or remove section type definitions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setTypeFormMode('add');
                setTypeForm({
                  name: '',
                  label: '',
                  color_code: '',
                  icon: '',
                  sort_order: String(sectionTypes.length + 1)
                });
              }}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-2 rounded-xl text-xs font-semibold transition">
              <Plus size={13} /> Add Type
            </button>
            <button
              onClick={() => {
                setShowManageTypes(false);
                setTypeFormMode(null);
                setEditingType(null);
                setDeleteTypeId(null);
              }}
              className="p-2 hover:bg-white/10 rounded-lg text-white/80 transition">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {typesLoading ? (
            <div className="py-10 text-center">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg
                  className="animate-spin w-5 h-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </div>
              <p className="text-gray-400 text-sm">Loading section types...</p>
            </div>
          ) : sectionTypes.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">
              No section types defined yet.
            </div>
          ) : (
            <HybridTable
              desktop={
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-3 py-3 text-left">
                          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em]">
                            Name
                          </span>
                        </th>
                        <th className="px-3 py-3 text-left">
                          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em]">
                            Label
                          </span>
                        </th>
                        <th className="px-3 py-3 text-center">
                          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em]">
                            Order
                          </span>
                        </th>
                        <th className="px-3 py-3 text-center">
                          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em]">
                            Active
                          </span>
                        </th>
                        <th className="px-3 py-3 text-right">
                          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.06em]">
                            Actions
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="">
                      {sectionTypes.map(t => (
                        <tr
                          key={t.id}
                          className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${t.color_code || 'bg-gray-100 text-gray-600'}`}>
                                {t.icon && t.icon.length <= 2
                                  ? t.icon
                                  : t.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium text-gray-800">
                                {t.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-sm text-gray-600">
                            {t.label}
                          </td>
                          <td className="px-3 py-3.5 text-center text-sm text-gray-500">
                            {t.sort_order}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            {t.is_locked ? (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                <Lock size={10} /> Fixed
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${t.is_active ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-gray-400 bg-gray-50 border-gray-200'}`}>
                                {t.is_active ? 'Active' : 'Inactive'}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setEditingType(t);
                                  setTypeFormMode('edit');
                                  setTypeForm({
                                    name: t.name,
                                    label: t.label,
                                    color_code: t.color_code || '',
                                    icon: t.icon || '',
                                    sort_order: String(t.sort_order)
                                  });
                                }}
                                className="text-blue-400 hover:text-blue-600 transition p-1.5 rounded-lg hover:bg-blue-50">
                                <Edit2 size={13} />
                              </button>
                              {!t.is_locked && (
                                <button
                                  onClick={() => setDeleteTypeId(t)}
                                  className="text-red-400 hover:text-red-600 transition p-1.5 rounded-lg hover:bg-red-50">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
              mobile={
                <ul className="">
                  {sectionTypes.map(t => (
                    <li key={t.id} className="py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${t.color_code || 'bg-gray-100 text-gray-600'}`}>
                            {t.icon && t.icon.length <= 2
                              ? t.icon
                              : t.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {t.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {t.label}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => {
                              setEditingType(t);
                              setTypeFormMode('edit');
                              setTypeForm({
                                name: t.name,
                                label: t.label,
                                color_code: t.color_code || '',
                                icon: t.icon || '',
                                sort_order: String(t.sort_order)
                              });
                            }}
                            className="text-blue-400 hover:text-blue-600 transition p-2 rounded-lg hover:bg-blue-50 touch-target">
                            <Edit2 size={14} />
                          </button>
                          {!t.is_locked && (
                            <button
                              onClick={() => setDeleteTypeId(t)}
                              className="text-red-400 hover:text-red-600 transition p-2 rounded-lg hover:bg-red-50 touch-target">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 pl-1">
                        <span className="text-xs text-gray-400">
                          Order:{' '}
                          <strong className="text-gray-600">
                            {t.sort_order}
                          </strong>
                        </span>
                        {t.is_locked ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <Lock size={10} /> Fixed
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${t.is_active ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-gray-400 bg-gray-50 border-gray-200'}`}>
                            {t.is_active ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              }
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {sectionTypes.length} section type{sectionTypes.length !== 1 && 's'}{' '}
            defined
          </p>
          <button
            onClick={() => {
              setShowManageTypes(false);
              setTypeFormMode(null);
              setEditingType(null);
              setDeleteTypeId(null);
            }}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition">
            Close
          </button>
        </div>
      </ModalShell>

      {/* ── Add/Edit Section Type Form Modal ── */}
      <ModalShell
        open={typeFormMode !== null}
        onClose={() => {
          setTypeFormMode(null);
          setEditingType(null);
        }}
        maxWidth="max-w-md"
        bodyClassName="p-0">
        <div className="px-6 py-5 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-400 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Palette size={18} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">
                {typeFormMode === 'add'
                  ? 'Add Section Type'
                  : 'Edit Section Type'}
              </h3>
              <p className="text-blue-200 text-xs">
                {typeFormMode === 'add'
                  ? 'Create a new section type definition'
                  : `Editing: ${editingType?.name}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setTypeFormMode(null);
              setEditingType(null);
            }}
            className="p-2 hover:bg-white/10 rounded-lg text-white/80 transition">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          {typeFormMode === 'add' && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                Internal Name
              </label>
              <input
                type="text"
                value={typeForm.name}
                onChange={e =>
                  setTypeForm(p => ({
                    ...p,
                    name: e.target.value.replace(/[^a-z0-9_]/g, '')
                  }))
                }
                placeholder="e.g. ste, spfl, honors"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400"
              />
              <p className="text-xs text-gray-400 mt-1 lowercase tracking-wide">
                Used internally — only lowercase letters, numbers, underscores
              </p>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
              Display Label
            </label>
            <input
              type="text"
              value={typeForm.label}
              onChange={e =>
                setTypeForm(p => ({ ...p, label: e.target.value }))
              }
              placeholder="e.g. STE (Science & Technology)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
              Color Theme
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  value: 'bg-amber-100 text-amber-700 border-amber-200',
                  swatch: 'bg-amber-400',
                  label: 'Amber'
                },
                {
                  value: 'bg-blue-100 text-blue-700 border-blue-200',
                  swatch: 'bg-blue-400',
                  label: 'Blue'
                },
                {
                  value: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                  swatch: 'bg-yellow-400',
                  label: 'Yellow'
                },
                {
                  value: 'bg-slate-100 text-slate-700 border-slate-200',
                  swatch: 'bg-slate-400',
                  label: 'Slate'
                },
                {
                  value: 'bg-red-100 text-red-700 border-red-200',
                  swatch: 'bg-red-400',
                  label: 'Red'
                },
                {
                  value: 'bg-green-100 text-green-700 border-green-200',
                  swatch: 'bg-green-400',
                  label: 'Green'
                },
                {
                  value: 'bg-purple-100 text-purple-700 border-purple-200',
                  swatch: 'bg-purple-400',
                  label: 'Purple'
                },
                {
                  value: 'bg-teal-100 text-teal-700 border-teal-200',
                  swatch: 'bg-teal-400',
                  label: 'Teal'
                },
                {
                  value: 'bg-pink-100 text-pink-700 border-pink-200',
                  swatch: 'bg-pink-400',
                  label: 'Pink'
                },
                {
                  value: 'bg-orange-100 text-orange-700 border-orange-200',
                  swatch: 'bg-orange-400',
                  label: 'Orange'
                },
                {
                  value: 'bg-cyan-100 text-cyan-700 border-cyan-200',
                  swatch: 'bg-cyan-400',
                  label: 'Cyan'
                },
                {
                  value: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                  swatch: 'bg-emerald-400',
                  label: 'Emerald'
                },
                {
                  value: 'bg-violet-100 text-violet-700 border-violet-200',
                  swatch: 'bg-violet-400',
                  label: 'Violet'
                },
                {
                  value: 'bg-blue-100 text-blue-700 border-blue-200',
                  swatch: 'bg-blue-400',
                  label: 'Indigo'
                }
              ].map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() =>
                    setTypeForm(p => ({ ...p, color_code: c.value }))
                  }
                  title={c.label}
                  className={`w-10 h-10 rounded-xl border-2 transition-all ${c.swatch} ${
                    typeForm.color_code === c.value
                      ? 'border-gray-800 scale-110 shadow-md ring-2 ring-offset-1 ring-gray-800/20'
                      : 'border-transparent hover:scale-105 hover:shadow-sm'
                  }`}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-400">Selected:</span>
              {typeForm.color_code ? (
                <span
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${typeForm.color_code}`}>
                  Sample Badge
                </span>
              ) : (
                <span className="text-xs text-gray-400 italic">
                  None selected
                </span>
              )}
              {typeForm.color_code && (
                <button
                  onClick={() => setTypeForm(p => ({ ...p, color_code: '' }))}
                  className="touch-target inline-flex items-center text-[10px] text-gray-400 hover:text-red-500 underline ml-1">
                  Clear
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
              Icon
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                '🔬',
                '🌐',
                '📰',
                '📚',
                '📖',
                '⭐',
                '🏆',
                '🎯',
                '🎨',
                '🎵',
                '💻',
                '🔧',
                '🧪',
                '🎭',
                '🏅',
                '📝',
                '🎓',
                '🛡️',
                '⚡',
                '🌈',
                '🎪',
                '🌿',
                '📡',
                '🎼'
              ].map(icon => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setTypeForm(p => ({ ...p, icon }))}
                  className={`w-11 h-11 rounded-xl text-lg flex items-center justify-center transition-all border-2 ${
                    typeForm.icon === icon
                      ? 'border-blue-500 bg-blue-50 scale-110 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}>
                  {icon}
                </button>
              ))}
            </div>
            {typeForm.icon && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  Selected: <span className="text-lg">{typeForm.icon}</span>
                </span>
                <button
                  onClick={() => setTypeForm(p => ({ ...p, icon: '' }))}
                  className="touch-target inline-flex items-center text-[10px] text-gray-400 hover:text-red-500 underline">
                  Clear
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
              Sort Order
            </label>
            <input
              type="number"
              value={typeForm.sort_order}
              onChange={e =>
                setTypeForm(p => ({ ...p, sort_order: e.target.value }))
              }
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50/50">
          <button
            onClick={() => {
              setTypeFormMode(null);
              setEditingType(null);
            }}
            className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            onClick={async () => {
              try {
                if (typeFormMode === 'add') {
                  await sectionTypesApi.create({
                    name: typeForm.name,
                    label: typeForm.label,
                    color_code: typeForm.color_code || undefined,
                    icon: typeForm.icon || undefined,
                    sort_order: parseInt(typeForm.sort_order) || 0
                  });
                  showToast(
                    'success',
                    `Section type "${typeForm.name}" created.`
                  );
                } else if (editingType) {
                  await sectionTypesApi.update(editingType.id, {
                    label: typeForm.label,
                    color_code: typeForm.color_code || undefined,
                    icon: typeForm.icon || undefined,
                    sort_order: parseInt(typeForm.sort_order) || 0
                  });
                  showToast(
                    'success',
                    `Section type "${editingType.name}" updated.`
                  );
                }
                setTypeFormMode(null);
                setEditingType(null);
                const updated = await sectionTypesApi.list();
                setSectionTypes(updated);
              } catch (err: any) {
                showToast(
                  'error',
                  err.detail?.error ||
                    err.message ||
                    'Failed to save section type'
                );
              }
            }}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all"
            disabled={
              typeFormMode === 'add' && (!typeForm.name || !typeForm.label)
            }>
            {typeFormMode === 'add' ? 'Create Type' : 'Save Changes'}
          </button>
        </div>
      </ModalShell>

      {/* ── Delete Section Type Confirm Modal ── */}
      {deleteTypeId !== null && (
        <ModalShell
          open
          onClose={() => setDeleteTypeId(null)}
          maxWidth="max-w-sm"
          bodyClassName="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle size={22} className="text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Delete Section Type</h3>
              <p className="text-gray-500 text-xs">This cannot be undone</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-5">
            Are you sure you want to delete "
            {deleteTypeId.label || deleteTypeId.name}"? Existing sections using
            this type will not be affected but will show as unknown.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteTypeId(null)}
              className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              onClick={async () => {
                try {
                  await sectionTypesApi.delete(deleteTypeId.id);
                  showToast(
                    'success',
                    `Section type "${deleteTypeId.name}" deleted.`
                  );
                  setDeleteTypeId(null);
                  const updated = await sectionTypesApi.list();
                  setSectionTypes(updated);
                } catch (err: any) {
                  showToast(
                    'error',
                    err.detail?.error ||
                      err.message ||
                      'Failed to delete section type'
                  );
                }
              }}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all">
              Delete
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
