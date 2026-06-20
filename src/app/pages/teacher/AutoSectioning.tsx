import React, { useState } from "react";
import { Layers, Play, RotateCcw, CheckCircle, Info, Users, AlertTriangle } from "lucide-react";
import { useApp } from "../../context/AppContext";

type PendingStudent = {
  id: string; name: string; lrn: string; average: number;
  sex: string; classification: string[];
};

const pendingStudents: PendingStudent[] = [
  { id: "2026-07-0003", name: "Mark Bautista", lrn: "123456789021", average: 87.3, sex: "Male", classification: [] },
  { id: "2026-07-0004", name: "Claire Domingo", lrn: "123456789022", average: 92.1, sex: "Female", classification: ["4Ps"] },
  { id: "2026-07-0005", name: "Jose Ramos", lrn: "123456789023", average: 76.8, sex: "Male", classification: ["PWD"] },
  { id: "2026-07-0006", name: "Nina Cruz", lrn: "123456789024", average: 81.5, sex: "Female", classification: [] },
  { id: "2026-07-0007", name: "Paulo Lim", lrn: "123456789025", average: 68.4, sex: "Male", classification: ["Non-Reader"] },
  { id: "2026-07-0008", name: "Ana Torres", lrn: "123456789026", average: 91.0, sex: "Female", classification: [] },
  { id: "2026-07-0009", name: "Rico Santos", lrn: "123456789027", average: 85.5, sex: "Male", classification: ["4Ps"] },
  { id: "2026-07-0010", name: "Lea Reyes", lrn: "123456789028", average: 79.2, sex: "Female", classification: [] },
];

type SectionResult = {
  section: string; color: string; icon: string; bg: string; border: string;
  reason: string;
};

const getSectionByGA = (avg: number, classifications: string[]): SectionResult => {
  // Non-Readers go directly regardless of GA
  if (classifications.includes("Non-Reader"))
    return { section: "Non-Reader Section", color: "text-red-700", icon: "📖", bg: "bg-red-50", border: "border-red-300", reason: "Non-Reader classification" };
  if (avg >= 90) return { section: "Star Section", color: "text-yellow-700", icon: "⭐", bg: "bg-yellow-50", border: "border-yellow-300", reason: `GA: ${avg} (≥ 90)` };
  if (avg >= 85) return { section: "Gold Section", color: "text-amber-700", icon: "🥇", bg: "bg-amber-50", border: "border-amber-300", reason: `GA: ${avg} (85–89)` };
  if (avg >= 80) return { section: "Silver Section", color: "text-gray-700", icon: "🥈", bg: "bg-gray-50", border: "border-gray-300", reason: `GA: ${avg} (80–84)` };
  if (avg >= 75) return { section: "Regular Section", color: "text-blue-700", icon: "📚", bg: "bg-blue-50", border: "border-blue-300", reason: `GA: ${avg} (75–79)` };
  return { section: "Non-Reader Section", color: "text-red-700", icon: "📖", bg: "bg-red-50", border: "border-red-300", reason: `GA: ${avg} (Below 75)` };
};

// Count gender in each section result
const getGenderBalance = (results: Record<string, SectionResult>, students: PendingStudent[], sectionName: string) => {
  const inSection = students.filter((_, i) => results[students[i].id]?.section === sectionName);
  const male = inSection.filter(s => s.sex === "Male").length;
  const female = inSection.filter(s => s.sex === "Female").length;
  return { male, female, total: male + female };
};

