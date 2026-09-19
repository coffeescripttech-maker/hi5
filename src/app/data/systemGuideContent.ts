/**
 * Written content for the System Guide page (/guide, all roles).
 * Kept out of SystemGuide.tsx so the prose stays separate from the
 * mermaid/PDF machinery. Written for non-technical users — plain language,
 * no jargon without explanation.
 */

export interface GuideRole {
  role: string;
  summary: string;
  duties: string[];
  pages: string[];
}

export interface GuideHowTo {
  title: string;
  summary: string;
  steps: string[];
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const GUIDE_META = {
  title: 'HI5 Portal — System User Guide',
  subtitle: 'A step-by-step guide for non-technical users',
  audience: 'For teachers, the registrar, administrators, and the school head.',
  footer:
    'Don Servillano Platon Memorial National High School · Sta. Cruz, Tinambac, Camarines Sur'
};

export const gettingStarted: string[] = [
  "The HI5 Portal is the school's online system for enrollment, student records, grade encoding, and school forms. Everything you do on paper today — enrollment forms, grade sheets, SF9 records — is handled here, in one place.",
  'To enter the system, open the portal link in a web browser (Chrome or Edge works best) and sign in with the personal username and password issued to you by the ICT Coordinator or Administrator. Do not share your account — every sign-in is recorded.',
  'The pages you see after signing in depend on your role. A teacher sees enrollment, grades, and school forms. The registrar assigns sections and prints reports. Administrators manage users, classes, and system settings. This guide explains each role step by step.',
  'If anything looks wrong — a student is missing, a grade looks incorrect, or you cannot sign in — stop and ask the ICT Coordinator or Administrator before making changes. Making corrections after work is locked takes longer and needs approval from the Registrar.'
];

export const roles: GuideRole[] = [
  {
    role: 'Administrator',
    summary:
      'Sets up the system for the whole school: school year, subjects, sections, and user accounts.',
    duties: [
      'Create and manage school years and mark the active one.',
      'Set up subjects and section types per grade level.',
      'Create teacher, registrar, and principal accounts.',
      'Configure school settings, deadlines, and backups.',
      'Control which modules each role can open.'
    ],
    pages: [
      'School Year Mgmt',
      'Subjects',
      'Sections & Types',
      'User Management',
      'System Settings'
    ]
  },
  {
    role: 'Teacher',
    summary:
      'Handles the day-to-day classroom data: enrolling students, encoding grades, locking grades, and printing school forms.',
    duties: [
      'Enroll new and returning students.',
      'Encode quarterly grades (Q1–Q4).',
      'Lock grades when encoding is finished.',
      'Generate school forms (SF1, SF5, SF9, SF10).',
      'Run bulk promotion or mark completers.'
    ],
    pages: [
      'Enrollment',
      'My Sections',
      'Grade Management',
      'Upload Grades',
      'School Forms',
      'Student List'
    ]
  },
  {
    role: 'Registrar',
    summary:
      'Controls sectioning and records: assigns students to sections, monitors enrollment, and produces reports and certificates.',
    duties: [
      'Assign pending students to sections.',
      'Monitor enrollment and at-risk students.',
      'Generate certificates and reports.',
      'Advance the system to the next school year.',
      'Manage schedules and student transfers.'
    ],
    pages: [
      'Section Assignment',
      'Enrollment Report',
      'Certificates',
      'At-Risk Students',
      'Document Completion'
    ]
  },
  {
    role: 'Principal / School Head',
    summary:
      'Views the school-wide picture — enrollment, grade progress, and promotion statistics — without changing data.',
    duties: [
      'Review enrollment figures per grade and gender.',
      'Monitor grade submission progress.',
      'Check promotion and retention statistics.',
      'View at-risk and 4Ps/PWD summaries.',
      'Track section population and utilization.'
    ],
    pages: [
      'Principal Dashboard',
      'Enrollment Figures',
      'Grade Progress',
      'Promotion Stats',
      'At-Risk Students'
    ]
  }
];

export const howtos: GuideHowTo[] = [
  {
    title: 'Enroll a New Grade 7 Student',
    summary: 'For a student who is enrolled at the school for the first time.',
    steps: [
      'Open Enrollment from the side menu and choose New Student.',
      "Fill in the student's details: LRN (if available), full name, birthdate, sex, address, and guardian information.",
      'If the student is entering Grade 11 or 12, select their Strand/Track (e.g. STEM, ABM, HUMSS, TVL).',
      'Toggle the submitted requirements (birth certificate, report card, etc.) as they are checked.',
      'Click Enroll — the student is created without a section yet and appears in the Pending Section list.',
      'The Registrar then assigns the student to a section.'
    ]
  },
  {
    title: 'Enroll a Returning (G8–G12) or Balik-Aral Student',
    summary:
      'For a student continuing from last year, or returning after being out of school.',
    steps: [
      'Open Enrollment and choose Returning Student or Balik-Aral.',
      "Search by the student's LRN — their details automatically load from their existing record.",
      'For a returning student, confirm the details and pick the new grade level.',
      'For Balik-Aral, the system creates a fresh record while keeping the previous history.',
      'Click Enroll, then let the Registrar assign the section.'
    ]
  },
  {
    title: 'Assign Students to Sections (Registrar)',
    summary: 'Turn pending students into sectioned classes.',
    steps: [
      'Open Section Assignment — the Pending Section Queue lists every enrolled student without a section.',
      'Choose a method: Manual (pick the section yourself), Random (system distributes evenly), Placement (by exam scores, e.g. STE/SPFL/SPJ), or Carryover (strand carried to G12).',
      "Confirm the assignment — the student's section is updated immediately and they become visible inside it.",
      'Repeat until the queue is cleared.'
    ]
  },
  {
    title: 'Encode Grades (Q1–Q4)',
    summary: 'Enter the quarterly grades for your students.',
    steps: [
      'Open Grade Management or My Students and pick the section and subject.',
      'Select the quarter (Q1, Q2, Q3, or Q4).',
      "Enter each student's grade, or upload them from a prepared Excel template.",
      'Double-check the values before saving — a grade of 60–74 means the student needs remedial work.'
    ]
  },
  {
    title: 'Lock Grades',
    summary:
      'Seal a finished grading period so grades cannot be silently changed.',
    steps: [
      'After encoding, open Lock Grades for the relevant subject or quarter.',
      'Confirm the lock — locked grades become read-only for teachers.',
      'If a correction is truly needed, follow the official grade-correction request workflow instead of unlocking directly.'
    ]
  },
  {
    title: 'Generate School Forms (SF1, SF5, SF9, SF10)',
    summary: 'Print the official DepEd forms from encoded data.',
    steps: [
      'Open School Forms and choose the form you need (SF1 class record, SF5 grade sheet, SF9 report card, SF10 permanent record).',
      'Pick the school year, grade level, and section.',
      'Generate the form, review it on screen, then download or print it.',
      "Handle and store printed forms according to the school's data-privacy policy."
    ]
  },
  {
    title: 'Run Bulk Promotion / Mark Completers',
    summary: 'Close the school year for your students.',
    steps: [
      'Open Bulk Promotion after all grades are locked.',
      'Students with a general average of 75 or higher move to the next grade level automatically.',
      'Students below 75 are retained in the same grade.',
      'For Grade 12, use Mark as Completers — the system marks the enrollment completed and the student graduated.',
      'The Registrar then advances the system to the new school year.'
    ]
  },
  {
    title: 'Generate Certificates & Reports (Registrar)',
    summary:
      'Official documents for students leaving or needing proof of enrollment.',
    steps: [
      'Open Certificates and choose Enrollment or Good Moral.',
      'Pick the student (or batch of students) and the school year.',
      'Generate and print; export options include PDF.',
      'Use the Enrollment Report to monitor numbers and the At-Risk list to track students needing support.'
    ]
  }
];

export const glossary: GlossaryEntry[] = [
  {
    term: 'LRN',
    definition:
      "Learner Reference Number — the student's permanent 12-digit DepEd identification number. Used to fetch and match student records."
  },
  {
    term: 'School Year (SY)',
    definition:
      'The academic year the system is currently operating for, e.g. 2026–2027. Teachers and the registrar work against the active school year.'
  },
  {
    term: 'General Average (GWA)',
    definition:
      "The student's overall average across all subjects for the year. 75+ means promoted; below 75 means retained."
  },
  {
    term: 'Pending Section Queue',
    definition:
      'A list of newly enrolled students who do not have a section yet. The registrar works through this queue to assign them.'
  },
  {
    term: 'Section Type',
    definition:
      'The kind of class a student is placed into — for example STE, SPFL, or SPJ (special programs). Section types decide thresholds for placement.'
  },
  {
    term: 'Balik-Aral',
    definition:
      'A learner returning to school after being out of school for some time. The system creates a fresh enrollment while keeping their history.'
  },
  {
    term: 'Strand / Track',
    definition:
      'The SHS (Grades 11–12) specialization — e.g. STEM, ABM, HUMSS, or TVL. Selected at enrollment.'
  },
  {
    term: 'Carryover Assignment',
    definition:
      "Moving a Grade 11 student's strand into the matching Grade 12 section at the start of Grade 12."
  },
  {
    term: 'SF1',
    definition:
      'School Form 1 — the class/shool register of enrolled learners for a section.'
  },
  {
    term: 'SF5',
    definition:
      'School Form 5 — the report on promotion and level of proficiency by subject.'
  },
  {
    term: 'SF9',
    definition:
      "School Form 9 — the learner's report card (Progress Report Card)."
  },
  {
    term: 'SF10',
    definition: "School Form 10 — the learner's permanent academic record."
  },
  {
    term: 'Locked Grades',
    definition:
      'Grades marked as final for a subject or quarter. Locked grades cannot be changed by teachers without going through the official correction request.'
  },
  {
    term: 'At-Risk Students',
    definition:
      'Learners whose grades signal they may not pass — flagged so teachers and the registrar can give them attention.'
  }
];
