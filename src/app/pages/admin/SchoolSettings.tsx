import React, { useState, useEffect } from "react";
import {
  Settings, Calendar, Layers, Save,
  AlertTriangle, Info, Lock, Unlock, ChevronDown,
  GraduationCap, Building2, Hash, MapPin, Globe, CalendarDays,
  UserCheck, FileText
} from "lucide-react";
import { settingsApi, SectionTypeThreshold } from "../../services/settings";
import { sectionTypesApi, SectionType } from "../../services/sectionTypes";
import { schoolYearsApi } from "../../services/schoolYears";
import { useApp } from "../../context/AppContext";

export function SchoolSettings() {
  const { showToast, refreshSchoolInfo } = useApp();
  const [thresholds, setThresholds] = useState<SectionTypeThreshold[]>([]);
  const [schoolYear, setSchoolYear] = useState("");
  const [enrollmentOpen, setEnrollmentOpen] = useState("");
  const [enrollmentClose, setEnrollmentClose] = useState("");
  const [enrollmentStatus, setEnrollmentStatus] = useState<"open" | "closed">("open");
  const [saving, setSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [region, setRegion] = useState("");
  const [division, setDivision] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [registrarName, setRegistrarName] = useState("");
  const [loading, setLoading] = useState(true);
  const [sectionTypes, setSectionTypes] = useState<SectionType[]>([]);

  useEffect(() => {
    Promise.all([
      settingsApi.get(),
      schoolYearsApi.list(),
      settingsApi.getThresholds(),
      sectionTypesApi.list(),
    ]).then(([settings, sys, thresholdsData, types]) => {
      setSectionTypes(types);
      setSchoolName(settings.school_name);
      setSchoolId(settings.school_id);
      setRegion(settings.region);
      setDivision(settings.division);
      setPrincipalName(settings.principal_name || "");
      setRegistrarName(settings.registrar_name || "");
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

  const handleSaveSchoolInfo = async () => {
    setSaving(true);
    try {
      const updated = await settingsApi.update({
        school_name: schoolName,
        school_id: schoolId,
        region,
        division,
        principal_name: principalName,
        registrar_name: registrarName,
      });
      // Update local state from the server response so it reflects the persisted values
      setSchoolName(updated.school_name);
      setSchoolId(updated.school_id);
      setRegion(updated.region);
      setDivision(updated.division);
      setPrincipalName(updated.principal_name || "");
      setRegistrarName(updated.registrar_name || "");
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
      const lockedTypes = sectionTypes.filter(t => t.is_locked).map(t => t.name);
      const updated = await settingsApi.updateThresholds({
        thresholds: thresholds
          .filter(t => !lockedTypes.includes(t.section_type))
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
    return (
      <div className="space-y-5 max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-400" />
          <div className="p-5 sm:p-6">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
              <svg className="animate-spin w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm font-medium text-center">Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  const inputClass = "w-full pl-9 pr-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400 border border-gray-200 bg-white";

  const sectionFooter = (onSave: () => void, label: string, children?: React.ReactNode) => (
    <div className="px-5 sm:px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
      {children}
      <button onClick={onSave} disabled={saving}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all">
        <Save size={15} /> {label}
      </button>
    </div>
  );

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-200 flex items-center justify-center flex-shrink-0">
            <Settings size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">School Settings</h2>
            <p className="text-gray-500 text-sm">Configure school year, enrollment period, and academic thresholds</p>
          </div>
        </div>
      </div>

      {/* School Information */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <GraduationCap size={16} className="text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">School Information</h3>
            <p className="text-xs text-gray-400">Basic school profile and DepEd registration details</p>
          </div>
        </div>
        <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em] mb-1.5">School Name</label>
            <div className="relative">
              <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)} className={inputClass} placeholder="e.g. Datu Paglas Memorial NHS" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em] mb-1.5">School ID (DepEd)</label>
            <div className="relative">
              <Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={schoolId} onChange={e => setSchoolId(e.target.value)} className={inputClass} placeholder="e.g. 305123" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em] mb-1.5">Region</label>
            <div className="relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={region} onChange={e => setRegion(e.target.value)} className={inputClass} placeholder="e.g. Region XII" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em] mb-1.5">Division</label>
            <div className="relative">
              <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={division} onChange={e => setDivision(e.target.value)} className={inputClass} placeholder="e.g. Maguindanao Division" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em] mb-1.5">School Principal</label>
            <div className="relative">
              <UserCheck size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={principalName} onChange={e => setPrincipalName(e.target.value)} className={inputClass} placeholder="e.g. Dr. Rosario B. Villanueva" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em] mb-1.5">Registrar</label>
            <div className="relative">
              <FileText size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={registrarName} onChange={e => setRegistrarName(e.target.value)} className={inputClass} placeholder="e.g. Ms. Carla Reyes" />
            </div>
          </div>
        </div>
        {sectionFooter(handleSaveSchoolInfo, "Save School Info")}
      </div>

      {/* School Year Configuration */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <Calendar size={16} className="text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">School Year Configuration</h3>
            <p className="text-xs text-gray-400">Set the active school year and enrollment period</p>
          </div>
        </div>
        <div className="p-5 sm:p-6 space-y-5">
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em] mb-1.5">Active School Year</label>
            <div className="flex gap-3 items-center flex-wrap">
              <div className="relative">
                <CalendarDays size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={schoolYear} onChange={e => setSchoolYear(e.target.value)}
                  className={`${inputClass} w-44`} placeholder="e.g. 2025-2026" />
              </div>
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-200">Currently Active</span>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
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
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em] mb-1.5">Enrollment Opens</label>
                <div className="relative">
                  <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="date" value={enrollmentOpen} onChange={e => setEnrollmentOpen(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em] mb-1.5">Enrollment Closes</label>
                <div className="relative">
                  <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="date" value={enrollmentClose} onChange={e => setEnrollmentClose(e.target.value)} className={inputClass} />
                </div>
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
        {sectionFooter(handleSaveSchoolYear, "Save Year & Enrollment Settings")}
      </div>

      {/* Auto-Sectioning Grade Thresholds */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Layers size={16} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Auto-Sectioning Grade Thresholds</h3>
              <p className="text-xs text-gray-400">Configure grade average ranges for automatic section assignment</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex-shrink-0">
            <AlertTriangle size={13} className="text-amber-500" />
            <span className="text-xs text-amber-700 font-medium">Changes affect next auto-sectioning run</span>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-3">
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
            <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Grade averages from the previous school year are used to automatically assign sections to returning students.
              Thresholds must not overlap and must cover the full range from 0 to 100.
            </p>
          </div>

          {sectionTypes.filter(t => t.is_active).sort((a, b) => a.sort_order - b.sort_order).map(sectionType => {
            const displayName = sectionType.label || sectionType.name;
            const description = `Section type with sort order ${sectionType.sort_order}`;
            const isLocked = sectionType.is_locked === 1;
            // Color class helpers: parse color_code or use defaults
            const colorCode = sectionType.color_code || "";
            const bgColor = colorCode ? `bg-${colorCode.split(" ")[0]?.replace("bg-", "") || "gray"}-50` : "bg-gray-50";
            const borderColor = colorCode ? `border-${colorCode.split(" ")[2]?.replace("border-", "") || "gray"}-200` : "border-gray-200";
            const textColor = colorCode ? `text-${colorCode.split("text-")[1]?.split(" ")[0] || "gray"}-700` : "text-gray-700";
            // Get the row for the lowest grade level (used as the editable entry point)
            const t = thresholds
              .filter(th => th.section_type === sectionType.name)
              .sort((a, b) => a.grade_level - b.grade_level)[0];

            if (!t) {
              return (
                <div key={sectionType.name} className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 overflow-hidden">
                  <div className="px-4 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-gray-200">
                        <span className="text-sm">{sectionType.icon || sectionType.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-sm text-gray-500">{displayName}</p>
                        <p className="text-gray-400 text-xs">No thresholds configured</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">—</span>
                  </div>
                </div>
              );
            }

            return (
            <div key={sectionType.name} className={`rounded-xl border ${borderColor} ${bgColor} overflow-hidden`}>
              <button onClick={() => setExpandedSection(expandedSection === sectionType.name ? null : sectionType.name)}
                className="w-full px-4 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border ${borderColor}`}>
                    <span className="text-sm">{sectionType.icon || sectionType.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="text-left">
                    <p className={`font-semibold text-sm ${textColor}`}>{displayName}</p>
                    <p className="text-gray-500 text-xs">{description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold px-3 py-1 rounded-full bg-white border ${borderColor} ${textColor}`}>
                    {t.max_average === 100 ? `${t.min_average} – 100` : `${t.min_average} – ${t.max_average}`}
                  </span>
                  {isLocked && <span className="flex items-center gap-1 text-xs text-gray-500 bg-white px-2 py-1 rounded-lg border border-gray-200"><Lock size={11} /> Fixed</span>}
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${expandedSection === sectionType.name ? "rotate-180" : ""}`} />
                </div>
              </button>
              {expandedSection === sectionType.name && (
                <div className="px-4 pb-4 border-t border-white/60 pt-4">
                  {isLocked ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/70 rounded-lg p-3 border border-gray-200">
                      <Lock size={13} className="text-gray-400" />
                      This section type is locked and cannot be customized.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em] mb-1.5">Minimum Average</label>
                        <input type="number" min={0} max={100} value={t.min_average}
                          onChange={e => updateThreshold(t.id, "min_average", Number(e.target.value))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400 bg-white" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em] mb-1.5">Maximum Average</label>
                        <input type="number" min={0} max={100} value={t.max_average ?? ""}
                          onChange={e => updateThreshold(t.id, "max_average", Number(e.target.value))}
                          disabled={t.max_average === 100}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400 bg-white disabled:bg-gray-100 disabled:text-gray-400" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
        {sectionFooter(handleSaveThresholds, "Save Thresholds",
          <p className="text-xs text-gray-400 flex items-center gap-1.5 mr-auto"><Info size={13} className="text-gray-400" />Thresholds apply to all Grade 7–12 sections upon next auto-sectioning run.</p>
        )}
      </div>
    </div>
  );
}
