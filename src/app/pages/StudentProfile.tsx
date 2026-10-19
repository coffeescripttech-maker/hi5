import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft,
  User,
  BookOpen,
  BarChart2,
  ClipboardList,
  Layers,
  ClipboardEdit,
  Phone,
  MapPin,
  Calendar,
  ChevronRight,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Loader2,
  FileText,
  Info,
  AlertCircle,
  GraduationCap,
  Hash,
  Shield,
  Download,
  Clock,
  Award,
  IdCard,
  Mail,
  Globe,
  Star,
  Activity,
  ExternalLink,
  MoreHorizontal,
  CreditCard,
  BadgeCheck,
  Bookmark,
  Users,
  Target,
  Ruler,
  Weight,
  Pencil,
  Save,
  X
} from 'lucide-react';
import { studentsApi, StudentDetail } from '../services/students';
import {
  enrollmentsApi,
  EnrollmentRow,
  EnrollmentRequirementRow
} from '../services/enrollments';
import { gradesApi, GradeHistoryYear } from '../services/grades';
import { useApp } from '../context/AppContext';
import { useRoleAccent } from '../utils/roleTheme';
import { HybridTable } from '../components/HybridTable';

const TABS = [
  { id: 'personal', label: 'Personal Information', icon: User },
  { id: 'enrollment', label: 'Enrollment History', icon: BookOpen },
  { id: 'grades', label: 'Grade History', icon: BarChart2 },
  { id: 'documents', label: 'Document Checklist', icon: ClipboardList },
  { id: 'sections', label: 'Section History', icon: Layers }
];

/** Standard enrollment-requirement documents shown in the Student Profile checklist. */
const DOCUMENT_CHECKLIST = [
  { key: 'psa_birth_cert', label: 'PSA/NSO Birth Certificate' },
  { key: 'previous_grade_card', label: 'Previous Report Card / Form 138' },
  { key: 'good_moral', label: 'Good Moral Certificate' },
  { key: 'id_photo', label: '2 pcs. 2x2 ID Picture' },
  { key: 'medical_clearance', label: 'Medical/Dental Clearance' },
  { key: 'parent_consent', label: 'Parent/Guardian Consent Form' },
  { key: 'transcript', label: 'Transcript of Records / Form 137' },
  { key: 'lrn_verification', label: 'LRN Verification Slip' }
];

const STATUS_BADGE: Record<
  string,
  { bg: string; ring: string; label: string }
> = {
  enrolled: {
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
    ring: 'ring-emerald-500/20',
    label: 'Enrolled'
  },
  pending: {
    bg: 'bg-amber-50 text-amber-700 border-amber-200/50',
    ring: 'ring-amber-500/20',
    label: 'Pending'
  },
  dropped: {
    bg: 'bg-red-50 text-red-600 border-red-200/50',
    ring: 'ring-red-500/20',
    label: 'Dropped'
  },
  transferred: {
    bg: 'bg-blue-50 text-blue-700 border-blue-200/50',
    ring: 'ring-blue-500/20',
    label: 'Transferred'
  },
  graduated: {
    bg: 'bg-purple-50 text-purple-700 border-purple-200/50',
    ring: 'ring-purple-500/20',
    label: 'Graduated'
  },
  completed: {
    bg: 'bg-purple-50 text-purple-700 border-purple-200/50',
    ring: 'ring-purple-500/20',
    label: 'Completed'
  }
};

interface DetailRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
  highlight?: boolean;
  copyable?: boolean;
}

/**
 * Body Mass Index from the learner's measurements: BMI = weight(kg) / height(m)².
 * Always derived on the fly so the profile can never show a stale BMI after a
 * new height/weight reading is saved.
 */
function calcBmi(heightCm?: number | null, weightKg?: number | null): number | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
  return Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
}

