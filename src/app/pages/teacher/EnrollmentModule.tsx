import React, { useState, useEffect, useRef } from 'react';
import {
  UserPlus,
  UserCheck,
  RefreshCw,
  Search,
  ChevronRight,
  Check,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  User,
  Users,
  UserX,
  MapPin,
  Phone,
  Clock,
  CalendarDays,
  BookOpen,
  FileText,
  X,
  UserMinus,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  studentsApi,
  StudentRow,
  CreateStudentPayload
} from '../../services/students';
import { enrollmentsApi, EnrollmentRow } from '../../services/enrollments';
import { strandTracksApi, StrandTrackRow } from '../../services/strandTracks';
import { schoolYearsApi } from '../../services/schoolYears';
import { sectionsApi, SectionRow } from '../../services/sections';
import { z } from 'zod';

// ── Zod Validation Schemas ──────────────────────────────────────────────

const newStudentSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .min(2, 'First name must be at least 2 characters'),
  middleName: z.string().optional(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .min(2, 'Last name must be at least 2 characters'),
  birthdate: z
    .string()
    .min(1, 'Birthdate is required')
    .refine(val => !isNaN(Date.parse(val)), 'Invalid date')
    .refine(
      val => new Date(val) <= new Date(),
      'Birthdate cannot be in the future'
    )
    .refine(val => {
      const age = Math.floor(
        (Date.now() - new Date(val).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
      return age <= 100;
    }, 'Invalid birthdate'),
  sex: z.string().min(1, 'Sex is required'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  lrn: z
    .string()
    .min(1, 'LRN is required')
    .regex(/^\d{12}$/, 'LRN must be exactly 12 digits'),
  guardian: z
    .string()
    .min(1, 'Guardian name is required')
    .min(2, 'Guardian name must be at least 2 characters'),
  contact: z
    .string()
    .min(1, 'Contact number is required')
    .regex(
      /^(09|\+639)\d{9}$/,
      'Enter a valid PH mobile number (e.g. 09123456789'
    )
});

const retSearchSchema = z.object({
  query: z.string().min(1, 'Enter an LRN or Student ID to search')
});

const dropReasonSchema = z.object({
  reason: z.string().min(1, 'Please select a reason for the drop or transfer')
});

// ── End Validation Schemas ──────────────────────────────────────────────

type Flow = 'select' | 'new' | 'returning' | 'drop';
type NewStep = 1 | 2 | 3 | 4 | 5;
type RetStep = 1 | 2 | 3 | 4;
type DropStep = 1 | 2 | 3;

const DROP_REASONS = [
  'Dropout — Family/Financial Reasons',
  'Dropout — Health Reasons',
  'Dropout — Relocation',
  'Transfer Out — To Another Public School',
  'Transfer Out — To Private School',
  'Transfer In — From Another School',
  'Other'
];

const GRADE_LEVELS = [7, 8, 9, 10, 11, 12];

const PROGRAMS = [
  {
    value: 'regular',
    label: 'Mainstream / Regular',
    desc: 'Standard DepEd Basic Education Curriculum',
    color: 'blue'
  },
  {
    value: 'ste',
    label: 'STE',
    desc: 'Science, Technology & Engineering',
    color: 'purple'
  },
  {
    value: 'spfl',
    label: 'SPFL',
    desc: 'Special Program in Foreign Language',
    color: 'teal'
  },
  {
    value: 'open_high',
    label: 'Open High School',
    desc: 'Flexible learning for independent study',
    color: 'amber'
  },
  {
    value: 'als_shs',
    label: 'ALS SHS',
    desc: 'Alternative Learning System',
    color: 'emerald'
  }
];

const PROGRAM_BADGES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  regular: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Mainstream' },
  ste: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'STE' },
  spfl: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'SPFL' },
  open_high: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Open High' },
  als_shs: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'ALS SHS' }
};

const REQUIREMENTS_LIST = [
  { key: 'psa_birth_cert', label: 'PSA/NSO Birth Certificate (photocopy)' },
  { key: 'previous_grade_card', label: 'Previous Report Card / Form 138' },
  { key: 'good_moral', label: 'Good Moral Certificate' },
  { key: 'id_photo', label: '2 pcs. 2x2 ID Picture' },
  { key: 'medical_clearance', label: 'Medical/Dental Clearance' },
  { key: 'parent_consent', label: 'Parent/Guardian Consent Form' },
  { key: 'transcript', label: 'Transcript of Records / Form 137' },
  { key: 'lrn_verification', label: 'LRN Verification Slip' }
];

const genStudentID = (grade: number) => {
  const yr = new Date().getFullYear() + 1;
  const g = String(grade).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `${yr}-${g}-${seq}`;
};

const getSection = (avg: number | null) => {
  if (avg === null) return 'Pending Section';
  if (avg >= 90) return 'Star Section';
  if (avg >= 85) return 'Gold Section';
  if (avg >= 80) return 'Silver Section';
  if (avg >= 75) return 'Regular Section';
  return 'Non-Reader Section';
};

