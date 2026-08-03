import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { BookOpen, Download, Printer, ZoomIn, ZoomOut } from "lucide-react";

const MERMAID_CDN = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";

/** Map partial text content of flowchart nodes to their system route */
const NODE_ROUTES: [string, string, string][] = [
  // Admin setup
  ["School Year", "/admin/academic-year", "Manage Academic Years"],
  ["Subjects", "/admin/subjects", "Manage Subjects"],
  ["Sections and Types", "/admin/sections", "Manage Sections"],
  ["Teacher/Registrar accounts", "/admin/users", "Manage Users"],

  // Teacher enrollment
  ["New Student", "/teacher/enroll", "Enroll New Student"],
  ["Returning G8", "/teacher/enroll", "Enroll Returning Student"],
  ["Balik-Aral", "/teacher/enroll", "Enroll Balik-Aral"],
  ["Strand/Track", "/teacher/enroll", "Select Strand"],
  ["requirements", "/teacher/enroll", "Submit Requirements"],
  ["ENROLL", "/teacher/enroll", "Enroll Student"],

  // Registrar section assignment
  ["Section Assignment", "/registrar/section-assignment", "Assign Sections"],
  ["Pending Section Queue", "/registrar/section-assignment", "Pending Queue"],
  ["Random", "/registrar/section-assignment", "Random Assignment"],
  ["Placement", "/registrar/section-assignment", "Placement Assignment"],
  ["Carryover", "/registrar/section-assignment", "Carryover Assignment"],
  ["Manual", "/registrar/section-assignment", "Manual Assignment"],

  // Teacher grades
  ["Grade Management", "/teacher/grades", "Grade Management"],
  ["My Students", "/teacher/my-students", "My Students"],
  ["Q1-Q4 grades", "/teacher/grades", "Encode Grades"],
  ["locks grades", "/teacher/grades", "Lock Grades"],
  ["School Forms", "/teacher/forms/sf1", "School Forms"],

  // Teacher promotion
  ["Bulk Promotion", "/teacher/promote", "Bulk Promotion"],
  ["Mark as Completers", "/teacher/promote", "Mark Completers"],

  // Registrar monitoring
  ["Registrar Dashboard", "/registrar", "Registrar Dashboard"],
  ["Enrollment Report", "/registrar/enrollment-report", "Enrollment Report"],
  ["Certificates", "/registrar/certificates/enrollment", "Certificates"],
  ["At-Risk Students", "/registrar/atrisk", "At-Risk Students"],

  // Principal
  ["Principal Dashboard", "/principal", "Principal Dashboard"],
  ["Enrollment Figures", "/principal/enrollment-figures", "Enrollment Figures"],
  ["Grade Progress", "/principal/grade-progress", "Grade Progress"],
  ["Promotion Stats", "/principal/promotion-stats", "Promotion Stats"],
];