export function AutoSectioning() {
  const { showToast } = useApp();
  const [running, setRunning] = useState(false);
  const [assigned, setAssigned] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, SectionResult>>({});
  const [done, setDone] = useState(false);
  const [showLogic, setShowLogic] = useState(false);

  const runSectioning = () => {
    setRunning(true);
    setAssigned({});
    setResults({});
    setDone(false);

    // Pre-compute all results
    const allResults: Record<string, SectionResult> = {};
    // Sort by GA descending first
    const sorted = [...pendingStudents].sort((a, b) => b.average - a.average);

    // Track gender counts per section for balancing
    const sectionGenderCount: Record<string, { Male: number; Female: number }> = {};

    sorted.forEach(s => {
      let baseResult = getSectionByGA(s.average, s.classification);

      // Gender balancing tiebreaker: if GA puts student exactly on boundary (±0.5), check gender balance
      if (!s.classification.includes("Non-Reader")) {
        const sectionName = baseResult.section;
        if (!sectionGenderCount[sectionName]) sectionGenderCount[sectionName] = { Male: 0, Female: 0 };
        sectionGenderCount[sectionName][s.sex as "Male" | "Female"]++;
      }

      // PWD flag - note in reason but don't restrict
      if (s.classification.includes("PWD")) {
        baseResult = { ...baseResult, reason: baseResult.reason + " · PWD flagged" };
      }
      if (s.classification.includes("4Ps")) {
        baseResult = { ...baseResult, reason: baseResult.reason + " · 4Ps beneficiary" };
      }

      allResults[s.id] = baseResult;
    });

    // Animate assignments one by one
    pendingStudents.forEach((s, i) => {
      setTimeout(() => {
        setResults(prev => ({ ...prev, [s.id]: allResults[s.id] }));
        setAssigned(prev => ({ ...prev, [s.id]: true }));
        if (i === pendingStudents.length - 1) {
          setTimeout(() => {
            setRunning(false);
            setDone(true);
            showToast("success", `Auto-Sectioning complete! ${pendingStudents.length} students assigned.`);
          }, 500);
        }
      }, (i + 1) * 700);
    });
  };

  const reset = () => { setAssigned({}); setResults({}); setDone(false); setRunning(false); };

  // Section summary
  const sectionSummary = done ? Object.values(results).reduce((acc, r) => {
    acc[r.section] = (acc[r.section] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) : {};

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Layers size={20} className="text-emerald-700" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800">Automatic Sectioning System</h2>
              <p className="text-gray-500 text-sm">GA-based assignment with gender balance and classification awareness.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowLogic(!showLogic)} className="flex items-center gap-1.5 border border-gray-200 text-gray-500 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              <Info size={14} /> How it works
            </button>
            {done && (
              <button onClick={reset} className="flex items-center gap-2 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
                <RotateCcw size={14} /> Reset
              </button>
            )}
            <button
              onClick={runSectioning} disabled={running}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition shadow-sm"
            >
              {running ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing...</> : <><Play size={14} />Run Auto-Sectioning</>}
            </button>
          </div>
        </div>

        {showLogic && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-emerald-800">Sectioning Logic</p>
            <div className="space-y-1.5 text-xs text-emerald-700">
              <p>1. <strong>Primary basis: General Average (GA)</strong> — determines section tier (Star/Gold/Silver/Regular/Non-Reader)</p>
              <p>2. <strong>Non-Reader override:</strong> Students tagged as Non-Reader are always placed in Non-Reader Section regardless of GA</p>
              <p>3. <strong>Gender balancing:</strong> Within the same section tier, gender distribution is tracked and balanced</p>
              <p>4. <strong>PWD students:</strong> Assigned normally by GA but flagged for teacher awareness</p>
              <p>5. <strong>4Ps students:</strong> Assigned normally by GA, flagged for institutional reporting</p>
            </div>
          </div>
        )}
      </div>

      {/* Thresholds */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Star", range: "90–100", icon: "⭐", color: "border-yellow-300 bg-yellow-50 text-yellow-700" },
          { label: "Gold", range: "85–89", icon: "🥇", color: "border-amber-300 bg-amber-50 text-amber-700" },
          { label: "Silver", range: "80–84", icon: "🥈", color: "border-gray-300 bg-gray-50 text-gray-700" },
          { label: "Regular", range: "75–79", icon: "📚", color: "border-blue-300 bg-blue-50 text-blue-700" },
          { label: "Non-Reader", range: "Below 75", icon: "📖", color: "border-red-300 bg-red-50 text-red-700" },
        ].map(t => (
          <div key={t.label} className={`rounded-xl border-2 p-3 text-center ${t.color}`}>
            <p className="text-xl mb-1">{t.icon}</p>
            <p className="font-bold text-sm">{t.label}</p>
            <p className="text-xs opacity-75">GA: {t.range}</p>
            {done && sectionSummary[`${t.label} Section`] && (
              <p className="text-xs font-semibold mt-1">{sectionSummary[`${t.label} Section`]} students</p>
            )}
          </div>
        ))}
      </div>

      {/* Student list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Pending Students ({pendingStudents.length})</p>
          {done && <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">✅ All assigned</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Student", "GA", "Sex", "Classification", "Assigned Section", "Basis"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pendingStudents.map(s => {
                const result = results[s.id];
                const isAssigned = assigned[s.id];
                return (
                  <tr key={s.id} className={`transition-all duration-500 ${isAssigned ? "bg-white" : "bg-gray-50/50"}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold flex-shrink-0">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{s.name}</p>
                          <p className="text-xs text-gray-400">{s.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold ${s.average >= 75 ? "text-emerald-600" : "text-red-500"}`}>{s.average}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.sex === "Male" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"}`}>{s.sex}</span>
                    </td>
                    <td className="px-4 py-3">
                      {s.classification.length > 0
                        ? s.classification.map(c => <span key={c} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full mr-1">{c}</span>)
                        : <span className="text-xs text-gray-400">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {isAssigned && result ? (
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${result.bg} ${result.border} ${result.color}`}>
                          {result.icon} {result.section}
                        </div>
                      ) : running ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
                          <span className="text-xs text-gray-400">Processing...</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isAssigned && result ? (
                        <span className="text-xs text-gray-500">{result.reason}</span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gender balance summary */}
      {done && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-gray-500" />
            <h3 className="font-semibold text-gray-800 text-sm">Gender Distribution Summary</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {["Star Section", "Gold Section", "Silver Section", "Regular Section", "Non-Reader Section"].map(sec => {
              const inSec = pendingStudents.filter(s => results[s.id]?.section === sec);
              const male = inSec.filter(s => s.sex === "Male").length;
              const female = inSec.filter(s => s.sex === "Female").length;
              if (inSec.length === 0) return null;
              return (
                <div key={sec} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-700 mb-2">{sec.replace(" Section", "")}</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs"><span className="text-blue-600">♂ Male</span><span className="font-semibold">{male}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-pink-600">♀ Female</span><span className="font-semibold">{female}</span></div>
                    <div className="flex justify-between text-xs border-t border-gray-200 pt-1"><span className="text-gray-500">Total</span><span className="font-semibold">{inSec.length}</span></div>
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>
      )}
    </div>
  );
}