export function EnrollmentModule() {
  const { showToast } = useApp();
  const [flow, setFlow] = useState<Flow>('select');

  // New student state
  const [newStep, setNewStep] = useState<NewStep>(1);
  const [newData, setNewData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    birthdate: '',
    sex: 'Female',
    address: '',
    lrn: '',
    guardian: '',
    contact: '',
    classifications: [] as string[]
  });
  const [newGrade, setNewGrade] = useState<number | null>(null);
  const [newStudentID, setNewStudentID] = useState('');
  const [enrolledNew, setEnrolledNew] = useState(false);
  const [newErrors, setNewErrors] = useState<Record<string, string>>({});
  const [enrolledSectionName, setEnrolledSectionName] = useState('');
  const [program, setProgram] = useState('regular');
  const [strandTracks, setStrandTracks] = useState<StrandTrackRow[]>([]);
  const [selectedStrandTrackId, setSelectedStrandTrackId] = useState<
    number | null
  >(null);
  const [requirements, setRequirements] = useState<Record<string, boolean>>({
    psa_birth_cert: false,
    previous_grade_card: false,
    good_moral: false,
    id_photo: false,
    medical_clearance: false,
    parent_consent: false,
    transcript: false,
    lrn_verification: false
  });
  const [gradeFile, setGradeFile] = useState<File | null>(null);

  // Returning student state
  const [retStep, setRetStep] = useState<RetStep>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [foundStudent, setFoundStudent] = useState<StudentRow | null>(null);
  const [retGrade, setRetGrade] = useState<number | null>(null);
  const [enrolledRet, setEnrolledRet] = useState(false);
  const [retErrors, setRetErrors] = useState<Record<string, string>>({});
  const [notFound, setNotFound] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Drop/Transfer state
  const [dropStep, setDropStep] = useState<DropStep>(1);
  const [dropSearch, setDropSearch] = useState('');
  const [dropFound, setDropFound] = useState<StudentRow | null>(null);
  const [dropNotFound, setDropNotFound] = useState(false);
  const [dropErrors, setDropErrors] = useState<Record<string, string>>({});
  const [dropReason, setDropReason] = useState('');
  const [dropRemarks, setDropRemarks] = useState('');
  const [dropDone, setDropDone] = useState(false);
  const [dropShowSuggestions, setDropShowSuggestions] = useState(false);
  const dropSearchRef = useRef<HTMLDivElement>(null);

  // API data state
  const [allStudents, setAllStudents] = useState<StudentRow[]>([]);
  const [allSections, setAllSections] = useState<SectionRow[]>([]);
  const [allEnrollments, setAllEnrollments] = useState<EnrollmentRow[]>([]);
  const [selectedSYId, setSelectedSYId] = useState<number>(1);
  const [currentSYLabel, setCurrentSYLabel] = useState('');
  const [enrollmentOpen, setEnrollmentOpen] = useState(true);

  // Fetch data on mount
  useEffect(() => {
    Promise.all([
      studentsApi.list(),
      sectionsApi.list(),
      schoolYearsApi.list(),
      enrollmentsApi.list()
    ])
      .then(([students, sections, years, enrollments]) => {
        setAllStudents(students);
        setAllSections(sections);
        setAllEnrollments(enrollments);
        const current = years.find(y => y.is_current === 1);
        if (current) {
          setSelectedSYId(current.id);
          setCurrentSYLabel(current.sy_label);
          setEnrollmentOpen(current.enrollment_open === 1);
        }
      })
      .catch(err => {
        showToast(
          'error',
          'Failed to load data: ' + (err.detail?.error || err.message)
        );
      });
  }, []);

  // Fetch strand tracks when new grade or ret grade changes
  useEffect(() => {
    const grade = newGrade || retGrade;
    if (!grade) return;
    setSelectedStrandTrackId(null);
    const trackType = grade >= 11 ? 'shs_strand' : 'tle';
    strandTracksApi
      .list({ track_type: trackType, grade_level: grade })
      .then(setStrandTracks)
      .catch(() => setStrandTracks([]));
  }, [newGrade, retGrade]);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (
        dropSearchRef.current &&
        !dropSearchRef.current.contains(e.target as Node)
      ) {
        setDropShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Compute suggestions from allStudents based on search query
  const q = searchQuery.trim().toLowerCase();
  const suggestions = q
    ? allStudents
        .filter(
          s =>
            s.lrn.includes(q) ||
            s.student_id.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q)
        )
        .slice(0, 8)
    : [];

  const dq = dropSearch.trim().toLowerCase();
  const dropSuggestions = dq
    ? allStudents
        .filter(
          s =>
            s.lrn.includes(dq) ||
            s.student_id.toLowerCase().includes(dq) ||
            s.name.toLowerCase().includes(dq)
        )
        .slice(0, 8)
    : [];

  const toggleClassification = (val: string) => {
    setNewData(d => ({
      ...d,
      classifications: d.classifications.includes(val)
        ? d.classifications.filter(c => c !== val)
        : [...d.classifications, val]
    }));
  };

  // ── Validation Helpers ─────────────────────────────────────
  const validateNewField = (field: string, value: string) => {
    const fieldSchema = z.object({
      firstName: z
        .string()
        .min(1, 'First name is required')
        .min(2, 'First name must be at least 2 characters'),
      middleName: z.string().optional(),
      lastName: z
        .string()
        .min(1, 'Last name is required')
        .min(2, 'Last name must be at least 2 characters'),
      birthdate: z
        .string()
        .min(1, 'Birthdate is required')
        .refine(val => !isNaN(Date.parse(val)), 'Invalid date')
        .refine(
          val => new Date(val) <= new Date(),
          'Birthdate cannot be in the future'
        ),
      sex: z.string().min(1, 'Sex is required'),
      address: z.string().min(5, 'Address must be at least 5 characters'),
      lrn: z
        .string()
        .min(1, 'LRN is required')
        .regex(/^\d{12}$/, 'LRN must be exactly 12 digits'),
      guardian: z
        .string()
        .min(1, 'Guardian name is required')
        .min(2, 'Guardian name must be at least 2 characters'),
      contact: z
        .string()
        .min(1, 'Contact number is required')
        .regex(
          /^(09|\+639)\d{9}$/,
          'Enter a valid PH mobile number (e.g. 09123456789)'
        ),
      classifications: z.array(z.string()).optional()
    });
    const result =
      fieldSchema.shape[field as keyof typeof fieldSchema.shape]?.safeParse(
        value
      );
    if (!result || result.success) {
      setNewErrors(prev => ({ ...prev, [field]: '' }));
    } else {
      const err = result.error as { issues: Array<{ message: string }> };
      setNewErrors(prev => ({
        ...prev,
        [field]: err.issues[0]?.message || ''
      }));
    }
  };

  const validateNewStep1 = (): boolean => {
    const result = newStudentSchema.safeParse({
      ...newData,
      middleName: newData.middleName || undefined
    });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((issue: any) => {
        const path = issue.path[0] as string;
        if (!errs[path]) errs[path] = issue.message;
      });
      setNewErrors(errs);
      return false;
    }
    setNewErrors({});
    return true;
  };

  const updateNewField = (field: string, value: string) => {
    setNewData(d => ({ ...d, [field]: value }));
    validateNewField(field, value);
  };

  const clearNewError = (field: string) => {
    setNewErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleNewNext = () => {
    if (newStep === 1 && !validateNewStep1()) return;
    if (newStep === 2 && !newGrade) return;
    if (newStep === 3) {
      setNewStudentID(genStudentID(newGrade!));
    }
    if (newStep < 5) {
      setNewStep((newStep + 1) as NewStep);
    }
  };

  const handleNewBack = () => {
    setNewErrors({});
    setNewStep((newStep - 1) as NewStep);
  };

  const handleSearch = async () => {
    // Validate search query
    const result = retSearchSchema.safeParse({ query: searchQuery });
    if (!result.success) {
      setRetErrors({ query: 'Enter an LRN or Student ID to search' });
      return;
    }
    setRetErrors({});
    try {
      const students = await studentsApi.list({ search: searchQuery });
      if (students.length > 0) {
        setFoundStudent(students[0]);
        setNotFound(false);
        setRetStep(2);
        // Clear any grade picked for a previously searched student so the
        // validation for the new student always starts from a clean slate.
        setRetGrade(null);
      } else {
        setNotFound(true);
      }
    } catch {
      showToast('error', 'Search failed. Please try again.');
    }
  };

  // Grade the student completed before this enrollment — shown as "Previous Grade"
  // on returning enrollment. students.grade_level reflects the CURRENT grade (e.g. 8
  // after promotion), so derive the completed grade from the student's enrollment
  // history and the grade level of the section they were in:
  //   1. the most recent enrollment in a PRIOR school year (normal re-enrollment), or
  //   2. the latest enrollment's section grade when it lags the current grade level
  //      (promotion recorded within the same school year), or
  //   3. the student's current grade level as a last resort.
  const prevGradeLevel = (() => {
    if (!foundStudent) return null;
    const sectionGrade = (enr: EnrollmentRow) =>
      allSections.find(s => s.id === enr.section_id)?.grade_level;
    const sorted = [...allEnrollments]
      .filter(e => e.student_id === foundStudent.id)
      .sort((a, b) => b.school_year_id - a.school_year_id || b.id - a.id);
    const prior = sorted.find(e => e.school_year_id !== selectedSYId);
    if (prior) {
      const g = sectionGrade(prior);
      if (g) return g;
    }
    const latest = sorted[0];
    if (latest) {
      const g = sectionGrade(latest);
      if (g && g < foundStudent.grade_level) return g;
    }
    return foundStudent.grade_level;
  })();

  // Data-integrity guard for the returning flow's grade selection: a student who
  // completed Grade N may only be enrolled in Grade N (retained/repeating) or Grade
  // N+1 (the normal next level) — never a grade they skipped or moved back to.
  const allowedRetGrades = (() => {
    if (prevGradeLevel == null) return GRADE_LEVELS;
    const allowed = new Set<number>();
    if (prevGradeLevel >= 7 && prevGradeLevel <= 12)
      allowed.add(prevGradeLevel); // retained / repeating
    if (prevGradeLevel >= 7 && prevGradeLevel < 12)
      allowed.add(prevGradeLevel + 1); // next level
    return GRADE_LEVELS.filter(g => allowed.has(g));
  })();
  const recommendedRetGrade =
    prevGradeLevel != null && prevGradeLevel < 12 ? prevGradeLevel + 1 : null;
  const completedGrade12 = prevGradeLevel === 12;

  // A student can only have one enrollment per school year (DB unique key). If they
  // already have one in the school year this flow targets (the current SY), the
  // confirm step would fail with a duplicate-enrollment error — surface that early
  // with guidance instead of letting the API throw a raw error.
  const alreadyEnrolledThisSY =
    foundStudent != null &&
    allEnrollments.some(
      e => e.student_id === foundStudent.id && e.school_year_id === selectedSYId
    );

  const handleRetNext = () => {
    if (retStep === 3) {
      // Block advancing unless a grade that is valid for this student is selected
      if (retGrade != null && allowedRetGrades.includes(retGrade))
        setRetStep(4);
      return;
    }
    if (retStep < 4) setRetStep((retStep + 1) as RetStep);
  };

  const resetAll = () => {
    setFlow('select');
    setNewStep(1);
    setNewData({
      firstName: '',
      middleName: '',
      lastName: '',
      birthdate: '',
      sex: 'Female',
      address: '',
      lrn: '',
      guardian: '',
      contact: '',
      classifications: []
    });
    setNewGrade(null);
    setNewStudentID('');
    setGradeFile(null);
    setEnrolledNew(false);
    setNewErrors({});
    setEnrolledSectionName('');
    setProgram('regular');
    setSelectedStrandTrackId(null);
    setStrandTracks([]);
    setRequirements({
      psa_birth_cert: false,
      previous_grade_card: false,
      good_moral: false,
      id_photo: false,
      medical_clearance: false,
      parent_consent: false,
      transcript: false,
      lrn_verification: false
    });
    setRetStep(1);
    setRetErrors({});
    setSearchQuery('');
    setFoundStudent(null);
    setRetGrade(null);
    setEnrolledRet(false);
    setNotFound(false);
    setShowSuggestions(false);
    setDropStep(1);
    setDropSearch('');
    setDropFound(null);
    setDropNotFound(false);
    setDropErrors({});
    setDropReason('');
    setDropRemarks('');
    setDropDone(false);
    setDropShowSuggestions(false);
  };

  const handleDropSearch = async () => {
    if (!dropSearch.trim()) {
      setDropErrors({ search: 'Enter an LRN or Student ID' });
      return;
    }
    setDropErrors({});
    try {
      const students = await studentsApi.list({ search: dropSearch });
      if (students.length > 0) {
        setDropFound(students[0]);
        setDropNotFound(false);
        setDropStep(2);
      } else {
        setDropNotFound(true);
      }
    } catch {
      showToast('error', 'Search failed. Please try again.');
    }
  };

  const handleConfirmNewEnrollment = async () => {
    if (!newGrade) return;
    try {
      const fullName = [newData.firstName, newData.middleName, newData.lastName]
        .filter(Boolean)
        .join(' ');
      const created = await studentsApi.create({
        student_id: newStudentID,
        lrn: newData.lrn,
        name: fullName,
        grade_level: newGrade,
        sex: newData.sex.toLowerCase() as 'male' | 'female',
        birthdate: newData.birthdate,
        address: newData.address || undefined,
        guardian: newData.guardian || undefined,
        contact: newData.contact || undefined
      });
      // Enroll without section — student goes to Pending Section Queue
      await enrollmentsApi.create({
        student_id: created.id,
        school_year_id: selectedSYId,
        enrollment_date: new Date().toISOString().split('T')[0],
        program: program,
        strand_track_id: selectedStrandTrackId || undefined,
        requirements: REQUIREMENTS_LIST.map(r => ({
          requirement_key: r.key,
          label: r.label,
          is_submitted: requirements[r.key]
        }))
      });
      setEnrolledSectionName('Pending Section');
      // Add classifications (batch)
      if (newData.classifications.length > 0) {
        const clsMap: Record<string, string> = {
          '4Ps Beneficiary': '4ps',
          PWD: 'pwd',
          Transferee: 'transferee',
          'Non-Reader': 'non_reader'
        };
        try {
          await studentsApi.addClassification(created.id, {
            classifications: newData.classifications.map(
              c => clsMap[c] || 'regular'
            ),
            school_year_id: selectedSYId
          });
        } catch {
          /* skip if classification fails — not critical */
        }
      }
      setEnrolledNew(true);
    } catch (err: any) {
      showToast(
        'error',
        err.detail?.error || err.message || 'Failed to enroll student'
      );
    }
  };

  const handleConfirmReturning = async () => {
    if (!foundStudent || !retGrade) return;
    // A student can only be enrolled once per school year — the returned student
    // must be moved into the NEXT school year, not re-enrolled in the current one.
    if (alreadyEnrolledThisSY) {
      showToast(
        'error',
        `${foundStudent.name} is already enrolled for school year ${currentSYLabel}. This flow enrolls into the current school year — create the next school year and set it as current (Admin → Academic Year Mgmt.), or use Bulk Promotion to move this student forward.`
      );
      return;
    }
    // Last-line data-integrity guard: never enroll into a grade the student
    // hasn't reached (previous grade + 1) or is repeating (same grade).
    if (prevGradeLevel != null && !allowedRetGrades.includes(retGrade)) {
      showToast(
        'error',
        `Grade ${retGrade} is not a valid level for this student (previous grade: Grade ${prevGradeLevel}).`
      );
      return;
    }
    try {
      // Promote student to new grade level first
      await studentsApi.update(foundStudent.id, {
        grade_level: retGrade,
        status: 'enrolled'
      });
      // Enroll without section — goes to Pending Section Queue
      await enrollmentsApi.create({
        student_id: foundStudent.id,
        school_year_id: selectedSYId,
        enrollment_date: new Date().toISOString().split('T')[0],
        program: program,
        strand_track_id: selectedStrandTrackId || undefined
      });
      setEnrolledSectionName('Pending Section');
      setEnrolledRet(true);
    } catch (err: any) {
      showToast(
        'error',
        err.detail?.error || err.message || 'Failed to re-enroll student'
      );
    }
  };

  const handleConfirmDrop = async () => {
    if (!dropFound) return;
    try {
      const isTransferIn = dropReason.includes('Transfer In');
      const isTransfer = dropReason.includes('Transfer');
      const lbl = isTransferIn
        ? 'Transfer In'
        : isTransfer
          ? 'Transfer Out'
          : 'Dropout';
      const newStatus = isTransferIn
        ? 'transferred'
        : isTransfer
          ? 'transferred'
          : 'dropped';

      // Find the student's current enrollment for this school year
      const enrollment = allEnrollments.find(
        e =>
          e.student_id === dropFound.id &&
          e.school_year_id === selectedSYId &&
          e.status === 'enrolled'
      );
      if (enrollment) {
        await enrollmentsApi.update(enrollment.id, {
          status: newStatus as 'dropped' | 'transferred',
          remarks: dropRemarks || `${lbl}: ${dropReason}`
        });
      } else {
        // Fallback: just update the student record
        await studentsApi.update(dropFound.id, {
          status: newStatus as 'dropped' | 'transferred'
        });
      }

      showToast('success', `${lbl} processed for ${dropFound.name}.`);
      setDropDone(true);
    } catch (err: any) {
      showToast(
        'error',
        err.detail?.error || err.message || 'Failed to process drop/transfer'
      );
    }
  };

  // ── FLOW SELECT ──────────────────────────────────────────
  if (flow === 'select') {
    // Derived stats for the landing dashboard (current SY only)
    const syEnrollments = allEnrollments.filter(
      e => e.school_year_id === selectedSYId
    );
    const enrolledCount = syEnrollments.filter(
      e => e.status === 'enrolled'
    ).length;
    const pendingCount = syEnrollments.filter(
      e => e.status === 'enrolled' && !e.section_id
    ).length;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = syEnrollments.filter(
      e => e.enrollment_date === todayStr
    ).length;
    const closedCount = syEnrollments.filter(
      e => e.status === 'dropped' || e.status === 'transferred'
    ).length;
    const recentEnrollments = [...syEnrollments]
      .sort(
        (a, b) =>
          (b.enrollment_date || '').localeCompare(a.enrollment_date || '') ||
          b.id - a.id
      )
      .slice(0, 6);

    const statCards = [
      {
        label: 'Total Enrolled',
        value: enrolledCount,
        icon: UserCheck,
        iconWrap: 'bg-emerald-50 ring-emerald-100/70',
        iconCls: 'text-emerald-600',
        hint: 'this school year'
      },
      {
        label: 'Pending Section',
        value: pendingCount,
        icon: Users,
        iconWrap: 'bg-amber-50 ring-amber-100/70',
        iconCls: 'text-amber-600',
        hint: 'awaiting sectioning'
      },
      {
        label: 'Enrolled Today',
        value: todayCount,
        icon: Clock,
        iconWrap: 'bg-emerald-50 ring-emerald-100/70',
        iconCls: 'text-emerald-600',
        hint: todayStr
      },
      {
        label: 'Drop / Transfer',
        value: closedCount,
        icon: UserX,
        iconWrap: 'bg-red-50 ring-red-100/70',
        iconCls: 'text-red-600',
        hint: 'this school year'
      }
    ];

    const flowCards = [
      {
        key: 'new',
        flow: 'new' as Flow,
        code: 'NEW',
        title: 'Enroll New Student',
        subtitle: 'First-time enrollees · Grades 7–12',
        desc: 'Complete data entry for new students with auto-generated Student ID and placement in the pending section queue.',
        icon: UserPlus,
        iconCls: 'text-emerald-600',
        bandBg: 'bg-emerald-50',
        cardBorder: 'border-emerald-200',
        badge: 'bg-emerald-100 text-emerald-700',
        accent: 'text-emerald-600',
        statusOpen: '✓ Open',
        statusClosed: 'Closed',
        statusCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        action: 'Start Enrollment',
        disabled: !enrollmentOpen
      },
      {
        key: 'returning',
        flow: 'returning' as Flow,
        code: 'RETURN',
        title: 'Enroll Returning Student',
        subtitle: 'Re-enrollment · Grades 7–12',
        desc: 'Search by LRN or Student ID to auto-populate existing records, then promote the student to their new grade level.',
        icon: RefreshCw,
        iconCls: 'text-emerald-600',
        bandBg: 'bg-emerald-50',
        cardBorder: 'border-emerald-200',
        badge: 'bg-emerald-100 text-emerald-700',
        accent: 'text-emerald-600',
        statusOpen: '✓ Open',
        statusClosed: 'Closed',
        statusCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        action: 'Search Student',
        disabled: !enrollmentOpen
      },
      {
        key: 'drop',
        flow: 'drop' as Flow,
        code: 'DROP',
        title: 'Student Drop / Transfer',
        subtitle: 'Status management · All grades',
        desc: 'Process dropout or school transfer with official reason documentation. Academic records are preserved for SF10.',
        icon: UserMinus,
        iconCls: 'text-red-500',
        bandBg: 'bg-red-50',
        cardBorder: 'border-red-200',
        badge: 'bg-red-100 text-red-700',
        accent: 'text-red-500',
        statusOpen: '✓ Available',
        statusClosed: '✓ Available',
        statusCls: 'bg-red-50 text-red-600 border-red-200',
        action: 'Process Request',
        disabled: false
      }
    ];

    return (
      <div className="space-y-6 max-w-8xl mx-auto">
        {/* Header hero */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500" />
          <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-200/60">
              <UserCheck size={22} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900 tracking-[-0.01em]">
                  Enrollment Module
                </h2>
                {enrollmentOpen ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Open
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 ring-1 ring-red-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    Closed
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-sm mt-1">
                Manage student enrollment, re-enrollment, and drop/transfer
                processing
              </p>
            </div>
            {currentSYLabel && (
              <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-50 border border-gray-100 flex-shrink-0">
                <CalendarDays size={14} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-500">
                  SY {currentSYLabel}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Enrollment closed banner */}
        {!enrollmentOpen && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <Lock size={20} className="text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-red-800 text-sm">
                Enrollment is currently CLOSED
              </p>
              <p className="text-red-600 text-xs mt-0.5 leading-relaxed">
                New enrollments and returning student enrollments are disabled
                while enrollment is closed. You may still process student
                drop/transfer requests.
              </p>
            </div>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map(s => (
            <div
              key={s.label}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3.5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div
                className={`w-10 h-10 rounded-xl ring-1 flex items-center justify-center flex-shrink-0 ${s.iconWrap}`}>
                <s.icon size={18} className={s.iconCls} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.05em] truncate">
                  {s.label}
                </p>
                <p className="text-xl font-bold text-gray-900 leading-tight">
                  {s.value}
                </p>
                <p className="text-[10px] text-gray-400 truncate">{s.hint}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Flow cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {flowCards.map(card => (
            <button
              key={card.key}
              onClick={() => setFlow(card.flow)}
              disabled={card.disabled}
              className={`bg-white text-left rounded-2xl border shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group flex flex-col ${card.cardBorder} disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:shadow-sm disabled:hover:-translate-y-0`}>
              {/* Colored header band */}
              <div
                className={`${card.bandBg} px-4 py-3 flex items-center justify-between flex-shrink-0`}>
                <div className="flex items-center gap-2.5">
                  <card.icon size={20} className={card.iconCls} />
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${card.badge} border ${card.cardBorder}`}>
                    {card.code}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                      card.disabled
                        ? 'bg-gray-100 text-gray-500 border-gray-200'
                        : card.statusCls
                    }`}>
                    {card.disabled ? card.statusClosed : card.statusOpen}
                  </span>
                  <ChevronRight
                    size={15}
                    className="text-gray-400 group-hover:translate-x-0.5 transition-transform"
                  />
                </div>
              </div>
              {/* Body */}
              <div className="p-4 flex flex-col flex-1">
                <p className="font-bold text-gray-900 text-sm">{card.title}</p>
                <p className={`text-sm font-semibold mt-0.5 ${card.accent}`}>
                  {card.subtitle}
                </p>
                <p className="text-gray-500 text-xs mt-2 leading-relaxed flex-1">
                  {card.desc}
                </p>
                <div
                  className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${card.accent}`}>
                  <card.icon size={12} />
                  {card.action}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Recently enrolled */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-50 ring-1 ring-gray-100 flex items-center justify-center">
                <Clock size={16} className="text-gray-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">
                  Recently Enrolled
                </h3>
                <p className="text-[11px] text-gray-400">
                  Latest enrollments · SY {currentSYLabel || `#${selectedSYId}`}
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-gray-500 bg-gray-50 ring-1 ring-gray-100 px-2.5 py-1 rounded-full flex-shrink-0">
              {enrolledCount} enrolled
            </span>
          </div>

          {recentEnrollments.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 ring-1 ring-gray-100 flex items-center justify-center mx-auto mb-3">
                <UserCheck size={24} className="text-gray-300" />
              </div>
              <p className="font-semibold text-gray-500 text-sm">
                No enrollments yet
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Use one of the options above to enroll your first student.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="text-left px-6 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                      Student
                    </th>
                    <th className="text-left px-6 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                      LRN
                    </th>
                    <th className="text-left px-6 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                      Grade
                    </th>
                    <th className="text-left px-6 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                      Section
                    </th>
                    <th className="text-left px-6 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                      Program
                    </th>
                    <th className="text-left px-6 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentEnrollments.map(e => (
                    <tr
                      key={e.id}
                      className="hover:bg-emerald-50/40 transition-colors duration-150">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs flex-shrink-0">
                            {e.student_name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {e.student_name}
                            </p>
                            <p className="text-[11px] text-gray-400 font-mono">
                              {e.student_display_id || `#${e.id}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-xs text-gray-400">
                        {e.lrn}
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">
                        Grade {e.grade_level}
                      </td>
                      <td className="px-6 py-3.5">
                        {e.section_name ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                            {e.section_name}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/50">
                            Pending Section
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        {PROGRAM_BADGES[e.program] ? (
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium border ${PROGRAM_BADGES[e.program]?.bg || 'bg-emerald-50'} ${PROGRAM_BADGES[e.program]?.text || 'text-emerald-700'}`}>
                            {PROGRAM_BADGES[e.program]?.label || e.program}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        {e.status === 'enrolled' ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2.5 py-1 rounded-full text-[11px] font-medium">
                            Enrolled
                          </span>
                        ) : e.status === 'dropped' ? (
                          <span className="bg-red-50 text-red-600 border border-red-200/50 px-2.5 py-1 rounded-full text-[11px] font-medium">
                            Dropped
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200/50 px-2.5 py-1 rounded-full text-[11px] font-medium">
                            Transferred
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── NEW STUDENT FLOW ──────────────────────────────────────
  if (flow === 'new') {
    const steps = [
      'Personal Details',
      'Grade & Program',
      'Requirements',
      'Student ID',
      'Preview & Confirm'
    ];
    const fullName = [newData.firstName, newData.middleName, newData.lastName]
      .filter(Boolean)
      .join(' ');

    if (enrolledNew) {
      return (
        <div className="max-w-lg mx-auto text-center py-12 sm:py-16">
          {/* Animated checkmark */}
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-200/50 animate-[pulse_2s_ease-in-out_infinite]">
            <CheckCircle size={44} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            Enrollment Successful!
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            {fullName} has been successfully enrolled.
          </p>
          <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 shadow-xl shadow-emerald-100/30 rounded-2xl p-6 mb-6 text-left space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-emerald-100/60">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md flex items-center justify-center flex-shrink-0">
                <UserCheck size={18} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{fullName}</p>
                <p className="text-xs text-gray-400">
                  Student ID:{' '}
                  <span className="font-mono text-emerald-700 font-semibold">
                    {newStudentID}
                  </span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Grade Level
                </p>
                <p className="font-semibold text-gray-800">Grade {newGrade}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Section
                </p>
                <p className="font-semibold text-emerald-700">
                  {enrolledSectionName}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  LRN
                </p>
                <p className="font-mono text-xs text-gray-700">{newData.lrn}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Program
                </p>
                <p>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${PROGRAM_BADGES[program]?.bg || 'bg-emerald-100'} ${PROGRAM_BADGES[program]?.text || 'text-emerald-700'}`}>
                    {PROGRAM_BADGES[program]?.label || 'Regular'}
                  </span>
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={resetAll}
            className="bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300">
            Enroll Another Student
          </button>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <button
            onClick={resetAll}
            className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-all flex-shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-4 flex-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md flex items-center justify-center flex-shrink-0">
              <UserPlus size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Enroll New Student</h2>
              <p className="text-gray-400 text-sm">
                Complete all steps to finish enrollment
              </p>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between relative">
            <div
              className="absolute top-5 left-0 right-0 h-1 bg-gray-100 z-0 rounded-full"
              style={{ left: '8%', right: '8%' }}
            />
            <div
              className="absolute top-5 left-0 right-0 h-1 z-0 rounded-full overflow-hidden"
              style={{ left: '8%', right: '8%' }}>
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-500 transition-all duration-500 rounded-full"
                style={{
                  width: `${((newStep - 1) / (steps.length - 1)) * 100}%`
                }}
              />
            </div>
            {steps.map((s, i) => {
              const stepNum = i + 1;
              const done = newStep > stepNum;
              const active = newStep === stepNum;
              return (
                <div
                  key={s}
                  className="flex flex-col items-center gap-2 z-10 flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                      done
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                        : active
                          ? 'bg-white text-emerald-600 border-2 border-emerald-500 shadow-lg shadow-emerald-200 scale-110'
                          : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                    }`}>
                    {done ? <Check size={15} /> : stepNum}
                  </div>
                  <p
                    className={`text-[11px] font-semibold text-center leading-tight hidden sm:block transition-all duration-200 ${
                      active
                        ? 'text-emerald-700'
                        : done
                          ? 'text-emerald-600'
                          : 'text-gray-400'
                    }`}>
                    {s}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-7 transition-all duration-300">
          {newStep === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <User size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Personal Details
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Enter the student's basic personal information
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={newData.firstName}
                    onChange={e => updateNewField('firstName', e.target.value)}
                    className={`w-full border ${newErrors.firstName ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-100'} rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-3 transition-all bg-white/75`}
                    placeholder="Maria"
                  />
                  {newErrors.firstName && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {newErrors.firstName}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    value={newData.middleName}
                    onChange={e => updateNewField('middleName', e.target.value)}
                    className="w-full border border-gray-200 focus:border-emerald-400 focus:ring-emerald-100 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-3 transition-all bg-white/75"
                    placeholder="Cruz"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={newData.lastName}
                    onChange={e => updateNewField('lastName', e.target.value)}
                    className={`w-full border ${newErrors.lastName ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-100'} rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-3 transition-all bg-white/75`}
                    placeholder="Santos"
                  />
                  {newErrors.lastName && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {newErrors.lastName}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    Birthdate *
                  </label>
                  <input
                    type="date"
                    value={newData.birthdate}
                    onChange={e => updateNewField('birthdate', e.target.value)}
                    className={`w-full border ${newErrors.birthdate ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-100'} rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-3 transition-all bg-white/75`}
                  />
                  {newErrors.birthdate && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {newErrors.birthdate}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    Sex *
                  </label>
                  <select
                    value={newData.sex}
                    onChange={e => updateNewField('sex', e.target.value)}
                    className={`w-full border ${newErrors.sex ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-100'} rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-3 transition-all bg-white/75`}>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                  </select>
                  {newErrors.sex && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {newErrors.sex}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                  <MapPin size={11} className="inline mr-1" />
                  Complete Address *
                </label>
                <input
                  type="text"
                  value={newData.address}
                  onChange={e => updateNewField('address', e.target.value)}
                  className={`w-full border ${newErrors.address ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-100'} rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-3 transition-all bg-white/75`}
                  placeholder="House No., Street, Barangay, City/Municipality, Province"
                />
                {newErrors.address && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={10} />
                    {newErrors.address}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    LRN (12 digits) *
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    value={newData.lrn}
                    onChange={e => updateNewField('lrn', e.target.value)}
                    className={`w-full border ${newErrors.lrn ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-100'} rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-3 transition-all bg-white/75`}
                    placeholder="000000000000"
                  />
                  {newErrors.lrn && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {newErrors.lrn}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    Guardian Name *
                  </label>
                  <input
                    type="text"
                    value={newData.guardian}
                    onChange={e => updateNewField('guardian', e.target.value)}
                    className={`w-full border ${newErrors.guardian ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-100'} rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-3 transition-all bg-white/75`}
                    placeholder="Full name"
                  />
                  {newErrors.guardian && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {newErrors.guardian}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    <Phone size={11} className="inline mr-1" />
                    Contact Number *
                  </label>
                  <input
                    type="text"
                    value={newData.contact}
                    onChange={e => updateNewField('contact', e.target.value)}
                    className={`w-full border ${newErrors.contact ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-100'} rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-3 transition-all bg-white/75`}
                    placeholder="09XXXXXXXXX"
                  />
                  {newErrors.contact && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {newErrors.contact}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-2">
                  Classification (check all that apply)
                </label>
                <div className="flex flex-wrap gap-3">
                  {['4Ps Beneficiary', 'PWD', 'Transferee', 'Non-Reader'].map(
                    cls => (
                      <label
                        key={cls}
                        className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${newData.classifications.includes(cls) ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-gray-100 bg-gray-50/50 text-gray-600 hover:border-gray-200 hover:bg-gray-50'}`}>
                        <input
                          type="checkbox"
                          checked={newData.classifications.includes(cls)}
                          onChange={() => toggleClassification(cls)}
                          className="accent-emerald-600 w-4 h-4"
                        />
                        <span className="text-sm font-medium">{cls}</span>
                      </label>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {newStep === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <BookOpen size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Grade Level & Program
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Select the grade level and curriculum program
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-2.5">
                  Grade Level *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {GRADE_LEVELS.map(g => (
                    <button
                      key={g}
                      onClick={() => setNewGrade(g)}
                      className={`p-4 sm:p-5 rounded-xl border-2 text-center transition-all duration-200 ${
                        newGrade === g
                          ? 'border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-100/50'
                          : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50 hover:shadow-sm'
                      }`}>
                      <p
                        className={`font-bold text-lg ${newGrade === g ? 'text-emerald-700' : 'text-gray-700'}`}>
                        Grade {g}
                      </p>
                      <p
                        className={`text-[11px] mt-0.5 font-medium ${newGrade === g ? 'text-emerald-500' : 'text-gray-400'}`}>
                        {g <= 10 ? 'Junior High' : 'Senior High'}
                      </p>
                      {newGrade === g && (
                        <div className="mt-2 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-sm">
                          <Check size={11} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Program selector */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-2.5">
                  Curriculum Program *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PROGRAMS.map(p => {
                    const active = program === p.value;
                    const borderCls = active
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50';
                    const dotCls = active
                      ? 'border-emerald-500'
                      : 'border-gray-300';
                    const innerDotCls = active ? 'bg-emerald-500' : '';
                    return (
                      <button
                        key={p.value}
                        onClick={() => setProgram(p.value)}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200 ${borderCls}`}>
                        <div
                          className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors ${dotCls}`}>
                          {active && (
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${innerDotCls}`}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-semibold text-sm ${active ? 'text-emerald-700' : 'text-gray-800'}`}>
                            {p.label}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {p.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Strand/Track selector — shown when tracks are available for the selected grade */}
              {strandTracks.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-2.5">
                    {newGrade && newGrade >= 11
                      ? 'SHS Strand *'
                      : 'TLE Specialization (optional)'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {strandTracks.map(t => {
                      const active = selectedStrandTrackId === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() =>
                            setSelectedStrandTrackId(active ? null : t.id)
                          }
                          className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                            active
                              ? 'border-emerald-400 bg-emerald-50'
                              : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50'
                          }`}>
                          <div
                            className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors ${
                              active ? 'border-emerald-500' : 'border-gray-300'
                            }`}>
                            {active && (
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`font-semibold text-sm ${active ? 'text-emerald-700' : 'text-gray-800'}`}>
                              {t.name}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 font-mono uppercase">
                              {t.code}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {newStep === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <FileText size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Enrollment Requirements
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Check off the requirements the student has submitted. These
                    can be submitted later.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {REQUIREMENTS_LIST.map(r => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() =>
                      setRequirements(prev => ({
                        ...prev,
                        [r.key]: !prev[r.key]
                      }))
                    }
                    className={`flex items-start gap-3.5 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 text-left w-full ${
                      requirements[r.key]
                        ? 'border-emerald-400 bg-emerald-50/80 shadow-sm'
                        : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50'
                    }`}>
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center mt-0.5 flex-shrink-0 transition-all duration-200 ${
                        requirements[r.key]
                          ? 'bg-emerald-500 border-emerald-500 shadow-sm shadow-emerald-200'
                          : 'border-gray-300 bg-white'
                      }`}>
                      {requirements[r.key] && (
                        <Check
                          size={12}
                          className="text-white"
                          strokeWidth={3}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-sm block ${requirements[r.key] ? 'text-emerald-800 font-medium' : 'text-gray-600'}`}>
                        {r.label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Check size={14} className="text-emerald-600" />
                </div>
                <p className="text-xs text-emerald-700 font-medium">
                  {Object.values(requirements).filter(Boolean).length} of{' '}
                  {REQUIREMENTS_LIST.length} requirements checked
                </p>
              </div>
            </div>
          )}

          {newStep === 4 && (
            <div className="space-y-5 text-center">
              <div className="flex items-center gap-3 justify-center">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <FileText size={18} className="text-emerald-700" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-gray-900 text-sm">
                    Auto-Generated Student ID
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    System-generated unique identifier for this student
                  </p>
                </div>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-50 border-2 border-emerald-200 rounded-2xl p-8 shadow-inner">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold mb-4">
                  <Check size={12} /> Generated Successfully
                </div>
                <p className="text-gray-500 text-sm mb-2 tracking-[0.04em]">
                  System Generated Student ID
                </p>
                <p className="text-4xl sm:text-5xl font-black text-emerald-700 font-mono tracking-[0.08em]">
                  {newStudentID}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-5 text-xs text-gray-500">
                  <span className="px-3 py-1.5 bg-white/70 rounded-lg border border-emerald-100">
                    <span className="font-bold text-emerald-700">
                      {newStudentID.split('-')[0]}
                    </span>{' '}
                    — School Year
                  </span>
                  <span className="px-3 py-1.5 bg-white/70 rounded-lg border border-emerald-100">
                    <span className="font-bold text-emerald-700">
                      {newStudentID.split('-')[1]}
                    </span>{' '}
                    — Grade Level
                  </span>
                  <span className="px-3 py-1.5 bg-white/70 rounded-lg border border-emerald-100">
                    <span className="font-bold text-emerald-700">
                      {newStudentID.split('-')[2]}
                    </span>{' '}
                    — Sequence No.
                  </span>
                </div>
              </div>
              <p className="text-gray-400 text-xs">
                This ID is unique and will be used for all records of this
                student throughout their academic journey.
              </p>
            </div>
          )}

          {newStep === 5 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <CheckCircle size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Enrollment Preview
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Review all details before confirming enrollment
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-5 space-y-3">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.06em] flex items-center gap-2">
                    <User size={13} /> Student Information
                  </p>
                  {[
                    ['Full Name', fullName || '—'],
                    ['Student ID', newStudentID],
                    ['LRN', newData.lrn || '—'],
                    ['Birthdate', newData.birthdate || '—'],
                    ['Sex', newData.sex],
                    ['Grade Level', `Grade ${newGrade}`]
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between text-sm border-b border-gray-100/80 pb-2 last:border-0 last:pb-0">
                      <span className="text-gray-500">{k}:</span>
                      <span className="font-medium text-gray-800 text-right max-w-[60%]">
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-5 space-y-3">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.06em] flex items-center gap-2">
                    <MapPin size={13} /> Contact & Classification
                  </p>
                  {[
                    ['Address', newData.address || '—'],
                    ['Guardian', newData.guardian || '—'],
                    ['Contact', newData.contact || '—'],
                    [
                      'Classification',
                      newData.classifications.join(', ') || 'None'
                    ]
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between text-sm border-b border-gray-100/80 pb-2 last:border-0 last:pb-0">
                      <span className="text-gray-500">{k}:</span>
                      <span className="font-medium text-gray-800 text-right max-w-[60%]">
                        {v}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Program:</span>
                    <span
                      className={`font-medium ${PROGRAM_BADGES[program]?.text || 'text-emerald-700'}`}>
                      {PROGRAM_BADGES[program]?.label || 'Regular'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Requirements summary */}
              <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.06em] flex items-center gap-2">
                    <FileText size={13} /> Requirements Submitted
                  </p>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                    {Object.values(requirements).filter(Boolean).length}/
                    {REQUIREMENTS_LIST.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {REQUIREMENTS_LIST.map(r => (
                    <span
                      key={r.key}
                      className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                        requirements[r.key]
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                      {requirements[r.key] ? '✓' : '○'}{' '}
                      {r.label.replace(/\(.*\)/, '').trim()}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-amber-800 text-sm">
                    Section Status: Pending Section
                  </p>
                  <p className="text-amber-600 text-xs mt-0.5 leading-relaxed">
                    New students without previous grades are temporarily
                    assigned to Pending Section until their average is computed.
                    The system will automatically move them to the appropriate
                    section once grades are uploaded and computed.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {newStep > 1 && (
            <button
              onClick={handleNewBack}
              className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-semibold py-2.5 transition-all duration-200">
              ← Back
            </button>
          )}
          {newStep < 5 ? (
            <button
              onClick={handleNewNext}
              disabled={newStep === 2 && !newGrade}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {newStep === 4 ? 'Continue to Preview' : 'Next Step'}{' '}
              <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleConfirmNewEnrollment}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 flex items-center justify-center gap-2">
              <CheckCircle size={16} /> Confirm Enrollment
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── RETURNING STUDENT FLOW ────────────────────────────────
  if (flow === 'returning') {
    if (enrolledRet && foundStudent) {
      return (
        <div className="max-w-lg mx-auto text-center py-12 sm:py-16">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-200/50 animate-[pulse_2s_ease-in-out_infinite]">
            <CheckCircle size={44} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            Re-enrollment Successful!
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            {foundStudent.name} has been enrolled for Grade {retGrade}.
          </p>
          <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 shadow-xl shadow-emerald-100/30 rounded-2xl p-6 mb-6 text-left space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-emerald-100/60">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md flex items-center justify-center flex-shrink-0">
                <RefreshCw size={18} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{foundStudent.name}</p>
                <p className="text-xs text-gray-400">
                  Student ID:{' '}
                  <span className="font-mono text-emerald-700 font-semibold">
                    {foundStudent.student_id}
                  </span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Previous Grade
                </p>
                <p className="font-semibold text-gray-700">
                  Grade {prevGradeLevel}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  New Grade
                </p>
                <p className="font-semibold text-emerald-700">
                  Grade {retGrade}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Assigned Section
                </p>
                <p className="font-semibold text-emerald-700">
                  {enrolledSectionName}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Program
                </p>
                <p>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${PROGRAM_BADGES[program]?.bg || 'bg-emerald-100'} ${PROGRAM_BADGES[program]?.text || 'text-emerald-700'}`}>
                    {PROGRAM_BADGES[program]?.label || 'Regular'}
                  </span>
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={resetAll}
            className="bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300">
            Enroll Another Student
          </button>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <button
            onClick={resetAll}
            className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-all flex-shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-4 flex-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md flex items-center justify-center flex-shrink-0">
              <RefreshCw size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">
                Enroll Returning Student
              </h2>
              <p className="text-gray-400 text-sm">
                Search by LRN or Student ID to auto-populate student records
              </p>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between relative">
            <div
              className="absolute top-5 left-0 right-0 h-1 bg-gray-100 z-0 rounded-full"
              style={{ left: '8%', right: '8%' }}
            />
            <div
              className="absolute top-5 left-0 right-0 h-1 z-0 rounded-full overflow-hidden"
              style={{ left: '8%', right: '8%' }}>
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-500 transition-all duration-500 rounded-full"
                style={{ width: `${((retStep - 1) / 3) * 100}%` }}
              />
            </div>
            {[
              'Search LRN/ID',
              'Student Details',
              'Grade & Program',
              'Confirm'
            ].map((s, i) => {
              const stepNum = i + 1;
              const done = retStep > stepNum;
              const active = retStep === stepNum;
              return (
                <div
                  key={s}
                  className="flex flex-col items-center gap-2 z-10 flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                      done
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                        : active
                          ? 'bg-white text-emerald-600 border-2 border-emerald-500 shadow-lg shadow-emerald-200 scale-110'
                          : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                    }`}>
                    {done ? <Check size={15} /> : stepNum}
                  </div>
                  <p
                    className={`text-[11px] font-semibold text-center leading-tight hidden sm:block transition-all duration-200 ${
                      active
                        ? 'text-emerald-700'
                        : done
                          ? 'text-emerald-600'
                          : 'text-gray-400'
                    }`}>
                    {s}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-7 transition-all duration-300">
          {retStep === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <Search size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Search Student Record
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Enter the student's LRN or Student ID to retrieve their
                    record
                  </p>
                </div>
              </div>
              <div className="flex gap-3" ref={searchRef}>
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      setRetErrors({});
                      setNotFound(false);
                      setShowSuggestions(e.target.value.trim().length > 0);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        setShowSuggestions(false);
                        handleSearch();
                      }
                    }}
                    onFocus={() => {
                      if (searchQuery.trim()) setShowSuggestions(true);
                    }}
                    className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-3 transition-all bg-white/75 ${retErrors.query ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-100'}`}
                    placeholder="Enter LRN (e.g. 123456789012) or Student ID (e.g. 2026-07-0001)"
                  />
                  {/* Suggestions dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-50 top-full mt-1.5 left-0 right-0 bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 max-h-72 overflow-y-auto">
                      {suggestions.map(s => (
                        <button
                          key={s.id}
                          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-emerald-50 border-b border-gray-50 last:border-0 text-left transition"
                          onClick={() => {
                            setSearchQuery(s.lrn);
                            setFoundStudent(s);
                            setShowSuggestions(false);
                            setRetStep(2);
                          }}>
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs flex-shrink-0 shadow-sm">
                            {s.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {s.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              <span className="font-mono">{s.lrn}</span> · ID:{' '}
                              {s.student_id} · Grade {s.grade_level}
                            </p>
                          </div>
                          <ChevronRight
                            size={14}
                            className="text-gray-300 flex-shrink-0"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  {retErrors.query && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {retErrors.query}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowSuggestions(false);
                    handleSearch();
                  }}
                  className="bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-emerald-200">
                  Search
                </button>
              </div>
              {notFound && (
                <div className="flex items-center gap-2.5 text-red-600 bg-red-50/80 border border-red-200 rounded-xl px-4 py-3 text-sm">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  No student record found for "<strong>{searchQuery}</strong>".
                  Please check the LRN or Student ID.
                </div>
              )}
              {allStudents.length > 0 && !showSuggestions && !foundStudent && (
                <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-4">
                  <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-[0.04em] mb-2.5">
                    Quick access
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allStudents.slice(0, 4).map(s => (
                      <button
                        key={s.lrn}
                        onClick={() => {
                          setSearchQuery(s.lrn);
                          setNotFound(false);
                          setShowSuggestions(true);
                        }}
                        className="text-xs bg-white border border-gray-200 hover:border-emerald-300 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-all">
                        {s.lrn} — {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {retStep === 2 && foundStudent && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <CheckCircle size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Student Record Found
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Details auto-populated from existing record
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-5 space-y-3">
                  <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-[0.06em] flex items-center gap-2">
                    <User size={13} /> Student Information
                  </p>
                  {[
                    ['Full Name', foundStudent.name],
                    ['Student ID', foundStudent.student_id],
                    ['LRN', foundStudent.lrn],
                    ['Sex', foundStudent.sex === 'male' ? 'Male' : 'Female'],
                    ['Address', foundStudent.address || '—']
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between text-sm border-b border-emerald-100/50 pb-2 last:border-0 last:pb-0">
                      <span className="text-gray-500">{k}:</span>
                      <span className="font-medium text-gray-800 text-right max-w-[55%]">
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-5 space-y-3">
                  <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-[0.06em] flex items-center gap-2">
                    <FileText size={13} /> Previous Academic Record
                  </p>
                  {[
                    ['Previous Grade', `Grade ${prevGradeLevel}`],
                    ['Guardian', foundStudent.guardian || '—'],
                    ['Contact', foundStudent.contact || '—']
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between text-sm border-b border-emerald-100/50 pb-2 last:border-0 last:pb-0">
                      <span className="text-gray-500">{k}:</span>
                      <span className="font-medium text-gray-800">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {alreadyEnrolledThisSY && (
                <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <AlertCircle
                    size={16}
                    className="text-amber-600 flex-shrink-0 mt-0.5"
                  />
                  <div className="text-xs text-amber-800 leading-relaxed">
                    <p className="font-semibold">
                      Already enrolled for {currentSYLabel}
                    </p>
                    <p className="mt-0.5">
                      {foundStudent.name} already has an enrollment for this
                      school year, so confirming here will be blocked (a student
                      can only be enrolled once per school year). To move them
                      forward, create the next school year (e.g. 2026-2027) and
                      set it as current in{' '}
                      <span className="font-semibold">
                        Admin → Academic Year Mgmt.
                      </span>
                      , or use Bulk Promotion for the year-end rollover.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {retStep === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <BookOpen size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Grade Level & Program
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Select the new grade level and curriculum program
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-2.5">
                  Grade Level *
                </label>

                {prevGradeLevel != null && (
                  <div
                    className={`mb-3 rounded-xl border px-4 py-3 ${
                      completedGrade12
                        ? 'bg-amber-50/60 border-amber-200/60 text-amber-800'
                        : 'bg-emerald-50/50 border-emerald-100 text-emerald-800'
                    }`}>
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertCircle size={14} className="flex-shrink-0" />
                      {completedGrade12
                        ? 'This student has completed Grade 12'
                        : `Previous Grade: Grade ${prevGradeLevel}`}
                    </p>
                    <p className="text-xs mt-0.5 opacity-80">
                      {completedGrade12
                        ? 'They should be marked as Graduated rather than re-enrolled. Only Grade 12 (repeating) is available here.'
                        : `New grade is limited to${
                            recommendedRetGrade
                              ? ` Grade ${recommendedRetGrade} (next level)`
                              : ''
                          }${
                            recommendedRetGrade &&
                            allowedRetGrades.includes(prevGradeLevel)
                              ? ' or'
                              : ''
                          }${
                            allowedRetGrades.includes(prevGradeLevel)
                              ? ` Grade ${prevGradeLevel} (repeating)`
                              : ''
                          }.`}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {GRADE_LEVELS.map(g => {
                    const isAllowed = allowedRetGrades.includes(g);
                    const isRecommended = recommendedRetGrade === g;
                    const isSameGrade = prevGradeLevel === g;
                    const isSelected = retGrade === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => isAllowed && setRetGrade(g)}
                        disabled={!isAllowed}
                        className={`relative p-4 sm:p-5 rounded-xl border-2 text-center transition-all duration-200 ${
                          !isAllowed
                            ? 'border-gray-100 bg-gray-50/40 opacity-45 cursor-not-allowed'
                            : isSelected
                              ? 'border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-100/50'
                              : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50 hover:shadow-sm'
                        }`}>
                        <p
                          className={`font-bold text-lg ${
                            !isAllowed
                              ? 'text-gray-400'
                              : isSelected
                                ? 'text-emerald-700'
                                : 'text-gray-700'
                          }`}>
                          Grade {g}
                        </p>
                        <p
                          className={`text-[11px] mt-0.5 font-medium ${
                            !isAllowed
                              ? 'text-gray-300'
                              : isSelected
                                ? 'text-emerald-500'
                                : 'text-gray-400'
                          }`}>
                          {g <= 10 ? 'Junior High' : 'Senior High'}
                        </p>
                        <div className="mt-2 flex items-center justify-center gap-1">
                          {isAllowed && (
                            <>
                              {isRecommended ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wide">
                                  <Check size={10} strokeWidth={3} /> Next level
                                </span>
                              ) : isSameGrade ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wide">
                                  <RefreshCw size={10} /> Repeating
                                </span>
                              ) : null}
                            </>
                          )}
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                              <Check size={11} strokeWidth={3} />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Program selector for returning student */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-2.5">
                  Curriculum Program *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PROGRAMS.map(p => {
                    const active = program === p.value;
                    const borderCls = active
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50';
                    const dotCls = active
                      ? 'border-emerald-500'
                      : 'border-gray-300';
                    const innerDotCls = active ? 'bg-emerald-500' : '';
                    return (
                      <button
                        key={p.value}
                        onClick={() => setProgram(p.value)}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200 ${borderCls}`}>
                        <div
                          className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors ${dotCls}`}>
                          {active && (
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${innerDotCls}`}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-semibold text-sm ${active ? 'text-emerald-700' : 'text-gray-800'}`}>
                            {p.label}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {p.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Strand/Track selector for returning student */}
              {strandTracks.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-2.5">
                    {retGrade && retGrade >= 11
                      ? 'SHS Strand *'
                      : 'TLE Specialization (optional)'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {strandTracks.map(t => {
                      const active = selectedStrandTrackId === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() =>
                            setSelectedStrandTrackId(active ? null : t.id)
                          }
                          className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                            active
                              ? 'border-emerald-400 bg-emerald-50'
                              : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50'
                          }`}>
                          <div
                            className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors ${
                              active ? 'border-emerald-500' : 'border-gray-300'
                            }`}>
                            {active && (
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`font-semibold text-sm ${active ? 'text-emerald-700' : 'text-gray-800'}`}>
                              {t.name}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 font-mono uppercase">
                              {t.code}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {retStep === 4 && foundStudent && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <CheckCircle size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Confirm Re-Enrollment
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Please review the details before confirming
                  </p>
                </div>
              </div>
              <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-5 space-y-3">
                {[
                  ['Student Name', foundStudent.name],
                  ['Student ID', foundStudent.student_id],
                  ['LRN', foundStudent.lrn],
                  ['Previous Grade', `Grade ${prevGradeLevel}`],
                  ['New Grade Level', `Grade ${retGrade}`],
                  ['School Year', currentSYLabel || '—'],
                  ['Assigned Section', getSection(null)],
                  ['Program', PROGRAM_BADGES[program]?.label || 'Regular']
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between text-sm border-b border-gray-100/80 pb-2.5 last:border-0 last:pb-0">
                    <span className="text-gray-500">{k}:</span>
                    <span
                      className={`font-medium text-right max-w-[55%] ${k.includes('Section') ? 'text-emerald-700' : k === 'New Grade Level' ? 'text-emerald-700' : 'text-gray-800'}`}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          {retStep > 1 && (
            <button
              onClick={() => setRetStep((retStep - 1) as RetStep)}
              className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-semibold py-2.5 transition-all duration-200">
              ← Back
            </button>
          )}
          {retStep < 4 ? (
            <button
              onClick={handleRetNext}
              disabled={
                retStep === 3 &&
                (retGrade == null || !allowedRetGrades.includes(retGrade))
              }
              className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              Next Step <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleConfirmReturning}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 flex items-center justify-center gap-2">
              <CheckCircle size={16} /> Confirm Re-Enrollment
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── DROP / TRANSFER FLOW ─────────────────────────────────
  if (flow === 'drop') {
    const isTransferIn = dropReason.includes('Transfer In');
    const isTransfer = dropReason.includes('Transfer');
    const actionLabel = isTransferIn
      ? 'Transfer In'
      : isTransfer
        ? 'Transfer Out'
        : 'Dropout';

    if (dropDone && dropFound) {
      return (
        <div className="max-w-lg mx-auto text-center py-12 sm:py-16">
          <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-red-200/50 animate-[pulse_2s_ease-in-out_infinite]">
            <CheckCircle size={44} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            {actionLabel} Processed
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            {dropFound.name}'s record has been updated with {actionLabel}{' '}
            status.
          </p>
          <div className="bg-white/80 backdrop-blur-sm border border-red-100 shadow-xl shadow-red-100/30 rounded-2xl p-6 mb-6 text-left space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-red-100/60">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 shadow-md flex items-center justify-center flex-shrink-0">
                <UserMinus size={18} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{dropFound.name}</p>
                <p className="text-xs text-gray-400">
                  Student ID:{' '}
                  <span className="font-mono text-gray-700">
                    {dropFound.student_id}
                  </span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Action
                </p>
                <p className="font-semibold text-red-700">{actionLabel}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Grade
                </p>
                <p className="font-semibold text-gray-700">
                  Grade {dropFound.grade_level}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Reason
                </p>
                <p className="font-medium text-gray-700">{dropReason}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Date Processed
                </p>
                <p className="font-medium text-gray-700">
                  {new Date().toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={resetAll}
            className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-red-200 hover:shadow-xl hover:shadow-red-300">
            Process Another
          </button>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <button
            onClick={resetAll}
            className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-all flex-shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-4 flex-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 shadow-md flex items-center justify-center flex-shrink-0">
              <UserMinus size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">
                Student Drop / Transfer
              </h2>
              <p className="text-gray-400 text-sm">
                Search for a student, select action reason, and confirm
              </p>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between relative">
            <div
              className="absolute top-5 left-0 right-0 h-1 bg-gray-100 z-0 rounded-full"
              style={{ left: '8%', right: '8%' }}
            />
            <div
              className="absolute top-5 left-0 right-0 h-1 z-0 rounded-full overflow-hidden"
              style={{ left: '8%', right: '8%' }}>
              <div
                className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-500 rounded-full"
                style={{ width: `${((dropStep - 1) / 2) * 100}%` }}
              />
            </div>
            {['Search Student', 'Select Reason', 'Confirm'].map((s, i) => {
              const stepNum = i + 1;
              const done = dropStep > stepNum;
              const active = dropStep === stepNum;
              return (
                <div
                  key={s}
                  className="flex flex-col items-center gap-2 z-10 flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                      done
                        ? 'bg-red-500 text-white shadow-md shadow-red-200'
                        : active
                          ? 'bg-white text-red-600 border-2 border-red-500 shadow-lg shadow-red-200 scale-110'
                          : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                    }`}>
                    {done ? <Check size={15} /> : stepNum}
                  </div>
                  <p
                    className={`text-[11px] font-semibold text-center leading-tight hidden sm:block transition-all duration-200 ${
                      active
                        ? 'text-red-700'
                        : done
                          ? 'text-red-500'
                          : 'text-gray-400'
                    }`}>
                    {s}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-7 transition-all duration-300">
          {/* Step 1 — Search */}
          {dropStep === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center shadow-sm">
                  <Search size={18} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Search Student Record
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Enter the student's LRN or Student ID to locate their record
                  </p>
                </div>
              </div>
              <div className="flex gap-3" ref={dropSearchRef}>
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={dropSearch}
                    onChange={e => {
                      setDropSearch(e.target.value);
                      setDropNotFound(false);
                      setDropErrors({});
                      setDropShowSuggestions(e.target.value.trim().length > 0);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        setDropShowSuggestions(false);
                        handleDropSearch();
                      }
                    }}
                    onFocus={() => {
                      if (dropSearch.trim()) setDropShowSuggestions(true);
                    }}
                    className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-3 transition-all bg-white/75 ${dropErrors.search ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-red-400 focus:ring-red-100'}`}
                    placeholder="Enter LRN or Student ID"
                  />
                  {/* Suggestions dropdown */}
                  {dropShowSuggestions && dropSuggestions.length > 0 && (
                    <div className="absolute z-50 top-full mt-1.5 left-0 right-0 bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 max-h-72 overflow-y-auto">
                      {dropSuggestions.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 border-b border-gray-50 last:border-0 text-left transition"
                          onClick={() => {
                            setDropSearch(s.lrn);
                            setDropFound(s);
                            setDropShowSuggestions(false);
                            setDropStep(2);
                          }}>
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center text-red-700 font-bold text-xs flex-shrink-0 shadow-sm">
                            {s.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {s.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              <span className="font-mono">{s.lrn}</span> · ID:{' '}
                              {s.student_id} · Grade {s.grade_level}
                            </p>
                          </div>
                          <ChevronRight
                            size={14}
                            className="text-gray-300 flex-shrink-0"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  {dropErrors.search && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {dropErrors.search}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setDropShowSuggestions(false);
                    handleDropSearch();
                  }}
                  className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-red-200">
                  Search
                </button>
              </div>
              {dropNotFound && (
                <div className="flex items-center gap-2.5 text-red-600 bg-red-50/80 border border-red-200 rounded-xl px-4 py-3 text-sm">
                  <AlertCircle size={16} className="flex-shrink-0" /> No record
                  found for "<strong>{dropSearch}</strong>". Please check the
                  LRN or Student ID.
                </div>
              )}
              {allStudents.length > 0 && !dropFound && !dropShowSuggestions && (
                <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-4">
                  <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-[0.04em] mb-2.5">
                    Quick access
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allStudents.slice(0, 4).map(s => (
                      <button
                        key={s.lrn}
                        onClick={() => {
                          setDropSearch(s.lrn);
                          setDropNotFound(false);
                          setDropShowSuggestions(true);
                        }}
                        className="text-xs bg-white border border-gray-200 hover:border-red-300 text-gray-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all">
                        {s.lrn} — {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Select Reason */}
          {dropStep === 2 && dropFound && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <CheckCircle size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Student Found — Select Action & Reason
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Choose the reason for this drop or transfer
                  </p>
                </div>
              </div>
              {/* Student info strip */}
              <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-200 to-orange-200 flex items-center justify-center text-red-800 font-bold text-sm flex-shrink-0 shadow-sm">
                  {dropFound.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{dropFound.name}</p>
                  <p className="text-xs text-gray-500">
                    ID: {dropFound.student_id} · LRN: {dropFound.lrn} · Grade{' '}
                    {dropFound.grade_level}
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-2.5">
                  Action / Reason *
                </label>
                <div className="space-y-2">
                  {DROP_REASONS.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setDropReason(r)}
                      className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 text-left ${dropReason === r ? 'border-red-400 bg-red-50/80 shadow-sm' : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50'}`}>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${dropReason === r ? 'border-red-500' : 'border-gray-300'}`}>
                        {dropReason === r && (
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        )}
                      </div>
                      <span className="text-sm text-gray-700 font-medium">
                        {r}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                  Additional Remarks (optional)
                </label>
                <textarea
                  value={dropRemarks}
                  onChange={e => setDropRemarks(e.target.value)}
                  rows={3}
                  placeholder="Any additional information for the record..."
                  className="w-full border border-gray-200 focus:border-red-400 focus:ring-red-100 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-3 transition-all bg-white/75 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 3 — Confirm */}
          {dropStep === 3 && dropFound && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center shadow-sm">
                  <AlertCircle size={18} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Confirm {actionLabel}
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Please review the details before confirming this action
                  </p>
                </div>
              </div>
              <div className="bg-red-50/70 border border-red-100 rounded-xl p-5 space-y-3">
                {[
                  ['Student Name', dropFound.name],
                  ['Student ID', dropFound.student_id],
                  ['LRN', dropFound.lrn],
                  ['Current Grade', `Grade ${dropFound.grade_level}`],
                  ['Action', actionLabel],
                  ['Reason', dropReason],
                  ...(dropRemarks ? [['Remarks', dropRemarks]] : []),
                  [
                    'Date Processed',
                    new Date().toLocaleDateString('en-PH', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  ]
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between text-sm border-b border-red-100/60 pb-2.5 last:border-0 last:pb-0">
                    <span className="text-gray-500">{k}:</span>
                    <span
                      className={`font-medium text-right max-w-[60%] ${k === 'Action' ? 'text-red-700 font-bold' : 'text-gray-800'}`}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-amber-800 text-sm">
                    Important Notice
                  </p>
                  <p className="text-amber-600 text-xs mt-0.5 leading-relaxed">
                    This action will update the student's enrollment status in
                    the system. The student's academic records will be preserved
                    for reference and SF10 generation.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {dropStep > 1 && (
            <button
              onClick={() => setDropStep((dropStep - 1) as DropStep)}
              className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-semibold py-2.5 transition-all duration-200">
              ← Back
            </button>
          )}
          {dropStep < 3 ? (
            <button
              onClick={() => {
                if (dropStep === 2) {
                  const result = dropReasonSchema.safeParse({
                    reason: dropReason
                  });
                  if (!result.success) {
                    showToast(
                      'error',
                      'Please select a reason before proceeding.'
                    );
                    return;
                  }
                }
                setDropStep((dropStep + 1) as DropStep);
              }}
              disabled={dropStep === 2 && !dropReason}
              className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-red-200 hover:shadow-lg hover:shadow-red-300 flex items-center justify-center gap-2">
              Next Step <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleConfirmDrop}
              className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-red-200 hover:shadow-lg hover:shadow-red-300 flex items-center justify-center gap-2">
              <CheckCircle size={16} /> Confirm {actionLabel}
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