const LIFECYCLE_DEF = `
flowchart TB
  classDef admin fill:#e0e7ff,stroke:#6366f1,stroke-width:1.5,color:#3730a3
  classDef teacher fill:#d1fae5,stroke:#10b981,stroke-width:1.5,color:#065f46
  classDef registrar fill:#fef3c7,stroke:#f59e0b,stroke-width:1.5,color:#92400e
  classDef system fill:#f3e8ff,stroke:#a855f7,stroke-width:1.5,color:#6b21a8
  classDef decision fill:#fff7ed,stroke:#f97316,stroke-width:1.5,color:#9a3412
  classDef terminal fill:#fce7f3,stroke:#ec4899,stroke-width:1.5,color:#831843

  START([Start])-->SETUP

  subgraph SETUP_PHASE[Phase 0 - Admin Setup]
    SETUP[Admin creates School Year]:::admin-->SUBJECTS[Admin creates Subjects]:::admin-->SECTIONS[Admin creates Sections and Types]:::admin-->USERS[Admin creates Teacher/Registrar accounts]:::admin
  end

  USERS-->ENROLL_START

  subgraph ENROLL_PHASE[Phase 1 - Teacher: Enrollment]
    ENROLL_START{Student type?}:::decision
    ENROLL_START-->|New Student G7|NEW_STU[Teacher fills New Student form<br/>LRN, Name, Grade Level, etc.]:::teacher
    ENROLL_START-->|Returning G8-G12|RET_STU[Teacher searches LRN<br/>details auto-populate]:::teacher
    ENROLL_START-->|Balik-Aral|BALIK[Teacher searches LRN<br/>creates fresh record]:::teacher
    NEW_STU-->STRAND{G11+?}
    STRAND-->|Yes|SELECT_STRAND[Teacher selects Strand/Track<br/>e.g. STEM, ABM, HUMSS, TVL]:::teacher
    STRAND-->|No|SKIP_STRAND
    SELECT_STRAND-->REQUIREMENTS
    SKIP_STRAND-->REQUIREMENTS
    RET_STU-->REQUIREMENTS
    BALIK-->REQUIREMENTS
    REQUIREMENTS[Teacher toggles submitted requirements]:::teacher-->ENROLL[Teacher clicks ENROLL<br/><b>No section selected</b>]:::teacher-->SYSTEM_ENROLL[System creates enrollment<br/>section_id = NULL<br/>status = enrolled]:::system-->PENDING[Student appears as<br/><b>Pending Section</b>]:::system
  end

  PENDING-->REG_PHASE

  subgraph REG_PHASE[Phase 2 - Registrar: Section Assignment]
    REG_VIEW[Registrar opens Section Assignment page]:::registrar-->QUEUE[Sees Pending Section Queue<br/>with all unassigned students]:::registrar
    QUEUE-->ASSIGN_METHOD{Assignment method?}:::decision
    ASSIGN_METHOD-->|Manual|MANUAL[Pick student -> select target section]:::registrar
    ASSIGN_METHOD-->|Random|RANDOM[Auto-distribute across available sections]:::registrar
    ASSIGN_METHOD-->|Placement|PLACEMENT[Assign by exam scores<br/>STE / SPFL / SPJ]:::registrar
    ASSIGN_METHOD-->|Carryover|CARRYOVER[Carry G11 strand to G12 section]:::registrar
    MANUAL-->ASSIGNED
    RANDOM-->ASSIGNED
    PLACEMENT-->ASSIGNED
    CARRYOVER-->ASSIGNED
    ASSIGNED[System updates section_id on enrollment]:::system-->CONFIRM[Student now visible in assigned section]:::system
  end

  CONFIRM-->GRADE_PHASE

  subgraph GRADE_PHASE[Phase 3 - Teacher: Grade Encoding]
    TEACH_GRADE[Teacher opens My Students or Grade Management]:::teacher-->SELECT_CLASS[Selects section and student]:::teacher-->ENTER_GRADES[Enters Q1-Q4 grades for each of 12 subjects]:::teacher-->LOCK[Teacher locks grades per subject]:::teacher-->FORMS[Teacher generates School Forms<br/>SF1 - SF5 - SF9 - SF10]:::teacher
    FORMS-->YEAR_END{End of school year?}:::decision
    YEAR_END-->|Not yet|TEACH_GRADE
    YEAR_END-->|Yes|PROMOTE_CHECK
  end

  PROMOTE_CHECK-->PROMOTE_PHASE

  subgraph PROMOTE_PHASE[Phase 4 - Teacher: Promotion / Graduation]
    GRADE12{Grade level?}:::decision
    GRADE12-->|G7-G11|PROMOTE[Teacher runs Bulk Promotion<br/>creates enrollment in next SY<br/>updates student grade_level]:::teacher
    GRADE12-->|G12|COMPLETER[Teacher clicks<br/><b>Mark as Completers</b>]:::teacher
    PROMOTE-->RET_CHECK{General Average >= 75?}:::decision
    RET_CHECK-->|Yes|PASS[Promoted to next grade]:::system
    RET_CHECK-->|No|RETAIN[Retained - stays in same grade]:::system
    PASS-->NEXT_YEAR
    RETAIN-->NEXT_YEAR
    COMPLETER-->GRAD_SYS[System updates:<br/>enrollment -> completed<br/>student -> graduated]:::system-->GRAD_DONE([🎓 Graduated!]):::terminal
    NEXT_YEAR[Registrar advances to next School Year]:::registrar
  end

  NEXT_YEAR-->REG_MONITOR

  subgraph REG_MONITOR_PHASE[Phase 5 - Registrar: Monitoring]
    REG_DASH[Registrar Dashboard<br/>enrollment stats, charts]:::registrar
    REG_REPORT[Enrollment Report<br/>export CSV / Excel / PDF]:::registrar
    REG_CERT[Generate Certificates<br/>Enrollment, Good Moral]:::registrar
    REG_ATRISK[At-Risk Students<br/>read-only view]:::registrar
  end

  REG_DASH-->REG_REPORT-->REG_CERT-->REG_ATRISK
  REG_ATRISK-->PRIN_PHASE

  subgraph PRIN_PHASE[Phase 6 - Principal: View Only]
    PRIN_DASH[Principal Dashboard<br/>school-wide overview]:::admin
    PRIN_ENROLL[Enrollment Figures<br/>per grade, gender breakdown]:::admin
    PRIN_PROGRESS[Grade Progress<br/>submission completion]:::admin
    PRIN_PROMO[Promotion Stats]:::admin
  end

  PRIN_DASH-->PRIN_ENROLL-->PRIN_PROGRESS-->PRIN_PROMO
  PRIN_PROMO-->NEXT_CYCLE{Next School Year?}:::decision
  NEXT_CYCLE-->|Yes - repeat|ENROLL_START
  NEXT_CYCLE-->|No - end|FINISH([End]):::terminal
`;

