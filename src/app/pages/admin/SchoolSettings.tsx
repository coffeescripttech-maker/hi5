import React, { useState, useEffect } from "react";
import {
  Settings, Calendar, Layers, Save, CheckCircle,
  AlertTriangle, Info, Lock, Unlock, ChevronDown,
  GraduationCap, Star, Award, Shield, BookOpen, BookMarked
} from "lucide-react";
import { settingsApi, SectionTypeThreshold } from "../../services/settings";
import { schoolYearsApi } from "../../services/schoolYears";
import { useApp } from "../../context/AppContext";

const SECTION_META: Record<string, { icon: React.ReactNode; color: string; bgColor: string; borderColor: string; textColor: string; description: string; locked?: boolean }> = {
  star: {
    icon: <Star size={16} className="text-amber-500" fill="currentColor" />,
    color: "amber", bgColor: "bg-amber-50", borderColor: "border-amber-200",
    textColor: "text-amber-700",
    description: "Top performers — highest general average",
  },
  gold: {
    icon: <Award size={16} className="text-yellow-600" />,
    color: "yellow", bgColor: "bg-yellow-50", borderColor: "border-yellow-200",
    textColor: "text-yellow-700",
    description: "High achievers — above average performance",
  },
  silver: {
    icon: <Shield size={16} className="text-slate-500" />,
    color: "slate", bgColor: "bg-slate-50", borderColor: "border-slate-200",
    textColor: "text-slate-600",
    description: "Average performers — meeting grade standards",
  },
  regular: {
    icon: <BookOpen size={16} className="text-blue-500" />,
    color: "blue", bgColor: "bg-blue-50", borderColor: "border-blue-200",
    textColor: "text-blue-600",
    description: "Below average — needs additional academic support",
  },
  non_reader: {
    icon: <BookMarked size={16} className="text-red-500" />,
    color: "red", bgColor: "bg-red-50", borderColor: "border-red-200",
    textColor: "text-red-600",
    description: "Intervention needed — remedial literacy program",
    locked: true,
  },
};

const TYPE_ORDER = ["star", "gold", "silver", "regular", "non_reader"];
const SECTION_LABELS: Record<string, string> = {
  star: "Star Section", gold: "Gold Section", silver: "Silver Section",
  regular: "Regular Section", non_reader: "Non-Reader Section",
};

