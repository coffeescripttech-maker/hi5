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
  MapPin,
  Phone,
  BookOpen,
  FileText,
  X,
  UserMinus
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  studentsApi,
  StudentRow,
  CreateStudentPayload
} from '../../services/students';
import { enrollmentsApi, EnrollmentRow } from '../../services/enrollments';
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
  regular: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Mainstream' },
  ste: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'STE' },
  spfl: { bg: 'bg-teal-100', text: 'text-teal-700', label: 'SPFL' },
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
        if (current) setSelectedSYId(current.id);
      })
      .catch(err => {
        showToast(
          'error',
          'Failed to load data: ' + (err.detail?.error || err.message)
        );
      });
  }, []);

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
      } else {
        setNotFound(true);
      }
    } catch {
      showToast('error', 'Search failed. Please try again.');
    }
  };

  const handleRetNext = () => {
    if (retStep === 3 && retGrade) setRetStep(4);
    else if (retStep < 4) setRetStep((retStep + 1) as RetStep);
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
        program: program
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
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200/60 shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <UserCheck size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Enrollment Module
              </h2>
              <p className="text-gray-400 text-sm">
                Manage student enrollment, re-enrollment, and drop/transfer
                processing
              </p>
            </div>
          </div>
        </div>

        {/* Flow cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setFlow('new')}
            className="group bg-emerald-50/30 rounded-xl border border-gray-200/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-emerald-200 transition-all duration-200 p-6 text-left relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-500 scale-y-0 group-hover:scale-y-100 transition-transform duration-200 origin-top" />
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors ring-1 ring-emerald-200/50">
                <UserPlus size={19} className="text-emerald-600" />
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md ring-1 ring-emerald-200/50 tracking-wide uppercase">
                New
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 text-[15px] tracking-[-0.02em] mb-1.5">
              Enroll New Student
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Complete data entry for first-time enrollees with auto-ID
              generation
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['Full data entry', 'Auto-ID', 'Section assignment'].map(t => (
                <span
                  key={t}
                  className="text-[11px] text-gray-500 bg-gray-100/60 px-2.5 py-1 rounded-md tracking-wide">
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-4 pt-3.5 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-600 flex items-center gap-1.5 group-hover:gap-2.5 transition-all duration-200 tracking-[-0.01em]">
                Start Enrollment
                <ChevronRight
                  size={14}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </span>
            </div>
          </button>

          <button
            onClick={() => setFlow('returning')}
            className="group bg-blue-50/30 rounded-xl border border-gray-200/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-blue-200 transition-all duration-200 p-6 text-left relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 scale-y-0 group-hover:scale-y-100 transition-transform duration-200 origin-top" />
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors ring-1 ring-blue-200/50">
                <RefreshCw size={19} className="text-blue-600" />
              </div>
              <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md ring-1 ring-blue-200/50">
                Returning
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 text-[15px] tracking-[-0.02em] mb-1.5">
              Enroll Returning Student
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Auto-populate from existing records via LRN or name search
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['LRN search', 'Auto-populate', 'Grade promotion'].map(t => (
                <span
                  key={t}
                  className="text-[11px] text-gray-500 bg-gray-100/60 px-2.5 py-1 rounded-md tracking-wide">
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-4 pt-3.5 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm font-medium text-blue-600 flex items-center gap-1.5 group-hover:gap-2.5 transition-all duration-200 tracking-[-0.01em]">
                Search Student
                <ChevronRight
                  size={14}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </span>
            </div>
          </button>

          <button
            onClick={() => setFlow('drop')}
            className="group bg-red-50/30 rounded-xl border border-gray-200/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-red-200 transition-all duration-200 p-6 text-left relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-400 scale-y-0 group-hover:scale-y-100 transition-transform duration-200 origin-top" />
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors ring-1 ring-red-200/50">
                <UserMinus size={19} className="text-red-500" />
              </div>
              <span className="text-[11px] font-medium text-red-500 bg-red-50 px-2.5 py-1 rounded-md ring-1 ring-red-200/50">
                Status
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 text-[15px] tracking-[-0.02em] mb-1.5">
              Student Drop / Transfer
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Process student dropout or school transfer with official reason
              documentation
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Dropout',
                'Transfer Out',
                'Transfer In',
                'Reason on record'
              ].map(t => (
                <span
                  key={t}
                  className="text-[11px] text-gray-500 bg-gray-100/60 px-2.5 py-1 rounded-md tracking-wide">
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-4 pt-3.5 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm font-medium text-red-500 flex items-center gap-1.5 group-hover:gap-2.5 transition-all duration-200">
                Process Request
                <ChevronRight
                  size={14}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </span>
            </div>
          </button>
        </div>

        {/* Recently enrolled */}
        {/* <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Recently Enrolled Students</h3>
            <span className="text-xs text-gray-400">{allStudents.filter(s => s.status === "enrolled").length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="text-left px-6 py-3.5 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">Student ID</th>
                  <th className="text-left px-6 py-3.5 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">Name</th>
                  <th className="text-left px-6 py-3.5 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">LRN</th>
                  <th className="text-left px-6 py-3.5 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">Grade</th>
                  <th className="text-left px-6 py-3.5 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">Section</th>
                  <th className="text-left px-6 py-3.5 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">Program</th>
                  <th className="text-left px-6 py-3.5 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allStudents.filter(s => s.status === "enrolled").slice(0, 6).map((s, idx) => {
                  const enrollment = allEnrollments.find(e => e.student_id === s.id && e.school_year_id === selectedSYId && e.status === "enrolled");
                  return (
                  <tr key={s.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-green-50/50 transition-colors duration-150`}>
                    <td className="px-6 py-3.5 font-mono text-xs text-gray-500">{s.student_id}</td>
                    <td className="px-6 py-3.5 font-medium text-gray-900">{s.name}</td>
                    <td className="px-6 py-3.5 font-mono text-xs text-gray-400">{s.lrn}</td>
                    <td className="px-6 py-3.5 text-gray-600">Grade {s.grade_level}</td>
                    <td className="px-6 py-3.5">
                      {enrollment ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/50">{enrollment.section_name}</span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {enrollment && enrollment.program ? (
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium border ${PROGRAM_BADGES[enrollment.program]?.bg || "bg-blue-50"} ${PROGRAM_BADGES[enrollment.program]?.text || "text-blue-700"}`}>
                          {PROGRAM_BADGES[enrollment.program]?.label || enrollment.program}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="bg-green-50 text-green-700 border border-green-200/50 px-2.5 py-1 rounded-full text-[11px] font-medium">Enrolled</span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div> */}
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
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-green-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-200/50 animate-[pulse_2s_ease-in-out_infinite]">
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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-md flex items-center justify-center flex-shrink-0">
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
                    className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${PROGRAM_BADGES[program]?.bg || 'bg-blue-100'} ${PROGRAM_BADGES[program]?.text || 'text-blue-700'}`}>
                    {PROGRAM_BADGES[program]?.label || 'Regular'}
                  </span>
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={resetAll}
            className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300">
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-md flex items-center justify-center flex-shrink-0">
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
                className="h-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-500 rounded-full"
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
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-sm">
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
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-sm">
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
            </div>
          )}

          {newStep === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-sm">
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
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-sm">
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
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl p-8 shadow-inner">
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
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-sm">
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
                      className={`font-medium ${PROGRAM_BADGES[program]?.text || 'text-blue-700'}`}>
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
              className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {newStep === 4 ? 'Continue to Preview' : 'Next Step'}{' '}
              <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleConfirmNewEnrollment}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 flex items-center justify-center gap-2">
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
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-green-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-200/50 animate-[pulse_2s_ease-in-out_infinite]">
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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-md flex items-center justify-center flex-shrink-0">
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
                  Grade {foundStudent.grade_level}
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
                    className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${PROGRAM_BADGES[program]?.bg || 'bg-blue-100'} ${PROGRAM_BADGES[program]?.text || 'text-blue-700'}`}>
                    {PROGRAM_BADGES[program]?.label || 'Regular'}
                  </span>
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={resetAll}
            className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300">
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md flex items-center justify-center flex-shrink-0">
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
                className="h-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-500 rounded-full"
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
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-sm">
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
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center text-emerald-700 font-bold text-xs flex-shrink-0 shadow-sm">
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
                  className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-emerald-200">
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
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-sm">
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
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 space-y-3">
                  <p className="text-[11px] font-bold text-blue-700 uppercase tracking-[0.06em] flex items-center gap-2">
                    <FileText size={13} /> Previous Academic Record
                  </p>
                  {[
                    ['Previous Grade', `Grade ${foundStudent.grade_level}`],
                    ['Guardian', foundStudent.guardian || '—'],
                    ['Contact', foundStudent.contact || '—']
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between text-sm border-b border-blue-100/50 pb-2 last:border-0 last:pb-0">
                      <span className="text-gray-500">{k}:</span>
                      <span className="font-medium text-gray-800">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {retStep === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-sm">
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {GRADE_LEVELS.map(g => (
                    <button
                      key={g}
                      onClick={() => setRetGrade(g)}
                      className={`p-4 sm:p-5 rounded-xl border-2 text-center transition-all duration-200 ${
                        retGrade === g
                          ? 'border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-100/50'
                          : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50 hover:shadow-sm'
                      }`}>
                      <p
                        className={`font-bold text-lg ${retGrade === g ? 'text-emerald-700' : 'text-gray-700'}`}>
                        Grade {g}
                      </p>
                      <p
                        className={`text-[11px] mt-0.5 font-medium ${retGrade === g ? 'text-emerald-500' : 'text-gray-400'}`}>
                        {g <= 10 ? 'Junior High' : 'Senior High'}
                      </p>
                      {retGrade === g && (
                        <div className="mt-2 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-sm">
                          <Check size={11} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  ))}
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
            </div>
          )}

          {retStep === 4 && foundStudent && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-sm">
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
                  ['Previous Grade', `Grade ${foundStudent.grade_level}`],
                  ['New Grade Level', `Grade ${retGrade}`],
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
              disabled={retStep === 3 && !retGrade}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              Next Step <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleConfirmReturning}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 flex items-center justify-center gap-2">
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
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-sm">
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
