import { useState, useEffect } from "react";
import { Upload, Download, Loader2, FileSpreadsheet, GraduationCap, Users, Info, ExternalLink, FileText } from "lucide-react";
import { lisApi } from "../services/lis";
import { exportLisPdf } from "../services/lisPdf";
import { schoolYearsApi, SchoolYearRow } from "../services/schoolYears";
import { useApp } from "../context/AppContext";

interface CardDef {
  key: string;
  icon: typeof Upload;
  title: string;
  desc: string;
  filename: string;
  downloadXlsx: (params: any) => Promise<void>;
  downloadCsv: (params: any) => Promise<void>;
}

const CARDS: CardDef[] = [
  {
    key: "learner-profile",
    icon: FileSpreadsheet,
    title: "Learner Profile",
    desc: "Student personal data including LRN, birthdate, address, guardian, and contact information.",
    filename: "lis-learner-profile",
    downloadXlsx: p => lisApi.downloadLearnerProfileXlsx(p),
    downloadCsv: p => lisApi.downloadLearnerProfile(p),
  },
  {
    key: "grades",
    icon: GraduationCap,
    title: "Grade Summary",
    desc: "Per-subject quarterly grades with computed general average and promotion status.",
    filename: "lis-grades",
    downloadXlsx: p => lisApi.downloadGradesXlsx(p),
    downloadCsv: p => lisApi.downloadGrades(p),
  },
  {
    key: "enrolled-list",
    icon: Users,
    title: "Enrolled List",
    desc: "Currently enrolled students with program/track, guardian, 4Ps/PWD classifications, and enrollment date.",
    filename: "lis-enrolled-list",
    downloadXlsx: p => lisApi.downloadEnrolledListXlsx(p),
    downloadCsv: p => lisApi.downloadEnrolledList(p),
  },
];

export function LisExportPanel({ accent = "from-indigo-500 via-indigo-600 to-blue-500" }: { accent?: string }) {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [schoolYears, setSchoolYears] = useState<SchoolYearRow[]>([]);
  const [selectedSY, setSelectedSY] = useState<number | undefined>(undefined);
  const [selectedGrade, setSelectedGrade] = useState<string>("");

  useEffect(() => {
    schoolYearsApi
      .list()
      .then(sys => {
        setSchoolYears(sys);
        const current = sys.find(sy => sy.is_current === 1);
        if (current) setSelectedSY(current.id);
      })
      .catch(err => showToast("error", "Failed to load school years: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, []);

  const params = () => ({
    school_year_id: selectedSY,
    grade_level: selectedGrade ? parseInt(selectedGrade) : undefined,
  });

  const runAction = async (key: string, label: string, action: () => Promise<void>) => {
    setDownloading(key);
    try {
      await action();
      showToast("success", `${label} downloaded.`);
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Download failed.");
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto px-3 sm:px-0">
      {/* ── Header + filters ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className={"h-1.5 bg-gradient-to-r " + accent} />
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-200 flex items-center justify-center flex-shrink-0">
              <Upload size={22} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-lg">LIS Export</h2>
              <p className="text-gray-500 text-sm">
                DepEd Learner Information System — official Excel, PDF & CSV exports
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 px-5 sm:px-6 pb-5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">School Year</span>
            <select
              value={selectedSY ?? ""}
              onChange={e => setSelectedSY(e.target.value ? parseInt(e.target.value) : undefined)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            >
              <option value="">Select SY</option>
              {schoolYears.map(sy => (
                <option key={sy.id} value={sy.id}>
                  {sy.sy_label}
                  {sy.is_current === 1 ? " (Current)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Grade Level</span>
            <select
              value={selectedGrade}
              onChange={e => setSelectedGrade(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            >
              <option value="">All Grades</option>
              {[7, 8, 9, 10, 11, 12].map(g => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {/* ── Export cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {CARDS.map(card => {
          const isBusy = downloading === card.key || downloading === card.key + "-pdf" || downloading === card.key + "-csv";
          return (
            <div key={card.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
              <div className="p-5">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
                  <card.icon size={18} className="text-blue-700" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-1">{card.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed mb-4">{card.desc}</p>
                <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-4">
                  <FileSpreadsheet size={12} />
                  <span>Excel · PDF · CSV</span>
                </div>
                {/* Official Excel workbook (primary) */}
                <button
                  onClick={() => runAction(card.key, `${card.title} Excel`, () => card.downloadXlsx(params()))}
                  disabled={isBusy}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all"
                >
                  {downloading === card.key ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  {downloading === card.key ? "Downloading..." : "Download Excel"}
                </button>
                {/* Official PDF + legacy CSV */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    onClick={() => runAction(card.key + "-pdf", `${card.title} PDF`, () => exportLisPdf(card.key as any, params(), card.filename))}
                    disabled={isBusy}
                    className="flex items-center justify-center gap-1.5 bg-white hover:bg-gray-50 disabled:opacity-50 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                  >
                    <FileText size={13} className="text-red-500" />
                    Official PDF
                  </button>
                  <button
                    onClick={() => runAction(card.key + "-csv", `${card.title} CSV`, () => card.downloadCsv(params()))}
                    disabled={isBusy}
                    className="flex items-center justify-center gap-1.5 bg-white hover:bg-gray-50 disabled:opacity-50 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                  >
                    <Download size={13} className="text-gray-400" />
                    CSV
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Info banner ── */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex items-start gap-3">
        <Info size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800 mb-1">DepEd LIS Submission</p>
          <p className="text-xs text-blue-600 leading-relaxed">
            <strong>Excel</strong> gives a formatted workbook with auto-sized columns; <strong>Official PDF</strong> renders a
            DepEd letterhead document (logos, borders, signatures) ready for printing. For direct upload to the{" "}
            <strong>DepEd Learner Information System (LIS)</strong> portal at{" "}
            <a href="https://lis.deped.gov.ph" target="_blank" rel="noopener noreferrer" className="underline font-semibold inline-flex items-center gap-0.5">
              lis.deped.gov.ph <ExternalLink size={10} />
            </a>
            , use the <strong>CSV</strong> format (UTF-8 with BOM).
          </p>
        </div>
      </div>
    </div>
  );
}