const YEARLY_DEF = `
flowchart LR
  classDef admin fill:#e0e7ff,stroke:#6366f1,color:#3730a3
  classDef teacher fill:#d1fae5,stroke:#10b981,color:#065f46
  classDef registrar fill:#fef3c7,stroke:#f59e0b,color:#92400e
  classDef system fill:#f3e8ff,stroke:#a855f7,color:#6b21a8

  A[👤 Admin Setup]:::admin-->B[🧑‍🏫 Teacher Enroll Student<br/><small>no section</small>]:::teacher
  B-->C[📋 Registrar Assign Section]:::registrar
  C-->D[🧑‍🏫 Teacher Encode Grades Q1-Q4]:::teacher
  D-->E[🧑‍🏫 Teacher Lock Grades]:::teacher
  E-->F[🧑‍🏫 Teacher Generate Forms<br/>SF1 / SF5 / SF9 / SF10]:::teacher
  F-->G[⚙️ System Bulk Promotion -> next grade]:::system
  G-->|Repeat for G8-G12|B
  G-->H[🎓 Grade 12 -> Graduation]:::system
`;

export function SystemGuide() {
  const navigate = useNavigate();
  const [lifecycleSvg, setLifecycleSvg] = useState("");
  const [yearlySvg, setYearlySvg] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const lifecycleRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || !lifecycleSvg) return;
    // Attach click handlers to flowchart nodes
    makeNodesClickable(node);
  }, [lifecycleSvg]);

  /** Walk the SVG and attach click handlers matching NODE_ROUTES */
  function makeNodesClickable(container: HTMLElement) {
    const svg = container.querySelector("svg");
    if (!svg) return;

    // Find all text-bearing elements inside node groups
    const textElements = svg.querySelectorAll("text, foreignObject");
    textElements.forEach(el => {
      const text = (el.textContent || "").trim();
      if (!text) return;

      // Try to match against any route entry
      for (const [match, path, label] of NODE_ROUTES) {
        if (text.includes(match)) {
          // Walk up to the closest <g> that represents the node
          let target = el.closest("g");
          // Mermaid wraps nodes in a <g> with class 'node' near the top
          while (target && !target.classList.contains("node") && target.parentElement) {
            target = target.parentElement;
          }
          if (target) {
            (target as HTMLElement).style.cursor = "pointer";
            (target as HTMLElement).title = `Click to go to: ${label}`;
            target.addEventListener("click", (e) => {
              e.stopPropagation();
              navigate(path);
            });
          }
          break; // only first match per element
        }
      }
    });

    // Also add clickable overlay hint text
    const hint = document.createElement("div");
    hint.className = "clickable-hint";
    hint.style.cssText =
      "position:absolute;bottom:8px;right:12px;font-size:11px;color:#94a3b8;background:rgba(255,255,255,0.9);padding:4px 10px;border-radius:6px;border:1px solid #e2e8f0;pointer-events:none;display:flex;align-items:center;gap:4px";
    hint.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Click any node to navigate';
    container.style.position = "relative";
    container.appendChild(hint);
  }

  useEffect(() => {
    if (document.getElementById("mermaid-script")) {
      waitForMermaid();
      return;
    }

    const script = document.createElement("script");
    script.id = "mermaid-script";
    script.src = MERMAID_CDN;
    script.onload = () => waitForMermaid();
    script.onerror = () => setError("Failed to load Mermaid renderer from CDN.");
    document.head.appendChild(script);

    function waitForMermaid() {
      const check = () => {
        if ((window as any).mermaid) {
          initMermaid();
        } else {
          setTimeout(check, 200);
        }
      };
      check();
    }

    function initMermaid() {
      const mermaid = (window as any).mermaid;
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        themeVariables: {
          fontFamily: "system-ui, -apple-system, sans-serif",
          primaryColor: "#6366f1",
          primaryBorderColor: "#4f46e5",
          primaryTextColor: "#1e293b",
          lineColor: "#94a3b8",
          secondaryColor: "#d1fae5",
          tertiaryColor: "#fef3c7",
        },
        flowchart: { useMaxWidth: true, htmlLabels: true, curve: "basis", padding: 16 },
        securityLevel: "loose",
      });

      Promise.all([
        mermaid.render("lifecycle-guide", LIFECYCLE_DEF),
        mermaid.render("yearly-guide", YEARLY_DEF),
      ])
        .then(([lifecycleResult, yearlyResult]) => {
          setLifecycleSvg(lifecycleResult.svg);
          setYearlySvg(yearlyResult.svg);
          setLoaded(true);
        })
        .catch((e: any) => setError("Render error: " + e.message));
    }
  }, []);

  const handleDownloadSVG = () => {
    if (!lifecycleSvg) return;
    const blob = new Blob([lifecycleSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student-lifecycle-flowchart.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <BookOpen size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg">System Guide — Student Lifecycle</h2>
            <p className="text-indigo-200 text-sm">
              Complete workflow from Grade 7 enrollment to Grade 12 graduation
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3">
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#e0e7ff] border border-indigo-400 inline-block" /> Admin</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#d1fae5] border border-emerald-400 inline-block" /> Teacher</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#fef3c7] border border-amber-400 inline-block" /> Registrar</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#f3e8ff] border border-purple-400 inline-block" /> System</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#fff7ed] border border-orange-400 inline-block" /> Decision</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(z => Math.max(50, z - 10))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-medium text-gray-500 w-10 text-center">{zoom}%</span>
          <button
            onClick={() => setZoom(z => Math.min(200, z + 10))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <button onClick={handleDownloadSVG} className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 transition">
            <Download size={13} /> SVG
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 transition">
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Full Lifecycle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Full Lifecycle: Grade 7 → Graduation</h3>
          <p className="text-gray-400 text-xs">All 6 phases across Admin, Teacher, Registrar, and Principal roles</p>
        </div>
        <div className="p-5 overflow-x-auto" style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}>
          <div className="min-w-[800px]" ref={lifecycleRef}>
            {lifecycleSvg ? (
              <div dangerouslySetInnerHTML={{ __html: lifecycleSvg }} />
            ) : error ? null : (
              <div className="flex items-center gap-3 text-gray-400 text-sm py-10">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
                Loading flowchart...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Simplified Yearly Cycle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Simplified Yearly Cycle</h3>
          <p className="text-gray-400 text-xs">Role-by-role view of the annual loop</p>
        </div>
        <div className="p-5 overflow-x-auto">
          {yearlySvg ? (
            <div dangerouslySetInnerHTML={{ __html: yearlySvg }} />
          ) : error ? null : (
            <div className="flex items-center gap-3 text-gray-400 text-sm py-6">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
              Loading...
            </div>
          )}
        </div>
      </div>

      {/* Quick Reference */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            role: "Admin",
            color: "bg-indigo-50 border-indigo-200",
            textColor: "text-indigo-700",
            steps: ["Create School Years", "Create Subjects", "Create Sections & Types", "Manage Users", "Configure Settings"],
          },
          {
            role: "Teacher",
            color: "bg-emerald-50 border-emerald-200",
            textColor: "text-emerald-700",
            steps: ["Enroll Students (no section)", "Encode Q1-Q4 Grades", "Lock Grades", "Generate School Forms", "Bulk Promotion / Completers"],
          },
          {
            role: "Registrar",
            color: "bg-amber-50 border-amber-200",
            textColor: "text-amber-700",
            steps: ["Assign Sections from Pending Queue", "Monitor Enrollment", "Generate Certificates", "Run Reports", "Track At-Risk Students"],
          },
        ].map(card => (
          <div key={card.role} className={`${card.color} border rounded-xl p-4`}>
            <p className={`font-bold text-sm ${card.textColor} mb-2`}>{card.role}</p>
            <ol className="space-y-1.5">
              {card.steps.map((step, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                  <span className={`font-bold ${card.textColor} flex-shrink-0`}>{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