/** Read-out band for the BMI value (adult WHO cut-offs). */
function bmiBand(bmi: number): { label: string; cls: string } {
  if (bmi < 18.5) return { label: 'Underweight', cls: 'bg-amber-50 text-amber-700 border-amber-200/60' };
  if (bmi < 25) return { label: 'Normal', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' };
  if (bmi < 30) return { label: 'Overweight', cls: 'bg-orange-50 text-orange-700 border-orange-200/60' };
  return { label: 'Obese', cls: 'bg-red-50 text-red-700 border-red-200/60' };
}

/** Student Profile — Document Checklist tab.
 *  Reads the current enrollment's required documents and lets authorized users
 *  (admin / registrar / enrollment committee) mark each as Submitted or Not
 *  Submitted. Committee verification is displayed read-only — it stays the
 *  committee dashboard's action. No file is uploaded from this page. */
function DocumentChecklist({
  enrollment,
  canEdit,
  showToast,
  accent
}: {
  enrollment: StudentDetail['enrollment'];
  canEdit: boolean;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  accent: ReturnType<typeof useRoleAccent>;
}) {
  const enrollmentId = enrollment?.id ?? null;
  const [rows, setRows] = useState<EnrollmentRequirementRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (enrollmentId == null) {
      setRows(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    enrollmentsApi
      .listRequirements(enrollmentId)
      .then(setRows)
      .catch(err =>
        showToast(
          'error',
          'Failed to load document checklist: ' +
            (err.detail?.error || err.message)
        )
      )
      .finally(() => setLoading(false));
  }, [enrollmentId, showToast]);

  useEffect(() => {
    reload();
  }, [reload]);

  const display = useMemo(() => {
    const base = DOCUMENT_CHECKLIST.map(d => ({
      key: d.key,
      label: d.label,
      rec: (rows ?? []).find(r => r.requirement_key === d.key)
    }));
    const extra = (rows ?? [])
      .filter(r => !DOCUMENT_CHECKLIST.some(d => d.key === r.requirement_key))
      .map(r => ({
        key: r.requirement_key,
        label: r.label || r.requirement_key,
        rec: r
      }));
    return [...base, ...extra];
  }, [rows]);

  const submittedCount = display.filter(d => !!d.rec?.is_submitted).length;
  const verifiedCount = display.filter(
    d => !!d.rec?.is_submitted && !!d.rec?.is_verified
  ).length;

  const fmtDate = (d?: string | null): string =>
    d
      ? new Date(d).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      : '';

  const toggle = async (key: string, label: string) => {
    if (enrollmentId == null || !canEdit) return;
    const rec = display.find(d => d.key === key)?.rec;
    const next = !rec?.is_submitted;
    setSavingKey(key);
    setRows(prev =>
      (prev ?? []).map(r =>
        r.requirement_key === key
          ? {
              ...r,
              is_submitted: next ? 1 : 0,
              submitted_at: next ? new Date().toISOString() : null,
              is_verified: next ? r.is_verified : 0
            }
          : r
      )
    );
    try {
      const updated = await enrollmentsApi.updateRequirements(enrollmentId, {
        requirements: [{ requirement_key: key, label, is_submitted: next }]
      });
      setRows(updated);
      showToast(
        'success',
        next ? 'Marked as Submitted' : 'Marked as Not Submitted'
      );
    } catch (err: any) {
      showToast(
        'error',
        err.detail?.error || err.message || 'Failed to update checklist.'
      );
      reload();
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div>
      {!enrollmentId ? (
        <div className="text-center py-16 bg-gray-50/50 rounded-xl border border-gray-100">
          <div
            className={`w-16 h-16 rounded-2xl ${accent.soft} flex items-center justify-center mx-auto mb-4`}>
            <ClipboardList size={32} className={`${accent.text} opacity-50`} />
          </div>
          <p className="text-gray-500 text-sm font-semibold mb-1">
            No enrollment to check
          </p>
          <p className="text-gray-400 text-xs max-w-sm mx-auto leading-relaxed">
            A document checklist appears once the student has an active
            enrollment with recorded requirements.
          </p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
          <Loader2 size={16} className="animate-spin" />
          Loading document checklist...
        </div>
      ) : (
        <>
          <div
            className={`px-4 py-3 rounded-xl border border-gray-100 ${accent.soft} mb-4`}>
            <div className="flex items-center justify-between text-xs font-semibold text-gray-600 mb-1.5">
              <span>
                {submittedCount} of {display.length} documents submitted
              </span>
              <span>{verifiedCount} verified</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/70 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${accent.gradient} transition-all duration-300`}
                style={{
                  width: `${
                    display.length ? (submittedCount / display.length) * 100 : 0
                  }%`
                }}
              />
            </div>
          </div>

          {canEdit && (
            <div className="flex items-start gap-2 px-1 mb-3 text-[11px] text-gray-400 leading-relaxed">
              <Info size={13} className="flex-shrink-0 mt-0.5" />
              <p>
                Mark each required document as Submitted or Not Submitted.
                Unmarking a document also removes its committee verification.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
            {display.map(({ key, label, rec }) => {
              const submitted = !!rec?.is_submitted;
              const verified = !!rec?.is_verified;
              return (
                <div
                  key={key}
                  className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2.5 sm:gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                    <FileText size={15} className="text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">
                      {label}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {submitted && rec?.submitted_at
                        ? `Submitted ${fmtDate(rec.submitted_at)}`
                        : 'Not yet recorded'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-auto flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border ${
                        submitted
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                          : 'bg-gray-50 text-gray-500 border-gray-200/80'
                      }`}>
                      {submitted ? (
                        <CheckCircle size={11} />
                      ) : (
                        <XCircle size={11} />
                      )}
                      {submitted ? 'Submitted' : 'Not Submitted'}
                    </span>
                    {verified && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border bg-blue-50 text-blue-700 border-blue-200/60">
                        <ShieldCheck size={11} /> Verified
                      </span>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        disabled={savingKey === key}
                        onClick={() => toggle(key, label)}
                        title={
                          submitted
                            ? 'Mark as Not Submitted'
                            : 'Mark as Submitted'
                        }
                        className={`touch-target inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                          submitted
                            ? 'text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100'
                            : 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                        } disabled:opacity-60 disabled:cursor-wait`}>
                        {savingKey === key && (
                          <Loader2 size={12} className="animate-spin" />
                        )}
                        {submitted ? 'Mark Not Submitted' : 'Mark Submitted'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast, role } = useApp();
  const accent = useRoleAccent();
  const [activeTab, setActiveTab] = useState('personal');
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [gradeHistory, setGradeHistory] = useState<GradeHistoryYear[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const studentId = parseInt(id);
    if (isNaN(studentId)) {
      showToast('error', 'Invalid student ID');
      navigate(-1);
      return;
    }
    setLoading(true);
    Promise.all([
      studentsApi.get(studentId),
      enrollmentsApi.list(),
      gradesApi.history(studentId)
    ])
      .then(([stud, enrs, hist]) => {
        setStudent(stud);
        setEnrollments(
          enrs
            .filter(e => e.student_id === studentId)
            .sort((a, b) => b.school_year_id - a.school_year_id)
        );
        setGradeHistory(hist.school_years);
      })
      .catch(err => {
        showToast(
          'error',
          'Failed to load student: ' + (err.detail?.error || err.message)
        );
        navigate(-1);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // ── helpers ──
  const getInitials = (name: string): string =>
    name
      .split(' ')
      .filter(Boolean)
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';

  /** Format an ISO date string (e.g. "2026-08-04T16:00:00.000Z") as "August 4, 2026" */
  const formatDate = (d?: string | null): string =>
    d
      ? new Date(d).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : '—';

  const getDescriptor = (
    val: number | null | undefined
  ): { label: string; color: string } => {
    const n = typeof val === 'string' ? parseFloat(val) : val;
    if (n == null || isNaN(n)) return { label: '—', color: 'text-gray-400' };
    if (n >= 90) return { label: 'Outstanding', color: 'text-green-600' };
    if (n >= 85) return { label: 'Very Satisfactory', color: 'text-blue-600' };
    if (n >= 80) return { label: 'Satisfactory', color: 'text-teal-600' };
    if (n >= 75)
      return { label: 'Fairly Satisfactory', color: 'text-yellow-600' };
    return { label: 'Did Not Meet Expectations', color: 'text-red-500' };
  };

  const statusBadge = student
    ? STATUS_BADGE[student.status] || {
        bg: 'bg-gray-50 text-gray-500 border-gray-200/50',
        ring: 'ring-gray-500/20',
        label: student.status
      }
    : null;

  // Only admin / registrar / enrollment committee may edit the document
  // checklist — this mirrors the backend PUT /enrollments/:id/requirements
  // permission. Other roles (teacher, principal) view it read-only.
  const canEditChecklist =
    role === 'admin' || role === 'registrar' || role === 'enrollment_committee';

  // Height/weight editing is limited to the roles allowed to PUT /students/:id.
  const canEditMeasurements = canEditChecklist;

  const [measureOpen, setMeasureOpen] = useState(false);
  const [mHeight, setMHeight] = useState('');
  const [mWeight, setMWeight] = useState('');
  const [savingMeasure, setSavingMeasure] = useState(false);

  // BMI is always recomputed from the current measurements (never stored), so
  // saving a new reading immediately reflects on the profile.
  const bmi = calcBmi(student?.height_cm, student?.weight_kg);
  const bmiInfo = bmi !== null ? bmiBand(bmi) : null;

  const openMeasurements = () => {
    setMHeight(student?.height_cm != null ? String(student.height_cm) : '');
    setMWeight(student?.weight_kg != null ? String(student.weight_kg) : '');
    setMeasureOpen(true);
  };

  const handleSaveMeasurements = async () => {
    if (!student) return;
    const h = parseFloat(mHeight);
    const w = parseFloat(mWeight);
    if (!Number.isFinite(h) || h < 30 || h > 250) {
      showToast('error', 'Enter a height between 30 and 250 cm.');
      return;
    }
    if (!Number.isFinite(w) || w < 5 || w > 300) {
      showToast('error', 'Enter a weight between 5 and 300 kg.');
      return;
    }
    setSavingMeasure(true);
    try {
      const updated = await studentsApi.update(student.id, {
        height_cm: h,
        weight_kg: w
      });
      // Merge the response but keep the values we just saved, so the BMI is
      // guaranteed to match the latest reading even if the API echoes an
      // older row.
      setStudent(prev =>
        prev ? { ...prev, ...updated, height_cm: h, weight_kg: w } : prev
      );
      setMeasureOpen(false);
      const recalculated = calcBmi(h, w)!;
      showToast(
        'success',
        `Measurements saved — BMI ${recalculated} (${bmiBand(recalculated).label}).`
      );
    } catch (err: any) {
      showToast(
        'error',
        err.detail?.error || err.message || 'Failed to update measurements.'
      );
    } finally {
      setSavingMeasure(false);
    }
  };

  // Graduation details for graduated students — the class year comes from the
  // SY they completed (e.g. "2030-2031" → Class of 2031).
  const graduation =
    student && student.status === 'graduated'
      ? (() => {
          const completed = [...enrollments]
            .sort((a, b) => b.school_year_id - a.school_year_id)
            .find(e => e.status === 'completed');
          const parts = String(completed?.sy_label || '').split(/[-–]/);
          const classYear = parts.length === 2 ? parts[1].trim() : '';
          return { syLabel: completed?.sy_label || '', classYear };
        })()
      : null;

  // Section history reads newest school year first (descending), matching the
  // enrollment records table so the most recent section is always on top.
  const sectionHistory = [...enrollments].sort(
    (a, b) => b.school_year_id - a.school_year_id
  );

  const DetailRow = ({
    icon: Icon,
    label,
    value,
    highlight,
    copyable
  }: DetailRowProps) => (
    <div className="group flex items-start gap-3 py-3 border-b border-gray-100 last:border-0 transition-colors hover:bg-gray-50/40 px-3 -mx-3 rounded-lg">
      <div className="w-8 h-8 rounded-lg bg-gray-100/70 group-hover:bg-white flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors">
        <Icon
          size={14}
          className="text-gray-400 group-hover:text-gray-500 transition-colors"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.05em]">
          {label}
        </p>
        <p
          className={`text-sm mt-0.5 ${highlight ? `font-bold ${accent.text}` : 'font-medium text-gray-800'}`}>
          {value || '—'}
        </p>
      </div>
      {copyable && value && value !== '—' && (
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value);
            showToast('success', 'Copied!');
          }}
          className="touch-target inline-flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-gray-200/60 rounded-md mt-0.5"
          aria-label={`Copy ${label}`}
          title="Copy">
          <CreditCard size={13} className="text-gray-400" />
        </button>
      )}
    </div>
  );

  // ── loading skeleton ──
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto w-full space-y-4 px-3 sm:space-y-5 sm:px-0">
        {/* skeleton header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
          <div className={`h-1.5 bg-gradient-to-r ${accent.gradient}`} />
          <div className="p-6 space-y-5">
            <div className="h-4 w-16 bg-gray-100 rounded-md" />
            <div className="flex items-start gap-5">
              <div className="w-20 h-20 rounded-2xl bg-gray-100" />
              <div className="flex-1 space-y-3 pt-1">
                <div className="h-6 w-48 bg-gray-100 rounded-lg" />
                <div className="h-4 w-36 bg-gray-50 rounded-md" />
                <div className="flex gap-2">
                  <div className="h-6 w-24 bg-gray-50 rounded-lg" />
                  <div className="h-6 w-20 bg-gray-50 rounded-lg" />
                  <div className="h-6 w-16 bg-gray-50 rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* skeleton tabs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
          <div className="flex gap-2 px-4 py-4 border-b border-gray-100">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-8 w-32 bg-gray-50 rounded-lg" />
            ))}
          </div>
          <div className="p-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="h-48 bg-gray-50 rounded-xl" />
            <div className="h-48 bg-gray-50 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // ── not found ──
  if (!student) {
    return (
      <div className="max-w-5xl mx-auto w-full px-3 sm:px-0">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-300" />
          </div>
          <p className="text-gray-500 text-base font-semibold">
            Student not found
          </p>
          <p className="text-gray-400 text-sm mt-1">
            The student record may have been removed or the link is invalid.
          </p>
          <button
            onClick={() => navigate(-1)}
            className={`mt-6 inline-flex items-center gap-1.5 text-sm font-semibold ${accent.text} hover:opacity-80 transition`}>
            <ArrowLeft size={14} /> Go back
          </button>
        </div>
      </div>
    );
  }

  // ── main ──
  return (
    <div className="max-w-5xl mx-auto w-full space-y-4 px-3 sm:space-y-5 sm:px-0 pb-10">
      {/* ────────── HERO CARD ────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow duration-200">
        <div className={`h-1.5 bg-gradient-to-r ${accent.gradient}`} />
        <div className="p-5 sm:p-7">
          <button
            onClick={() => navigate(-1)}
            className="group flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition mb-5">
            <ArrowLeft
              size={14}
              className="group-hover:-translate-x-0.5 transition-transform"
            />{' '}
            Back
          </button>

          <div className="flex flex-col sm:flex-row items-start gap-5 sm:gap-7">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br ${accent.tile} shadow-lg ${accent.tileShadow} flex items-center justify-center`}>
                <span className="text-white text-2xl sm:text-3xl font-black tracking-tight">
                  {getInitials(student.name)}
                </span>
              </div>
              {/* status dot */}
              <span
                className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white shadow-sm
                  ${student.status === 'enrolled' ? 'bg-emerald-500' : ''}
                  ${student.status === 'graduated' ? 'bg-purple-500' : ''}
                  ${student.status === 'pending' ? 'bg-amber-400' : ''}
                  ${student.status === 'dropped' ? 'bg-red-500' : ''}
                  ${student.status === 'transferred' ? 'bg-blue-500' : ''}
                `}
                title={statusBadge?.label || student.status}
              />
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 pt-1 w-full">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                    {student.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-gray-400 text-sm font-mono">
                      LRN: {student.lrn}
                    </p>
                    <span className="text-gray-200">·</span>
                    <p className="text-gray-400 text-sm font-mono">
                      ID: {student.student_id}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge && (
                    <span
                      className={`inline-flex self-start items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border shadow-sm ${statusBadge.bg}`}>
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${statusBadge.ring} bg-current`}
                      />
                      {statusBadge.label}
                    </span>
                  )}
                  {role === 'teacher' && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/teacher/grades?student_id=${student.id}`)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
                      title="Enter or edit this student's grades">
                      <ClipboardEdit size={12} /> Manage Grades
                    </button>
                  )}
                </div>
              </div>

              {/* Badge row */}
              <div className="flex flex-wrap gap-2 mt-4">
                {student.enrollment && student.status !== 'graduated' && (
                  <span
                    className={`inline-flex items-center gap-1.5 ${accent.chip} text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border shadow-xs`}>
                    <GraduationCap size={12} /> Grade {student.grade_level}
                  </span>
                )}

                {student.enrollment && student.status !== 'graduated' && (
                  <span
                    className={`inline-flex items-center gap-1.5 ${accent.chip} text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border shadow-xs`}>
                    <BookOpen size={12} /> {student.enrollment.section_name}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 ${accent.chip} text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border capitalize shadow-xs`}>
                  <User size={12} /> {student.sex}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ────────── GRADUATION BANNER ────────── */}
      {graduation && (
        <div className="bg-purple-50/60 border-2 border-purple-200 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center flex-shrink-0">
              <GraduationCap size={24} className="text-purple-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-purple-500">
                Graduate
              </p>
              <p className="text-lg font-bold text-purple-900 leading-tight">
                {graduation.classYear
                  ? `Class of ${graduation.classYear}`
                  : 'Graduated'}{' '}
                <span aria-hidden>🎓</span>
              </p>
              <p className="text-xs text-purple-700/80 mt-0.5 leading-relaxed">
                {student.name} completed Grade 12
                {graduation.syLabel ? ` in SY ${graduation.syLabel}` : ''} and
                has been marked as a graduate in the system.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-purple-200 text-purple-700 text-[11px] font-bold shadow-xs flex-shrink-0">
              <CheckCircle size={12} /> Graduated
            </span>
          </div>
        </div>
      )}

      {/* ────────── QUICK STATS ROW ────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            icon: GraduationCap,
            label: 'Grade Level',
            value:
              student.status === 'graduated'
                ? 'Graduated'
                : `Grade ${student.grade_level}`
          },
          {
            icon: BookOpen,
            label: 'Current Section',
            value:
              student.status === 'graduated'
                ? 'Graduated'
                : student.enrollment?.section_name || '—'
          },
          {
            icon: Calendar,
            label: 'Enrolled Date',
            value: formatDate(
              student.status === 'graduated'
                ? [...enrollments].find(e => e.status === 'completed')
                    ?.enrollment_date
                : student.enrollment?.enrollment_date
            )
          },
          {
            icon: Activity,
            label: 'Status',
            value: statusBadge?.label || student.status
          }
        ].map((stat, i) => {
          const statusTint =
            student.status === 'enrolled'
              ? 'from-emerald-50 to-green-50 border-emerald-200/50 text-emerald-700'
              : student.status === 'graduated'
                ? 'from-purple-50 to-purple-50 border-purple-200/50 text-purple-700'
                : student.status === 'pending'
                  ? 'from-amber-50 to-yellow-50 border-amber-200/50 text-amber-700'
                  : student.status === 'dropped'
                    ? 'from-red-50 to-red-50 border-red-200/50 text-red-600'
                    : 'from-gray-50 to-gray-50 border-gray-200/50 text-gray-600';
          const badgeColor =
            i === 3
              ? statusTint
              : i === 1 && student.status === 'graduated'
                ? 'from-purple-50 to-purple-50 border-purple-200/50 text-purple-700'
                : `${accent.soft} to-white border-gray-100/60 text-gray-800`;
          return (
            <div
              key={i}
              className={`bg-gradient-to-br ${badgeColor} rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-default`}>
              <div className="flex items-center gap-2 mb-1.5">
                <stat.icon size={14} className="opacity-70" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em] opacity-70">
                  {stat.label}
                </span>
              </div>
              <p className="text-base font-bold">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* ────────── TABS + CONTENT ────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow duration-200">
        {/* Tab bar */}
        <div className="border-b border-gray-100 overflow-x-auto overscroll-x-contain [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar]:bg-transparent [&::-webkit-scrollbar]:rounded-full [&::-webkit-scrollbar]:thumb:bg-gray-200">
          <div className="flex px-1 min-w-max">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex-none flex items-center gap-2 px-4 py-4 text-sm font-medium whitespace-nowrap transition-all duration-200 min-h-11 ${
                    active ? accent.text : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {/* background */}
                  <span
                    className={`absolute inset-0 transition-all duration-200 ${
                      active ? accent.soft : 'hover:bg-gray-50/60'
                    }`}
                  />
                  {/* active bottom bar */}
                  {active && (
                    <span
                      className={`absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r ${accent.gradient} rounded-full`}
                    />
                  )}
                  <Icon
                    size={15}
                    className={`relative ${active ? accent.text : 'text-gray-400'}`}
                  />
                  <span className="relative">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div className="p-5 sm:p-7">
          {/* ══════ PERSONAL INFO ══════ */}
          {activeTab === 'personal' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="bg-gradient-to-br from-gray-50/80 to-white border border-gray-100 rounded-xl overflow-hidden transition-shadow duration-200 hover:shadow-sm">
                <div className="flex items-center gap-2.5 px-5 pt-5 pb-3 border-b border-gray-100">
                  <div
                    className={`w-8 h-8 rounded-lg bg-gradient-to-br ${accent.softTile} flex items-center justify-center shadow-xs`}>
                    <User size={14} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">
                      Basic Information
                    </h4>
                    <p className="text-[10px] text-gray-400 font-medium">
                      Personal details and identifiers
                    </p>
                  </div>
                </div>
                <div className="p-3">
                  <DetailRow
                    icon={User}
                    label="Full Name"
                    value={student.name}
                  />
                  <DetailRow
                    icon={Hash}
                    label="Student ID"
                    value={student.student_id}
                    copyable
                  />
                  <DetailRow
                    icon={IdCard}
                    label="LRN"
                    value={student.lrn}
                    copyable
                  />
                  <DetailRow
                    icon={Calendar}
                    label="Date of Birth"
                    value={student.birthdate}
                  />
                  <DetailRow
                    icon={User}
                    label="Sex"
                    value={
                      student.sex.charAt(0).toUpperCase() + student.sex.slice(1)
                    }
                  />
                  <DetailRow
                    icon={GraduationCap}
                    label="Grade Level"
                    value={
                      student.status === 'graduated'
                        ? 'Graduated'
                        : `Grade ${student.grade_level}`
                    }
                    highlight
                  />
                </div>
              </div>

              {/* Contact Details */}
              <div className="bg-gradient-to-br from-gray-50/80 to-white border border-gray-100 rounded-xl overflow-hidden transition-shadow duration-200 hover:shadow-sm">
                <div className="flex items-center gap-2.5 px-5 pt-5 pb-3 border-b border-gray-100">
                  <div
                    className={`w-8 h-8 rounded-lg bg-gradient-to-br ${accent.softTile} flex items-center justify-center shadow-xs`}>
                    <Phone size={14} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">
                      Contact Details
                    </h4>
                    <p className="text-[10px] text-gray-400 font-medium">
                      Address and guardian information
                    </p>
                  </div>
                </div>
                <div className="p-3">
                  <DetailRow
                    icon={MapPin}
                    label="Address"
                    value={student.address || 'Not provided'}
                  />
                  <DetailRow
                    icon={User}
                    label="Guardian"
                    value={student.guardian || 'Not provided'}
                  />
                  <DetailRow
                    icon={Phone}
                    label="Contact No."
                    value={student.contact || 'Not provided'}
                  />
                  <DetailRow
                    icon={Shield}
                    label="Status"
                    value={statusBadge?.label || student.status}
                  />
                </div>
              </div>

              {/* Physical Measurements — height, weight and the BMI derived
                  from them. Updated whenever new readings are recorded. */}
              <div className="lg:col-span-2 bg-gradient-to-br from-gray-50/80 to-white border border-gray-100 rounded-xl overflow-hidden transition-shadow duration-200 hover:shadow-sm">
                <div className="flex items-center gap-2.5 px-5 pt-5 pb-3 border-b border-gray-100">
                  <div
                    className={`w-8 h-8 rounded-lg bg-gradient-to-br ${accent.softTile} flex items-center justify-center shadow-xs`}>
                    <Activity size={14} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">
                      Physical Measurements
                    </h4>
                    <p className="text-[10px] text-gray-400 font-medium">
                      Height, weight and auto-calculated BMI
                    </p>
                  </div>
                  {canEditMeasurements && !measureOpen && (
                    <button
                      type="button"
                      onClick={openMeasurements}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50">
                      <Pencil size={12} /> Update
                    </button>
                  )}
                </div>

                {measureOpen ? (
                  <div className="p-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-gray-400">
                          Height (cm)
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={30}
                          max={250}
                          step="0.1"
                          value={mHeight}
                          onChange={e => setMHeight(e.target.value)}
                          placeholder="e.g. 165"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-gray-400 focus:outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-gray-400">
                          Weight (kg)
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={5}
                          max={300}
                          step="0.1"
                          value={mWeight}
                          onChange={e => setMWeight(e.target.value)}
                          placeholder="e.g. 55"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-gray-400 focus:outline-none"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <div
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                          bmiInfo
                            ? bmiInfo.cls
                            : 'bg-gray-50 text-gray-500 border-gray-200/60'
                        }`}>
                        <Activity size={12} />
                        BMI {bmi ?? '—'}
                        {bmiInfo ? ` · ${bmiInfo.label}` : ''}
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMeasureOpen(false)}
                          disabled={savingMeasure}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50">
                          <X size={12} /> Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveMeasurements}
                          disabled={savingMeasure}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50 ${accent.button}`}>
                          {savingMeasure ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Save size={12} />
                          )}
                          {savingMeasure ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
                    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white/70 px-4 py-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100/70">
                        <Ruler size={14} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-gray-400">
                          Height
                        </p>
                        <p className="text-sm font-bold text-gray-800">
                          {student.height_cm != null
                            ? `${student.height_cm} cm`
                            : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white/70 px-4 py-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100/70">
                        <Weight size={14} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-gray-400">
                          Weight
                        </p>
                        <p className="text-sm font-bold text-gray-800">
                          {student.weight_kg != null
                            ? `${student.weight_kg} kg`
                            : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white/70 px-4 py-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100/70">
                        <Activity size={14} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-gray-400">
                          Body Mass Index
                        </p>
                        <p className="flex items-center gap-2 text-sm font-bold text-gray-800">
                          {bmi ?? '—'}
                          {bmiInfo && (
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${bmiInfo.cls}`}>
                              {bmiInfo.label}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════ ENROLLMENT HISTORY ══════ */}
          {activeTab === 'enrollment' && (
            <div>
              <div className="flex items-center gap-2.5 mb-6">
                <div
                  className={`w-8 h-8 rounded-lg bg-gradient-to-br ${accent.softTile} flex items-center justify-center`}>
                  <BookOpen size={14} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-800">
                    Enrollment Records
                  </h4>
                  <p className="text-[10px] text-gray-400 font-medium">
                    Historical enrollment across school years
                  </p>
                </div>
                <span
                  className={`ml-auto ${accent.chip} text-[11px] font-semibold px-2.5 py-1 rounded-full border shadow-xs`}>
                  {enrollments.length} record
                  {enrollments.length !== 1 ? 's' : ''}
                </span>
              </div>

              {enrollments.length === 0 ? (
                <div className="text-center py-16 bg-gray-50/50 rounded-xl border border-gray-100">
                  <div
                    className={`w-16 h-16 rounded-2xl ${accent.soft} flex items-center justify-center mx-auto mb-4`}>
                    <BookOpen
                      size={32}
                      className={`${accent.text} opacity-50`}
                    />
                  </div>
                  <p className="text-gray-500 text-sm font-semibold">
                    No enrollment records found
                  </p>
                  <p className="text-gray-400 text-xs mt-1 max-w-xs mx-auto leading-relaxed">
                    Enrollment history will appear once the student is enrolled
                    in a section.
                  </p>
                </div>
              ) : (
                <HybridTable
                  desktop={
                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                      <table className="w-full min-w-[600px]">
                        <thead>
                          <tr className="bg-gray-50/80">
                            {[
                              'School Year',
                              'Grade Level',
                              'Section',
                              'Program',
                              'Enrollment Date',
                              'Status'
                            ].map(h => (
                              <th
                                key={h}
                                className="text-left px-5 py-3.5 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em] border-b border-gray-100">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="">
                          {enrollments.map((e, idx) => {
                            const badge = STATUS_BADGE[e.status] || {
                              bg: 'bg-gray-50 text-gray-500 border-gray-200/50',
                              ring: '',
                              label: e.status
                            };
                            return (
                              <tr
                                key={e.id}
                                className={`transition-all duration-150 ${
                                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                                } hover:bg-gray-50 hover:shadow-xs`}>
                                <td className="px-5 py-4 font-semibold text-gray-800 text-sm">
                                  {e.sy_label}
                                </td>
                                <td className="px-5 py-4 text-gray-600 text-sm">
                                  Grade {e.section_grade_level ?? e.grade_level}
                                </td>
                                <td className="px-5 py-4 text-gray-600 text-sm font-medium">
                                  {e.section_name}
                                </td>
                                <td className="px-5 py-4">
                                  <span className="text-[11px] font-medium text-gray-500 capitalize bg-gray-100 px-2 py-0.5 rounded-md">
                                    {e.program || 'regular'}
                                  </span>
                                </td>
                                <td className="px-5 py-4 text-gray-500 text-sm">
                                  {formatDate(e.enrollment_date)}
                                </td>
                                <td className="px-5 py-4">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border capitalize ${badge.bg}`}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                    {badge.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  }
                  mobile={
                    <ul className="rounded-xl border border-gray-100 divide-y divide-gray-50">
                      {enrollments.map(e => {
                        const badge = STATUS_BADGE[e.status] || {
                          bg: 'bg-gray-50 text-gray-500 border-gray-200/50',
                          ring: '',
                          label: e.status
                        };
                        return (
                          <li key={e.id} className="px-4 py-3.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-bold text-gray-800">
                                {e.section_name || '—'}
                              </p>
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border capitalize flex-shrink-0 ${badge.bg}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                {badge.label}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              SY {e.sy_label} · Grade{' '}
                              {e.section_grade_level ?? e.grade_level}
                              {e.program && e.program !== 'regular'
                                ? ` · ${e.program}`
                                : ''}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {formatDate(e.enrollment_date)}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  }
                />
              )}
            </div>
          )}

          {/* ══════ GRADE HISTORY ══════ */}
          {activeTab === 'grades' && (
            <div>
              <div className="flex items-center gap-2.5 mb-6">
                <div
                  className={`w-8 h-8 rounded-lg bg-gradient-to-br ${accent.softTile} flex items-center justify-center`}>
                  <BarChart2 size={14} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-800">
                    Grade History
                  </h4>
                  <p className="text-[10px] text-gray-400 font-medium">
                    Academic performance records per subject
                  </p>
                </div>
                <span
                  className={`ml-auto ${accent.chip} text-[11px] font-semibold px-2.5 py-1 rounded-full border shadow-xs`}>
                  {gradeHistory.length} school{' '}
                  {gradeHistory.length !== 1 ? 'years' : 'year'}
                </span>
              </div>

              {gradeHistory.length === 0 ? (
                <div className="text-center py-16 bg-gradient-to-b from-gray-50/80 to-white rounded-xl border border-gray-100">
                  <div
                    className={`w-16 h-16 rounded-2xl ${accent.soft} flex items-center justify-center mx-auto mb-4 shadow-sm`}>
                    <BarChart2
                      size={32}
                      className={`${accent.text} opacity-50`}
                    />
                  </div>
                  <p className="text-gray-500 text-sm font-semibold mb-1">
                    No Grade Records Yet
                  </p>
                  <p className="text-gray-400 text-xs max-w-sm mx-auto leading-relaxed">
                    Grade records will appear here once teachers encode them in
                    the Grade Management module. Each subject will display the
                    final rating, equivalent descriptor, and school year.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {gradeHistory.map(sy => {
                    const syDesc = getDescriptor(sy.general_average);
                    return (
                      <div
                        key={sy.school_year_id}
                        className="rounded-xl border border-gray-100 overflow-hidden">
                        {/* School year header */}
                        <div
                          className={`flex flex-wrap items-center gap-3 px-5 py-4 ${accent.soft} border-b border-gray-100`}>
                          <div
                            className={`w-9 h-9 rounded-lg bg-gradient-to-br ${accent.softTile} flex items-center justify-center flex-shrink-0`}>
                            <Calendar size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 text-sm">
                              SY {sy.sy_label}
                            </p>
                            <p className="text-[11px] text-gray-500 font-medium">
                              {sy.grade_level != null
                                ? `Grade ${sy.grade_level}`
                                : ''}
                              {sy.section_name ? ` · ${sy.section_name}` : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.05em]">
                              General Average
                            </p>
                            {sy.general_average != null ? (
                              <p
                                className={`text-base font-bold ${syDesc.color}`}>
                                {sy.general_average}
                                <span className="block text-[10px] font-medium">
                                  {syDesc.label}
                                </span>
                              </p>
                            ) : (
                              <p className="text-base font-bold text-gray-400">
                                —
                              </p>
                            )}
                          </div>
                        </div>

                        {sy.subjects.length === 0 ? (
                          <p className="text-center text-gray-400 text-sm py-8">
                            No grades recorded for this school year yet.
                          </p>
                        ) : (
                          <HybridTable
                            desktop={
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[600px]">
                                  <thead>
                                    <tr className="bg-gray-50/80">
                                      {[
                                        'Subject',
                                        'Q1',
                                        'Q2',
                                        'Q3',
                                        'Final Rating',
                                        'Descriptor'
                                      ].map(h => (
                                        <th
                                          key={h}
                                          className="text-left px-4 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em] border-b border-gray-100">
                                          {h}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="">
                                    {sy.subjects.map(sub => {
                                      const desc = getDescriptor(
                                        sub.final_average
                                      );
                                      return (
                                        <tr
                                          key={`${sy.school_year_id}-${sub.subject_id}`}
                                          className="transition-colors hover:bg-gray-50">
                                          <td className="px-4 py-3 font-semibold text-gray-800 text-sm whitespace-nowrap">
                                            {sub.subject_name}
                                          </td>
                                          {[sub.q1, sub.q2, sub.q3].map(
                                            (q, qi) => (
                                              <td
                                                key={qi}
                                                className="px-4 py-3 text-gray-600 text-sm text-center">
                                                {q ?? '—'}
                                              </td>
                                            )
                                          )}
                                          <td
                                            className={`px-4 py-3 text-sm font-bold text-center ${sub.final_average != null ? desc.color : 'text-gray-400'}`}>
                                            {sub.final_average ?? '—'}
                                          </td>
                                          <td
                                            className={`px-4 py-3 text-sm font-medium ${desc.color}`}>
                                            {desc.label}
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
                                {sy.subjects.map(sub => {
                                  const desc = getDescriptor(sub.final_average);
                                  return (
                                    <li
                                      key={`${sy.school_year_id}-${sub.subject_id}`}
                                      className="px-4 py-3">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-gray-800 truncate">
                                          {sub.subject_name}
                                        </p>
                                        <span
                                          className={`text-sm font-bold flex-shrink-0 ${sub.final_average != null ? desc.color : 'text-gray-400'}`}>
                                          {sub.final_average ?? '—'}
                                        </span>
                                      </div>
                                      <p
                                        className={`text-[10px] font-medium mt-0.5 ${desc.color}`}>
                                        {desc.label}
                                      </p>
                                      <div className="grid grid-cols-3 gap-2 mt-1.5">
                                        {[sub.q1, sub.q2, sub.q3].map(
                                          (q, qi) => (
                                            <div
                                              key={qi}
                                              className="text-center rounded-lg bg-gray-50/80 border border-gray-100 py-1.5">
                                              <p className="text-[9px] font-semibold text-gray-400 uppercase">
                                                Q{qi + 1}
                                              </p>
                                              <p className="text-xs font-medium text-gray-700">
                                                {q ?? '—'}
                                              </p>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════ DOCUMENT CHECKLIST ══════ */}
          {activeTab === 'documents' && (
            <div>
              <div className="flex items-center gap-2.5 mb-6">
                <div
                  className={`w-8 h-8 rounded-lg bg-gradient-to-br ${accent.softTile} flex items-center justify-center`}>
                  <ClipboardList size={14} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-800">
                    Document Checklist
                  </h4>
                  <p className="text-[10px] text-gray-400 font-medium">
                    Required enrollment documents
                    {student.enrollment
                      ? ` for SY ${student.enrollment.sy_label}`
                      : ''}
                  </p>
                </div>
                {canEditChecklist && (
                  <span
                    className={`ml-auto ${accent.chip} text-[11px] font-semibold px-2.5 py-1.5 rounded-full border shadow-xs hidden sm:inline-flex items-center gap-1`}>
                    <ShieldCheck size={11} /> Editable
                  </span>
                )}
              </div>

              <DocumentChecklist
                enrollment={student.enrollment}
                canEdit={canEditChecklist}
                showToast={showToast}
                accent={accent}
              />
            </div>
          )}

          {/* ══════ SECTION HISTORY ══════ */}
          {activeTab === 'sections' && (
            <div>
              <div className="flex items-center gap-2.5 mb-6">
                <div
                  className={`w-8 h-8 rounded-lg bg-gradient-to-br ${accent.softTile} flex items-center justify-center`}>
                  <Layers size={14} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-800">
                    Section Assignment History
                  </h4>
                  <p className="text-[10px] text-gray-400 font-medium">
                    All sections the student has been assigned to
                  </p>
                </div>
                <span
                  className={`ml-auto ${accent.chip} text-[11px] font-semibold px-2.5 py-1 rounded-full border shadow-xs`}>
                  {enrollments.length} record
                  {enrollments.length !== 1 ? 's' : ''}
                </span>
              </div>

              {sectionHistory.length === 0 ? (
                <div className="text-center py-16 bg-gray-50/50 rounded-xl border border-gray-100">
                  <div
                    className={`w-16 h-16 rounded-2xl ${accent.soft} flex items-center justify-center mx-auto mb-4`}>
                    <Layers size={32} className={`${accent.text} opacity-50`} />
                  </div>
                  <p className="text-gray-500 text-sm font-semibold">
                    No section assignment records found
                  </p>
                  <p className="text-gray-400 text-xs mt-1 max-w-xs mx-auto leading-relaxed">
                    Section assignments will appear once the student is enrolled
                    in a section.
                  </p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div
                    className={`absolute left-6 top-3 bottom-3 w-0.5 bg-gradient-to-b ${accent.soft} to-white rounded-full hidden sm:block`}
                  />

                  <div className="space-y-4">
                    {sectionHistory.map((e, idx) => {
                      const badge = STATUS_BADGE[e.status] || {
                        bg: 'bg-gray-50 text-gray-500 border-gray-200/50',
                        ring: '',
                        label: e.status
                      };
                      const isEven = idx % 2 === 0;

                      return (
                        <div
                          key={e.id}
                          className={`relative flex gap-4 sm:gap-6 p-5 rounded-xl border ${accent.soft} border-gray-100 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}>
                          {/* Timeline dot (desktop) */}
                          <div
                            className={`hidden sm:flex w-12 h-12 rounded-xl bg-gradient-to-br ${accent.tile} shadow-lg ${accent.tileShadow} items-center justify-center flex-shrink-0 mt-0.5 text-white text-lg`}>
                            {isEven ? '🏫' : '📚'}
                          </div>

                          {/* Mobile icon */}
                          <div
                            className={`sm:hidden w-10 h-10 rounded-xl ${accent.softTile} flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm`}>
                            <span className="text-base">
                              {isEven ? '🏫' : '📚'}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-gray-900">
                                    {e.section_name}
                                  </p>
                                  <span className="hidden sm:inline text-gray-300">
                                    ·
                                  </span>
                                  <span className="text-xs font-medium text-gray-400">
                                    {e.program || 'Regular'}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1.5 text-sm text-gray-500">
                                  <span className="inline-flex items-center gap-1.5">
                                    <Calendar
                                      size={12}
                                      className="text-gray-400"
                                    />
                                    SY {e.sy_label}
                                  </span>
                                  <span className="inline-flex items-center gap-1.5">
                                    <GraduationCap
                                      size={12}
                                      className="text-gray-400"
                                    />
                                    Grade{' '}
                                    {e.section_grade_level ?? e.grade_level}
                                  </span>
                                  <span className="inline-flex items-center gap-1.5">
                                    <Clock
                                      size={12}
                                      className="text-gray-400"
                                    />
                                    {formatDate(e.enrollment_date)}
                                  </span>
                                </div>
                              </div>
                              <span
                                className={`inline-flex self-start items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border whitespace-nowrap shadow-xs ${badge.bg}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                {badge.label}
                              </span>
                            </div>
                            {e.remarks && (
                              <div className="mt-3 pt-3 border-t border-gray-200/50">
                                <p className="text-xs text-gray-400 italic flex items-start gap-1.5">
                                  <span className="font-medium text-gray-500 not-italic">
                                    Remarks:
                                  </span>
                                  {e.remarks}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
