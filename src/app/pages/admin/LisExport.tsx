import { useState, useEffect } from "react";
import { Upload, Download, Loader2, FileSpreadsheet, GraduationCap, Users, Info, ChevronRight, ExternalLink } from "lucide-react";
import { lisApi } from "../../services/lis";
import { schoolYearsApi, SchoolYearRow } from "../../services/schoolYears";
import { useApp } from "../../context/AppContext";

interface CardDef {
  key: string;
  icon: typeof Upload;
  title: string;
  desc: string;
  filename: string;
  download: (params: any) => Promise<void>;
}

const CARDS: CardDef[] = [
  {
    key: "learner-profile",
    icon: FileSpreadsheet,
    title: "Learner Profile",
    desc: "Student personal data including LRN, birthdate, address, guardian, and contact information.",
    filename: "lis-learner-profile",
    download: (p) => lisApi.downloadLearnerProfile(p),
  },
  {
    key: "grades",
    icon: GraduationCap,
    title: "Grade Summary",
    desc: "Per-subject quarterly grades with computed general average and promotion status.",
    filename: "lis-grades",
    download: (p) => lisApi.downloadGrades(p),
  },
  {
    key: "enrolled-list",
    icon: Users,
    title: "Enrolled List",
    desc: "Currently enrolled students with program/track, guardian, 4Ps/PWD classifications, and enrollment date.",
    filename: "lis-enrolled-list",
    download: (p) => lisApi.downloadEnrolledList(p),
  },
];

export function LisExport() {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [schoolYears, setSchoolYears] = useState<SchoolYearRow[]>([]);
  const [selectedSY, setSelectedSY] = useState<number | undefined>(undefined);
  const [selectedGrade, setSelectedGrade] = useState<string>("");

  useEffect(() => {
    schoolYearsApi.list()
      .then(sys => {
        setSchoolYears(sys);
        const current = sys.find(sy => sy.is_current === 1);
        if (current) setSelectedSY(current.id);
      })
      .catch(err => showToast("error", "Failed to load school years: " + (err.detail?.error || err.message)))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (card: CardDef) => {
    setDownloading(card.key);
    try {
      await card.download({
        school_year_id: selectedSY,
        grade_level: selectedGrade ? parseInt(selectedGrade) : undefined,
      });
      showToast("success", `${card.title} CSV downloaded.`);
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
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400" />
        <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-200 flex items-center justify-center flex-shrink-0">
              <Upload size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">LIS Export / CSV Downloads</h2>
              <p className="text-gray-500 text-sm">
                Generate CSV files for submission to the DepEd Learner Information System (LIS)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">School Year</span>
            <select
              value={selectedSY || ""}
              onChange={e => setSelectedSY(e.target.value ? parseInt(e.target.value) : undefined)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            >
              {schoolYears.map(sy => (
                <option key={sy.id} value={sy.id}>
                  {sy.sy_label}{sy.is_current ? " (Current)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Grade Level</span>
            <select
              value={selectedGrade}
              onChange={e => setSelectedGrade(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            >
              <option value="">All Grades</option>
              {[7, 8, 9, 10, 11, 12].map(g => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Export Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {CARDS.map(card => {
          const isDownloading = downloading === card.key;
          return (
            <div
              key={card.key}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all"
            >
              <div className="p-5">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center mb-4">
                  <card.icon size={18} className="text-indigo-700" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-1">{card.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed mb-4">{card.desc}</p>
                <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-4">
                  <FileSpreadsheet size={12} />
                  <span>CSV format · UTF-8 with BOM</span>
                </div>
                <button
                  onClick={() => handleDownload(card)}
                  disabled={isDownloading}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all"
                >
                  {isDownloading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Download size={15} />
                  )}
                  {isDownloading ? "Downloading..." : "Download CSV"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Info Banner ── */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex items-start gap-3">
        <Info size={18} className="text-indigo-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-indigo-800 mb-1">DepEd LIS Submission</p>
          <p className="text-xs text-indigo-600 leading-relaxed">
            Download these CSV files and upload them to the{" "}
            <strong>DepEd Learner Information System (LIS)</strong> portal at{" "}
            <a
              href="https://lis.deped.gov.ph"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold inline-flex items-center gap-0.5"
            >
              lis.deped.gov.ph <ExternalLink size={10} />
            </a>
            . Files are formatted for Excel compatibility with UTF-8 BOM encoding.
          </p>
        </div>
      </div>
    </div>
  );
}