export function SchoolSettings() {
  const { showToast, refreshSchoolInfo } = useApp();
  const [thresholds, setThresholds] = useState<SectionTypeThreshold[]>([]);
  const [schoolYear, setSchoolYear] = useState("");
  const [enrollmentOpen, setEnrollmentOpen] = useState("");
  const [enrollmentClose, setEnrollmentClose] = useState("");
  const [enrollmentStatus, setEnrollmentStatus] = useState<"open" | "closed">("open");
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [region, setRegion] = useState("");
  const [division, setDivision] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      settingsApi.get(),
      schoolYearsApi.list(),
      settingsApi.getThresholds(),
    ]).then(([settings, sys, thresholdsData]) => {
      setSchoolName(settings.school_name);
      setSchoolId(settings.school_id);
      setRegion(settings.region);
      setDivision(settings.division);
      setThresholds(thresholdsData);
      const current = sys.find(sy => sy.is_current === 1);
      if (current) {
        setSchoolYear(current.sy_label);
        setEnrollmentOpen(current.enrollment_start_date || "");
        setEnrollmentClose(current.enrollment_end_date || "");
        setEnrollmentStatus(current.enrollment_open === 1 ? "open" : "closed");
      }
    }).catch(err => {
      showToast("error", "Failed to load settings: " + (err.detail?.error || err.message));
    }).finally(() => setLoading(false));
  }, []);

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleSaveSchoolInfo = async () => {
    setSaving(true);
    try {
      const updated = await settingsApi.update({
        school_name: schoolName,
        school_id: schoolId,
        region,
        division,
      });
      // Update local state from the server response so it reflects the persisted values
      setSchoolName(updated.school_name);
      setSchoolId(updated.school_id);
      setRegion(updated.region);
      setDivision(updated.division);
      // Refresh sidebar/header school name
      refreshSchoolInfo();
      showToast("success", "School information saved successfully.");
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSchoolYear = async () => {
    setSaving(true);
    try {
      const sys = await schoolYearsApi.list();
      const current = sys.find(sy => sy.is_current === 1);
      if (current) {
        const updated = await schoolYearsApi.update(current.id, {
          sy_label: schoolYear || undefined,
          enrollment_open: enrollmentStatus === "open" ? 1 : 0,
          enrollment_start_date: enrollmentOpen || undefined,
          enrollment_end_date: enrollmentClose || undefined,
        });
        // Refresh local state from server response
        setSchoolYear(updated.sy_label);
        setEnrollmentOpen(updated.enrollment_start_date || "");
        setEnrollmentClose(updated.enrollment_end_date || "");
        setEnrollmentStatus(updated.enrollment_open === 1 ? "open" : "closed");
        // Refresh sidebar/header school year label
        refreshSchoolInfo();
      }
      showToast("success", "School year & enrollment settings saved successfully.");
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveThresholds = async () => {
    setSaving(true);
    try {
      const updated = await settingsApi.updateThresholds({
        thresholds: thresholds
          .filter(t => t.section_type !== "non_reader")
          .map(t => ({ id: t.id, min_average: t.min_average, max_average: t.max_average })),
      });
      setThresholds(updated);
      showToast("success", "Auto-sectioning thresholds saved successfully.");
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to save thresholds");
    } finally {
      setSaving(false);
    }
  };

  const updateThreshold = (id: number, field: "min_average" | "max_average", value: number) => {
    setThresholds(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-400 text-sm">Loading settings...</div>;
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">
          <CheckCircle size={16} className="text-emerald-600" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Settings size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg">School Settings</h2>
            <p className="text-blue-200 text-sm">Configure school year, enrollment period, and academic thresholds</p>
          </div>
        </div>
      </div>

      {/* School Information */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <GraduationCap size={18} className="text-blue-600" />
          <div>
            <h3 className="font-semibold text-gray-800">School Information</h3>
            <p className="text-gray-400 text-xs">Basic school profile and DepEd registration details</p>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">School Name</label>
            <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">School ID (DepEd)</label>
            <input type="text" value={schoolId} onChange={e => setSchoolId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Region</label>
            <input type="text" value={region} onChange={e => setRegion(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Division</label>
            <input type="text" value={division} onChange={e => setDivision(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button onClick={handleSaveSchoolInfo} disabled={saving}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition shadow-sm">
            <Save size={15} /> Save School Info
          </button>
        </div>
      </div>

      {/* School Year Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <Calendar size={18} className="text-blue-600" />
          <div>
            <h3 className="font-semibold text-gray-800">School Year Configuration</h3>
            <p className="text-gray-400 text-xs">Set the active school year and enrollment period</p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Active School Year</label>
            <div className="flex gap-3 items-center flex-wrap">
              <input type="text" value={schoolYear} onChange={e => setSchoolYear(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
                placeholder="e.g. 2025-2026" />
              <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-blue-200">Currently Active</span>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-700">Enrollment Period</p>
                <p className="text-xs text-gray-400">Open and close dates for student enrollment</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEnrollmentStatus("open")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    enrollmentStatus === "open"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-gray-500 border-gray-200 hover:border-emerald-300"
                  }`}><Unlock size={12} /> Open</button>
                <button onClick={() => setEnrollmentStatus("closed")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    enrollmentStatus === "closed"
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-white text-gray-500 border-gray-200 hover:border-red-300"
                  }`}><Lock size={12} /> Closed</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Enrollment Opens</label>
                <input type="date" value={enrollmentOpen} onChange={e => setEnrollmentOpen(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Enrollment Closes</label>
                <input type="date" value={enrollmentClose} onChange={e => setEnrollmentClose(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className={`mt-3 flex items-start gap-2 p-3 rounded-xl border text-xs ${
              enrollmentStatus === "open"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}>
              {enrollmentStatus === "open" ? <Unlock size={13} className="mt-0.5 flex-shrink-0" /> : <Lock size={13} className="mt-0.5 flex-shrink-0" />}
              <span>Enrollment is currently <strong>{enrollmentStatus}</strong>.</span>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button onClick={handleSaveSchoolYear} disabled={saving}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition shadow-sm">
            <Save size={15} /> Save Year & Enrollment Settings
          </button>
        </div>
      </div>

      {/* Auto-Sectioning Grade Thresholds */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers size={18} className="text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-800">Auto-Sectioning Grade Thresholds</h3>
              <p className="text-gray-400 text-xs">Configure grade average ranges for automatic section assignment</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            <AlertTriangle size={13} className="text-amber-500" />
            <span className="text-xs text-amber-700 font-medium">Changes affect next auto-sectioning run</span>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
            <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Grade averages from the previous school year are used to automatically assign sections to returning students.
              Thresholds must not overlap and must cover the full range from 0 to 100.
            </p>
          </div>

          {TYPE_ORDER.map(sectionType => {
            const meta = SECTION_META[sectionType];
            // Get the row for the lowest grade level (used as the editable entry point)
            const t = thresholds
              .filter(th => th.section_type === sectionType)
              .sort((a, b) => a.grade_level - b.grade_level)[0];
            if (!t) return null;
            const displayName = SECTION_LABELS[sectionType] || sectionType;
            const isLocked = meta.locked;
            return (
            <div key={sectionType} className={`rounded-xl border ${meta.borderColor} ${meta.bgColor} overflow-hidden`}>
              <button onClick={() => setExpandedSection(expandedSection === sectionType ? null : sectionType)}
                className="w-full px-4 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border ${meta.borderColor}`}>{meta.icon}</div>
                  <div className="text-left">
                    <p className={`font-semibold text-sm ${meta.textColor}`}>{displayName}</p>
                    <p className="text-gray-500 text-xs">{meta.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold px-3 py-1 rounded-full bg-white border ${meta.borderColor} ${meta.textColor}`}>
                    {sectionType === "non_reader" ? `Below ${t.max_average + 1}` : t.max_average === 100 ? `${t.min_average} – 100` : `${t.min_average} – ${t.max_average}`}
                  </span>
                  {isLocked && <span className="flex items-center gap-1 text-xs text-gray-500 bg-white px-2 py-1 rounded-lg border border-gray-200"><Lock size={11} /> Fixed</span>}
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${expandedSection === sectionType ? "rotate-180" : ""}`} />
                </div>
              </button>
              {expandedSection === sectionType && (
                <div className="px-4 pb-4 border-t border-white/60 pt-4">
                  {isLocked ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/70 rounded-lg p-3 border border-gray-200">
                      <Lock size={13} className="text-gray-400" />
                      The Non-Reader threshold (below 75) is fixed per DepEd policy and cannot be customized.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Minimum Average</label>
                        <input type="number" min={0} max={100} value={t.min_average}
                          onChange={e => updateThreshold(t.id, "min_average", Number(e.target.value))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Maximum Average</label>
                        <input type="number" min={0} max={100} value={t.max_average ?? ""}
                          onChange={e => updateThreshold(t.id, "max_average", Number(e.target.value))}
                          disabled={t.max_average === 100}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-400" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400 flex items-center gap-1.5"><Info size={13} className="text-gray-400" />Thresholds apply to all Grade 7–12 sections upon next auto-sectioning run.</p>
          <button onClick={handleSaveThresholds} disabled={saving}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition shadow-sm">
            <Save size={15} /> Save Thresholds
          </button>
        </div>
      </div>
    </div>
  );
}
