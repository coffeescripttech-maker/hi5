/**
 * LIS Import — Registrar/Administrator only.
 * Client revision: Hi5_Portal_LIS_Import_Expected_Behavior.md.
 *
 * Flow: choose file + school year → preview (auto column mapping, nothing
 * saved) → per-group Fill-empty-only / Overwrite toggles → Confirm → one
 * transaction on the server → result summary with downloadable report.
 */
import { useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useRoleAccent } from "../../utils/roleTheme";
import { schoolYearsApi, SchoolYearRow } from "../../services/schoolYears";
import { lisImportApi } from "../../services/lisImport";
import { Upload as UploadIcon } from "lucide-react";

interface MappingEntry {
  field: string;
  header: string;
  index: number;
}

interface ImportRow {
  rowNum: number;
  lrn: string;
  name: string;
  result: "matched_update" | "matched_no_change" | "mismatch" | "not_in_hi5" | "error";
  error?: string;
  mismatches?: string[];
  hi5_name?: string;
  changes?: { field: string; old: string; new: string; group: string; savedEdit: boolean }[];
  has_saved_sf_edit?: boolean;
}

const RESULT_META: Record<ImportRow["result"], { label: string; cls: string }> = {
  matched_update: { label: "Will update", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  matched_no_change: { label: "No change", cls: "bg-gray-50 text-gray-500 border-gray-200" },
  mismatch: { label: "Mismatch", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  not_in_hi5: { label: "Not in Hi5", cls: "bg-blue-50 text-blue-600 border-blue-200" },
  error: { label: "Error", cls: "bg-red-50 text-red-600 border-red-200" }
};

const GROUP_LABELS: Record<string, string> = {
  personal: "Mother tongue / IP / Religion",
  address: "Address parts",
  guardian: "Parents / Guardian / Contact"
};

export function LisImport() {
  const { showToast, schoolYearLabel } = useApp();
  const accent = useRoleAccent();
  const [years, setYears] = useState<SchoolYearRow[]>([]);
  const [syId, setSyId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [mapping, setMapping] = useState<MappingEntry[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [applied, setApplied] = useState<number | null>(null);
  const [appliedBatch, setAppliedBatch] = useState<string | null>(null);
  const [modes, setModes] = useState<Record<string, string>>({});
  const [stage, setStage] = useState<"idle" | "preview" | "done">("idle");

  // school years load
  useEffect(() => {
    schoolYearsApi.list().then(list => {
      setYears(list);
      const cur = list.find(y => y.is_current === 1);
      setSyId(cur ? cur.id : (list[0]?.id ?? null));
    }).catch(() => {});
  }, []);

  const buildFormData = (): FormData | null => {
    if (!file || !syId) {
      showToast("error", "Choose a file and a school year first.");
      return null;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("school_year_id", String(syId));
    if (mapping.length > 0) {
      fd.append("mapping", JSON.stringify(Object.fromEntries(mapping.filter(m => m.index >= 0).map(m => [m.field, m.index]))));
    }
    return fd;
  };

  const handlePreview = async () => {
    const fd = buildFormData();
    if (!fd) return;
    setPreviewing(true);
    setApplied(null);
    setAppliedBatch(null);
    try {
      const resp = await lisImportApi.preview(fd);
      setMapping(Object.entries(resp.mapping).map(([field, index]) => ({
        field,
        header: resp.header_texts[index] ?? `Column ${index + 1}`,
        index
      })));
      setHeaders(resp.header_texts);
      setCounts({ ...resp.counts });
      setRows(resp.rows);
      // default modes: fill-empty-only
      const groups = new Set<string>();
      for (const m of Object.entries(resp.mapping)) groups.add(groupOf(m[0]));
      const initial: Record<string, string> = {};
      groups.forEach(g => (initial[g] = "fill"));
      setModes(initial);
      setStage("preview");
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Preview failed.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleApply = async () => {
    const fd = buildFormData();
    if (!fd) return;
    // carry the (possibly adjusted) mapping + modes
    if (mapping.length > 0) {
      fd.append("modes", JSON.stringify(modes));
    }
    setApplying(true);
    try {
      const resp = await lisImportApi.apply(fd);
      setCounts({ ...resp.counts });
      setRows(resp.rows);
      setApplied(resp.applied);
      setAppliedBatch(resp.batch_id ?? null);
      setStage("done");
      showToast("success", resp.message);
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Import failed.");
    } finally {
      setApplying(false);
    }
  };

  const downloadReport = () => {
    const lines = [
      "Row,LRN,Name,Result,Details",
      ...rows.map(r =>
        [
          r.rowNum,
          r.lrn,
          `"${(r.name || "").replace(/"/g, '""')}"`,
          r.result,
          `"${(
            (r.error ? r.error + " " : "") +
            (r.mismatches ? r.mismatches.join("; ") + " " : "") +
            ((r.changes || []).map(c => `${c.field}: ${c.old} -> ${c.new}`).join("; "))
          ).replace(/"/g, '""')}"`
        ].join(",")
      )
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lis-import-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const reset = () => {
    setStage("idle");
    setFile(null);
    setRows([]);
    setCounts(null);
    setMapping([]);
    setApplied(null);
    setAppliedBatch(null);
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-10 px-3 sm:px-0">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-blue-500" />
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accent.tile} shadow-lg ${accent.tileShadow} flex items-center justify-center flex-shrink-0`}>
              <FileSpreadsheet size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">
                Import from LIS
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Fill learner details from a DepEd LIS file — matched by LRN.
                Identity fields are compared, never overwritten. Existing
                learners only; nothing is created.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Step 1: file + SY */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 space-y-4">
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.05em]">
          1 · Choose the file and school year
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em]">
              LIS file (.xlsx / .xls / .csv, up to 10 MB)
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={e => {
                setFile(e.target.files?.[0] ?? null);
                setStage("idle");
                setRows([]);
              }}
              className="w-full text-sm text-gray-600 file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-indigo-50 file:text-indigo-700 file:text-xs file:font-semibold hover:file:bg-indigo-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em]">
              School year (for saved-edit checks)
            </span>
            <select
              value={syId ?? ""}
              onChange={e => setSyId(parseInt(e.target.value) || null)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
              {years.map(y => (
                <option key={y.id} value={y.id}>
                  {y.sy_label}
                  {y.is_current === 1 ? " (Current)" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              onClick={handlePreview}
              disabled={previewing || !file || !syId}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 shadow-sm">
              {previewing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              Preview Import
            </button>
          </div>
        </div>
        <p className="text-[11px] text-gray-400">
          The file is read in memory and never stored. Nothing is saved until
          you press Confirm. Importing the same file twice is safe.
        </p>
      </div>

      {/* Step 2: mapping */}
      {stage !== "idle" && mapping.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 space-y-3">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.05em]">
            2 · Column mapping (auto-detected)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {mapping.map((m, i) => (
              <div key={m.field} className="flex items-center justify-between gap-2 border border-gray-100 rounded-xl px-3 py-2 bg-gray-50/60">
                <span className="font-semibold text-gray-700">{m.field.replace(/_/g, " ")}</span>
                <span className="text-gray-400">←</span>
                <span className="text-indigo-700 font-medium truncate max-w-40">{m.header}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400">
            Mapping is automatic from known LIS headers; unmatched columns are ignored. School year: {schoolYearLabel || "—"}.
          </p>
        </div>
      )}

      {/* Modes */}
      {stage === "preview" && counts && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 space-y-3">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.05em]">
            3 · Choose how each group is applied
          </p>
          {Object.keys(GROUP_LABELS).map(g => (
            <div key={g} className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl px-4 py-2.5">
              <span className="text-sm text-gray-700 font-medium">{GROUP_LABELS[g]}</span>
              <div className="flex gap-2">
                {["fill", "overwrite"].map(mode => (
                  <button
                    key={mode}
                    onClick={() => setModes(m => ({ ...m, [g]: mode }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      (modes[g] || "fill") === mode
                        ? mode === "fill"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                    }`}>
                    {mode === "fill" ? "Fill empty only" : "Overwrite"}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-gray-400">
              Fill empty only (default) never touches a value the school already has.
            </p>
            <button
              onClick={handleApply}
              disabled={applying || (counts?.matched_update ?? 0) === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50 shadow-sm">
              {applying ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Confirm Import {(counts?.matched_update ?? 0) > 0 ? `(${counts.matched_update} learners)` : ""}
            </button>
          </div>
        </div>
      )}

      {/* Result summary */}
      {counts && (stage === "preview" || stage === "done") && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.05em]">
              {stage === "done" ? "Import result" : "Preview result"}
            </p>
            <button
              onClick={downloadReport}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200">
              <Download size={12} /> Download report
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="border border-emerald-200 bg-emerald-50/70 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-emerald-700">{counts.matched_update}</p>
              <p className="text-[10px] text-emerald-600 font-semibold uppercase">Will update</p>
            </div>
            <div className="border border-gray-200 bg-gray-50/70 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-gray-500">{counts.matched_no_change}</p>
              <p className="text-[10px] text-gray-400 font-semibold uppercase">No change</p>
            </div>
            <div className="border border-amber-200 bg-amber-50/70 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-amber-700">{counts.mismatch}</p>
              <p className="text-[10px] text-amber-600 font-semibold uppercase">Mismatch</p>
            </div>
            <div className="border border-blue-200 bg-blue-50/70 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-blue-600">{counts.not_in_hi5}</p>
              <p className="text-[10px] text-blue-500 font-semibold uppercase">Not in Hi5</p>
            </div>
            <div className="border border-red-200 bg-red-50/70 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-red-600">{counts.error}</p>
              <p className="text-[10px] text-red-500 font-semibold uppercase">Error</p>
            </div>
          </div>

          {/* rows */}
          <div className="rounded-xl border border-gray-100 overflow-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-gray-500 font-semibold uppercase text-[10px]">Row</th>
                  <th className="px-3 py-2 text-gray-500 font-semibold uppercase text-[10px]">LRN</th>
                  <th className="px-3 py-2 text-gray-500 font-semibold uppercase text-[10px]">Name</th>
                  <th className="px-3 py-2 text-gray-500 font-semibold uppercase text-[10px]">Result</th>
                  <th className="px-3 py-2 text-gray-500 font-semibold uppercase text-[10px]">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                    <td className="px-3 py-2 text-gray-400">{r.rowNum}</td>
                    <td className="px-3 py-2 font-mono text-gray-600">{r.lrn || "—"}</td>
                    <td className="px-3 py-2 text-gray-700">{r.name || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${RESULT_META[r.result].cls}`}>
                        {RESULT_META[r.result].label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {r.error && <span className="text-red-600">{r.error}</span>}
                      {r.mismatches && <span className="text-amber-700">{r.mismatches.join(" · ")}</span>}
                      {(r.changes || []).map(c => (
                        <div key={c.field} className="text-[11px]">
                          {c.field.replace(/_/g, " ")}: {c.old ? `"${c.old}"` : "(empty)"} → {c.new}
                          {c.savedEdit && (
                            <span className="ml-1 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1 rounded">
                              saved edit kept
                            </span>
                          )}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* done banner */}
      {stage === "done" && applied != null && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <CheckCircle2 size={18} className="text-emerald-600 mt-0.5" />
          <div className="text-sm text-emerald-800">
            <p className="font-semibold">
              Import complete — {applied} field{applied !== 1 ? "s" : ""} updated.
            </p>
            <p className="text-xs mt-1">
              Batch {appliedBatch?.slice(0, 8)}… — every changed value is recorded in the learner change history. Re-importing the same file will report no changes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function groupOf(field: string): string {
  if (["mother_tongue", "ip_ethnic_group", "religion"].includes(field)) return "personal";
  if (["house_street", "barangay", "city_municipality", "province", "zip_code"].includes(field)) return "address";
  return "guardian";
}
